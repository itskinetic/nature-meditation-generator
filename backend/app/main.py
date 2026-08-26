from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.routes.api import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    yield


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
