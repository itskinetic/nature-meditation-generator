import asyncio
import datetime
import os
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.config import settings
from backend.app.database import Base
from backend.app.models import VideoLibraryItem, GenerationJob, SearchCache
from backend.app.schemas import (
    CandidateItem, IntentAnalysisResult, PresetSchema, ScoringResult
)
from backend.app.presets.nature_presets import NATURE_PRESETS
from backend.app.services.intent_service import intent_service
from backend.app.services.pexels_service import pexels_service
from backend.app.services.pixabay_service import pixabay_service
from backend.app.services.candidate_service import candidate_service
from backend.app.services.scoring_service import scoring_service
from backend.app.services.library_service import library_service
from backend.app.services.selection_service import selection_service
from backend.app.services.ffmpeg_service import ffmpeg_service
from backend.app.services.music_service import music_service


@pytest.fixture
def db_session():
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.mark.asyncio
async def test_intent_extraction_and_query_generation():
    result = await intent_service.analyze(
        title="Softening the Heart",
        script="Let your breath soften into the tranquil woods.",
        preset_name="Calm Misty Forest"
    )
    assert isinstance(result, IntentAnalysisResult)
    assert "softening" in result.intent.lower() or "relaxation" in result.intent.lower()
    assert len(result.mood) > 0
    assert len(result.generated_queries) > 0
    assert "people" in result.avoid_visuals
    assert result.energy_level == "very low"


@pytest.mark.asyncio
async def test_pexels_search_and_pagination(db_session):
    # Tests offline/fixture or online Pexels search
    res = await pexels_service.search("misty forest", page=1, per_page=10, db=db_session)
    assert len(res) > 0
    first = res[0]
    assert first.source == "pexels"
    assert first.duration > 0
    assert first.width >= 1280

    # Test cache persistence
    cached_res = await pexels_service.search("misty forest", page=1, per_page=10, db=db_session)
    assert len(cached_res) == len(res)


@pytest.mark.asyncio
async def test_pixabay_search(db_session):
    res = await pixabay_service.search("forest stream", page=1, per_page=10, db=db_session)
    assert len(res) > 0
    assert res[0].source == "pixabay"


def test_candidate_duplicate_removal_and_negative_filtering(db_session):
    preset = NATURE_PRESETS["Calm Misty Forest"]
    analysis = IntentAnalysisResult(
        intent="relaxation",
        mood=["peaceful"],
        energy_level="very low",
        visual_style="woodland",
        preferred_colors=["green"],
        visual_motifs=["misty trees"],
        avoid_visuals=["people", "crowds", "cars"],
        generated_queries=["misty forest"]
    )

    candidates = [
        # Valid candidate 1
        CandidateItem(
            source="pexels",
            source_video_id="v1",
            source_url="https://pexels.com/v1",
            duration=25.0,
            width=1920,
            height=1080,
            preview_url="https://preview.jpg",
            search_query="foggy woodland",
            creator_name="Nature Cam"
        ),
        # Duplicate by ID
        CandidateItem(
            source="pexels",
            source_video_id="v1",
            source_url="https://pexels.com/v1_dup",
            duration=25.0,
            width=1920,
            height=1080,
            preview_url="https://preview.jpg"
        ),
        # Duplicate by URL
        CandidateItem(
            source="pexels",
            source_video_id="v2",
            source_url="https://pexels.com/v1",
            duration=25.0,
            width=1920,
            height=1080,
            preview_url="https://preview.jpg"
        ),
        # Negative term in creator
        CandidateItem(
            source="pexels",
            source_video_id="v3",
            source_url="https://pexels.com/v3",
            duration=25.0,
            width=1920,
            height=1080,
            preview_url="https://preview.jpg",
            creator_name="Fast Car Racing"
        ),
        # Too short duration
        CandidateItem(
            source="pexels",
            source_video_id="v4",
            source_url="https://pexels.com/v4",
            duration=5.0,
            width=1920,
            height=1080,
            preview_url="https://preview.jpg"
        ),
    ]

    filtered = candidate_service.filter_candidates(
        candidates=candidates,
        preset=preset,
        analysis=analysis,
        min_duration=15.0,
        aspect_ratio="16:9",
        resolution="1080p",
        db=db_session
    )

    assert len(filtered) == 1
    assert filtered[0].source_video_id == "v1"


@pytest.mark.asyncio
async def test_scoring_validation():
    preset = NATURE_PRESETS["Calm Misty Forest"]
    analysis = IntentAnalysisResult(
        intent="peaceful grounding",
        mood=["peaceful"],
        energy_level="very low",
        visual_style="woodland",
        preferred_colors=["green"],
        visual_motifs=["misty trees"],
        avoid_visuals=["people", "storms", "cars"],
        generated_queries=["misty forest"]
    )

    # High quality calm nature candidate
    good_cand = CandidateItem(
        source="pexels",
        source_video_id="good_1",
        source_url="https://pexels.com/good_1",
        duration=30.0,
        width=1920,
        height=1080,
        preview_url="",
        search_query="misty forest quiet woodland",
        creator_name="Forest Serenity"
    )
    score_res = await scoring_service.score_candidate(good_cand, analysis, preset)
    assert score_res.keep is True
    assert score_res.intent_match >= 8.0
    assert score_res.theme_match >= 8.0
    assert score_res.calmness >= 8.0
    assert score_res.motion_intensity <= 4.0

    # Bad candidate with negative keyword
    bad_cand = CandidateItem(
        source="pexels",
        source_video_id="bad_1",
        source_url="https://pexels.com/bad_1",
        duration=30.0,
        width=1920,
        height=1080,
        preview_url="",
        search_query="lightning storm cars traffic",
        creator_name="Storm Chaser"
    )
    bad_score = await scoring_service.score_candidate(bad_cand, analysis, preset)
    assert bad_score.keep is False


def test_library_reuse_priority_and_cooldown(db_session):
    analysis = IntentAnalysisResult(
        intent="relaxation",
        mood=["peaceful"],
        energy_level="very low",
        visual_style="soft woodland",
        preferred_colors=["green"],
        visual_motifs=["misty trees"],
        avoid_visuals=["people"],
        generated_queries=["misty forest"]
    )

    # Item A: Fresh, never used
    item_a = VideoLibraryItem(
        source="pexels",
        source_video_id="item_a",
        duration=30.0,
        intent_score=9.0,
        theme_score=9.0,
        calmness_score=9.0,
        visual_quality_score=9.0,
        times_used=0,
        last_used_at=None,
        is_approved=True,
        local_file_path="dummy.mp4"
    )
    # Item B: Used 10 times, used 2 hours ago
    item_b = VideoLibraryItem(
        source="pexels",
        source_video_id="item_b",
        duration=30.0,
        intent_score=9.0,
        theme_score=9.0,
        calmness_score=9.0,
        visual_quality_score=9.0,
        times_used=10,
        last_used_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
        is_approved=True,
        local_file_path="dummy.mp4"
    )

    p_a = library_service.calculate_reuse_priority(item_a, analysis)
    p_b = library_service.calculate_reuse_priority(item_b, analysis)

    assert p_a > p_b  # Fresh video gets strictly higher priority


def test_selection_sequence_and_duration_math():
    candidates = [
        CandidateItem(
            source="library",
            source_video_id=f"c_{i}",
            source_url=f"https://source/{i}",
            duration=30.0,
            width=1920,
            height=1080,
            preview_url="",
            subtheme=f"subtheme_{i % 3}",
            creator_name=f"Creator_{i}",
            intent_match=9.0,
            theme_match=9.0,
            calmness=9.0,
            visual_quality=9.0,
            motion_intensity=2.0,
            is_approved=True
        )
        for i in range(4)
    ]

    # Target duration: 120 seconds
    plan = selection_service.plan_sequence(
        approved_candidates=candidates,
        target_duration_seconds=120.0,
        max_unique_videos=4,
        transition_duration=2.0,
        trimming=0.5
    )

    assert plan["unique_clip_count"] == 4
    assert plan["actual_duration_seconds"] >= 120.0
    assert len(plan["sequence"]) > 4
    assert plan["repeat_count"] >= 1


@pytest.mark.asyncio
async def test_music_service_and_probe():
    # Test audio generation
    test_audio = await music_service.prepare_meditation_audio(
        target_duration_seconds=5.0,
        job_dir=settings.CACHE_DIR
    )
    assert test_audio.exists()

    probe = await ffmpeg_service.probe_file(test_audio)
    assert probe["duration"] >= 4.5
    test_audio.unlink(missing_ok=True)
