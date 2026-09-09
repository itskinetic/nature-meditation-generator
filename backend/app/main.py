import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database import engine, Base, init_db
from backend.app.routes.api import router as api_router
from backend.app.services.cleanup_service import cleanup_old_renders

logger = logging.getLogger(__name__)


async def periodic_cleanup_loop():
    """Runs automated cleanup of old renders/cache older than 3 days every 6 hours."""
    while True:
        try:
            cleanup_old_renders()
        except Exception as e:
            logger.warning(f"Automated cleanup error: {e}")
        await asyncio.sleep(6 * 3600)  # Sleep 6 hours


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables and auto-migrate missing columns
    init_db()
    
    # Run initial cleanup and launch background cleanup daemon
    try:
        cleanup_old_renders()
    except Exception as e:
        logger.warning(f"Initial render cleanup error: {e}")

    # Reset any orphaned transcribing/processing audio tasks or video generation jobs from container restarts
    try:
        from backend.app.database import SessionLocal
        from backend.app.models import AudioProject, GenerationJob
        db = SessionLocal()
        orphaned_audio = db.query(AudioProject).filter(AudioProject.status.in_(["transcribing", "processing"])).all()
        for p in orphaned_audio:
            p.status = "unprocessed"
        if orphaned_audio:
            db.commit()
            logger.info(f"Reset {len(orphaned_audio)} orphaned audio tasks to 'unprocessed' on startup.")

        active_video_statuses = ["pending", "queued", "analyzing", "searching", "scoring", "downloading", "evaluating", "rendering", "stitching"]
        orphaned_video = db.query(GenerationJob).filter(GenerationJob.status.in_(active_video_statuses)).all()
        for j in orphaned_video:
            j.status = "failed"
            j.error_message = "Generation was interrupted by server restart or crash."
            j.current_stage = "Interrupted by server reboot"
        if orphaned_video:
            db.commit()
            logger.info(f"Marked {len(orphaned_video)} orphaned video generation jobs as failed on startup.")

        db.close()
    except Exception as e:
        logger.warning(f"Error resetting orphaned tasks on startup: {e}")
        
    cleanup_task = asyncio.create_task(periodic_cleanup_loop())
    yield
    cleanup_task.cancel()


app = FastAPI(
    title="Calm Nature Meditation Video Generator",
    description="Automated relaxing nature video generation for meditation channels",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_no_cache_for_html(request, call_next):
    response = await call_next(request)
    path = request.url.path
    # Prevent browser caching of SPA entrypoint HTML so new builds are loaded instantly
    if path == "/" or path.endswith(".html"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Mount static directories
app.mount("/data/previews", StaticFiles(directory=str(settings.PREVIEWS_DIR)), name="previews")
app.mount("/data/renders", StaticFiles(directory=str(settings.RENDERS_DIR)), name="renders")

# Include API Router
app.include_router(api_router, prefix="/api")

# Serve Frontend static files in production if built
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "app": "Calm Nature Meditation Video Generator",
            "version": "1.0.0",
            "docs": "/docs",
            "status": "online"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
