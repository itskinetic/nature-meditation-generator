import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database import engine, Base
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
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    
    # Run initial cleanup and launch background cleanup daemon
    try:
        cleanup_old_renders()
    except Exception as e:
        logger.warning(f"Initial render cleanup error: {e}")
        
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
