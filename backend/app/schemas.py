from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime


class PlannedEnvironment(BaseModel):
    id: str
    name: str
    icon: str = "🌿"
    keywords: List[str]
    suggested_clips: int = 4
    enabled: bool = True


class PresetSchema(BaseModel):
    id: Optional[str] = "sunlit_forest"
    name: str = "Sunlit Forest"
    icon: Optional[str] = "🌲"
    category: Optional[str] = "Forest"
    description: Optional[str] = "Bright forest"
    queries: List[str] = ["sunlight through trees"]
    subthemes: List[str] = ["sunbeams in trees"]
    negative_terms: List[str] = ["gloomy", "dark", "overcast", "people", "cars"]
    preferred_colors: List[str] = ["green", "gold"]
    visual_style: str = "bright natural landscape"


class IntentAnalysisRequest(BaseModel):
    title: Optional[str] = ""
    script: Optional[str] = ""
    manual_intent: Optional[str] = None
    manual_mood: Optional[List[str]] = None
    target_clips: Optional[int] = 16
    studio_mode: Optional[str] = "meditation"  # "meditation" | "documentary"
    media_type: Optional[str] = "video"  # "video" | "image" | "both"


class IntentAnalysisResult(BaseModel):
    intent: str
    mood: List[str]
    energy_level: str
    visual_style: str
    preferred_colors: List[str]
    visual_motifs: List[str]
    avoid_visuals: List[str]
    generated_queries: List[str] = []
    planned_environments: List[PlannedEnvironment] = []


class VideoFileVariant(BaseModel):
    id: Optional[str] = None
    quality: Optional[str] = None
    file_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    link: str


class CandidateItem(BaseModel):
    source: str = "pexels"  # pexels, pixabay, library, procedural
    source_video_id: str
    source_url: Optional[str] = ""
    creator_name: str = "Unknown"
    creator_url: Optional[str] = None
    search_query: Optional[str] = None
    duration: float = 15.0
    width: int = 1920
    height: int = 1080
    preview_url: Optional[str] = ""
    video_files: List[VideoFileVariant] = []
    download_url: Optional[str] = None
    local_file_path: Optional[str] = None

    # Media type & Ken Burns motion
    media_type: str = "video"  # "video" | "image"
    image_url: Optional[str] = None
    motion_style: Optional[str] = None  # "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down"
    beat_index: Optional[int] = None

    # Scores and status
    intent_match: float = 0.0
    theme_match: float = 0.0
    calmness: float = 0.0
    motion_intensity: float = 0.0
    visual_quality: float = 0.0
    shot_type: Optional[str] = None  # "wide_vista", "close_up", "low_angle", "still_ambient", "slow_glide"
    subtheme: Optional[str] = None
    environment_id: Optional[str] = None
    is_approved: bool = False
    rejection_reason: Optional[str] = None
    is_reused: bool = False
    times_used: int = 0
    last_used_at: Optional[datetime] = None


class VisualBeat(BaseModel):
    beat_index: int
    narrative_cue: str
    visual_subject: str
    habitat: str
    action_type: str = "ambient"
    camera_shot: str = "wide_vista"
    keywords: List[str] = []
    duration_seconds: float = 12.0
    start_time: float = 0.0
    end_time: float = 12.0
    assigned_candidate_id: Optional[str] = None
    assigned_candidate: Optional[CandidateItem] = None


class StoryboardBreakdownRequest(BaseModel):
    title: Optional[str] = ""
    script: str
    target_duration: Optional[float] = None
    studio_mode: Optional[str] = "documentary"
    audio_file: Optional[str] = None


class StoryboardBreakdownResult(BaseModel):
    title: str
    total_beats: int
    estimated_total_duration: float
    visual_beats: List[VisualBeat]


class SubtitleSegment(BaseModel):
    start_seconds: float
    end_seconds: float
    text: str
    words: Optional[List[Dict[str, Any]]] = None


class SubtitleConfig(BaseModel):
    enabled: bool = False
    style: str = "documentary_classic"  # "documentary_classic", "dynamic_highlight", "minimal_clean"
    burn_into_video: bool = True
    font_size: int = 24
    primary_color: str = "#FFFFFF"
    highlight_color: str = "#F59E0B"


class EnvironmentSearchSpec(BaseModel):
    id: str
    name: str
    queries: List[str]
    clip_count: int = 4


class SearchRequest(BaseModel):
    queries: Optional[List[str]] = None
    preset_name: Optional[str] = None
    environments: Optional[List[str]] = None
    environments_spec: Optional[List[EnvironmentSearchSpec]] = None
    storyboard_beats: Optional[List[VisualBeat]] = None
    enable_pexels: bool = True
    enable_pixabay: bool = True
    min_duration: float = 15.0
    max_duration: Optional[float] = None
    aspect_ratio: str = "16:9"
    resolution: str = "1080p"
    exclude_all_history: bool = False
    shot_preference: Optional[str] = "balanced"  # "balanced", "still", "macro", "wide"
    studio_mode: Optional[str] = "meditation"  # "meditation" | "documentary"
    media_type: Optional[str] = "video"  # "video" | "image" | "both"


class BanCandidateRequest(BaseModel):
    source_video_id: str
    source: str = "pexels"
    source_url: Optional[str] = None
    reason: Optional[str] = "Manually banned by user"
    creator_name: Optional[str] = None
    preview_url: Optional[str] = None


class SearchResponse(BaseModel):
    candidates: List[CandidateItem]
    total_found: int
    approved_count: int
    rejected_count: int


class ScoringResult(BaseModel):
    intent_match: float
    theme_match: float
    calmness: float
    motion_intensity: float
    visual_quality: float
    shot_type: Optional[str] = "wide_vista"
    unwanted_elements: List[str] = []
    subtheme: str = "nature"
    keep: bool = False
    reason: str = ""


class GenerationRequest(BaseModel):
    title: Optional[str] = "Softening the Heart"
    script: Optional[str] = ""
    preset: Optional[str] = "sunlit_forest"
    studio_mode: Optional[str] = "meditation"  # "meditation" | "documentary"
    media_type: Optional[str] = "video"  # "video" | "image" | "both"
    environments: Optional[List[str]] = None
    environment_clip_targets: Optional[Dict[str, int]] = None
    manual_intent: Optional[str] = None
    manual_mood: Optional[List[str]] = None
    shot_preference: Optional[str] = "balanced"
    storyboard_beats: Optional[List[VisualBeat]] = None
    subtitle_config: Optional[SubtitleConfig] = None
    voiceover_file: Optional[str] = None

    target_duration: float = 30.0  # value in unit
    duration_unit: str = "minutes"  # "minutes" or "hours" or "seconds" (for dry-run)

    maximum_unique_videos: int = 20
    minimum_clip_duration: float = 15.0
    maximum_clip_duration: Optional[float] = None

    aspect_ratio: str = "16:9"  # 16:9, 9:16, 1:1
    resolution: str = "1080p"  # 1080p, 4K

    transition_type: str = "crossfade"
    transition_duration: float = 2.0

    allow_reuse: bool = True
    avoid_recently_used: bool = True

    enable_pexels: bool = True
    enable_pixabay: bool = True

    audio_mode: str = "none"  # "none", "upload", "ambient_synth"
    music_file: Optional[str] = None
    music_volume: float = 0.5
    voiceover_volume: float = 1.0

    selected_candidate_ids: Optional[List[str]] = None
    candidate_pool: Optional[List[CandidateItem]] = None


class GenerationResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobProgressResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    current_stage: str
    candidate_count: int
    approved_video_count: int
    rejected_video_count: int
    reused_video_count: int
    new_video_count: int
    estimated_sequence_duration: float
    expected_repeat_count: int
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class JobDetailResponse(JobProgressResponse):
    title: Optional[str] = None
    script: Optional[str] = None
    detected_intent: Optional[str] = None
    detected_mood: List[str] = []
    preset: Optional[str] = None
    target_duration_seconds: float = 0.0
    actual_duration_seconds: float = 0.0
    selected_video_count: int = 0
    transition_type: str = "crossfade"
    transition_duration: float = 2.0
    metadata: Optional[Dict[str, Any]] = None
    candidates: List[CandidateItem] = []


class LibraryItemSchema(BaseModel):
    id: int
    source: str
    source_video_id: str
    source_url: Optional[str] = None
    local_file_path: Optional[str] = None
    preview_url: Optional[str] = None
    creator_name: Optional[str] = None
    creator_url: Optional[str] = None
    duration: float
    width: int
    height: int
    intent_tags: List[str] = []
    mood_tags: List[str] = []
    subtheme: Optional[str] = None
    intent_score: float
    theme_score: float
    calmness_score: float
    motion_score: float
    visual_quality_score: float
    times_used: int
    last_used_at: Optional[datetime] = None
    is_approved: bool
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class HistoryItemSchema(BaseModel):
    job_id: str
    title: Optional[str] = None
    detected_intent: Optional[str] = None
    duration: float
    target_duration: float
    number_of_clips: int
    number_of_reused_clips: int
    number_of_new_clips: int
    repeat_count: int
    render_date: Optional[datetime] = None
    status: str
    download_url: Optional[str] = None


class WebhookGenerateRequest(BaseModel):
    title: str
    script: Optional[str] = ""
    duration_hours: Optional[float] = 1.0
    duration_minutes: Optional[float] = None
    maximum_unique_videos: int = 20
    aspect_ratio: str = "16:9"
    resolution: str = "1080p"
    transition_type: str = "crossfade"
    transition_duration: float = 2.0
    allow_reuse: bool = True
    avoid_recently_used: bool = True
    audio_mode: str = "none"
