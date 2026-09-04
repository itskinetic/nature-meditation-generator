import asyncio
import datetime
import json
import logging
import os
import shutil
import uuid
import wave
import io
import zipfile
import httpx
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File, Form, Body, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db, SessionLocal
from backend.app.models import GenerationJob, VideoLibraryItem, KeywordBankItem, BannedCandidate, AudioProject
from backend.app.schemas import (
    IntentAnalysisRequest, IntentAnalysisResult,
    PresetSchema, SearchRequest, SearchResponse, EnvironmentSearchSpec,
    CandidateItem, BanCandidateRequest, GenerationRequest, GenerationResponse,
    JobProgressResponse, JobDetailResponse,
    LibraryItemSchema, HistoryItemSchema, WebhookGenerateRequest,
    StoryboardBreakdownRequest, StoryboardBreakdownResult, SubtitleConfig, VisualBeat,
    KeywordBankItemSchema, KeywordBankAddRequest, KeywordBankToggleFavoriteRequest,
    BatchSaveCandidatesRequest, DownloadCandidatesZipRequest,
    AudioSegmentSchema, AudioSilenceIntervalSchema, AudioAnalysisRequest, AudioAnalysisResponse,
    AudioProcessRequest, AudioProcessResponse, AudioProjectSchema, AudioProjectListResponse
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
from backend.app.services.audio_spacer_service import audio_spacer_service

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

            # Fetch candidates for this environment (5 clips per keyword per provider)
            per_page = 5
            # Run queries for this environment, guaranteeing at least 5 diverse keywords per scene
            queries_to_run = []
            if req.queries and len(req.queries) > 0:
                queries_to_run = list(req.queries[:15])
            else:
                queries_to_run = list(env_spec.queries) if env_spec.queries else []
                if not queries_to_run:
                    queries_to_run = [env_spec.name]

                # Guarantee at least 5 diverse keywords per scene
                if len(queries_to_run) < 5:
                    preset_obj = active_presets.get(env_spec.id) or NATURE_ENVIRONMENTS.get(env_spec.id) or WILDLIFE_ENVIRONMENTS.get(env_spec.id)
                    if preset_obj and preset_obj.queries:
                        for pq in preset_obj.queries:
                            if pq not in queries_to_run:
                                queries_to_run.append(pq)
                            if len(queries_to_run) >= 5:
                                break
                    clean_name = env_spec.name.lower()
                    fallbacks = [
                        f"bright daylight {clean_name} forward drone glide 4k",
                        f"clear sunny day {clean_name} forward aerial 4k",
                        f"peaceful {clean_name} slow tracking daylight 4k",
                        f"vibrant {clean_name} landscape sunny day 4k",
                        f"crystal clear {clean_name} calm daylight 4k"
                    ]
                    for fb in fallbacks:
                        if len(queries_to_run) >= 5:
                            break
                        if fb not in queries_to_run:
                            queries_to_run.append(fb)

            if req.prioritize_slow_motion and req.studio_mode != "documentary":
                enriched = []
                for q in queries_to_run:
                    words = q.split()
                    if len(words) <= 4 and not any(k in q.lower() for k in ["slow", "glide", "ambient", "calm", "relaxing"]):
                        # Check if "slow motion" is not already in the query to avoid duplication
                        if "slow motion" not in q.lower():
                            enriched.append(f"slow motion {q}")
                        else:
                            enriched.append(q)
                    else:
                        enriched.append(q)
                queries_to_run = enriched

            env_raw: List[CandidateItem] = []
            for q in queries_to_run:
                search_page = max(1, req.page or 1)
                # 1. Fetch videos: Call BOTH Pexels and Pixabay concurrently
                if req.media_type in ("video", "both", None):
                    tasks = []
                    if req.enable_pexels:
                        tasks.append(pexels_service.search(query=q, page=search_page, per_page=per_page, db=db))
                    if req.enable_pixabay:
                        tasks.append(pixabay_service.search(query=q, page=search_page, per_page=per_page, db=db))

                    if tasks:
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        px_items: List[CandidateItem] = []
                        pb_items: List[CandidateItem] = []

                        if req.enable_pexels and len(results) > 0 and isinstance(results[0], list):
                            px_items = results[0]
                        if req.enable_pixabay:
                            pb_idx = 1 if req.enable_pexels else 0
                            if len(results) > pb_idx and isinstance(results[pb_idx], list):
                                pb_items = results[pb_idx]

                        for item in px_items:
                            item.environment_id = env_spec.id
                            item.subtheme = env_spec.name
                            item.media_type = "video"
                        for item in pb_items:
                            item.environment_id = env_spec.id
                            item.subtheme = env_spec.name
                            item.media_type = "video"

                        # Interleave Pexels and Pixabay candidates for balanced variety (~5 per provider)
                        max_len = max(len(px_items), len(pb_items))
                        for i in range(max_len):
                            if i < len(px_items):
                                env_raw.append(px_items[i])
                            if i < len(pb_items):
                                env_raw.append(pb_items[i])

                # 2. Fetch photos if media_type is "image" or "both"
                if req.media_type in ("image", "both"):
                    img_items = await image_fetch_service.search(query=q, page=search_page, per_page=per_page, db=db)
                    for item in img_items:
                        item.environment_id = env_spec.id
                        item.subtheme = env_spec.name
                    env_raw.extend(img_items)

            # Calculate effective minimum duration accounting for slow-motion playback speed
            speed_mult = float(req.playback_speed or 0.5)
            effective_min_dur = max(4.0, (req.min_duration or 15.0) * speed_mult) if req.media_type != "image" else 5.0

            # Filter for this environment
            env_filtered = candidate_service.filter_candidates(
                candidates=env_raw,
                preset=env_preset,
                min_duration=effective_min_dur,
                max_duration=req.max_duration,
                aspect_ratio=req.aspect_ratio,
                resolution=req.resolution,
                exclude_all_history=req.exclude_all_history,
                db=db
            )
            all_raw.extend(env_raw)

            # Fast local intent descriptor for candidate scoring
            active_mode = req.studio_mode or "meditation"
            env_dummy_analysis = IntentAnalysisResult(
                intent=env_spec.name,
                mood=["peaceful", "calm", "serene"],
                energy_level="low",
                visual_style="pure expansive nature landscape",
                preferred_colors=["green", "gold", "blue"],
                visual_motifs=[env_spec.name],
                avoid_visuals=["macro", "close up", "flower", "people", "boats", "buildings"]
            )
            
            async def score_single(c: CandidateItem):
                score_res = await scoring_service.score_candidate(
                    candidate=c,
                    analysis=env_dummy_analysis,
                    preset=env_preset,
                    studio_mode=active_mode,
                    shot_preference=req.shot_preference or "wide"
                )

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
            queries_to_run = list(beat.keywords) if beat.keywords else [beat.visual_subject]

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

            async def score_single_beat(c: CandidateItem):
                score_res = await scoring_service.score_candidate(
                    candidate=c,
                    analysis=beat_dummy_analysis,
                    preset=None,
                    studio_mode="documentary",
                    shot_preference=beat.camera_shot or "wide_vista"
                )
                c.intent_match = score_res.intent_match
                c.theme_match = score_res.theme_match
                c.calmness = score_res.calmness
                c.motion_intensity = score_res.motion_intensity
                c.visual_quality = score_res.visual_quality
                c.shot_type = score_res.shot_type or beat.camera_shot or "wide_vista"
                c.is_approved = score_res.keep
                c.rejection_reason = score_res.reason if not score_res.keep else None
                return c

            scored_beat = await asyncio.gather(*[score_single_beat(c) for c in beat_filtered])
            for c in scored_beat:
                if c.is_approved:
                    approved.append(c)
                else:
                    rejected.append(c)
    else:
        # Fallback to query search (up to 10 queries, 5 per provider = ~50-100 candidates)
        queries_to_run = list(req.queries[:10]) if req.queries else [
            "peaceful nature landscape daylight",
            "lush green forest daylight",
            "crystal clear turquoise ocean calm waves",
            "still alpine lake reflection daylight",
            "bright wildflower meadow sunny day"
        ]
        preset = NATURE_PRESETS.get(req.preset_name) if req.preset_name else None

        for q in queries_to_run:
            tasks = []
            if req.enable_pexels:
                tasks.append(pexels_service.search(query=q, page=1, per_page=5, db=db))
            if req.enable_pixabay:
                tasks.append(pixabay_service.search(query=q, page=1, per_page=5, db=db))
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, list):
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

        dummy_analysis = IntentAnalysisResult(
            intent=" ".join(queries_to_run),
            mood=["peaceful", "calm"],
            visual_style="pure nature landscape"
        )

        async def score_single_generic(c: CandidateItem):
            score_res = await scoring_service.score_candidate(
                candidate=c,
                analysis=dummy_analysis,
                preset=preset,
                studio_mode=req.studio_mode or "meditation",
                shot_preference=req.shot_preference or "wide"
            )

            c.intent_match = score_res.intent_match
            c.theme_match = score_res.theme_match
            c.calmness = score_res.calmness
            c.motion_intensity = score_res.motion_intensity
            c.visual_quality = score_res.visual_quality
            c.shot_type = score_res.shot_type or "wide_vista"
            c.subtheme = score_res.subtheme if hasattr(score_res, 'subtheme') and score_res.subtheme else c.subtheme
            c.is_approved = score_res.keep
            c.rejection_reason = score_res.reason if not score_res.keep else None
            return c

        scored_generic = await asyncio.gather(*[score_single_generic(c) for c in filtered[:100]])
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
                per_page_count = min(15, max(5, int(req.maximum_unique_videos / max(1, len(queries)))))
                for q in queries[:10]:
                    if len(collected_candidates) >= req.maximum_unique_videos:
                        break
                    tasks = []
                    if req.enable_pexels:
                        tasks.append(pexels_service.search(query=q, page=1, per_page=per_page_count, db=db))
                    if req.enable_pixabay:
                        tasks.append(pixabay_service.search(query=q, page=1, per_page=per_page_count, db=db))
                    if tasks:
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        for res in results:
                            if isinstance(res, list):
                                collected_candidates.extend(res)

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
            # For meditation/nature loops: compute natural, soothing clip duration based on target length
            # Adaptively distribute time across the approved candidate pool to prevent excessive loop cycles
            num_pool = max(1, len(approved_pool))
            duration_per_clip = target_dur_sec / num_pool

            if req.maximum_clip_duration and req.maximum_clip_duration > 0:
                effective_clip_cap = float(req.maximum_clip_duration)
            elif target_dur_sec >= 900:  # 15+ minutes
                effective_clip_cap = max(30.0, min(60.0, duration_per_clip))
            elif target_dur_sec >= 300:  # 5-15 minutes
                effective_clip_cap = max(20.0, min(45.0, duration_per_clip))
            else:
                effective_clip_cap = max(15.0, min(30.0, duration_per_clip))

            if req.minimum_clip_duration and req.minimum_clip_duration > 0:
                effective_clip_cap = max(effective_clip_cap, float(req.minimum_clip_duration))

            should_loop = (req.loop_mode == "loop_to_target") if req.loop_mode else False
            sequence_data = selection_service.plan_sequence(
                approved_candidates=approved_pool,
                target_duration_seconds=target_dur_sec,
                max_unique_videos=max(req.maximum_unique_videos, len(approved_pool)),
                transition_duration=req.transition_duration,
                studio_mode=active_mode,
                allow_looping=should_loop,
                playback_speed=req.playback_speed or 0.5,
                clip_duration_cap=effective_clip_cap
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

        # Auto-purge intermediate scratch files in job_dir to prevent disk bloat
        try:
            for pattern in ["norm_clip_*.mp4", "master_*.mp4", "video_merged.mp4", "raw_clip_*.mp4", "mixed_voiceover.aac", "meditation_soundtrack.aac"]:
                for temp_f in job_dir.glob(pattern):
                    try:
                        temp_f.unlink()
                    except Exception:
                        pass
            logger.info(f"Auto-purged intermediate scratch files for job {job_id}")
        except Exception as e:
            logger.warning(f"Error auto-purging scratch files for {job_id}: {e}")

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
            used_in_titles=json.loads(item.used_in_titles) if getattr(item, "used_in_titles", None) else [],
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


@router.get("/library/download/{item_id}")
async def download_library_video(item_id: int, db: Session = Depends(get_db)):
    """Direct file download endpoint for a library video."""
    item = db.query(VideoLibraryItem).filter(VideoLibraryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Library video item not found")

    safe_subtheme = "".join(c for c in (item.subtheme or "video") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    download_filename = f"{safe_subtheme}_{item.source_video_id}.mp4"

    # 1. If local downloaded video file exists on disk, serve as attachment
    if item.local_file_path:
        lp = Path(item.local_file_path)
        if lp.exists():
            return FileResponse(
                path=str(lp),
                media_type="video/mp4",
                filename=download_filename,
                headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
            )

    # 2. Dynamic resolution via API for Pexels or Pixabay
    if item.source == "pexels":
        try:
            vid_url = await pexels_service.get_video_play_url(item.source_video_id)
            if vid_url:
                return RedirectResponse(url=vid_url, status_code=307)
        except Exception as pex_err:
            logger.warning(f"Error resolving Pexels download for {item.source_video_id}: {pex_err}")

    if item.source == "pixabay":
        try:
            vid_url = await pixabay_service.get_video_play_url(item.source_video_id)
            if vid_url:
                return RedirectResponse(url=vid_url, status_code=307)
        except Exception as pix_err:
            logger.warning(f"Error resolving Pixabay download for {item.source_video_id}: {pix_err}")

    # 3. Fallback to source_url
    if item.source_url and item.source_url.startswith("http"):
        return RedirectResponse(url=item.source_url, status_code=307)

    raise HTTPException(status_code=404, detail="Video download URL unavailable")


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


@router.post("/library/batch-save-candidates")
async def batch_save_candidates(req: BatchSaveCandidatesRequest, db: Session = Depends(get_db)):
    """Saves selected candidates to the video library in bulk and tags them as used in the project title."""
    saved_count = 0
    clean_title = (req.title or "").strip()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        for candidate in req.candidates:
            existing = db.query(VideoLibraryItem).filter(
                VideoLibraryItem.source == candidate.source,
                VideoLibraryItem.source_video_id == candidate.source_video_id
            ).first()

            local_path = candidate.local_file_path
            if not local_path or not Path(local_path).exists():
                lib_file = settings.LIBRARY_DIR / f"{candidate.source}_{candidate.source_video_id}.mp4"
                if lib_file.exists():
                    local_path = str(lib_file)
                else:
                    target_url = candidate.download_url
                    if not target_url and candidate.video_files:
                        target_url = candidate.video_files[0].link
                    if not target_url and candidate.source == "pexels":
                        try:
                            target_url = await pexels_service.get_video_play_url(candidate.source_video_id)
                        except Exception:
                            pass
                    if not target_url and candidate.source == "pixabay":
                        try:
                            target_url = await pixabay_service.get_video_play_url(candidate.source_video_id)
                        except Exception:
                            pass
                    if not target_url:
                        target_url = candidate.preview_url

                    if target_url and target_url.startswith("http"):
                        try:
                            resp = await client.get(target_url)
                            if resp.status_code == 200 and len(resp.content) > 1000:
                                with open(lib_file, "wb") as f:
                                    f.write(resp.content)
                                local_path = str(lib_file)
                        except Exception as dl_err:
                            logger.warning(f"Could not download candidate {candidate.source_video_id} for library: {dl_err}")

            if existing:
                existing.subtheme = candidate.subtheme or existing.subtheme
                existing.is_approved = True
                if local_path:
                    existing.local_file_path = local_path
                if candidate.download_url:
                    existing.source_url = candidate.download_url

                if clean_title:
                    try:
                        titles = json.loads(existing.used_in_titles) if existing.used_in_titles else []
                    except Exception:
                        titles = []
                    if clean_title not in titles:
                        titles.append(clean_title)
                        existing.used_in_titles = json.dumps(titles)
                existing.times_used = (existing.times_used or 0) + 1
                existing.last_used_at = datetime.datetime.utcnow()
                saved_count += 1
            else:
                tags = getattr(candidate, 'tags', []) or ([candidate.search_query] if candidate.search_query else [])
                title_list = [clean_title] if clean_title else []
                item = VideoLibraryItem(
                    source=candidate.source,
                    source_video_id=candidate.source_video_id,
                    source_url=candidate.download_url or candidate.source_url,
                    preview_url=candidate.preview_url,
                    local_file_path=local_path,
                    creator_name=candidate.creator_name,
                    creator_url=candidate.creator_url,
                    duration=candidate.duration,
                    width=candidate.width,
                    height=candidate.height,
                    subtheme=candidate.subtheme or candidate.environment_id or "Nature Scene",
                    intent_tags=json.dumps(tags),
                    mood_tags=json.dumps([candidate.subtheme] if candidate.subtheme else []),
                    used_in_titles=json.dumps(title_list),
                    intent_score=candidate.intent_match or 8.5,
                    theme_score=candidate.theme_match or 8.5,
                    calmness_score=candidate.calmness or 8.5,
                    motion_score=candidate.motion_intensity or 2.0,
                    visual_quality_score=candidate.visual_quality or 8.5,
                    is_approved=True,
                    times_used=1,
                    last_used_at=datetime.datetime.utcnow()
                )
                db.add(item)
                saved_count += 1

    db.commit()
    return {
        "status": "success",
        "saved_count": saved_count,
        "title": clean_title,
        "message": f"Successfully saved {saved_count} clips tagged as used in '{clean_title or 'project'}'."
    }


@router.post("/candidates/download-zip")
async def download_candidates_zip(req: DownloadCandidatesZipRequest):
    """Downloads all selected raw candidate clips and packages them into a ZIP archive without rendering."""
    if not req.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided to download")

    clean_title = (req.title or "selected_clips").strip()
    safe_title = "".join(c for c in clean_title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_") or "selected_clips"
    zip_filename = f"{safe_title}_clips.zip"

    zip_buffer = io.BytesIO()

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for idx, cand in enumerate(req.candidates):
                subtheme = "".join(c for c in (cand.subtheme or "clip") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
                ext = ".mp4"
                if cand.preview_url and any(cand.preview_url.lower().endswith(e) for e in [".jpg", ".jpeg", ".png"]):
                    ext = ".jpg"
                filename = f"{idx+1:02d}_{subtheme}_{cand.source}_{cand.source_video_id}{ext}"

                file_bytes = None
                if cand.local_file_path and Path(cand.local_file_path).exists():
                    try:
                        file_bytes = Path(cand.local_file_path).read_bytes()
                    except Exception:
                        file_bytes = None

                if not file_bytes:
                    lib_file = settings.LIBRARY_DIR / f"{cand.source}_{cand.source_video_id}.mp4"
                    if lib_file.exists():
                        try:
                            file_bytes = lib_file.read_bytes()
                        except Exception:
                            file_bytes = None

                if not file_bytes:
                    target_url = cand.download_url
                    if not target_url and cand.video_files:
                        target_url = cand.video_files[0].link
                    if not target_url and cand.source == "pexels":
                        try:
                            target_url = await pexels_service.get_video_play_url(cand.source_video_id)
                        except Exception:
                            pass
                    if not target_url and cand.source == "pixabay":
                        try:
                            target_url = await pixabay_service.get_video_play_url(cand.source_video_id)
                        except Exception:
                            pass
                    if not target_url:
                        target_url = cand.preview_url

                    if target_url and target_url.startswith("http"):
                        try:
                            resp = await client.get(target_url)
                            if resp.status_code == 200:
                                file_bytes = resp.content
                        except Exception as dl_err:
                            logger.warning(f"Could not download candidate {cand.source_video_id} for zip: {dl_err}")

                if file_bytes:
                    zip_file.writestr(filename, file_bytes)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


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


@router.post("/library/batch-delete")
def batch_delete_library_items(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Batch delete multiple library items and their local video files."""
    item_ids = payload.get("item_ids", [])
    if not item_ids:
        return {"status": "noop", "deleted_count": 0}

    deleted_count = 0
    for item_id in item_ids:
        item = db.query(VideoLibraryItem).filter(VideoLibraryItem.id == item_id).first()
        if item:
            if item.local_file_path:
                p = Path(item.local_file_path)
                if p.exists():
                    try:
                        p.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete local video file {p}: {e}")
            db.delete(item)
            deleted_count += 1

    db.commit()
    return {"status": "batch_deleted", "deleted_count": deleted_count}


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
            download_url=f"/api/jobs/{j.id}/download" if j.status == "completed" else None,
            error_message=j.error_message,
            current_stage=j.current_stage
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


@router.get("/storage/stats")
def get_disk_storage_stats():
    """Returns live disk space breakdown for scratch files, renders, library, cache, and previews."""
    from backend.app.services.cleanup_service import get_storage_stats
    return get_storage_stats()


class StoragePurgeRequest(BaseModel):
    target: str = "scratch_jobs"  # 'scratch_jobs', 'cache_previews', 'renders', 'library', 'all'
    keep_final_videos: bool = True


@router.post("/storage/purge")
def purge_storage_category(req: StoragePurgeRequest):
    """Purges selected storage category to reclaim disk space."""
    from backend.app.services.cleanup_service import (
        purge_intermediate_scratch,
        purge_cache_and_previews,
        purge_renders,
        purge_library_files
    )

    t = req.target.lower().strip()
    total_reclaimed = 0.0
    total_deleted = 0
    details = {}

    if t in ("scratch_jobs", "all"):
        res = purge_intermediate_scratch(keep_final_videos=req.keep_final_videos)
        total_reclaimed += res.get("reclaimed_mb", 0.0)
        total_deleted += res.get("deleted_count", 0)
        details["scratch_jobs"] = res

    if t in ("cache_previews", "all"):
        res = purge_cache_and_previews()
        total_reclaimed += res.get("reclaimed_mb", 0.0)
        total_deleted += res.get("deleted_count", 0)
        details["cache_previews"] = res

    if t in ("renders", "all"):
        res = purge_renders()
        total_reclaimed += res.get("reclaimed_mb", 0.0)
        total_deleted += res.get("deleted_count", 0)
        details["renders"] = res

    if t in ("library", "all"):
        res = purge_library_files()
        total_reclaimed += res.get("reclaimed_mb", 0.0)
        total_deleted += res.get("deleted_count", 0)
        details["library"] = res

    return {
        "status": "success",
        "target": t,
        "deleted_count": total_deleted,
        "reclaimed_mb": round(total_reclaimed, 2),
        "details": details
    }


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


# --- AUDIO LAB / AUDIO SPACER DASHBOARD ENDPOINTS ---

@router.get("/audio/projects", response_model=AudioProjectListResponse)
def get_audio_projects(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Lists all saved audio projects / inbox tracks with status counts.
    """
    query = db.query(AudioProject).order_by(AudioProject.created_at.desc())
    all_projects = query.all()

    total_count = len(all_projects)
    unprocessed_count = sum(1 for p in all_projects if p.status == "unprocessed")
    processed_count = sum(1 for p in all_projects if p.status == "processed")

    filtered_projects = all_projects
    if status and status != "all":
        filtered_projects = [p for p in all_projects if p.status == status]

    project_schemas = []
    for p in filtered_projects:
        try:
            peaks = json.loads(p.waveform_peaks_json) if p.waveform_peaks_json else []
        except Exception:
            peaks = []
        try:
            segs = [AudioSegmentSchema(**s) for s in json.loads(p.segments_json)] if p.segments_json else []
        except Exception:
            segs = []
        try:
            sils = [AudioSilenceIntervalSchema(**s) for s in json.loads(p.silence_intervals_json)] if p.silence_intervals_json else []
        except Exception:
            sils = []

        audio_stream_name = p.spaced_filename if (p.status == "processed" and p.spaced_filename) else p.filename
        download_url = f"/api/audio/download/{p.spaced_filename}" if p.spaced_filename else None

        project_schemas.append(
            AudioProjectSchema(
                id=p.id,
                file_id=p.file_id,
                title=p.title,
                original_name=p.original_name,
                filename=p.filename,
                duration=p.duration,
                status=p.status,
                script_text=p.script_text,
                waveform_peaks=peaks,
                segments=segs,
                silence_intervals=sils,
                spaced_filename=p.spaced_filename,
                spaced_duration=p.spaced_duration or 0.0,
                audio_url=f"/api/audio/stream/{audio_stream_name}",
                download_url=download_url,
                created_at=p.created_at,
                updated_at=p.updated_at
            )
        )

    return AudioProjectListResponse(
        projects=project_schemas,
        total_count=total_count,
        unprocessed_count=unprocessed_count,
        processed_count=processed_count
    )


@router.post("/audio/projects/batch-upload", response_model=List[AudioProjectSchema])
async def batch_upload_audio(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads multiple raw audio files to the persistent Audio Inbox.
    Unprocessed audio tracks will remain stored until the user is ready to pace them.
    """
    created_projects = []

    for file in files:
        file_uuid = uuid.uuid4().hex[:8]
        clean_filename = f"{file_uuid}_{file.filename}"
        target_path = settings.AUDIO_DIR / clean_filename

        with open(target_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            analysis = await audio_spacer_service.analyze_audio_file(
                input_file_path=target_path,
                script_text=None
            )
            wav_name = Path(analysis["normalized_wav_path"]).name

            # Create or update AudioProject in DB
            db_project = AudioProject(
                file_id=analysis["file_id"],
                title=file.filename or clean_filename,
                original_name=file.filename or clean_filename,
                filename=wav_name,
                duration=analysis["duration"],
                status="unprocessed",
                script_text="",
                waveform_peaks_json=json.dumps(analysis["waveform_peaks"]),
                segments_json=json.dumps([s for s in analysis["segments"]]),
                silence_intervals_json=json.dumps([s for s in analysis["silence_intervals"]]),
                spaced_filename=None,
                spaced_duration=0.0
            )
            db.add(db_project)
            db.commit()
            db.refresh(db_project)

            created_projects.append(
                AudioProjectSchema(
                    id=db_project.id,
                    file_id=db_project.file_id,
                    title=db_project.title,
                    original_name=db_project.original_name,
                    filename=db_project.filename,
                    duration=db_project.duration,
                    status=db_project.status,
                    script_text=db_project.script_text,
                    waveform_peaks=analysis["waveform_peaks"],
                    segments=[AudioSegmentSchema(**seg) for seg in analysis["segments"]],
                    silence_intervals=[AudioSilenceIntervalSchema(**s) for s in analysis["silence_intervals"]],
                    spaced_filename=None,
                    spaced_duration=0.0,
                    audio_url=f"/api/audio/stream/{wav_name}",
                    download_url=None,
                    created_at=db_project.created_at,
                    updated_at=db_project.updated_at
                )
            )
        except Exception as e:
            logger.warning(f"Error processing batch item {file.filename}: {e}")

    return created_projects


@router.get("/audio/projects/{project_id}", response_model=AudioProjectSchema)
async def get_audio_project(project_id: int, db: Session = Depends(get_db)):
    """
    Loads an audio project into the Audio Lab editor with full state.
    """
    p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Audio project not found")

    try:
        peaks = json.loads(p.waveform_peaks_json) if p.waveform_peaks_json else []
    except Exception:
        peaks = []
    try:
        segs = [AudioSegmentSchema(**s) for s in json.loads(p.segments_json)] if p.segments_json else []
    except Exception:
        segs = []
    try:
        sils = [AudioSilenceIntervalSchema(**s) for s in json.loads(p.silence_intervals_json)] if p.silence_intervals_json else []
    except Exception:
        sils = []

    audio_stream_name = p.spaced_filename if (p.status == "processed" and p.spaced_filename) else p.filename
    download_url = f"/api/audio/download/{p.spaced_filename}" if p.spaced_filename else None

    return AudioProjectSchema(
        id=p.id,
        file_id=p.file_id,
        title=p.title,
        original_name=p.original_name,
        filename=p.filename,
        duration=p.duration,
        status=p.status,
        script_text=p.script_text,
        waveform_peaks=peaks,
        segments=segs,
        silence_intervals=sils,
        spaced_filename=p.spaced_filename,
        spaced_duration=p.spaced_duration or 0.0,
        audio_url=f"/api/audio/stream/{audio_stream_name}",
        download_url=download_url,
        created_at=p.created_at,
        updated_at=p.updated_at
    )


@router.patch("/audio/projects/{project_id}/script")
def update_project_script(
    project_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Autosaves updated reference script text directly to SQLite database for cross-device persistence.
    """
    p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Audio project not found")

    new_script = payload.get("script_text", "")
    p.script_text = new_script
    if "segments" in payload:
        p.segments_json = json.dumps(payload.get("segments", []))
    p.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(p)

    return {
        "status": "saved",
        "id": p.id,
        "script_text": p.script_text,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    }


@router.patch("/audio/projects/{project_id}/segments")
def update_audio_project_segments(
    project_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Autosaves modified segments (e.g. after merging or splitting phrases) directly to SQLite database.
    """
    p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Audio project not found")

    segs = payload.get("segments", [])
    p.segments_json = json.dumps(segs)
    p.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(p)

    return {
        "status": "saved",
        "id": p.id,
        "segments_count": len(segs),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    }


@router.delete("/audio/projects/{project_id}")
def delete_audio_project(project_id: int, db: Session = Depends(get_db)):
    """
    Deletes an audio project and associated disk files.
    """
    p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Audio project not found")

    # Clean up files from disk
    for f in [p.filename, p.spaced_filename]:
        if f:
            disk_file = settings.AUDIO_DIR / os.path.basename(f)
            if disk_file.exists():
                try:
                    disk_file.unlink()
                except Exception:
                    pass

    db.delete(p)
    db.commit()
    return {"status": "deleted", "id": project_id}



@router.post("/audio/upload", response_model=AudioAnalysisResponse)
async def upload_and_analyze_audio(
    file: UploadFile = File(...),
    script_text: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload voiceover audio file, normalize to PCM WAV, generate waveform peaks,
    detect natural silences, parse script tags, and save to SQLite.
    """
    file_uuid = uuid.uuid4().hex[:8]
    clean_filename = f"{file_uuid}_{file.filename}"
    target_path = settings.AUDIO_DIR / clean_filename

    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        analysis = await audio_spacer_service.analyze_audio_file(
            input_file_path=target_path,
            script_text=script_text
        )
        wav_name = Path(analysis["normalized_wav_path"]).name

        # Save to DB
        db_proj = AudioProject(
            file_id=analysis["file_id"],
            title=file.filename or clean_filename,
            original_name=file.filename or clean_filename,
            filename=wav_name,
            duration=analysis["duration"],
            status="unprocessed",
            script_text=script_text or "",
            waveform_peaks_json=json.dumps(analysis["waveform_peaks"]),
            segments_json=json.dumps(analysis["segments"]),
            silence_intervals_json=json.dumps(analysis["silence_intervals"]),
            spaced_filename=None,
            spaced_duration=0.0
        )
        db.add(db_proj)
        db.commit()

        return AudioAnalysisResponse(
            file_id=analysis["file_id"],
            original_name=file.filename or clean_filename,
            duration=analysis["duration"],
            waveform_peaks=analysis["waveform_peaks"],
            silence_intervals=[AudioSilenceIntervalSchema(**s) for s in analysis["silence_intervals"]],
            segments=[AudioSegmentSchema(**seg) for seg in analysis["segments"]],
            audio_url=f"/api/audio/stream/{wav_name}"
        )
    except Exception as e:
        logger.exception(f"Audio analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")


@router.post("/audio/analyze", response_model=AudioAnalysisResponse)
async def reanalyze_audio(req: AudioAnalysisRequest, db: Session = Depends(get_db)):
    """
    Re-analyzes an existing uploaded audio file with updated script text.
    """
    if not req.file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    wav_path = settings.AUDIO_DIR / f"{req.file_id}_norm.wav"
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file {req.file_id} not found on server")

    try:
        analysis = await audio_spacer_service.analyze_audio_file(
            input_file_path=wav_path,
            script_text=req.script_text
        )
        wav_name = wav_path.name

        # Update in DB
        db_proj = db.query(AudioProject).filter(AudioProject.file_id == req.file_id).first()
        if db_proj:
            db_proj.script_text = req.script_text or ""
            db_proj.segments_json = json.dumps(analysis["segments"])
            db.commit()

        return AudioAnalysisResponse(
            file_id=req.file_id,
            original_name=f"{req.file_id}.wav",
            duration=analysis["duration"],
            waveform_peaks=analysis["waveform_peaks"],
            silence_intervals=[AudioSilenceIntervalSchema(**s) for s in analysis["silence_intervals"]],
            segments=[AudioSegmentSchema(**seg) for seg in analysis["segments"]],
            audio_url=f"/api/audio/stream/{wav_name}"
        )
    except Exception as e:
        logger.exception(f"Re-analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Re-analysis failed: {str(e)}")


@router.post("/audio/align-script", response_model=AudioAnalysisResponse)
async def align_reference_script(
    req: AudioAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Aligns a pasted reference script with pause tags to the audio's existing timestamps & silences.
    """
    if not req.file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    wav_path = settings.AUDIO_DIR / f"{req.file_id}_norm.wav"
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file {req.file_id} not found")

    db_proj = db.query(AudioProject).filter(AudioProject.file_id == req.file_id).first()
    
    existing_silences = json.loads(db_proj.silence_intervals_json) if (db_proj and db_proj.silence_intervals_json) else []
    existing_segs = json.loads(db_proj.segments_json) if (db_proj and db_proj.segments_json) else []
    
    if not existing_silences:
        existing_silences = await audio_spacer_service.detect_silences(wav_path)

    with wave.open(str(wav_path), 'rb') as wf:
        total_duration = wf.getnframes() / wf.getframerate()

    new_segments = audio_spacer_service.align_script_with_transcript(
        script_text=req.script_text or "",
        current_segments=existing_segs,
        silences=existing_silences,
        total_duration=total_duration
    )

    peaks = audio_spacer_service.extract_waveform_peaks(wav_path, num_peaks=800)

    if db_proj:
        db_proj.script_text = req.script_text or ""
        db_proj.segments_json = json.dumps(new_segments)
        db_proj.silence_intervals_json = json.dumps(existing_silences)
        db.commit()

    return AudioAnalysisResponse(
        file_id=req.file_id,
        original_name=f"{req.file_id}.wav",
        duration=round(total_duration, 2),
        waveform_peaks=peaks,
        silence_intervals=[AudioSilenceIntervalSchema(**s) for s in existing_silences],
        segments=[AudioSegmentSchema(**seg) for seg in new_segments],
        audio_url=f"/api/audio/stream/{wav_path.name}"
    )


@router.post("/audio/transcribe", response_model=AudioAnalysisResponse)
async def transcribe_audio_file(
    req: AudioAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Directly triggers AI speech-to-text transcription on an existing audio file using Gemini AI,
    updating the project phrase cards with the exact spoken words.
    """
    if not req.file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    db_proj = db.query(AudioProject).filter(AudioProject.file_id == req.file_id).first()

    wav_path = settings.AUDIO_DIR / f"{req.file_id}_norm.wav"
    if not wav_path.exists() and db_proj and db_proj.filename:
        alt_path = settings.AUDIO_DIR / db_proj.filename
        if alt_path.exists():
            wav_path = alt_path
    if not wav_path.exists():
        matches = list(settings.AUDIO_DIR.glob(f"{req.file_id}*"))
        if matches:
            wav_path = matches[0]
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file {req.file_id} not found")

    # Transcribe via Gemini
    transcriptions = await audio_spacer_service.transcribe_audio(wav_path)
    if not transcriptions:
        raise HTTPException(
            status_code=500,
            detail="Gemini AI transcription did not return phrases. Please verify your API key/quota and retry."
        )

    existing_silences = json.loads(db_proj.silence_intervals_json) if (db_proj and db_proj.silence_intervals_json) else []
    if not existing_silences:
        existing_silences = await audio_spacer_service.detect_silences(wav_path)

    with wave.open(str(wav_path), 'rb') as wf:
        total_duration = wf.getnframes() / wf.getframerate()

    new_segments = audio_spacer_service.align_segments(
        parsed_script=[],
        silences=existing_silences,
        total_duration=total_duration,
        transcriptions=transcriptions
    )

    peaks = audio_spacer_service.extract_waveform_peaks(wav_path, num_peaks=800)

    if db_proj:
        db_proj.segments_json = json.dumps(new_segments)
        db_proj.silence_intervals_json = json.dumps(existing_silences)
        db.commit()

    return AudioAnalysisResponse(
        file_id=req.file_id,
        original_name=f"{req.file_id}.wav",
        duration=round(total_duration, 2),
        waveform_peaks=peaks,
        silence_intervals=[AudioSilenceIntervalSchema(**s) for s in existing_silences],
        segments=[AudioSegmentSchema(**seg) for seg in new_segments],
        audio_url=f"/api/audio/stream/{wav_path.name}"
    )


async def run_project_transcription(project_id: int):
    """
    Background worker that runs Gemini AI speech transcription for an AudioProject,
    aligns segments, and updates SQLite database with the results.
    """
    logger.info(f"Starting background transcription task for project {project_id}")
    db = SessionLocal()
    try:
        p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
        if not p:
            logger.warning(f"AudioProject {project_id} not found for background transcription.")
            return

        # Resolve audio file
        wav_path = settings.AUDIO_DIR / f"{p.file_id}_norm.wav"
        if not wav_path.exists() and p.filename:
            alt_path = settings.AUDIO_DIR / p.filename
            if alt_path.exists():
                wav_path = alt_path
        if not wav_path.exists():
            matches = list(settings.AUDIO_DIR.glob(f"{p.file_id}*"))
            if matches:
                wav_path = matches[0]

        if not wav_path.exists():
            logger.error(f"Audio file for project {project_id} ({p.file_id}) not found on disk.")
            p.status = "failed"
            db.commit()
            return

        # Run transcription via Gemini
        transcriptions = await audio_spacer_service.transcribe_audio(wav_path)

        existing_silences = json.loads(p.silence_intervals_json) if p.silence_intervals_json else []
        if not existing_silences:
            existing_silences = await audio_spacer_service.detect_silences(wav_path)

        with wave.open(str(wav_path), 'rb') as wf:
            total_duration = wf.getnframes() / wf.getframerate()

        new_segments = audio_spacer_service.align_segments(
            parsed_script=[],
            silences=existing_silences,
            total_duration=total_duration,
            transcriptions=transcriptions
        )

        peaks = audio_spacer_service.extract_waveform_peaks(wav_path, num_peaks=800)

        p.segments_json = json.dumps(new_segments)
        p.silence_intervals_json = json.dumps(existing_silences)
        p.waveform_peaks_json = json.dumps(peaks)
        p.status = "transcribed"
        p.updated_at = datetime.datetime.utcnow()
        db.commit()
        logger.info(f"Background transcription complete for project {project_id}: {len(new_segments)} phrases extracted.")
    except Exception as e:
        logger.error(f"Background transcription failed for project {project_id}: {e}")
        try:
            p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
            if p:
                p.status = "failed"
                p.updated_at = datetime.datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/audio/projects/{project_id}/transcribe-async")
async def start_async_project_transcription(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Triggers asynchronous background transcription for an audio project.
    Allows user to navigate away, upload more files, or close the browser while the VPS transcribes.
    """
    p = db.query(AudioProject).filter(AudioProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Audio project not found")

    p.status = "transcribing"
    p.updated_at = datetime.datetime.utcnow()
    db.commit()

    # Launch background task
    background_tasks.add_task(run_project_transcription, project_id)

    return {
        "status": "transcribing",
        "project_id": project_id,
        "message": "AI speech transcription started in the background. You can safely leave this view."
    }




@router.post("/audio/process", response_model=AudioProcessResponse)
async def process_spaced_audio(req: AudioProcessRequest, db: Session = Depends(get_db)):
    """
    Slices raw PCM audio at exact silence midpoints, injects silence buffers,
    applies smooth S-curve fades, masters the final spaced MP3, and updates project status.
    """
    wav_path = settings.AUDIO_DIR / f"{req.file_id}_norm.wav"
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file {req.file_id} not found")

    output_mp3_name = f"{req.file_id}_spaced.mp3"
    output_mp3_path = settings.AUDIO_DIR / output_mp3_name

    try:
        result = await audio_spacer_service.splice_and_render_spaced_audio(
            input_wav=wav_path,
            segments=[s.model_dump() for s in req.segments],
            output_mp3=output_mp3_path,
            fade_duration=req.fade_duration or 0.05
        )

        # Update DB Project
        db_proj = db.query(AudioProject).filter(AudioProject.file_id == req.file_id).first()
        if db_proj:
            db_proj.status = "processed"
            db_proj.spaced_filename = output_mp3_name
            db_proj.spaced_duration = result["spaced_duration"]
            db_proj.segments_json = json.dumps([s.model_dump() for s in req.segments])
            db.commit()

        return AudioProcessResponse(
            file_id=req.file_id,
            original_duration=result["original_duration"],
            spaced_duration=result["spaced_duration"],
            total_pauses_count=result["total_pauses_count"],
            total_silence_added=result["total_silence_added"],
            waveform_peaks=result["waveform_peaks"],
            spaced_filename=output_mp3_name,
            audio_url=f"/api/audio/stream/{output_mp3_name}",
            download_url=f"/api/audio/download/{output_mp3_name}"
        )
    except Exception as e:
        logger.exception(f"Spacing process error: {e}")
        raise HTTPException(status_code=500, detail=f"Audio spacing failed: {str(e)}")


@router.get("/audio/stream/{filename}")
async def stream_audio_file(filename: str):
    """
    Streams audio file (WAV / MP3) from the audio storage directory.
    """
    clean_name = os.path.basename(filename)
    file_path = settings.AUDIO_DIR / clean_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    media_type = "audio/mpeg" if clean_name.lower().endswith(".mp3") else "audio/wav"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Accept-Ranges": "bytes"}
    )


@router.get("/audio/download/{filename}")
async def download_audio_file(
    filename: str,
    title: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Direct file download endpoint for processed MP3 audio.
    Sets the download filename to <title>_spaced.mp3.
    """
    clean_name = os.path.basename(filename)
    file_path = settings.AUDIO_DIR / clean_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Determine user-friendly download filename: <title>_spaced.mp3
    download_title = title
    if not download_title:
        # Look up by spaced_filename or filename in db
        proj = db.query(AudioProject).filter(
            (AudioProject.spaced_filename == clean_name) | (AudioProject.filename == clean_name)
        ).first()
        if proj:
            download_title = proj.title or proj.original_name

    if download_title:
        base_name = Path(download_title).stem
        download_filename = f"{base_name}_spaced.mp3"
    else:
        base_name = Path(clean_name).stem
        if not base_name.endswith("_spaced"):
            base_name = f"{base_name}_spaced"
        download_filename = f"{base_name}.mp3"

    media_type = "audio/mpeg" if clean_name.lower().endswith(".mp3") else "audio/wav"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
    )


@router.post("/audio/send-to-studio")
async def send_audio_to_studio(
    payload: Dict[str, Any] = Body(...)
):
    """
    Transfers processed audio file to music directory and returns studio metadata.
    """
    filename = payload.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="filename is required")

    clean_name = os.path.basename(filename)
    source_path = settings.AUDIO_DIR / clean_name

    if not source_path.exists():
        raise HTTPException(status_code=404, detail=f"Source audio {clean_name} not found")

    studio_filename = f"paced_{uuid.uuid4().hex[:6]}_{clean_name}"
    target_path = settings.MUSIC_DIR / studio_filename
    shutil.copy2(source_path, target_path)

    probe = await ffmpeg_service.probe_file(target_path)
    dur_seconds = float(probe.get("duration", 0.0))
    dur_minutes = max(1, round(dur_seconds / 60.0)) if dur_seconds > 60 else round(dur_seconds, 1)

    return {
        "filename": studio_filename,
        "original_name": clean_name,
        "path": str(target_path),
        "duration_seconds": dur_seconds,
        "duration_minutes": dur_minutes,
        "audio_url": f"/api/audio/stream/{clean_name}"
    }


