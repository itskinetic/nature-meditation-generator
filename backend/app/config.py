from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # API Keys
    PEXELS_API_KEY: str = ""
    PIXABAY_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    VISION_PROVIDER: str = "gemini"

    # Video Defaults
    DEFAULT_ASPECT_RATIO: str = "16:9"
    DEFAULT_RESOLUTION: str = "1080p"
    DEFAULT_TRANSITION: str = "crossfade"
    DEFAULT_TRANSITION_DURATION: float = 2.0
    DEFAULT_MAX_UNIQUE_VIDEOS: int = 20
    DEFAULT_MIN_CLIP_DURATION: int = 15

    # Base Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    LIBRARY_DIR: Path = DATA_DIR / "library"
    PREVIEWS_DIR: Path = DATA_DIR / "previews"
    CACHE_DIR: Path = DATA_DIR / "cache"
    JOBS_DIR: Path = DATA_DIR / "jobs"
    MUSIC_DIR: Path = DATA_DIR / "music"
    RENDERS_DIR: Path = DATA_DIR / "renders"
    CREDITS_DIR: Path = DATA_DIR / "credits"
    DB_PATH: Path = DATA_DIR / "database.sqlite3"


settings = Settings()

# Ensure directories exist
for directory in [
    settings.DATA_DIR,
    settings.LIBRARY_DIR,
    settings.PREVIEWS_DIR,
    settings.CACHE_DIR,
    settings.JOBS_DIR,
    settings.MUSIC_DIR,
    settings.RENDERS_DIR,
    settings.CREDITS_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)
