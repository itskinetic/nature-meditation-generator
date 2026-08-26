import json
import logging
from typing import List, Optional
import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import SearchCache
from backend.app.schemas import CandidateItem, VideoFileVariant

logger = logging.getLogger(__name__)


class PexelsService:
    BASE_URL = "https://api.pexels.com/videos/search"

    def __init__(self):
        self.api_key = settings.PEXELS_API_KEY

    async def search(
        self,
        query: str,
        page: int = 1,
        per_page: int = 40,
        db: Optional[Session] = None
    ) -> List[CandidateItem]:
        cache_key = f"pexels:{query}:{page}:{per_page}"

        if db:
            cached = db.query(SearchCache).filter(SearchCache.cache_key == cache_key).first()
            if cached:
                try:
                    data = json.loads(cached.response_json)
                    return [CandidateItem(**item) for item in data]
                except Exception as e:
                    logger.warning(f"Error reading Pexels cache: {e}")

        if not self.api_key or len(self.api_key.strip()) < 5:
            # Fixture sample candidates for offline / dry-run mode
            candidates = self._get_fixture_candidates(query, page)
            return candidates

        headers = {
            "Authorization": self.api_key.strip()
        }
        params = {
            "query": query,
            "orientation": "landscape",
            "size": "large",
            "per_page": min(per_page, 80),
            "page": page
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(self.BASE_URL, headers=headers, params=params)
                if resp.status_code == 200:
                    raw_data = resp.json()
                    candidates = self._parse_pexels_response(raw_data, query)

                    if db:
                        cache_entry = SearchCache(
                            cache_key=cache_key,
                            provider="pexels",
                            query=query,
                            response_json=json.dumps([c.model_dump() for c in candidates])
                        )
                        db.merge(cache_entry)
                        db.commit()

                    return candidates
                else:
                    logger.error(f"Pexels API error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Pexels request failed: {e}")

        return self._get_fixture_candidates(query, page)

    def _parse_pexels_response(self, data: dict, query: str) -> List[CandidateItem]:
        candidates: List[CandidateItem] = []
        videos = data.get("videos", [])

        for v in videos:
            vid_id = str(v.get("id"))
            duration = float(v.get("duration", 0.0))
            width = int(v.get("width", 1920))
            height = int(v.get("height", 1080))
            user = v.get("user", {})
            creator_name = user.get("name", "Pexels Creator")
            creator_url = user.get("url", "")
            preview_url = v.get("image", "")
            source_url = v.get("url", "")

            # Video files
            raw_files = v.get("video_files", [])
            video_files: List[VideoFileVariant] = []
            best_link = ""
            for vf in raw_files:
                link = vf.get("link", "")
                w = vf.get("width")
                h = vf.get("height")
                q = vf.get("quality")
                video_files.append(VideoFileVariant(
                    id=str(vf.get("id", "")),
                    quality=q,
                    file_type=vf.get("file_type", "video/mp4"),
                    width=w,
                    height=h,
                    fps=vf.get("fps"),
                    link=link
                ))
                # Choose 1080p HD MP4 link
                if (w == 1920 or q == "hd") and not best_link:
                    best_link = link

            if not best_link and video_files:
                best_link = video_files[0].link

            candidates.append(CandidateItem(
                source="pexels",
                source_video_id=f"pexels_{vid_id}",
                source_url=source_url,
                creator_name=creator_name,
                creator_url=creator_url,
                search_query=query,
                duration=duration,
                width=width,
                height=height,
                preview_url=preview_url,
                video_files=video_files,
                download_url=best_link
            ))

        return candidates

    def _get_fixture_candidates(self, query: str, page: int = 1) -> List[CandidateItem]:
        """Provides simulated candidates when offline or running dry-run."""
        fixtures = [
            CandidateItem(
                source="pexels",
                source_video_id=f"pexels_fix_{query[:4]}_1_{page}",
                source_url=f"https://www.pexels.com/video/misty-forest-{page}-1",
                creator_name="Serene Visuals",
                creator_url="https://www.pexels.com/@serene",
                search_query=query,
                duration=25.0,
                width=1920,
                height=1080,
                preview_url="https://images.pexels.com/videos/111/free-video.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
            CandidateItem(
                source="pexels",
                source_video_id=f"pexels_fix_{query[:4]}_2_{page}",
                source_url=f"https://www.pexels.com/video/mossy-woodland-{page}-2",
                creator_name="Nature Light",
                creator_url="https://www.pexels.com/@naturelight",
                search_query=query,
                duration=30.0,
                width=1920,
                height=1080,
                preview_url="https://images.pexels.com/videos/112/free-video.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
            CandidateItem(
                source="pexels",
                source_video_id=f"pexels_fix_{query[:4]}_3_{page}",
                source_url=f"https://www.pexels.com/video/gentle-stream-{page}-3",
                creator_name="Quiet Woodlands",
                creator_url="https://www.pexels.com/@quietwoodlands",
                search_query=query,
                duration=28.0,
                width=1920,
                height=1080,
                preview_url="https://images.pexels.com/videos/113/free-video.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
            CandidateItem(
                source="pexels",
                source_video_id=f"pexels_fix_{query[:4]}_4_{page}",
                source_url=f"https://www.pexels.com/video/sunlight-trees-{page}-4",
                creator_name="Forest Whispers",
                creator_url="https://www.pexels.com/@forestwhispers",
                search_query=query,
                duration=35.0,
                width=1920,
                height=1080,
                preview_url="https://images.pexels.com/videos/114/free-video.jpg",
                download_url="https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
            ),
        ]
        return fixtures


pexels_service = PexelsService()
