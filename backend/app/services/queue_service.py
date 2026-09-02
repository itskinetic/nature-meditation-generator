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
            if job_id.startswith("audio_"):
                try:
                    p_id = int(job_id.replace("audio_", ""))
                    from backend.app.models import AudioProject
                    p = db.query(AudioProject).filter(AudioProject.id == p_id).first()
                    if p:
                        p.status = "unprocessed"
                        db.commit()
                        return True
                except Exception:
                    pass

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
        """Returns all currently queued, downloading, or rendering video & audio jobs."""
        active_statuses = ["pending", "queued", "analyzing", "searching", "scoring", "downloading", "evaluating", "rendering", "stitching"]
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
                "type": "video",
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            })

        # Include active Audio AI jobs (transcribing / spacing)
        try:
            from backend.app.models import AudioProject
            active_audio = db.query(AudioProject).filter(AudioProject.status.in_(["transcribing", "processing"])).order_by(AudioProject.updated_at.desc()).all()
            for p in active_audio:
                is_transcribing = p.status == "transcribing"
                stage_text = "🎙️ AI Speech Transcription (Gemini)" if is_transcribing else "🎵 Spacing & Mastering Audio Track"
                result.append({
                    "id": f"audio_{p.id}",
                    "title": p.title or p.original_name or "Voiceover Audio",
                    "status": "rendering",
                    "progress": 65 if is_transcribing else 85,
                    "current_stage": stage_text,
                    "target_duration_seconds": int(p.duration or 0),
                    "type": "audio",
                    "audio_project_id": p.id,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                })
        except Exception as e:
            logger.warning(f"Error fetching active audio projects for queue: {e}")

        return result

    async def _process_job_pipeline(self, job_id: str, req: GenerationRequest) -> None:
        """Runs the complete generation pipeline with concurrency control."""
        async with self.render_semaphore:
            try:
                from backend.app.routes.api import run_generation_pipeline
                await run_generation_pipeline(job_id, req)
            except asyncio.CancelledError:
                logger.info(f"Job {job_id} cancelled")
            except Exception as e:
                logger.error(f"Error executing queued job {job_id}: {e}", exc_info=True)
            finally:
                if job_id in self.job_tasks:
                    del self.job_tasks[job_id]

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
