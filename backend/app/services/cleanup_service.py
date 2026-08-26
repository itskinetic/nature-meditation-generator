import os
import time
import logging
from pathlib import Path
from backend.app.config import settings

logger = logging.getLogger(__name__)

RETENTION_SECONDS = 3 * 24 * 60 * 60  # 3 days in seconds (72 hours)


def cleanup_old_renders(retention_seconds: int = RETENTION_SECONDS) -> dict:
    """
    Deletes rendered video files, temporary preview caches, and jobs older than retention_seconds (default 3 days).
    Protects user's saved Library files and SQLite database from being touched.
    """
    now = time.time()
    cutoff_time = now - retention_seconds
    deleted_files = []
    reclaimed_bytes = 0

    target_directories = [
        settings.RENDERS_DIR,
        settings.PREVIEWS_DIR,
        settings.CACHE_DIR,
        settings.JOBS_DIR,
    ]

    for directory in target_directories:
        if not directory.exists():
            continue

        for item in directory.iterdir():
            if item.is_file():
                try:
                    mtime = item.stat().st_mtime
                    if mtime < cutoff_time:
                        size = item.stat().st_size
                        item.unlink()
                        deleted_files.append(str(item.name))
                        reclaimed_bytes += size
                        logger.info(f"Auto-cleaned expired render/cache file: {item.name} ({size / (1024*1024):.2f} MB)")
                except Exception as e:
                    logger.warning(f"Failed to delete expired file {item}: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Cleanup finished: removed {len(deleted_files)} files, reclaimed {reclaimed_mb} MB")

    return {
        "status": "success",
        "deleted_count": len(deleted_files),
        "reclaimed_mb": reclaimed_mb,
        "deleted_files": deleted_files,
    }
