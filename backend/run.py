import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.schemas import GenerationRequest
from backend.app.routes.api import run_generation_pipeline
from backend.app.models import GenerationJob
from backend.app.services.ffmpeg_service import ffmpeg_service


def main():
    parser = argparse.ArgumentParser(description="Calm Nature Meditation Video Generator CLI")
    parser.add_argument("--dry-run", action="store_true", help="Run in offline dry-run fixture mode without API keys")
    parser.add_argument("--duration", type=float, default=60.0, help="Duration in seconds (default 60)")
    parser.add_argument("--preset", type=str, default="Calm Misty Forest", help="Nature preset name")
    parser.add_argument("--title", type=str, default="Softening the Heart", help="Meditation title")
    args = parser.parse_args()

    # Initialize DB
    Base.metadata.create_all(bind=engine)

    job_id = f"cli_{uuid.uuid4().hex[:8]}"
    print(f"==================================================")
    print(f" Starting Calm Nature Video Generation: {job_id}")
    print(f" Title: {args.title}")
    print(f" Preset: {args.preset}")
    print(f" Target Duration: {args.duration}s")
    print(f" Mode: {'DRY RUN (Offline Fixture / Synthetic)' if args.dry_run else 'Standard'}")
    print(f"==================================================")

    db = SessionLocal()
    job = GenerationJob(
        id=job_id,
        title=args.title,
        preset=args.preset,
        target_duration_seconds=args.duration,
        aspect_ratio="16:9",
        resolution="1080p",
        transition_type="crossfade",
        transition_duration=2.0,
        status="pending",
        progress=0,
        current_stage="CLI Dry-Run Started"
    )
    db.add(job)
    db.commit()
    db.close()

    req = GenerationRequest(
        title=args.title,
        script="Gently close your eyes and breathe into the quiet forest air.",
        preset=args.preset,
        target_duration=args.duration,
        duration_unit="seconds",
        maximum_unique_videos=10,
        minimum_clip_duration=10.0,
        aspect_ratio="16:9",
        resolution="1080p",
        transition_type="crossfade",
        transition_duration=2.0,
        allow_reuse=True,
        avoid_recently_used=False,
        enable_pexels=not args.dry_run,
        enable_pixabay=not args.dry_run
    )

    asyncio.run(run_generation_pipeline(job_id, req))

    # Read final status
    db = SessionLocal()
    final_job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if final_job and final_job.status == "completed":
        print(f"\n[SUCCESS] Render finished!")
        print(f"Output: {final_job.output_path}")
        print(f"Actual Duration: {final_job.actual_duration_seconds}s")
        print(f"Clips Used: {final_job.selected_video_count} (Reused: {final_job.reused_video_count}, New: {final_job.new_video_count})")
        print(f"Repeats: {final_job.sequence_repeat_count}")
    else:
        print(f"\n[ERROR] Generation failed: {final_job.error_message if final_job else 'Unknown error'}")
        sys.exit(1)
    db.close()


if __name__ == "__main__":
    main()
