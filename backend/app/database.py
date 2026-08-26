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
    Base.metadata.create_all(bind=engine)

    # Auto-migration for SQLite tables
    with engine.connect() as conn:
        try:
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
            conn.commit()
        except Exception:
            pass
