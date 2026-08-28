from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

DATABASE_URL = f"sqlite:///{settings.DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes tables and automatically migrates any missing columns in SQLite."""
    try:
        import backend.app.models  # Ensure all model tables are registered with Base.metadata
    except Exception:
        pass
    Base.metadata.create_all(bind=engine)

    # Auto-migration for SQLite tables
    with engine.connect() as conn:
        try:
            # video_library table columns
            res = conn.execute(text("PRAGMA table_info(video_library)")).fetchall()
            existing_cols = {row[1] for row in res}

            if "shot_type" not in existing_cols:
                conn.execute(text("ALTER TABLE video_library ADD COLUMN shot_type VARCHAR(50)"))
            if "approved_at" not in existing_cols:
                conn.execute(text("ALTER TABLE video_library ADD COLUMN approved_at DATETIME"))
            if "rejected_at" not in existing_cols:
                conn.execute(text("ALTER TABLE video_library ADD COLUMN rejected_at DATETIME"))
            if "rejection_reason" not in existing_cols:
                conn.execute(text("ALTER TABLE video_library ADD COLUMN rejection_reason VARCHAR(500)"))

            # generation_jobs table columns
            res_jobs = conn.execute(text("PRAGMA table_info(generation_jobs)")).fetchall()
            job_cols = {row[1] for row in res_jobs}

            if "playback_speed" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN playback_speed FLOAT DEFAULT 0.5"))
            if "music_file" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN music_file VARCHAR(300)"))
            if "aspect_ratio" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN aspect_ratio VARCHAR(20) DEFAULT '16:9'"))
            if "resolution" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN resolution VARCHAR(20) DEFAULT '1080p'"))
            if "transition_type" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN transition_type VARCHAR(50) DEFAULT 'crossfade'"))
            if "transition_duration" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN transition_duration FLOAT DEFAULT 2.0"))
            if "candidate_count" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN candidate_count INTEGER DEFAULT 0"))
            if "approved_video_count" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN approved_video_count INTEGER DEFAULT 0"))
            if "rejected_video_count" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN rejected_video_count INTEGER DEFAULT 0"))
            if "unique_sequence_duration" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN unique_sequence_duration FLOAT DEFAULT 0.0"))
            if "metadata_json" not in job_cols:
                conn.execute(text("ALTER TABLE generation_jobs ADD COLUMN metadata_json TEXT"))

            conn.commit()
        except Exception:
            pass


# Execute migrations immediately on import so SQLite columns are guaranteed ready
try:
    init_db()
except Exception:
    pass
