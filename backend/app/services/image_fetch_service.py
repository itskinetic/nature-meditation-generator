import json
import logging
import random
from typing import List, Optional
import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import SearchCache
from backend.app.schemas import CandidateItem

logger = logging.getLogger(__name__)

MOTION_STYLES = ["zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down"]


class ImageFetchService:
    PEXELS_PHOTO_URL = "https://api.pexels.com/v1/search"
    PIXABAY_PHOTO_URL = "https://pixabay.com/api/"

    def __init__(self):
        self.pexels_key = settings.PEXELS_API_KEY
        self.pixabay_key = settings.PIXABAY_API_KEY

    async def search(
        self,
        query: str,
        page: int = 1,
        per_page: int = 25,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        candidates: List[CandidateItem] = []

        # 1. Search Pexels Photos FIRST (Prioritized for vivid high-contrast imagery)
        if self.pexels_key and len(self.pexels_key.strip()) > 5:
            try:
                pexels_items = await self._search_pexels_photos(query, page, per_page, db)
                candidates.extend(pexels_items)
            except Exception as e:
                logger.warning(f"Error fetching Pexels photos: {e}")

        # 2. Search Pixabay Photos only if Pexels yielded insufficient results (< 2 items)
        if len(candidates) < max(2, per_page // 2) and self.pixabay_key and len(self.pixabay_key.strip()) > 5:
            try:
                pixabay_items = await self._search_pixabay_photos(query, page, per_page, db)
                candidates.extend(pixabay_items)
            except Exception as e:
                logger.warning(f"Error fetching Pixabay photos: {e}")

        # 3. Fallback fixture images if offline or no keys
        if not candidates and (not self.pexels_key or len(self.pexels_key.strip()) < 5) and (not self.pixabay_key or len(self.pixabay_key.strip()) < 5):
            candidates = self._get_fixture_images(query, page)

        return candidates

    async def _search_pexels_photos(
        self,
        query: str,
        page: int = 1,
        per_page: int = 25,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        cache_key = f"pexels_photo:{query}:{page}:{per_page}"
        if db:
            cached = db.query(SearchCache).filter(SearchCache.cache_key == cache_key).first()
            if cached:
                try:
                    data = json.loads(cached.response_json)
                    return [CandidateItem(**item) for item in data]
                except Exception as e:
                    logger.warning(f"Error reading Pexels photo cache: {e}")

        headers = {"Authorization": self.pexels_key.strip()}
        params = {
            "query": query,
            "orientation": "landscape",
            "size": "large",
            "per_page": min(per_page, 50),
            "page": page
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(self.PEXELS_PHOTO_URL, headers=headers, params=params)
            if resp.status_code == 200:
                raw = resp.json()
                results = []
                for p in raw.get("photos", []):
                    src = p.get("src", {})
                    # Highest resolution link available
                    download_url = src.get("original") or src.get("large2x") or src.get("large") or ""
                    preview_url = src.get("large") or src.get("medium") or download_url

                    motion = random.choice(MOTION_STYLES)
                    c = CandidateItem(
                        source="pexels_photo",
                        source_video_id=f"pexels_img_{p.get('id')}",
                        source_url=p.get("url", ""),
                        creator_name=p.get("photographer", "Pexels Photographer"),
                        creator_url=p.get("photographer_url"),
                        search_query=query,
                        duration=15.0,  # default 15s display duration for Ken Burns
                        width=p.get("width", 3840),
                        height=p.get("height", 2160),
                        preview_url=preview_url,
                        image_url=download_url,
                        download_url=download_url,
                        media_type="image",
                        motion_style=motion
                    )
                    results.append(c)

                if db and results:
                    try:
                        dumped = json.dumps([item.model_dump() for item in results], default=str)
                        db.add(SearchCache(cache_key=cache_key, response_json=dumped))
                        db.commit()
                    except Exception as e:
                        logger.warning(f"Error caching Pexels photo results: {e}")
                        db.rollback()

                return results
        return []

    async def _search_pixabay_photos(
        self,
        query: str,
        page: int = 1,
        per_page: int = 25,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        cache_key = f"pixabay_photo:{query}:{page}:{per_page}"
        if db:
            cached = db.query(SearchCache).filter(SearchCache.cache_key == cache_key).first()
            if cached:
                try:
                    data = json.loads(cached.response_json)
                    return [CandidateItem(**item) for item in data]
                except Exception as e:
                    logger.warning(f"Error reading Pixabay photo cache: {e}")

        params = {
            "key": self.pixabay_key.strip(),
            "q": query,
            "image_type": "photo",
            "orientation": "horizontal",
            "min_width": 1920,
            "min_height": 1080,
            "per_page": min(per_page, 50),
            "page": page,
            "safesearch": "true"
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(self.PIXABAY_PHOTO_URL, params=params)
            if resp.status_code == 200:
                raw = resp.json()
                results = []
                for p in raw.get("hits", []):
                    download_url = p.get("largeImageURL") or p.get("webformatURL") or ""
                    preview_url = p.get("webformatURL") or download_url

                    motion = random.choice(MOTION_STYLES)
                    c = CandidateItem(
                        source="pixabay_photo",
                        source_video_id=f"pixabay_img_{p.get('id')}",
                        source_url=p.get("pageURL", ""),
                        creator_name=p.get("user", "Pixabay Photographer"),
                        creator_url=f"https://pixabay.com/users/{p.get('user')}-{p.get('user_id')}/" if p.get("user_id") else None,
                        search_query=query,
                        duration=15.0,
                        width=p.get("imageWidth", 3840),
                        height=p.get("imageHeight", 2160),
                        preview_url=preview_url,
                        image_url=download_url,
                        download_url=download_url,
                        media_type="image",
                        motion_style=motion
                    )
                    results.append(c)

                if db and results:
                    try:
                        dumped = json.dumps([item.model_dump() for item in results], default=str)
                        db.add(SearchCache(cache_key=cache_key, response_json=dumped))
                        db.commit()
                    except Exception as e:
                        logger.warning(f"Error caching Pixabay photo results: {e}")
                        db.rollback()

                return results
        return []

    def _get_fixture_images(self, query: str, page: int = 1) -> List[CandidateItem]:
        fixtures = [
            ("lion_1", "Majestic African Lion Savanna", "https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg", "zoom_in"),
            ("whale_1", "Humpback Whale Ocean Surface", "https://images.pexels.com/photos/4666751/pexels-photo-4666751.jpeg", "pan_left"),
            ("eagle_1", "Bald Eagle Soaring Mountain Ridge", "https://images.pexels.com/photos/1459534/pexels-photo-1459534.jpeg", "zoom_out"),
            ("tiger_1", "Wild Tiger in Rainforest Foliage", "https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg", "pan_right"),
            ("polar_1", "Polar Bear on Arctic Ice Sheet", "https://images.pexels.com/photos/3573382/pexels-photo-3573382.jpeg", "tilt_up"),
        ]
        results = []
        for fid, title, url, motion in fixtures:
            results.append(CandidateItem(
                source="procedural_photo",
                source_video_id=f"fixture_img_{fid}_{page}",
                source_url="https://pexels.com",
                creator_name="Documentary Photographer",
                search_query=query,
                duration=15.0,
                width=3840,
                height=2160,
                preview_url=url,
                image_url=url,
                download_url=url,
                media_type="image",
                motion_style=motion,
                intent_match=9.2,
                theme_match=9.0,
                calmness=8.8,
                visual_quality=9.5,
                is_approved=True
            ))
        return results


image_fetch_service = ImageFetchService()
