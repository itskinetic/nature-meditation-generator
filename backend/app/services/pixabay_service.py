import json
import logging
from typing import List, Optional
import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import SearchCache
from backend.app.schemas import CandidateItem, VideoFileVariant

logger = logging.getLogger(__name__)


class PixabayService:
    BASE_URL = "https://pixabay.com/api/videos/"

    def __init__(self):
        self.api_key = settings.PIXABAY_API_KEY

    async def search(
        self,
        query: str,
        page: int = 1,
        per_page: int = 30,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        cache_key = f"pixabay:{query}:{page}:{per_page}"

        if db:
            cached = db.query(SearchCache).filter(SearchCache.cache_key == cache_key).first()
            if cached:
                try:
                    data = json.loads(cached.response_json)
                    return [CandidateItem(**item) for item in data]
                except Exception as e:
                    logger.warning(f"Error reading Pixabay cache: {e}")

        if not self.api_key or len(self.api_key.strip()) < 5:
            # Fixture candidates for offline / dry-run
            return self._get_fixture_candidates(query, page)

        params = {
            "key": self.api_key.strip(),
            "q": query,
            "video_type": "film",
            "category": "nature",
            "safesearch": "true",
            "per_page": min(per_page, 50),
            "page": page
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(self.BASE_URL, params=params)
                if resp.status_code == 200:
                    raw_data = resp.json()
                    candidates = self._parse_pixabay_response(raw_data, query)

                    if db:
                        cache_entry = SearchCache(
                            cache_key=cache_key,
                            provider="pixabay",
                            query=query,
                            response_json=json.dumps([c.model_dump() for c in candidates])
                        )
                        db.merge(cache_entry)
                        db.commit()

                    return candidates
                else:
                    logger.error(f"Pixabay API error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Pixabay request failed: {e}")

        return self._get_fixture_candidates(query, page)

    def _parse_pixabay_response(self, data: dict, query: str) -> List[CandidateItem]:
        candidates: List[CandidateItem] = []
        hits = data.get("hits", [])

        for h in hits:
            vid_id = str(h.get("id"))
            duration = float(h.get("duration", 0.0))
            creator_name = h.get("user", "Pixabay Creator")
            user_id = h.get("user_id", "")
            creator_url = f"https://pixabay.com/users/{creator_name}-{user_id}/" if user_id else ""
            source_url = h.get("pageURL", "")

            # Videos dictionary in Pixabay response: { large: {url, width, height}, medium: {...}, small: {...}, tiny: {...} }
            vids = h.get("videos", {})
            video_files: List[VideoFileVariant] = []
            best_link = ""
            best_width = 1920
            best_height = 1080

            # Inspect large, medium, small
            for size_key in ["large", "medium", "small", "tiny"]:
                info = vids.get(size_key)
                if info and isinstance(info, dict) and info.get("url"):
                    url = info.get("url", "")
                    w = info.get("width", 1920)
                    h_val = info.get("height", 1080)
                    video_files.append(VideoFileVariant(
                        id=f"{vid_id}_{size_key}",
                        quality=size_key,
                        file_type="video/mp4",
                        width=w,
                        height=h_val,
                        link=url
                    ))
                    if (size_key == "large" or size_key == "medium") and not best_link:
                        best_link = url
                        best_width = w
                        best_height = h_val

            if not best_link and video_files:
                best_link = video_files[0].link

            preview_url = h.get("videos", {}).get("tiny", {}).get("thumbnail", "")
            if not preview_url:
                preview_url = f"https://i.vimeocdn.com/video/{h.get('picture_id', '')}_640x360.jpg"

            candidates.append(CandidateItem(
                source="pixabay",
                source_video_id=f"pixabay_{vid_id}",
                source_url=source_url,
                creator_name=creator_name,
                creator_url=creator_url,
                search_query=query,
                duration=duration,
                width=best_width,
                height=best_height,
                preview_url=preview_url,
                video_files=video_files,
                download_url=best_link
            ))

        return candidates

    async def get_video_play_url(self, vid_id: str) -> Optional[str]:
        """Fetch fresh direct playable MP4 link for a specific Pixabay video ID."""
        if not self.api_key or len(self.api_key.strip()) < 5:
            return None
        clean_id = vid_id.replace("pixabay_", "")
        url = f"https://pixabay.com/api/videos/?key={self.api_key.strip()}&id={clean_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    hits = data.get("hits", [])
                    if hits:
                        videos = hits[0].get("videos", {})
                        for q in ["large", "medium", "small", "tiny"]:
                            if q in videos and videos[q].get("url"):
                                return videos[q]["url"]
        except Exception as e:
            logger.warning(f"Error fetching Pixabay video details for {vid_id}: {e}")
        return None

    def _get_fixture_candidates(self, query: str, page: int = 1) -> List[CandidateItem]:
        fixtures = [
            CandidateItem(
                source="pixabay",
                source_video_id=f"pixabay_fix_{query[:4]}_1_{page}",
                source_url=f"https://pixabay.com/videos/fog-nature-{page}-1",
                creator_name="Zen Outdoors",
                creator_url="https://pixabay.com/users/zenoutdoors-1",
                search_query=query,
                duration=22.0,
                width=1920,
                height=1080,
                preview_url="https://cdn.pixabay.com/video/2020/05/25/40149-424754707_tiny.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
            CandidateItem(
                source="pixabay",
                source_video_id=f"pixabay_fix_{query[:4]}_2_{page}",
                source_url=f"https://pixabay.com/videos/misty-creek-{page}-2",
                creator_name="Deep Calm",
                creator_url="https://pixabay.com/users/deepcalm-2",
                search_query=query,
                duration=32.0,
                width=1920,
                height=1080,
                preview_url="https://cdn.pixabay.com/video/2020/05/25/40150-424754708_tiny.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
        ]
        return fixtures


pixabay_service = PixabayService()
