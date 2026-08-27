import asyncio
import datetime
import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db, SessionLocal
from backend.app.models import GenerationJob, VideoLibraryItem, KeywordBankItem, BannedCandidate
from backend.app.schemas import (
    IntentAnalysisRequest, IntentAnalysisResult,
    PresetSchema, SearchRequest, SearchResponse, EnvironmentSearchSpec,
    CandidateItem, BanCandidateRequest, GenerationRequest, GenerationResponse,
    JobProgressResponse, JobDetailResponse,
    LibraryItemSchema, HistoryItemSchema, WebhookGenerateRequest,
    StoryboardBreakdownRequest, StoryboardBreakdownResult, SubtitleConfig, VisualBeat,
    KeywordBankItemSchema, KeywordBankAddRequest, KeywordBankToggleFavoriteRequest
)
from backend.app.presets.nature_presets import NATURE_PRESETS, NATURE_ENVIRONMENTS, WILDLIFE_ENVIRONMENTS, get_presets_for_mode
from backend.app.services.intent_service import intent_service
from backend.app.services.pexels_service import pexels_service
from backend.app.services.pixabay_service import pixabay_service
from backend.app.services.image_fetch_service import image_fetch_service
from backend.app.services.candidate_service import candidate_service
from backend.app.services.scoring_service import scoring_service
from backend.app.services.library_service import library_service
from backend.app.services.selection_service import selection_service
from backend.app.services.ffmpeg_service import ffmpeg_service
from backend.app.services.queue_service import queue_service
from backend.app.services.subtitle_service import subtitle_service

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory candidate cache per job for UI inspection
JOB_CANDIDATES: Dict[str, List[CandidateItem]] = {}


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "storage": {
            "data_dir": str(settings.DATA_DIR),
            "library": str(settings.LIBRARY_DIR),
            "music": str(settings.MUSIC_DIR),
            "renders": str(settings.RENDERS_DIR)
        }
    }


@router.get("/presets", response_model=Dict[str, PresetSchema])
def get_presets(mode: str = Query("meditation")):
    return get_presets_for_mode(mode)


@router.post("/analyze", response_model=IntentAnalysisResult)
async def analyze_content(req: IntentAnalysisRequest, db: Session = Depends(get_db)):
    result = await intent_service.analyze(
        title=req.title,
        script=req.script,
        manual_intent=req.manual_intent,
        manual_mood=req.manual_mood,
        target_clips=req.target_clips or 10,
        studio_mode=req.studio_mode or "meditation",
        db=db
    )
    return result


@router.post("/storyboard/breakdown", response_model=StoryboardBreakdownResult)
async def breakdown_storyboard(req: StoryboardBreakdownRequest):
    return await intent_service.breakdown_script_beats(
        title=req.title or "",
        script=req.script,
        target_duration=req.target_duration,
        studio_mode=req.studio_mode or "documentary",
        audio_file=req.audio_file
    )


@router.post("/subtitles/generate")
async def generate_subtitles(
    script: str = Query(""),
    target_duration: float = Query(30.0),
    style: str = Query("documentary_classic")
):
    segments = subtitle_service.synthesize_subtitles_from_script(script or "", total_duration=target_duration)
    srt_content = subtitle_service.generate_srt_content(segments)
    ass_content = subtitle_service.generate_ass_content(segments, config=SubtitleConfig(style=style))
    return {
        "segments": segments,
        "srt": srt_content,
        "ass": ass_content
    }


@router.post("/search", response_model=SearchResponse)
async def search_candidates(req: SearchRequest, db: Session = Depends(get_db)):
    all_raw: List[CandidateItem] = []
    approved: List[CandidateItem] = []
    rejected: List[CandidateItem] = []

    active_presets = get_presets_for_mode(req.studio_mode or "meditation")

    # Determine scene specs to search
    specs_to_run = req.environments_spec
    if not specs_to_run and ((req.title and req.title.strip()) or (req.script and req.script.strip())):
        try:
            auto_plan = await intent_service.analyze(
                title=req.title,
                script=req.script,
                studio_mode=req.studio_mode or "meditation"
            )
            if auto_plan and auto_plan.planned_environments:
                specs_to_run = [
                    EnvironmentSearchSpec(
                        id=pe.id,
                        name=pe.name,
                        queries=pe.keywords,
                        clip_count=pe.suggested_clips
                    ) for pe in auto_plan.planned_environments
                ]
        except Exception as plan_err:
            logger.warning(f"Auto-plan in search_candidates failed: {plan_err}")

    # If environment specs are provided or derived, search per environment
    if specs_to_run and len(specs_to_run) > 0:
        for env_spec in specs_to_run:
            env_preset = active_presets.get(env_spec.id) or NATURE_ENVIRONMENTS.get(env_spec.id) or WILDLIFE_ENVIRONMENTS.get(env_spec.id)
            target_clips = env_spec.clip_count or 4

            # Fetch candidates for this environment
            per_page = min(15, max(6, int(target_clips * 2)))
            queries_to_run = list(env_spec.queries[:2]) if env_spec.queries else [env_spec.name]
            if req.prioritize_slow_motion and req.studio_mode != "documentary":
                enriched = []
                for q in queries_to_run:
                    if not any(k in q.lower() for k in ["slow", "glide", "ambient", "calm", "relaxing"]):
                        enriched.append(f"slow motion {q}")
                    else:
                        enriched.append(q)
                queries_to_run = enriched

            env_raw: List[CandidateItem] = []
            for q in queries_to_run:
                search_page = max(1, req.page or 1)
                # 1. Fetch videos: PRIORITIZE PIXABAY FIRST
                if req.media_type in ("video", "both", None):
                    pb_items: List[CandidateItem] = []
                    if req.enable_pixabay:
                        pb_items = await pixabay_service.search(query=q, page=search_page, per_page=per_page, db=db)
                        for item in pb_items:
                            item.environment_id = env_spec.id
                            item.subtheme = env_spec.name
                            item.media_type = "video"
                        env_raw.extend(pb_items)

                    # Only call Pexels if Pixabay is disabled, returned 0 results, or yielded insufficient clips
                    if req.enable_pexels and len(pb_items) < max(2, per_page // 2):
                        px_items = await pexels_service.search(query=q, page=search_page, per_page=per_page, db=db)
                        for item in px_items:
                            item.environment_id = env_spec.id
                            item.subtheme = env_spec.name
                            item.media_type = "video"
                        env_raw.extend(px_items)

                # 2. Fetch photos if media_type is "image" or "both"
                if req.media_type in ("image", "both"):
                    img_items = await image_fetch_service.search(query=q, page=search_page, per_page=per_page, db=db)
                    for item in img_items:
                        item.environment_id = env_spec.id
                        item.subtheme = env_spec.name
                    env_raw.extend(img_items)

            # Filter for this environment
            env_filtered = candidate_service.filter_candidates(
                candidates=env_raw,
                preset=env_preset,
                min_duration=req.min_duration if req.media_type != "image" else 5.0,
                max_duration=req.max_duration,
                aspect_ratio=req.aspect_ratio,
                resolution=req.resolution,
                exclude_all_history=req.exclude_all_history,
                db=db
            )
            all_raw.extend(env_raw)

            # Score candidates against this environment
            active_mode = req.studio_mode or "meditation"
            env_dummy_analysis = await intent_service.analyze(
                title=env_spec.name,
                preset_name=env_spec.id,
                studio_mode=active_mode
            )
            
            async def score_single(c: CandidateItem):
                try:
                    score_res = await asyncio.wait_for(
                        scoring_service.score_candidate(c, env_dummy_analysis, env_preset, studio_mode=active_mode),
                        timeout=4.0
                    )
                except Exception:
                    score_res = scoring_service._score_heuristic(c, env_dummy_analysis, env_preset, studio_mode=active_mode)
                    score_res = scoring_service._apply_scoring_thresholds(score_res, env_preset, studio_mode=active_mode)

                c.intent_match = score_res.intent_match
                c.theme_match = score_res.theme_match
                c.calmness = score_res.calmness
                c.motion_intensity = score_res.motion_intensity
                c.visual_quality = score_res.visual_quality
                c.shot_type = score_res.shot_type or "wide_vista"
                c.subtheme = env_spec.name
                c.environment_id = env_spec.id
                c.is_approved = score_res.keep
                c.rejection_reason = score_res.reason if not score_res.keep else None
                return c

            scored = await asyncio.gather(*[score_single(c) for c in env_filtered])
            for c in scored:
                if c.is_approved:
                    approved.append(c)
                else:
                    rejected.append(c)

    elif req.storyboard_beats and len(req.storyboard_beats) > 0:
        for beat in req.storyboard_beats:
            beat_raw: List[CandidateItem] = []
            queries_to_run = list(beat.keywords[:2]) if beat.keywords else [beat.visual_subject]

            for q in queries_to_run:
                if req.media_type in ("video", "both", None):
                    if req.enable_pexels:
                        px_items = await pexels_service.search(query=q, page=1, per_page=8, db=db)
                        for item in px_items:
                            item.beat_index = beat.beat_index
                            item.subtheme = beat.visual_subject
                            item.media_type = "video"
                        beat_raw.extend(px_items)
                    if req.enable_pixabay:
                        pb_items = await pixabay_service.search(query=q, page=1, per_page=8, db=db)
                        for item in pb_items:
                            item.beat_index = beat.beat_index
                            item.subtheme = beat.visual_subject
                            item.media_type = "video"
                        beat_raw.extend(pb_items)

                if req.media_type in ("image", "both"):
                    img_items = await image_fetch_service.search(query=q, page=1, per_page=8, db=db)
                    for item in img_items:
                        item.beat_index = beat.beat_index
                        item.subtheme = beat.visual_subject
                    beat_raw.extend(img_items)

            # Filter for this beat
            beat_filtered = candidate_service.filter_candidates(
                candidates=beat_raw,
                preset=None,
                min_duration=req.min_duration if req.media_type != "image" else 5.0,
                max_duration=req.max_duration,
                aspect_ratio=req.aspect_ratio,
                resolution=req.resolution,
                exclude_all_history=req.exclude_all_history,
                db=db
            )
            all_raw.extend(beat_raw)

            # Score candidates
            beat_dummy_analysis = await intent_service.analyze(
                title=beat.visual_subject,
                studio_mode="documentary"
            )
            for c in beat_filtered:
                score_res = scoring_service._score_heuristic(c, beat_dummy_analysis, None)
                c.intent_match = score_res.intent_match
                c.theme_match = score_res.theme_match
                c.calmness = score_res.calmness
                c.motion_intensity = score_res.motion_intensity
                c.visual_quality = score_res.visual_quality
                c.shot_type = score_res.shot_type or beat.camera_shot or "wide_vista"
                c.is_approved = score_res.keep
                c.rejection_reason = score_res.reason if not score_res.keep else None
                if score_res.keep:
                    approved.append(c)
                else:
                    rejected.append(c)
    else:
        # Fallback to query search
        queries_to_run = list(req.queries[:4]) if req.queries else ["peaceful nature landscape"]
        preset = NATURE_PRESETS.get(req.preset_name) if req.preset_name else None

        for q in queries_to_run:
            if req.enable_pexels:
                res = await pexels_service.search(query=q, page=1, per_page=20, db=db)
                all_raw.extend(res)
            if req.enable_pixabay:
                res = await pixabay_service.search(query=q, page=1, per_page=20, db=db)
                all_raw.extend(res)

        filtered = candidate_service.filter_candidates(
            candidates=all_raw,
            preset=preset,
            min_duration=req.min_duration,
            max_duration=req.max_duration,
            aspect_ratio=req.aspect_ratio,
            resolution=req.resolution,
            exclude_all_history=req.exclude_all_history,
            db=db
        )

        dummy_analysis = await intent_service.analyze(title=" ".join(queries_to_run), preset_name=req.preset_name)

        async def score_single_generic(c: CandidateItem):
            try:
                score_res = await asyncio.wait_for(
                    scoring_service.score_candidate(c, dummy_analysis, preset),
                    timeout=4.0
                )
            except Exception:
                score_res = scoring_service._score_heuristic(c, dummy_analysis, preset)
                score_res = scoring_service._apply_scoring_thresholds(score_res, preset)

            c.intent_match = score_res.intent_match
            c.theme_match = score_res.theme_match
            c.calmness = score_res.calmness
            c.motion_intensity = score_res.motion_intensity
            c.visual_quality = score_res.visual_quality
            c.shot_type = score_res.shot_type or "wide_vista"
            c.subtheme = score_res.subtheme
            c.is_approved = score_res.keep
            c.rejection_reason = score_res.reason if not score_res.keep else None
            return c
            return c

        scored_generic = await asyncio.gather(*[score_single_generic(c) for c in filtered[:30]])
        for c in scored_generic:
            if c.is_approved:
                approved.append(c)
            else:
                rejected.append(c)

    # Strictly deduplicate approved and rejected lists by ID and URL
    unique_approved: List[CandidateItem] = []
    unique_rejected: List[CandidateItem] = []
    seen_ids: Set[str] = set()
    seen_urls: Set[str] = set()

    for c in approved:
        cid = c.source_video_id
        curl = (c.source_url or "").strip().rstrip("/")
        if cid and cid not in seen_ids and (not curl or curl not in seen_urls):
            seen_ids.add(cid)
            if curl:
                seen_urls.add(curl)
            unique_approved.append(c)

    for c in rejected:
        cid = c.source_video_id
        curl = (c.source_url or "").strip().rstrip("/")
        if cid and cid not in seen_ids and (not curl or curl not in seen_urls):
            seen_ids.add(cid)
            if curl:
                seen_urls.add(curl)
            unique_rejected.append(c)

    # Auto-save approved and high-scoring candidates into SQLite Video Library
    for c in unique_approved:
        try:
            library_service.save_or_update_video(
                db=db,
                candidate=c,
                local_path=c.local_file_path or "",
                is_approved=True
            )
        except Exception as save_err:
            logger.warning(f"Could not auto-save candidate {c.source_video_id} to library: {save_err}")

    # Record searched queries into KeywordBankItem for usage tracking & cooldown rotation
    if req.environments_spec:
        for spec in req.environments_spec:
            for q in spec.queries or []:
                clean_q = q.strip()
                if clean_q:
                    try:
                        k_item = db.query(KeywordBankItem).filter(KeywordBankItem.keyword == clean_q).first()
                        if k_item:
                            k_item.times_used = (k_item.times_used or 0) + 1
                            k_item.last_used_at = datetime.datetime.utcnow()
                        else:
                            k_item = KeywordBankItem(
                                keyword=clean_q,
                                category=spec.name or "General",
                                is_favorite=False,
                                times_used=1,
                                last_used_at=datetime.datetime.utcnow()
                            )
                            db.add(k_item)
                        db.commit()
                    except Exception:
                        db.rollback()

    return SearchResponse(
        candidates=unique_approved + unique_rejected,
        total_found=len(unique_approved) + len(unique_rejected),
        approved_count=len(unique_approved),
        rejected_count=len(unique_rejected)
    )


async def run_generation_pipeline(job_id: str, req: GenerationRequest):
    """Background async worker for end-to-end video generation."""
    db = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            return

        def update_job(status: str, progress: int, stage: str, **kwargs):
            job.status = status
            job.progress = progress
            job.current_stage = stage
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()

        update_job("analyzing", 5, "Analyzing emotional intent and mood")

        active_mode = req.studio_mode or "meditation"
        active_presets = get_presets_for_mode(active_mode)

        # 1. Intent Analysis
        analysis = await intent_service.analyze(
            title=req.title,
            script=req.script,
            manual_intent=req.manual_intent,
            manual_mood=req.manual_mood,
            preset_name=req.preset,
            studio_mode=active_mode
        )

        preset = active_presets.get(req.preset) or (WILDLIFE_ENVIRONMENTS.get("savanna_predators") if active_mode == "documentary" else NATURE_PRESETS.get("Calm Misty Forest"))

        update_job(
            "analyzing", 10, "Visual query generation complete",
            detected_intent=analysis.intent,
            detected_mood=json.dumps(analysis.mood)
        )

        # Check if user manually reviewed and supplied a candidate pool
        if req.candidate_pool and len(req.candidate_pool) > 0:
            update_job("scoring", 30, "Using reviewed candidate pool")
            collected_candidates = req.candidate_pool
            if req.selected_candidate_ids:
                sel_order = {cid: idx for idx, cid in enumerate(req.selected_candidate_ids)}
                approved_pool = sorted(
                    [c for c in collected_candidates if c.source_video_id in sel_order],
                    key=lambda c: sel_order.get(c.source_video_id, 999)
                )
            else:
                approved_pool = [c for c in collected_candidates if c.is_approved]
            rejected_count = len(collected_candidates) - len(approved_pool)
        else:
            # 2. Check local video library first for reusable assets
            reused_candidates: List[CandidateItem] = []
            if req.allow_reuse:
                update_job("searching", 15, "Checking local video library for high-scoring assets")
                reused_candidates = library_service.find_reusable_candidates(
                    db=db,
                    analysis=analysis,
                    preset=preset,
                    min_duration=req.minimum_clip_duration,
                    avoid_recently_used=req.avoid_recently_used,
                    max_results=req.maximum_unique_videos
                )

            # 3. Search online providers if more candidates are needed
            collected_candidates: List[CandidateItem] = list(reused_candidates)
            
            # Generate mode-specific queries from environments or analysis
            if req.environments and len(req.environments) > 0:
                queries = []
                for env_name in req.environments:
                    matched = next((e for e in active_presets.values() if e.name.lower() == env_name.lower() or env_name.lower() in e.name.lower()), None)
                    if matched and matched.queries:
                        queries.extend(matched.queries[:2])
                    else:
                        queries.append(f"{env_name} wildlife 4k" if active_mode == "documentary" else f"{env_name} nature 4k")
            else:
                queries = analysis.generated_queries or (preset.queries if preset else (["african wildlife 4k", "savanna lions 4k"] if active_mode == "documentary" else ["misty forest", "peaceful nature"]))

            if len(collected_candidates) < req.maximum_unique_videos:
                update_job("searching", 20, f"Searching footage for {active_mode} preset")
                per_page_count = min(15, max(6, int(req.maximum_unique_videos / max(1, len(queries)))))
                for q in queries[:4]:
                    if len(collected_candidates) >= req.maximum_unique_videos:
                        break
                    # 1. Query Pixabay first
                    pb_count = 0
                    if req.enable_pixabay:
                        pb_items = await pixabay_service.search(query=q, page=1, per_page=per_page_count, db=db)
                        collected_candidates.extend(pb_items)
                        pb_count = len(pb_items)

                    # 2. Only query Pexels if Pixabay yielded insufficient clips or is disabled
                    if req.enable_pexels and (pb_count < 2 or len(collected_candidates) < req.maximum_unique_videos):
                        px_items = await pexels_service.search(query=q, page=1, per_page=per_page_count, db=db)
                        collected_candidates.extend(px_items)

            # 4. Filter Candidate Pool
            update_job("scoring", 25, "Filtering and deduplicating candidates")
            filtered_candidates = candidate_service.filter_candidates(
                candidates=collected_candidates,
                preset=preset,
                analysis=analysis,
                min_duration=req.minimum_clip_duration,
                max_duration=req.maximum_clip_duration,
                aspect_ratio=req.aspect_ratio,
                resolution=req.resolution,
                avoid_recently_used=req.avoid_recently_used,
                db=db
            )

            # 5. Score candidates
            update_job("scoring", 30, "Visual scoring and evaluation")
            approved_pool = []
            rejected_count = 0

            for cand in filtered_candidates:
                if cand.is_reused and cand.is_approved:
                    approved_pool.append(cand)
                    continue

                score_res = await scoring_service.score_candidate(cand, analysis, preset, studio_mode=active_mode)
                cand.intent_match = score_res.intent_match
                cand.theme_match = score_res.theme_match
                cand.calmness = score_res.calmness
                cand.motion_intensity = score_res.motion_intensity
                cand.visual_quality = score_res.visual_quality
                cand.subtheme = score_res.subtheme
                cand.is_approved = score_res.keep
                cand.rejection_reason = score_res.reason if not score_res.keep else None

                if score_res.keep:
                    approved_pool.append(cand)
                else:
                    rejected_count += 1

        JOB_CANDIDATES[job_id] = approved_pool

        if not approved_pool:
            # Add at least procedural fallback items
            logger.info("No online clips approved, generating procedural clips")
            for idx, q in enumerate(queries[:4]):
                approved_pool.append(CandidateItem(
                    source="procedural",
                    source_video_id=f"procedural_{idx}",
                    source_url="",
                    creator_name="Synthesizer",
                    search_query=q,
                    duration=30.0,
                    width=1920,
                    height=1080,
                    preview_url="",
                    intent_match=9.0,
                    theme_match=9.0,
                    calmness=9.0,
                    motion_intensity=2.0,
                    visual_quality=9.0,
                    subtheme=preset.subthemes[idx % len(preset.subthemes)] if preset and preset.subthemes else "nature",
                    is_approved=True
                ))

        # 6. Calculate target duration in seconds
        if req.duration_unit == "hours":
            target_dur_sec = req.target_duration * 3600.0
        elif req.duration_unit == "seconds":
            target_dur_sec = req.target_duration
        else:
            target_dur_sec = req.target_duration * 60.0

        # 7. Plan clip sequence (Storyboard sequential vs Standard loop)
        update_job("rendering", 35, "Planning clip sequence")
        if req.storyboard_beats and len(req.storyboard_beats) > 0:
            sequence_data = selection_service.plan_storyboard_sequence(
                storyboard_beats=req.storyboard_beats,
                candidate_pool=approved_pool,
                transition_duration=req.transition_duration
            )
            target_dur_sec = sequence_data["actual_duration_seconds"]
        else:
            sequence_data = selection_service.plan_sequence(
                approved_candidates=approved_pool,
                target_duration_seconds=target_dur_sec,
                max_unique_videos=req.maximum_unique_videos,
                transition_duration=req.transition_duration,
                studio_mode=active_mode,
                allow_looping=(req.allow_reuse if active_mode == "meditation" else False)
            )

        job_dir = settings.JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Prepare subtitles if configured
        sub_file = None
        if req.subtitle_config and req.subtitle_config.enabled:
            sub_file = job_dir / "subtitles.ass"
            sub_segments = subtitle_service.synthesize_subtitles_from_script(
                req.script or req.title,
                total_duration=target_dur_sec
            )
            ass_content = subtitle_service.generate_ass_content(sub_segments, config=req.subtitle_config)
            with open(sub_file, "w", encoding="utf-8") as f:
                f.write(ass_content)

            # Also generate standard .srt
            srt_file = job_dir / "subtitles.srt"
            with open(srt_file, "w", encoding="utf-8") as f:
                f.write(subtitle_service.generate_srt_content(sub_segments))

        # Save selected_clips.json and sequence.json
        with open(job_dir / "selected_clips.json", "w", encoding="utf-8") as f:
            json.dump([c.model_dump() for c in sequence_data["unique_clips"]], f, indent=2, default=str)

        with open(job_dir / "sequence.json", "w", encoding="utf-8") as f:
            json.dump(sequence_data["sequence"], f, indent=2, default=str)

        # Save credits.txt
        credits_lines = [
            f"Meditation Video: {req.title}",
            f"Intent: {analysis.intent}",
            f"Preset: {req.preset}",
            "Footage Credits & Attributions:\n"
        ]
        for c in sequence_data["unique_clips"]:
            credits_lines.append(f"- {c.creator_name}: {c.source_url or c.source}")
        with open(job_dir / "credits.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(credits_lines))

        update_job(
            "rendering", 40, "Beginning FFmpeg rendering pipeline",
            candidate_count=len(collected_candidates),
            approved_video_count=len(approved_pool),
            rejected_video_count=rejected_count,
            reused_video_count=sequence_data["reused_count"],
            new_video_count=sequence_data["new_count"],
            selected_video_count=sequence_data["unique_clip_count"],
            sequence_repeat_count=sequence_data["repeat_count"],
            unique_sequence_duration=sequence_data["unique_sequence_duration"]
        )

        # 8. Render video with progress callback
        def on_render_progress(pct: int, msg: str):
            update_job("rendering", pct, msg)

        final_video_path = await ffmpeg_service.render_video(
            job_id=job_id,
            sequence_data=sequence_data,
            aspect_ratio=req.aspect_ratio,
            resolution=req.resolution,
            transition_type=req.transition_type,
            transition_duration=req.transition_duration,
            playback_speed=req.playback_speed or 0.5,
            music_file=req.music_file,
            voiceover_file=req.voiceover_file,
            subtitle_file=sub_file,
            burn_subtitles=bool(req.subtitle_config and req.subtitle_config.burn_into_video),
            audio_mode=req.audio_mode,
            progress_callback=on_render_progress
        )

        # 9. Verify actual duration
        probe = await ffmpeg_service.probe_file(final_video_path)
        actual_dur = probe.get("duration", target_dur_sec)

        # 10. Auto-save all used / selected videos to library and update usage stats
        for cand in sequence_data["unique_clips"]:
            cand_id = cand.source_video_id or getattr(cand, "candidate_id", None)
            if not cand_id:
                continue
            
            # Check if file exists in library directory
            library_file = settings.LIBRARY_DIR / f"{cand_id}.mp4"
            if not library_file.exists():
                library_file = settings.LIBRARY_DIR / f"{cand_id}.jpg"

            resolved_path = str(library_file) if library_file.exists() else cand.local_file_path
            library_service.save_or_update_video(
                db=db,
                candidate=cand,
                local_path=resolved_path,
                is_approved=True
            )
            library_service.record_usage(db, cand_id)

        # Save metadata.json
        metadata = {
            "job_id": job_id,
            "title": req.title,
            "script": req.script,
            "detected_intent": analysis.intent,
            "detected_mood": analysis.mood,
            "preset": req.preset,
            "target_duration_seconds": target_dur_sec,
            "actual_duration_seconds": actual_dur,
            "selected_video_count": sequence_data["unique_clip_count"],
            "reused_video_count": sequence_data["reused_count"],
            "new_video_count": sequence_data["new_count"],
            "sequence_repeat_count": sequence_data["repeat_count"],
            "transition_type": req.transition_type,
            "transition_duration": req.transition_duration,
            "music_file": req.music_file or "meditation_ambient_drone",
            "source_videos": [
                {
                    "id": c.source_video_id,
                    "source": c.source,
                    "creator": c.creator_name,
                    "url": c.source_url
                }
                for c in sequence_data["unique_clips"]
            ]
        }
        with open(job_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        update_job(
            "completed", 100, "Final render complete",
            output_path=str(final_video_path),
            actual_duration_seconds=actual_dur,
            metadata_json=json.dumps(metadata)
        )

    except Exception as e:
        logger.error(f"Generation pipeline error: {e}", exc_info=True)
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.current_stage = f"Failed: {str(e)[:100]}"
            db.commit()
    finally:
        db.close()


@router.post("/generate", response_model=GenerationResponse)
async def generate_video(
    req: GenerationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    job_id = str(uuid.uuid4())

    # Calculate target seconds
    if req.duration_unit == "hours":
        target_sec = req.target_duration * 3600.0
    elif req.duration_unit == "seconds":
        target_sec = req.target_duration
    else:
        target_sec = req.target_duration * 60.0

    job = GenerationJob(
        id=job_id,
        title=req.title,
        script=req.script,
        preset=req.preset,
        target_duration_seconds=target_sec,
        aspect_ratio=req.aspect_ratio,
        resolution=req.resolution,
        transition_type=req.transition_type,
        transition_duration=req.transition_duration,
        playback_speed=req.playback_speed or 0.5,
        music_file=req.music_file,
        status="queued",
        progress=0,
        current_stage="Job queued in background worker"
    )
    db.add(job)
    db.commit()

    # Submit to the 2-slot concurrency queue service
    queue_service.submit_job(job_id, req)

    return GenerationResponse(
        job_id=job_id,
        status="queued",
        message="Video generation job has been queued in background."
    )


@router.get("/jobs/active")
def get_active_jobs(db: Session = Depends(get_db)):
    """Returns all currently queued, downloading, and rendering jobs."""
    return queue_service.get_active_jobs(db)


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancels a queued or active generation job."""
    success = queue_service.cancel_job(job_id)
    return {"status": "cancelled" if success else "not_found", "job_id": job_id}


@router.get("/jobs/{job_id}", response_model=JobDetailResponse)
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    meta = json.loads(job.metadata_json) if job.metadata_json else None
    mood = json.loads(job.detected_mood) if job.detected_mood else []
    candidates = JOB_CANDIDATES.get(job_id, [])

    return JobDetailResponse(
        job_id=job.id,
        title=job.title,
        script=job.script,
        detected_intent=job.detected_intent,
        detected_mood=mood,
        preset=job.preset,
        target_duration_seconds=job.target_duration_seconds,
        actual_duration_seconds=job.actual_duration_seconds,
        selected_video_count=job.selected_video_count,
        transition_type=job.transition_type,
        transition_duration=job.transition_duration,
        status=job.status,
        progress=job.progress,
        current_stage=job.current_stage,
        candidate_count=job.candidate_count,
        approved_video_count=job.approved_video_count,
        rejected_video_count=job.rejected_video_count,
        reused_video_count=job.reused_video_count,
        new_video_count=job.new_video_count,
        estimated_sequence_duration=job.unique_sequence_duration,
        expected_repeat_count=job.sequence_repeat_count,
        output_path=job.output_path,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        metadata=meta,
        candidates=candidates
    )


@router.get("/jobs/{job_id}/progress", response_model=JobProgressResponse)
def get_job_progress(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobProgressResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        current_stage=job.current_stage,
        candidate_count=job.candidate_count,
        approved_video_count=job.approved_video_count,
        rejected_video_count=job.rejected_video_count,
        reused_video_count=job.reused_video_count,
        new_video_count=job.new_video_count,
        estimated_sequence_duration=job.unique_sequence_duration,
        expected_repeat_count=job.sequence_repeat_count,
        output_path=job.output_path,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at
    )


@router.get("/jobs/{job_id}/preview")
def preview_job_video(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job or not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Video render file not available")
    return FileResponse(path=job.output_path, media_type="video/mp4")


@router.get("/jobs/{job_id}/download")
def download_job_video(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job or not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Rendered video not found")
    safe_title = "".join(c for c in (job.title or "meditation") if c.isalnum() or c in " _-").strip()
    filename = f"{safe_title}_{job_id[:8]}.mp4"
    return FileResponse(
        path=job.output_path,
        media_type="video/mp4",
        filename=filename
    )


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ffmpeg_service.cancel_job(job_id)
    job.status = "cancelled"
    job.current_stage = "Job cancelled by user"
    db.commit()
    return {"status": "cancelled", "job_id": job_id}


@router.get("/library", response_model=List[LibraryItemSchema])
def get_library(
    search: Optional[str] = None,
    approved_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(VideoLibraryItem)
    if approved_only:
        query = query.filter(VideoLibraryItem.is_approved == True)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (VideoLibraryItem.creator_name.like(s)) |
            (VideoLibraryItem.subtheme.like(s)) |
            (VideoLibraryItem.source.like(s))
        )
    items = query.order_by(VideoLibraryItem.last_used_at.desc().nullslast()).all()
    
    result = []
    for item in items:
        result.append(LibraryItemSchema(
            id=item.id,
            source=item.source,
            source_video_id=item.source_video_id,
            source_url=item.source_url,
            download_url=item.source_url,
            stream_url=f"/api/library/stream/{item.id}",
            local_file_path=item.local_file_path,
            preview_url=item.preview_url,
            creator_name=item.creator_name,
            creator_url=item.creator_url,
            duration=item.duration,
            width=item.width,
            height=item.height,
            intent_tags=json.loads(item.intent_tags) if item.intent_tags else [],
            mood_tags=json.loads(item.mood_tags) if item.mood_tags else [],
            subtheme=item.subtheme,
            intent_score=item.intent_score,
            theme_score=item.theme_score,
            calmness_score=item.calmness_score,
            motion_score=item.motion_score,
            visual_quality_score=item.visual_quality_score,
            times_used=item.times_used,
            last_used_at=item.last_used_at,
            is_approved=item.is_approved,
            rejection_reason=item.rejection_reason,
            created_at=item.created_at
        ))
    return result


@router.get("/library/stream/{item_id}")
async def stream_library_video(item_id: int, db: Session = Depends(get_db)):
    """Stream a library video locally from disk or resolve direct high-resolution video stream."""
    item = db.query(VideoLibraryItem).filter(VideoLibraryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Library video item not found")

    # 1. If local downloaded video file exists on disk, stream it
    if item.local_file_path:
        lp = Path(item.local_file_path)
        if lp.exists():
            return FileResponse(str(lp), media_type="video/mp4")

    # 2. If source_url is a direct video stream link, redirect directly
    if item.source_url and item.source_url.startswith("http") and (".mp4" in item.source_url or "video" in item.source_url):
        return RedirectResponse(url=item.source_url, status_code=307)

    # 3. Dynamic resolution via API for Pexels or Pixabay
    if item.source == "pexels":
        try:
            vid_url = await pexels_service.get_video_play_url(item.source_video_id)
            if vid_url:
                item.source_url = vid_url
                db.commit()
                return RedirectResponse(url=vid_url, status_code=307)
        except Exception as pex_err:
            logger.warning(f"Error fetching Pexels stream for {item.source_video_id}: {pex_err}")

    if item.source == "pixabay":
        try:
            vid_url = await pixabay_service.get_video_play_url(item.source_video_id)
            if vid_url:
                item.source_url = vid_url
                db.commit()
                return RedirectResponse(url=vid_url, status_code=307)
        except Exception as pix_err:
            logger.warning(f"Error fetching Pixabay stream for {item.source_video_id}: {pix_err}")

    # Fallback to source_url or preview_url
    if item.source_url and item.source_url.startswith("http"):
        return RedirectResponse(url=item.source_url, status_code=307)
    if item.preview_url and item.preview_url.startswith("http"):
        return RedirectResponse(url=item.preview_url, status_code=307)

    raise HTTPException(status_code=404, detail="Video stream unavailable")


@router.post("/library/save-candidate")
def save_candidate_to_library(candidate: CandidateItem, db: Session = Depends(get_db)):
    """Save any discovered candidate clip with its theme and tags directly into SQLite Video Library."""
    existing = db.query(VideoLibraryItem).filter(
        VideoLibraryItem.source == candidate.source,
        VideoLibraryItem.source_video_id == candidate.source_video_id
    ).first()
    
    if existing:
        existing.subtheme = candidate.subtheme or existing.subtheme
        existing.is_approved = True
        if candidate.download_url:
            existing.source_url = candidate.download_url
        if candidate.local_file_path:
            existing.local_file_path = candidate.local_file_path
        db.commit()
        return {"status": "already_saved", "id": existing.id, "message": "Video is already in library"}

    tags = getattr(candidate, 'tags', []) or ([candidate.search_query] if candidate.search_query else [])
    item = VideoLibraryItem(
        source=candidate.source,
        source_video_id=candidate.source_video_id,
        source_url=candidate.download_url or candidate.source_url,
        preview_url=candidate.preview_url,
        local_file_path=candidate.local_file_path,
        creator_name=candidate.creator_name,
        creator_url=candidate.creator_url,
        duration=candidate.duration,
        width=candidate.width,
        height=candidate.height,
        subtheme=candidate.subtheme or candidate.environment_id or "Nature Scene",
        intent_tags=json.dumps(tags),
        mood_tags=json.dumps([candidate.subtheme] if candidate.subtheme else []),
        intent_score=candidate.intent_match or 8.5,
        theme_score=candidate.theme_match or 8.5,
        calmness_score=candidate.calmness or 8.5,
        motion_score=candidate.motion_intensity or 2.0,
        visual_quality_score=candidate.visual_quality or 8.5,
        is_approved=True,
        times_used=0
    )
    db.add(item)
    db.commit()
    return {"status": "saved", "id": item.id, "message": "Saved to Library with theme tags"}


@router.post("/candidates/ban")
def ban_candidate(req: BanCandidateRequest, db: Session = Depends(get_db)):
    """Permanently bans a video candidate so it is never fetched again."""
    item = db.query(VideoLibraryItem).filter(
        VideoLibraryItem.source_video_id == req.source_video_id
    ).first()
    
    if not item:
        item = VideoLibraryItem(
            source=req.source,
            source_video_id=req.source_video_id,
            source_url=req.source_url,
            creator_name=req.creator_name,
            preview_url=req.preview_url,
            is_approved=False,
            rejected_at=datetime.datetime.utcnow(),
            rejection_reason=req.reason or "Manually banned by user"
        )
        db.add(item)
    else:
        item.is_approved = False
        item.rejected_at = datetime.datetime.utcnow()
        item.rejection_reason = req.reason or "Manually banned by user"
    
    db.commit()
    return {"status": "banned", "source_video_id": req.source_video_id, "message": "Video permanently banned"}


@router.post("/candidates/unban")
def unban_candidate(source_video_id: str = Query(...), db: Session = Depends(get_db)):
    """Removes the ban on a video candidate."""
    item = db.query(VideoLibraryItem).filter(
        VideoLibraryItem.source_video_id == source_video_id
    ).first()
    if item:
        item.is_approved = True
        item.rejected_at = None
        item.rejection_reason = None
        db.commit()
    return {"status": "unbanned", "source_video_id": source_video_id}


@router.delete("/library/{item_id}")
def delete_library_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(VideoLibraryItem).filter(VideoLibraryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Library item not found")
    
    # Remove local file if exists
    if item.local_file_path:
        p = Path(item.local_file_path)
        if p.exists():
            try:
                p.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete local video file {p}: {e}")

    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}


@router.delete("/library")
def clear_library(db: Session = Depends(get_db)):
    items = db.query(VideoLibraryItem).all()
    for item in items:
        if item.local_file_path:
            p = Path(item.local_file_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete local file {p}: {e}")
        db.delete(item)
    db.commit()
    return {"status": "cleared", "count": len(items)}


@router.get("/history", response_model=List[HistoryItemSchema])
def get_history(db: Session = Depends(get_db)):
    jobs = db.query(GenerationJob).order_by(GenerationJob.created_at.desc()).all()
    res = []
    for j in jobs:
        res.append(HistoryItemSchema(
            job_id=j.id,
            title=j.title,
            detected_intent=j.detected_intent,
            duration=j.actual_duration_seconds or j.target_duration_seconds,
            target_duration=j.target_duration_seconds,
            number_of_clips=j.selected_video_count,
            number_of_reused_clips=j.reused_video_count,
            number_of_new_clips=j.new_video_count,
            repeat_count=j.sequence_repeat_count,
            render_date=j.created_at,
            status=j.status,
            download_url=f"/api/jobs/{j.id}/download" if j.status == "completed" else None
        ))
    return res


@router.post("/webhooks/generate")
async def webhook_generate(
    req: WebhookGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """n8n integration endpoint."""
    duration_val = req.duration_hours or 1.0
    duration_unit = "hours"
    if req.duration_minutes is not None:
        duration_val = req.duration_minutes
        duration_unit = "minutes"

    gen_req = GenerationRequest(
        title=req.title,
        script=req.script,
        target_duration=duration_val,
        duration_unit=duration_unit,
        maximum_unique_videos=req.maximum_unique_videos,
        aspect_ratio=req.aspect_ratio,
        resolution=req.resolution,
        transition_type=req.transition_type,
        transition_duration=req.transition_duration,
        allow_reuse=req.allow_reuse,
        avoid_recently_used=req.avoid_recently_used
    )

    return await generate_video(gen_req, background_tasks, db)


@router.post("/music/upload")
@router.post("/upload/music")
async def upload_music(file: UploadFile = File(...)):
    filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    target_path = settings.MUSIC_DIR / filename
    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    probe = await ffmpeg_service.probe_file(target_path)
    dur_seconds = float(probe.get("duration", 0.0))
    dur_minutes = max(1, round(dur_seconds / 60.0)) if dur_seconds > 60 else round(dur_seconds, 1)

    return {
        "filename": filename,
        "original_name": file.filename,
        "path": str(target_path),
        "duration_seconds": dur_seconds,
        "duration_minutes": dur_minutes
    }


@router.post("/cleanup")
def trigger_manual_cleanup(retention_days: int = 3):
    """Manually trigger retention cleanup of rendered videos & cache older than N days (default 3)."""
    from backend.app.services.cleanup_service import cleanup_old_renders
    return cleanup_old_renders(retention_seconds=retention_days * 24 * 3600)


# --- KEYWORD BANK & ROTATION ENDPOINTS ---

@router.get("/keywords/bank", response_model=List[KeywordBankItemSchema])
def get_keyword_bank(
    category: Optional[str] = None,
    favorites_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(KeywordBankItem)
    if favorites_only:
        query = query.filter(KeywordBankItem.is_favorite == True)
    if category and category != "All":
        query = query.filter(KeywordBankItem.category == category)
    items = query.order_by(
        KeywordBankItem.is_favorite.desc(),
        KeywordBankItem.times_used.desc(),
        KeywordBankItem.last_used_at.desc()
    ).all()
    return items


@router.post("/keywords/bank", response_model=KeywordBankItemSchema)
def add_keyword_to_bank(req: KeywordBankAddRequest, db: Session = Depends(get_db)):
    clean_k = req.keyword.strip()
    if not clean_k:
        raise HTTPException(status_code=400, detail="Keyword cannot be empty")
    item = db.query(KeywordBankItem).filter(KeywordBankItem.keyword == clean_k).first()
    if not item:
        item = KeywordBankItem(
            keyword=clean_k,
            category=req.category or "General",
            is_favorite=req.is_favorite,
            times_used=1,
            last_used_at=datetime.datetime.utcnow()
        )
        db.add(item)
    else:
        if req.category:
            item.category = req.category
        item.is_favorite = req.is_favorite or item.is_favorite
        item.last_used_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.post("/keywords/bank/toggle-favorite")
def toggle_keyword_favorite(req: KeywordBankToggleFavoriteRequest, db: Session = Depends(get_db)):
    clean_k = req.keyword.strip()
    item = db.query(KeywordBankItem).filter(KeywordBankItem.keyword == clean_k).first()
    if not item:
        item = KeywordBankItem(
            keyword=clean_k,
            category="General",
            is_favorite=req.is_favorite,
            times_used=1,
            last_used_at=datetime.datetime.utcnow()
        )
        db.add(item)
    else:
        item.is_favorite = req.is_favorite
    db.commit()
    return {"status": "success", "keyword": clean_k, "is_favorite": req.is_favorite}


@router.delete("/keywords/bank/{item_id}")
def delete_keyword_from_bank(item_id: int, db: Session = Depends(get_db)):
    item = db.query(KeywordBankItem).filter(KeywordBankItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Keyword not found in bank")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}
