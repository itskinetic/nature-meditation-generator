import datetime
import logging
from typing import List, Set, Optional
from sqlalchemy.orm import Session

from backend.app.models import VideoLibraryItem
from backend.app.schemas import CandidateItem, PresetSchema, IntentAnalysisResult

logger = logging.getLogger(__name__)


class CandidateService:
    def filter_candidates(
        self,
        candidates: List[CandidateItem],
        preset: Optional[PresetSchema] = None,
        analysis: Optional[IntentAnalysisResult] = None,
        min_duration: float = 15.0,
        max_duration: Optional[float] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "1080p",
        avoid_recently_used: bool = True,
        exclude_all_history: bool = False,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        """
        Deduplicates and filters candidates based on duration (min & max), resolution,
        aspect ratio, negative terms, rejected history, and cooldown.
        """
        seen_ids: Set[str] = set()
        seen_urls: Set[str] = set()
        filtered: List[CandidateItem] = []

        # Load rejected and existing library IDs from DB
        rejected_ids: Set[str] = set()
        library_ids: Set[str] = set()

        if db:
            try:
                rejected_items = db.query(VideoLibraryItem.source_video_id).filter(
                    VideoLibraryItem.is_approved == False,
                    VideoLibraryItem.rejected_at.isnot(None)
                ).all()
                rejected_ids = {r[0] for r in rejected_items}

                if exclude_all_history:
                    # Exclude ANY video already in the library or previously generated
                    all_library_items = db.query(VideoLibraryItem.source_video_id).all()
                    library_ids = {r[0] for r in all_library_items}
            except Exception as db_err:
                logger.warning(f"Error querying history in candidate filter: {db_err}")

        # Build negative terms list
        negative_terms = set()
        if preset:
            negative_terms.update([term.lower() for term in preset.negative_terms])
        if analysis:
            negative_terms.update([term.lower() for term in analysis.avoid_visuals])

        for c in candidates:
            # 1. Deduplication by ID
            if not c.source_video_id or c.source_video_id in seen_ids:
                continue
            seen_ids.add(c.source_video_id)

            # 2. Deduplication by URL
            clean_url = (c.source_url or "").strip().rstrip("/")
            if clean_url:
                if clean_url in seen_urls:
                    continue
                seen_urls.add(clean_url)

            # 3. Check previously rejected / banned
            if c.source_video_id in rejected_ids:
                c.is_approved = False
                c.rejection_reason = "Previously rejected/banned video"
                continue

            # 4. Check existing library and past history exclusion (if Exclude History enabled)
            if exclude_all_history and c.source_video_id in library_ids:
                c.is_approved = False
                c.rejection_reason = "Already exists in Video Library"
                continue

            # 5. Check minimum & maximum duration
            if c.duration > 0 and c.duration < min_duration:
                c.is_approved = False
                c.rejection_reason = f"Duration {c.duration:.1f}s is below minimum {min_duration:.1f}s"
                continue

            if max_duration and max_duration > 0 and c.duration > max_duration:
                c.is_approved = False
                c.rejection_reason = f"Duration {c.duration:.1f}s exceeds maximum {max_duration:.1f}s"
                continue

            # 6. Check aspect ratio and orientation
            if c.width > 0 and c.height > 0:
                is_landscape = c.width >= c.height
                is_portrait = c.height > c.width
                is_square = abs(c.width - c.height) < 50

                if aspect_ratio == "16:9" and not is_landscape:
                    c.is_approved = False
                    c.rejection_reason = f"Invalid orientation for 16:9 (dimensions {c.width}x{c.height})"
                    continue
                elif aspect_ratio == "9:16" and not is_portrait:
                    c.is_approved = False
                    c.rejection_reason = f"Invalid orientation for 9:16 (dimensions {c.width}x{c.height})"
                    continue

                # 7. Check minimum resolution
                min_w = 1280 if resolution == "1080p" else 1920
                min_h = 720 if resolution == "1080p" else 1080
                if aspect_ratio == "16:9" and (c.width < min_w or c.height < min_h):
                    c.is_approved = False
                    c.rejection_reason = f"Resolution {c.width}x{c.height} below required standard"
                    continue

            # 8. Check negative keywords in candidate text / search query / creator / URL slugs
            import re
            raw_corpus = f"{c.source_url or ''} {c.search_query or ''} {c.creator_name or ''} {c.subtheme or ''}".lower()
            cleaned_corpus = re.sub(r'[^a-z0-9\s]', ' ', raw_corpus)
            corpus_words = set(cleaned_corpus.split())

            matched_neg = []
            for neg in negative_terms:
                n = neg.lower().strip()
                if not n:
                    continue
                if ' ' in n:
                    if n in cleaned_corpus:
                        matched_neg.append(n)
                        break
                else:
                    if n in corpus_words:
                        matched_neg.append(n)
                        break

            if matched_neg:
                c.is_approved = False
                c.rejection_reason = f"Contains banned visual: {matched_neg[0]}"
                continue

            filtered.append(c)

        return filtered


candidate_service = CandidateService()
