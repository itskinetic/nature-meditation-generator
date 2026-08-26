import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from typing import Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import GenerationJob, VideoLibraryItem
from backend.app.schemas import GenerationRequest, CandidateItem
from backend.app.services.intent_service import intent_service
from backend.app.services.library_service import library_service
from backend.app.services.ffmpeg_service import ffmpeg_service
from backend.app.presets.nature_presets import NATURE_PRESETS, NATURE_ENVIRONMENTS

logger = logging.getLogger(__name__)

MAX_CONCURRENT_RENDERS = 2


class QueueService:
    def __init__(self):
        self.render_semaphore = asyncio.Semaphore(MAX_CONCURRENT_RENDERS)
        self.job_tasks: Dict[str, asyncio.Task] = {}
        self.download_tasks: Dict[str, asyncio.Task] = {}

    def submit_job(self, job_id: str, req: GenerationRequest) -> None:
        """Dispatches job to the background pre-download and render pipeline."""
        task = asyncio.create_task(self._process_job_pipeline(job_id, req))
        self.job_tasks[job_id] = task

    def cancel_job(self, job_id: str) -> bool:
        """Cancels a queued or rendering job."""
        if job_id in self.job_tasks:
            self.job_tasks[job_id].cancel()
            del self.job_tasks[job_id]

        db = SessionLocal()
        try:
            job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
            if job and job.status not in ["completed", "failed"]:
                job.status = "cancelled"
                job.current_stage = "Job cancelled by user"
                db.commit()
                return True
        finally:
            db.close()
        return False

    def get_active_jobs(self, db: Session) -> List[dict]:
        """Returns all currently queued, downloading, or rendering jobs."""
        active_statuses = ["pending", "queued", "analyzing", "downloading", "evaluating", "rendering", "stitching"]
        jobs = db.query(GenerationJob).filter(GenerationJob.status.in_(active_statuses)).order_by(GenerationJob.created_at.desc()).all()
        
        result = []
        for j in jobs:
            result.append({
                "id": j.id,
                "title": j.title or "Untitled Meditation",
                "status": j.status,
                "progress": j.progress or 0,
                "current_stage": j.current_stage or "In Queue",
                "target_duration_seconds": j.target_duration_seconds or 0,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            })
        return result

    async def _process_job_pipeline(self, job_id: str, req: GenerationRequest) -> None:
        """2-Stage async pipeline: Pre-Download clips immediately, then acquire render slot."""
        db = SessionLocal()
        job_dir = settings.JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        def update_db(status: str, progress: int, stage: str, **kwargs):
            try:
                j = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
                if j:
                    j.status = status
                    j.progress = progress
                    j.current_stage = stage
                    for k, v in kwargs.items():
                        setattr(j, k, v)
                    db.commit()
            except Exception as ex:
                logger.error(f"Error updating job {job_id}: {ex}")

        try:
            update_db("analyzing", 5, "Analyzing meditation intent & selected themes")

            # 1. Resolve candidates from review pool or search
            approved_pool: List[CandidateItem] = []
            if req.candidate_pool and len(req.candidate_pool) > 0:
                if req.selected_candidate_ids:
                    sel_ids = set(req.selected_candidate_ids)
                    approved_pool = [c for c in req.candidate_pool if c.source_video_id in sel_ids]
                else:
                    approved_pool = [c for c in req.candidate_pool if c.is_approved]
            
            if not approved_pool:
                # If no pre-selected pool, analyze and find
                analysis = await intent_service.analyze(
                    title=req.title,
                    script=req.script,
                    manual_intent=req.manual_intent,
                    manual_mood=req.manual_mood,
                    preset_name=req.preset
                )
                from backend.app.services.candidate_service import candidate_service
                preset_schema = NATURE_PRESETS.get(req.preset) or list(NATURE_PRESETS.values())[0]
                search_res = await candidate_service.find_and_evaluate_candidates(
                    analysis=analysis,
                    preset=preset_schema,
                    db=db,
                    allow_reuse=req.allow_reuse,
                    avoid_recently_used=req.avoid_recently_used,
                    max_results=req.maximum_unique_videos
                )
                approved_pool = search_res.approved_candidates

            if not approved_pool:
                raise RuntimeError("No approved candidate footage available for render.")

            # 2. Pre-Download Selected High-Res Video Clips in Background (Phase 1)
            update_db("downloading", 15, f"Pre-downloading {len(approved_pool)} high-res clips to VPS")
            downloaded_files = await self._pre_download_clips(approved_pool, job_dir, job_id, update_db)

            if not downloaded_files:
                raise RuntimeError("Failed to download required video clips.")

            # 3. Wait for Rendering Slot (Phase 2: Up to 2 concurrent FFmpeg renders)
            update_db("queued", 35, "Clips ready on disk • Waiting for render slot")
            
            async with self.render_semaphore:
                update_db("rendering", 40, "Render slot acquired • Initializing video synthesis")

                # Sequence layout & repeats
                target_dur = req.target_duration
                if req.duration_unit == "hours":
                    target_dur_sec = target_dur * 3600.0
                elif req.duration_unit == "seconds":
                    target_dur_sec = target_dur
                else:
                    target_dur_sec = target_dur * 60.0

                trans_dur = req.transition_duration or 2.0
                clip_dur = req.minimum_clip_duration or 15
                net_clip_dur = max(3.0, clip_dur - trans_dur)
                total_unique_dur = len(downloaded_files) * net_clip_dur
                repeats = max(0, int(target_dur_sec / total_unique_dur)) if total_unique_dur > 0 else 0

                # Audio track resolution
                audio_file = None
                if req.music_file and (settings.MUSIC_DIR / req.music_file).exists():
                    audio_file = settings.MUSIC_DIR / req.music_file

                # Render with FFmpeg
                final_video_name = f"meditation_{int(time.time())}_{job_id[:6]}.mp4"
                final_video_path = settings.RENDERS_DIR / final_video_name

                def on_progress(p: int):
                    # Progress from 40% to 95%
                    scaled = 40 + int(p * 0.55)
                    update_db("rendering", scaled, f"Rendering full video ({p}%)")

                update_db("rendering", 50, "Stitching seamless crossfade transitions with FFmpeg")
                
                await ffmpeg_service.stitch_video(
                    clip_paths=downloaded_files,
                    output_path=final_video_path,
                    target_duration=target_dur_sec,
                    transition_duration=trans_dur,
                    aspect_ratio=req.aspect_ratio or "16:9",
                    resolution=req.resolution or "1080p",
                    music_path=audio_file,
                    progress_callback=on_progress
                )

                # Completed!
                update_db(
                    "completed", 100, "Render Complete • Ready for Download",
                    output_path=str(final_video_path),
                    actual_duration_seconds=target_dur_sec,
                    approved_video_count=len(downloaded_files)
                )
                logger.info(f"Successfully generated video {final_video_path}")

        except asyncio.CancelledError:
            logger.info(f"Job {job_id} cancelled")
            update_db("cancelled", 0, "Job was cancelled")
        except Exception as e:
            logger.error(f"Error executing job {job_id}: {e}", exc_info=True)
            update_db("failed", 0, f"Error: {str(e)[:150]}", error_message=str(e))
        finally:
            if job_id in self.job_tasks:
                del self.job_tasks[job_id]
            db.close()

    async def _pre_download_clips(
        self,
        candidates: List[CandidateItem],
        job_dir,
        job_id: str,
        update_db
    ) -> List:
        """Asynchronously downloads candidate clips to disk in parallel."""
        downloaded = []
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            for idx, c in enumerate(candidates):
                # If candidate already exists locally in Library
                if c.local_file_path and os.path.exists(c.local_file_path):
                    downloaded.append(c.local_file_path)
                    continue

                # Find best video URL
                target_url = c.download_url
                if not target_url and c.video_files:
                    target_url = c.video_files[0].link
                if not target_url:
                    target_url = c.preview_url

                if not target_url:
                    continue

                clip_filename = f"clip_{idx:02d}_{c.source_video_id}.mp4"
                clip_path = job_dir / clip_filename

                if not clip_path.exists() or clip_path.stat().st_size < 1000:
                    try:
                        resp = await client.get(target_url)
                        if resp.status_code == 200:
                            with open(clip_path, "wb") as f:
                                f.write(resp.content)
                            downloaded.append(str(clip_path))
                    except Exception as ex:
                        logger.warning(f"Failed to download clip {c.source_video_id}: {ex}")
                else:
                    downloaded.append(str(clip_path))

                # Update progress during download phase (15% - 35%)
                progress = 15 + int(((idx + 1) / len(candidates)) * 20)
                update_db("downloading", progress, f"Downloaded {idx + 1}/{len(candidates)} clips")

        return downloaded


queue_service = QueueService()
