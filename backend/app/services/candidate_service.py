import datetime
import logging
from typing import List, Set, Optional
from sqlalchemy.orm import Session

from backend.app.models import VideoLibraryItem
from backend.app.schemas import CandidateItem, PresetSchema, IntentAnalysisResult

logger = logging.getLogger(__name__)


GLOBAL_PROHIBITED_TERMS = [
    # People, Human presence, Lifestyle, Faces & Body Parts
    "person", "people", "man", "woman", "girl", "boy", "kid", "child", "children", "baby",
    "model", "crowd", "human", "humans", "face", "portrait", "selfie", "pedestrian", "pedestrians",
    "tourist", "tourists", "hiker", "hikers", "swimmer", "swimmers", "runner", "runners", "couple",
    "family", "hand", "hands", "foot", "feet", "leg", "legs", "body", "bikini", "yoga pose", "fitness",
    "lifestyle", "workout", "posing", "bikini", "fashion",

    # Boats, Ships & Watercraft
    "boat", "boats", "ship", "ships", "yacht", "yachts", "kayak", "kayaks", "canoe", "canoes",
    "vessel", "vessels", "ferry", "ferries", "sailboat", "sailboats", "motorboat", "speedboat",
    "jet ski", "cruiser", "harbor", "marina", "dock", "pier", "jetty", "port", "barge",

    # Vehicles, Roads & Traffic
    "car", "cars", "vehicle", "vehicles", "automobile", "traffic", "road", "roads", "highway",
    "highways", "street", "streets", "drive", "driving", "truck", "trucks", "bus", "train", "trains",
    "railway", "railroad", "motorcycle", "bike", "bicycle", "parking", "asphalt",

    # Buildings & Urban structures
    "building", "buildings", "house", "houses", "architecture", "city", "cityscape", "skyline",
    "urban", "skyscraper", "factory", "construction", "bridge", "fence", "fences", "wall", "room",
    "interior", "hotel", "resort", "apartment", "cabin", "cottage", "barn",

    # Timelapse, Hyperlapse & Fast Motion
    "timelapse", "time lapse", "time-lapse", "hyperlapse", "hyper lapse", "hyper-lapse",
    "fast motion", "accelerated", "speed up", "sped up", "fast clouds", "traffic lapse", "fast forward",

    # Captive Animals, Domestic pets & Enclosures
    "zoo", "cage", "caged", "enclosure", "aquarium", "pet", "pets", "dog", "dogs", "cat", "cats",
    "puppy", "kitten", "domestic", "leash", "collar", "trainer", "circus",

    # Flower Macro, Flowers, Lotus & Garden Plants
    "flower", "flowers", "blossom", "blossoms", "petal", "petals", "lotus", "waterlily", "water lily",
    "dahlia", "rose", "roses", "tulip", "tulips", "orchid", "orchids", "sunflower", "sunflowers", "daisy", "daisies",
    "bouquet", "pollen", "pollination", "macro flower", "flower close up",

    # Insects, Bees, Bugs & Crawlers
    "bee", "bees", "wasp", "wasps", "hornet", "bug", "bugs", "insect", "insects", "spider", "spiders",
    "caterpillar", "worm", "fly", "flies", "mosquito", "beetle", "beetles",

    # Macro & Close-up shots (Pure wide vistas required)
    "macro", "close up", "closeup", "extreme close up", "detail shot", "micro lens", "macro shot"
]


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
        Deduplicates and strictly filters candidates based on duration (min & max), resolution,
        aspect ratio, strict negative terms (no people, boats, cars, timelapse), rejected history, and cooldown.
        """
        seen_ids: Set[str] = set()
        seen_urls: Set[str] = set()
        filtered: List[CandidateItem] = []

        # Load rejected and existing library IDs/URLs from DB
        rejected_ids: Set[str] = set()
        library_ids: Set[str] = set()
        library_urls: Set[str] = set()

        if db:
            try:
                rejected_items = db.query(VideoLibraryItem.source_video_id).filter(
                    VideoLibraryItem.is_approved == False,
                    VideoLibraryItem.rejected_at.isnot(None)
                ).all()
                rejected_ids = {r[0] for r in rejected_items}

                all_library_items = db.query(VideoLibraryItem.source_video_id, VideoLibraryItem.source_url).all()
                for row in all_library_items:
                    if row[0]:
                        library_ids.add(str(row[0]))
                    if row[1]:
                        library_urls.add(str(row[1]).strip().rstrip("/"))

                # Also include past video usage records
                usage_items = db.query(VideoUsage.source_video_id).all()
                for row in usage_items:
                    if row[0]:
                        library_ids.add(str(row[0]))
            except Exception as db_err:
                logger.warning(f"Error querying history in candidate filter: {db_err}")

        # Build strict negative terms list (Always enforces global prohibitions)
        negative_terms = set(GLOBAL_PROHIBITED_TERMS)
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

            # 4. Check existing library & past history: If candidate already exists or was used
            is_in_library = (c.source_video_id in library_ids) or (clean_url and clean_url in library_urls)
            if is_in_library:
                if exclude_all_history:
                    c.is_approved = False
                    c.rejection_reason = "Already saved in Video Library or used in previous video"
                    continue
                elif c.source in ("pexels", "pixabay"):
                    # Tag as reusable library asset
                    c.source = "library"
                    c.is_reused = True

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
