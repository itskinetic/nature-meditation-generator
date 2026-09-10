import datetime
import logging
import re
from typing import List, Set, Optional
from sqlalchemy.orm import Session

from backend.app.models import VideoLibraryItem, BannedCandidate, BannedCreator
from backend.app.schemas import CandidateItem, PresetSchema, IntentAnalysisResult

logger = logging.getLogger(__name__)


def normalize_video_id(vid: Optional[str]) -> Set[str]:
    """Returns a set of normalized variants for a video ID (e.g. 'pexels_12345', '12345')."""
    if not vid:
        return set()
    cleaned = str(vid).strip().lower()
    variants = {cleaned}
    for prefix in ["pexels_", "pixabay_", "local_"]:
        if cleaned.startswith(prefix):
            raw = cleaned[len(prefix):]
            if raw:
                variants.add(raw)
        else:
            variants.add(f"{prefix}{cleaned}")
    return variants


def normalize_url(url: Optional[str]) -> str:
    """Normalizes URL by stripping query strings, trailing slashes, and protocol."""
    if not url:
        return ""
    u = str(url).strip().lower()
    u = u.split("?")[0].rstrip("/")
    u = re.sub(r"^https?://(www\.)?", "", u)
    return u


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
    "macro", "close up", "closeup", "extreme close up", "detail shot", "micro lens", "macro shot",

    # Dark, Backlit & Silhouette Footage (Pure Bright Daytime Required)
    "silhouette", "silhouettes", "backlit", "backlight", "sunset", "sunsets", "golden hour", "dusk", "twilight", "underexposed",

    # Ski Resorts, Winter Sports & Chairlifts (Never in calming nature meditation)
    "ski", "skier", "skiers", "skiing", "snowboard", "snowboarder", "snowboarding",
    "chairlift", "ski lift", "gondola", "cable car", "piste", "snowpark", "ski resort",
    "ski slope", "snowcat", "snowmobile", "slalom", "halfpipe", "jump ramp", "ski park",

    # Top-Down, Straight-Down, High-Altitude Survey & Overhead Textures
    "top down", "top-down", "straight down", "directly above", "bird's eye view", "birds eye view",
    "bird eye view", "looking down", "overhead", "vertically down", "aerial survey", "satellite",
    "topdown", "overhead view", "straight-down",

    # Clutter, Dense Bumpy Treetops & Choppy Water (No chaotic textures)
    "canopy", "treetops", "dense canopy", "overgrown", "tangle", "thicket", "shrubbery", "brushwood",
    "choppy", "turbulent", "rough sea", "rough waves", "heavy surf", "stormy sea", "bumpy",

    # Wires, Poles, Pylons & Man-made Infrastructure
    "pylon", "pylons", "power line", "power lines", "electric pole", "telephone pole",
    "cable lines", "wires", "fence line"
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

        # Load banned items, blocked creators, and existing library IDs/URLs from DB
        banned_id_variants: Set[str] = set()
        banned_urls: Set[str] = set()
        banned_creator_names: Set[str] = set()
        banned_creator_urls: Set[str] = set()
        saved_id_variants: Set[str] = set()
        saved_urls: Set[str] = set()

        if db:
            try:
                # 1. Query permanently banned candidate videos
                banned_cand_rows = db.query(
                    BannedCandidate.source_video_id,
                    BannedCandidate.normalized_id,
                    BannedCandidate.source_url
                ).all()
                for row in banned_cand_rows:
                    if row[0]:
                        banned_id_variants.update(normalize_video_id(row[0]))
                    if row[1]:
                        banned_id_variants.update(normalize_video_id(row[1]))
                    if row[2]:
                        banned_urls.add(normalize_url(row[2]))

                # Also include any rejected items from video_library
                rejected_rows = db.query(VideoLibraryItem.source_video_id, VideoLibraryItem.source_url).filter(
                    VideoLibraryItem.is_approved == False
                ).all()
                for row in rejected_rows:
                    if row[0]:
                        banned_id_variants.update(normalize_video_id(row[0]))
                    if row[1]:
                        banned_urls.add(normalize_url(row[1]))

                # 2. Query permanently blocked creators / uploaders
                banned_creator_rows = db.query(
                    BannedCreator.creator_name,
                    BannedCreator.creator_url
                ).all()
                for row in banned_creator_rows:
                    if row[0]:
                        banned_creator_names.add(row[0].strip().lower())
                    if row[1]:
                        banned_creator_urls.add(normalize_url(row[1]))

                # 3. Query all saved videos in Video Library (strictly exclude from fresh searches)
                saved_items = db.query(VideoLibraryItem.source_video_id, VideoLibraryItem.source_url).filter(
                    (VideoLibraryItem.is_approved == True) | 
                    (VideoLibraryItem.times_used > 0) | 
                    (VideoLibraryItem.local_file_path.isnot(None))
                ).all()
                for row in saved_items:
                    if row[0]:
                        saved_id_variants.update(normalize_video_id(row[0]))
                    if row[1]:
                        saved_urls.add(normalize_url(row[1]))
            except Exception as db_err:
                logger.warning(f"Error querying ban/library records in candidate filter: {db_err}")

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
            cand_norm_url = normalize_url(c.source_url)
            if cand_norm_url:
                if cand_norm_url in seen_urls:
                    continue
                seen_urls.add(cand_norm_url)

            # 3. Strict exclusion: Permanently banned videos
            cand_id_variants = normalize_video_id(c.source_video_id)
            if cand_id_variants.intersection(banned_id_variants) or (cand_norm_url and cand_norm_url in banned_urls):
                continue

            # 4. Strict exclusion: Blocked creators / uploaders
            cand_creator_name = (c.creator_name or "").strip().lower()
            cand_creator_url = normalize_url(c.creator_url)
            if (cand_creator_name and cand_creator_name in banned_creator_names) or (cand_creator_url and cand_creator_url in banned_creator_urls):
                continue

            # 5. Strict exclusion: Saved videos in Video Library
            if cand_id_variants.intersection(saved_id_variants) or (cand_norm_url and cand_norm_url in saved_urls):
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
