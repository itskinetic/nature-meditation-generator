import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean
from backend.app.database import Base


class VideoLibraryItem(Base):
    __tablename__ = "video_library"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # "pexels", "pixabay", "local"
    source_video_id = Column(String(100), unique=True, index=True, nullable=False)
    source_url = Column(String(500), nullable=True)
    local_file_path = Column(String(500), nullable=True)
    preview_url = Column(String(500), nullable=True)
    local_preview_path = Column(String(500), nullable=True)
    creator_name = Column(String(200), nullable=True)
    creator_url = Column(String(500), nullable=True)
    duration = Column(Float, default=0.0)
    width = Column(Integer, default=1920)
    height = Column(Integer, default=1080)

    # Tags and classification
    intent_tags = Column(Text, default="[]")  # JSON string
    mood_tags = Column(Text, default="[]")    # JSON string
    subtheme = Column(String(100), nullable=True)

    # Visual scoring
    intent_score = Column(Float, default=0.0)
    theme_score = Column(Float, default=0.0)
    calmness_score = Column(Float, default=0.0)
    motion_score = Column(Float, default=0.0)
    visual_quality_score = Column(Float, default=0.0)

    # Usage tracking & status
    times_used = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    is_approved = Column(Boolean, default=False)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(String(100), primary_key=True, index=True)
    title = Column(String(300), nullable=True)
    script = Column(Text, nullable=True)
    detected_intent = Column(String(300), nullable=True)
    detected_mood = Column(Text, default="[]")  # JSON string
    preset = Column(String(100), nullable=True)

    target_duration_seconds = Column(Float, default=0.0)
    actual_duration_seconds = Column(Float, default=0.0)
    selected_video_count = Column(Integer, default=0)
    reused_video_count = Column(Integer, default=0)
    new_video_count = Column(Integer, default=0)
    sequence_repeat_count = Column(Integer, default=0)

    aspect_ratio = Column(String(20), default="16:9")
    resolution = Column(String(20), default="1080p")
    transition_type = Column(String(50), default="crossfade")
    transition_duration = Column(Float, default=2.0)
    music_file = Column(String(300), nullable=True)

    status = Column(String(50), default="pending")  # pending, analyzing, searching, scoring, downloading, rendering, completed, failed, cancelled
    progress = Column(Integer, default=0)
    current_stage = Column(String(200), default="Initialized")
    error_message = Column(Text, nullable=True)

    candidate_count = Column(Integer, default=0)
    approved_video_count = Column(Integer, default=0)
    rejected_video_count = Column(Integer, default=0)
    unique_sequence_duration = Column(Float, default=0.0)

    output_path = Column(String(500), nullable=True)
    metadata_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class SearchCache(Base):
    __tablename__ = "search_cache"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(300), unique=True, index=True, nullable=False)
    provider = Column(String(50), nullable=False)
    query = Column(String(300), nullable=False)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
