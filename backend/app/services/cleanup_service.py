import os
import time
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.app.config import settings

logger = logging.getLogger(__name__)

RETENTION_SECONDS = 3 * 24 * 60 * 60  # 3 days in seconds (72 hours)


def _get_dir_size_and_count(directory: Path, pattern: str = "*") -> Dict[str, Any]:
    """Calculates total byte size and file count inside a directory recursively."""
    if not directory.exists():
        return {"bytes": 0, "mb": 0.0, "formatted": "0 MB", "count": 0}

    total_bytes = 0
    count = 0
    try:
        for p in directory.rglob(pattern):
            if p.is_file():
                try:
                    total_bytes += p.stat().st_size
                    count += 1
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Error measuring directory {directory}: {e}")

    mb = total_bytes / (1024 * 1024)
    if mb >= 1024:
        formatted = f"{mb / 1024:.2f} GB"
    else:
        formatted = f"{mb:.1f} MB"

    return {
        "bytes": total_bytes,
        "mb": round(mb, 2),
        "formatted": formatted,
        "count": count
    }


PRESERVED_JOB_FILES = {"final_video.mp4", "metadata.json", "credits.txt"}


def get_storage_stats() -> Dict[str, Any]:
    """Returns live storage breakdown across all data categories."""
    scratch_bytes = 0
    scratch_count = 0
    job_renders_bytes = 0
    job_renders_count = 0

    if settings.JOBS_DIR.exists():
        for job_folder in settings.JOBS_DIR.iterdir():
            if job_folder.is_dir():
                for p in job_folder.iterdir():
                    if p.is_file():
                        try:
                            sz = p.stat().st_size
                            if p.name == "final_video.mp4":
                                job_renders_bytes += sz
                                job_renders_count += 1
                            elif p.name not in PRESERVED_JOB_FILES:
                                scratch_bytes += sz
                                scratch_count += 1
                        except Exception:
                            pass

    standalone_renders = _get_dir_size_and_count(settings.RENDERS_DIR)
    total_renders_bytes = standalone_renders["bytes"] + job_renders_bytes
    total_renders_count = standalone_renders["count"] + job_renders_count
    total_renders_mb = round(total_renders_bytes / (1024 * 1024), 2)
    renders_formatted = f"{total_renders_mb / 1024:.2f} GB" if total_renders_mb >= 1024 else f"{total_renders_mb:.1f} MB"

    scratch_mb = round(scratch_bytes / (1024 * 1024), 2)
    scratch_formatted = f"{scratch_mb / 1024:.2f} GB" if scratch_mb >= 1024 else f"{scratch_mb:.1f} MB"

    library_stats = _get_dir_size_and_count(settings.LIBRARY_DIR)
    cache_stats = _get_dir_size_and_count(settings.CACHE_DIR)
    previews_stats = _get_dir_size_and_count(settings.PREVIEWS_DIR)
    music_stats = _get_dir_size_and_count(settings.MUSIC_DIR)
    audio_stats = _get_dir_size_and_count(settings.AUDIO_DIR)

    total_bytes = (
        scratch_bytes
        + total_renders_bytes
        + library_stats["bytes"]
        + cache_stats["bytes"]
        + previews_stats["bytes"]
        + music_stats["bytes"]
        + audio_stats["bytes"]
    )
    total_mb = total_bytes / (1024 * 1024)
    total_formatted = f"{total_mb / 1024:.2f} GB" if total_mb >= 1024 else f"{total_mb:.1f} MB"

    return {
        "status": "success",
        "total": {
            "bytes": total_bytes,
            "mb": round(total_mb, 2),
            "formatted": total_formatted
        },
        "categories": {
            "scratch_jobs": {
                "id": "scratch_jobs",
                "name": "Render Scratch Files & Slices",
                "description": "Temporary FFmpeg cuts, slow-motion masters, and audio mixes",
                "path": str(settings.JOBS_DIR),
                "safe_to_delete": True,
                "bytes": scratch_bytes,
                "mb": scratch_mb,
                "formatted": scratch_formatted,
                "count": scratch_count
            },
            "cache_previews": {
                "id": "cache_previews",
                "name": "API Cache & Thumbnail Previews",
                "description": "Cached search responses and thumbnail image previews",
                "path": f"{settings.CACHE_DIR}, {settings.PREVIEWS_DIR}",
                "safe_to_delete": True,
                "bytes": cache_stats["bytes"] + previews_stats["bytes"],
                "mb": round(cache_stats["mb"] + previews_stats["mb"], 2),
                "formatted": f"{(cache_stats['mb'] + previews_stats['mb']):.1f} MB",
                "count": cache_stats["count"] + previews_stats["count"]
            },
            "renders": {
                "id": "renders",
                "name": "Exported Video Renders",
                "description": "Final completed 30-min MP4 renders and master exports",
                "path": f"{settings.RENDERS_DIR}, {settings.JOBS_DIR}",
                "safe_to_delete": False,
                "bytes": total_renders_bytes,
                "mb": total_renders_mb,
                "formatted": renders_formatted,
                "count": total_renders_count
            },
            "library": {
                "id": "library",
                "name": "Stock Video Library",
                "description": "Downloaded Pexels & Pixabay clips saved for fast re-use",
                "path": str(settings.LIBRARY_DIR),
                "safe_to_delete": False,
                **library_stats
            },
            "audio_music": {
                "id": "audio_music",
                "name": "Audio & Music Assets",
                "description": "Custom uploaded background music tracks and audio voiceovers",
                "path": str(settings.MUSIC_DIR),
                "safe_to_delete": False,
                "bytes": music_stats["bytes"] + audio_stats["bytes"],
                "mb": round(music_stats["mb"] + audio_stats["mb"], 2),
                "formatted": f"{(music_stats['mb'] + audio_stats['mb']):.1f} MB",
                "count": music_stats["count"] + audio_stats["count"]
            }
        }
    }


def purge_intermediate_scratch(keep_final_videos: bool = True) -> Dict[str, Any]:
    """
    Deletes all intermediate sliced clips, master videos, and scratch files inside JOBS_DIR.
    If keep_final_videos is True, preserves final_video.mp4, credits.txt, and metadata.json in completed jobs.
    """
    if not settings.JOBS_DIR.exists():
        return {"deleted_count": 0, "reclaimed_mb": 0.0}

    deleted_count = 0
    reclaimed_bytes = 0

    for job_folder in list(settings.JOBS_DIR.iterdir()):
        if job_folder.is_dir():
            if not keep_final_videos:
                try:
                    for f in job_folder.rglob("*"):
                        if f.is_file():
                            reclaimed_bytes += f.stat().st_size
                            deleted_count += 1
                    shutil.rmtree(job_folder, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Could not delete job folder {job_folder}: {e}")
            else:
                for file_path in list(job_folder.iterdir()):
                    if file_path.is_file() and file_path.name not in PRESERVED_JOB_FILES:
                        try:
                            size = file_path.stat().st_size
                            file_path.unlink()
                            deleted_count += 1
                            reclaimed_bytes += size
                        except Exception as e:
                            logger.warning(f"Could not delete intermediate file {file_path}: {e}")

                # If job folder does not contain final_video.mp4, clean up the whole folder
                has_final = (job_folder / "final_video.mp4").exists()
                if not has_final:
                    try:
                        shutil.rmtree(job_folder, ignore_errors=True)
                    except Exception:
                        pass

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Purged intermediate scratch: removed {deleted_count} files, reclaimed {reclaimed_mb} MB")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "reclaimed_mb": reclaimed_mb
    }


def purge_cache_and_previews() -> Dict[str, Any]:
    """Purges all API search cache and thumbnail preview files."""
    deleted_count = 0
    reclaimed_bytes = 0

    for target_dir in [settings.CACHE_DIR, settings.PREVIEWS_DIR]:
        if not target_dir.exists():
            continue
        for item in target_dir.iterdir():
            if item.is_file():
                try:
                    size = item.stat().st_size
                    item.unlink()
                    deleted_count += 1
                    reclaimed_bytes += size
                except Exception as e:
                    logger.warning(f"Could not delete cache item {item}: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Purged cache/previews: removed {deleted_count} files, reclaimed {reclaimed_mb} MB")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "reclaimed_mb": reclaimed_mb
    }


def purge_renders() -> Dict[str, Any]:
    """Deletes all completed exported videos in renders directory."""
    deleted_count = 0
    reclaimed_bytes = 0

    if settings.RENDERS_DIR.exists():
        for item in settings.RENDERS_DIR.iterdir():
            if item.is_file():
                try:
                    size = item.stat().st_size
                    item.unlink()
                    deleted_count += 1
                    reclaimed_bytes += size
                except Exception as e:
                    logger.warning(f"Could not delete render item {item}: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Purged renders: removed {deleted_count} files, reclaimed {reclaimed_mb} MB")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "reclaimed_mb": reclaimed_mb
    }


def purge_library_files() -> Dict[str, Any]:
    """Deletes all stock video and image files in library directory."""
    deleted_count = 0
    reclaimed_bytes = 0

    if settings.LIBRARY_DIR.exists():
        for item in settings.LIBRARY_DIR.iterdir():
            if item.is_file():
                try:
                    size = item.stat().st_size
                    item.unlink()
                    deleted_count += 1
                    reclaimed_bytes += size
                except Exception as e:
                    logger.warning(f"Could not delete library item {item}: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Purged library: removed {deleted_count} files, reclaimed {reclaimed_mb} MB")
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "reclaimed_mb": reclaimed_mb
    }


def cleanup_old_renders(retention_seconds: int = RETENTION_SECONDS) -> Dict[str, Any]:
    """
    Deletes rendered video files, temporary preview caches, and job directories older than retention_seconds (default 3 days).
    Protects user's saved Library files and SQLite database from being touched.
    """
    now = time.time()
    cutoff_time = now - retention_seconds
    deleted_files = 0
    reclaimed_bytes = 0

    # 1. Clean expired job folders recursively
    if settings.JOBS_DIR.exists():
        for item in settings.JOBS_DIR.iterdir():
            if item.is_dir():
                try:
                    mtime = item.stat().st_mtime
                    if mtime < cutoff_time:
                        for f in item.rglob("*"):
                            if f.is_file():
                                reclaimed_bytes += f.stat().st_size
                                deleted_files += 1
                        shutil.rmtree(item, ignore_errors=True)
                        logger.info(f"Auto-cleaned expired job folder: {item.name}")
                except Exception as e:
                    logger.warning(f"Failed to auto-clean job folder {item}: {e}")

    # 2. Clean cache, previews, and renders directories
    for directory in [settings.RENDERS_DIR, settings.PREVIEWS_DIR, settings.CACHE_DIR]:
        if not directory.exists():
            continue

        for item in directory.iterdir():
            if item.is_file():
                try:
                    mtime = item.stat().st_mtime
                    if mtime < cutoff_time:
                        size = item.stat().st_size
                        item.unlink()
                        deleted_files += 1
                        reclaimed_bytes += size
                        logger.info(f"Auto-cleaned expired cache file: {item.name} ({size / (1024*1024):.2f} MB)")
                except Exception as e:
                    logger.warning(f"Failed to delete expired file {item}: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    logger.info(f"Cleanup finished: removed {deleted_files} files, reclaimed {reclaimed_mb} MB")

    return {
        "status": "success",
        "deleted_count": deleted_files,
        "reclaimed_mb": reclaimed_mb
    }

