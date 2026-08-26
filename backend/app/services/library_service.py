import datetime
import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.app.models import VideoLibraryItem
from backend.app.schemas import CandidateItem, IntentAnalysisResult, PresetSchema

logger = logging.getLogger(__name__)


class LibraryService:
    def calculate_reuse_priority(
        self,
        item: VideoLibraryItem,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema] = None
    ) -> float:
        """
        Calculates reuse priority based on formula:
        reuse_priority = intent_match * 0.35 + theme_match * 0.25 + calmness * 0.25 + visual_quality * 0.10 + freshness * 0.05
        """
        intent_match = float(item.intent_score or 8.0)
        theme_match = float(item.theme_score or 8.0)
        calmness = float(item.calmness_score or 8.0)
        visual_quality = float(item.visual_quality_score or 8.0)

        # Freshness calculation (0 to 10 scale)
        # Drops with times_used and recent usage
        freshness = 10.0 - (min(item.times_used, 5) * 1.5)
        if item.last_used_at:
            delta = datetime.datetime.utcnow() - item.last_used_at
            hours_ago = delta.total_seconds() / 3600.0
            if hours_ago < 24:
                freshness -= 4.0
            elif hours_ago < 72:
                freshness -= 2.0
        freshness = max(0.0, min(10.0, freshness))

        priority = (
            intent_match * 0.35
            + theme_match * 0.25
            + calmness * 0.25
            + visual_quality * 0.10
            + freshness * 0.05
        )
        return priority

    def find_reusable_candidates(
        self,
        db: Session,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema] = None,
        min_duration: float = 15.0,
        avoid_recently_used: bool = True,
        max_results: int = 20
    ) -> List[CandidateItem]:
        """
        Searches SQLite library for approved, suitable videos and ranks them by reuse_priority.
        """
        query = db.query(VideoLibraryItem).filter(
            VideoLibraryItem.is_approved == True,
            VideoLibraryItem.rejected_at.is_(None),
            VideoLibraryItem.local_file_path.isnot(None)
        )

        if avoid_recently_used:
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
            query = query.filter(
                (VideoLibraryItem.last_used_at.is_(None)) | (VideoLibraryItem.last_used_at < cutoff)
            )

        items = query.all()
        scored_items = []

        for item in items:
            if item.duration and item.duration < min_duration:
                continue

            priority = self.calculate_reuse_priority(item, analysis, preset)
            scored_items.append((priority, item))

        # Sort by priority descending
        scored_items.sort(key=lambda x: x[0], reverse=True)

        candidates: List[CandidateItem] = []
        for priority, item in scored_items[:max_results]:
            candidates.append(CandidateItem(
                source="library",
                source_video_id=item.source_video_id,
                source_url=item.source_url or "",
                creator_name=item.creator_name or "Local Library",
                creator_url=item.creator_url,
                search_query=item.subtheme or "library asset",
                duration=item.duration or 30.0,
                width=item.width or 1920,
                height=item.height or 1080,
                preview_url=item.preview_url or item.local_preview_path or "",
                local_file_path=item.local_file_path,
                intent_match=item.intent_score,
                theme_match=item.theme_score,
                calmness=item.calmness_score,
                motion_intensity=item.motion_score,
                visual_quality=item.visual_quality_score,
                subtheme=item.subtheme,
                is_approved=True,
                is_reused=True,
                times_used=item.times_used,
                last_used_at=item.last_used_at
            ))

        return candidates

    def record_usage(self, db: Session, video_id: str):
        """Increments usage count and updates last_used_at timestamp."""
        item = db.query(VideoLibraryItem).filter(VideoLibraryItem.source_video_id == video_id).first()
        if item:
            item.times_used += 1
            item.last_used_at = datetime.datetime.utcnow()
            db.commit()

    def save_or_update_video(
        self,
        db: Session,
        candidate: CandidateItem,
        local_path: str,
        is_approved: bool = True,
        rejection_reason: Optional[str] = None
    ) -> VideoLibraryItem:
        """Stores or updates a video record in SQLite."""
        existing = db.query(VideoLibraryItem).filter(
            VideoLibraryItem.source_video_id == candidate.source_video_id
        ).first()

        now = datetime.datetime.utcnow()
        if not existing:
            existing = VideoLibraryItem(
                source=candidate.source,
                source_video_id=candidate.source_video_id,
                source_url=candidate.source_url,
                local_file_path=local_path,
                preview_url=candidate.preview_url,
                creator_name=candidate.creator_name,
                creator_url=candidate.creator_url,
                duration=candidate.duration,
                width=candidate.width,
                height=candidate.height,
                subtheme=candidate.subtheme,
                intent_score=candidate.intent_match,
                theme_score=candidate.theme_match,
                calmness_score=candidate.calmness,
                motion_score=candidate.motion_intensity,
                visual_quality_score=candidate.visual_quality,
                is_approved=is_approved,
                approved_at=now if is_approved else None,
                rejected_at=now if not is_approved else None,
                rejection_reason=rejection_reason
            )
            db.add(existing)
        else:
            existing.local_file_path = local_path or existing.local_file_path
            existing.is_approved = is_approved
            if is_approved:
                existing.approved_at = now
                existing.rejected_at = None
                existing.rejection_reason = None
            else:
                existing.rejected_at = now
                existing.rejection_reason = rejection_reason

        db.commit()
        db.refresh(existing)
        return existing


library_service = LibraryService()
