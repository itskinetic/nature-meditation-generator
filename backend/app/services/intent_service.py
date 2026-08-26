import json
import logging
from typing import Optional, List, Dict
import httpx
from backend.app.config import settings
from backend.app.schemas import IntentAnalysisResult, PlannedEnvironment
from backend.app.presets.nature_presets import NATURE_ENVIRONMENTS

logger = logging.getLogger(__name__)


class IntentService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    async def analyze(
        self,
        title: Optional[str] = "",
        script: Optional[str] = "",
        manual_intent: Optional[str] = None,
        manual_mood: Optional[List[str]] = None,
        preset_name: Optional[str] = None,
        target_clips: int = 16
    ) -> IntentAnalysisResult:
        """
        AI Video Director: Analyzes meditation content and automatically plans
        3 to 6 harmonious, diverse environment scenes with search keywords and clip allocations.
        Strictly prioritizes bright, serene, daylight scenes and excludes gloomy footage.
        """
        if self.api_key and len(self.api_key.strip()) > 5:
            try:
                result = await self._analyze_with_gemini(title, script, manual_intent, manual_mood, target_clips)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"Gemini AI Director analysis failed, falling back to heuristic director: {e}")

        return self._analyze_heuristic(title, script, manual_intent, manual_mood, target_clips)

    async def _analyze_with_gemini(
        self,
        title: Optional[str],
        script: Optional[str],
        manual_intent: Optional[str],
        manual_mood: Optional[List[str]],
        target_clips: int
    ) -> Optional[IntentAnalysisResult]:
        prompt = f"""
You are an expert AI Video Creative Director for a relaxing nature meditation video channel.
Analyze the meditation content, and plan a bright, uplifting, peaceful visual journey composed of 3 to 5 distinct nature environment scenes.

Title: {title or 'Serene Meditation'}
Script: {script or 'Restful breathing and peaceful presence'}
Target Total Video Clips Needed: {target_clips}

IMPORTANT VISUAL DIRECTIVE:
- ALL scenes must be visually bright, softly sunlit, vibrant, clear, and serene.
- STRICTLY EXCLUDE gloomy, dark, dreary, overcast, foggy-grey, stormy, or shadowy footage.
- Choose a diverse variety of environments (e.g. mix forests, wildflower meadows, crystal lakes, sunrise valleys, or turquoise oceans).

Return ONLY valid JSON matching this schema:
{{
  "intent": "emotional softening and peaceful inner spaciousness",
  "mood": ["peaceful", "gentle", "warm", "spacious", "uplifting"],
  "energy_level": "very low",
  "visual_style": "bright softly-sunlit natural landscape",
  "preferred_colors": ["warm gold", "fresh green", "turquoise blue", "soft white"],
  "visual_motifs": ["sunbeams through green trees", "blooming wildflowers", "crystal clear water", "gentle morning light"],
  "avoid_visuals": ["raw footage", "log profile", "flat color", "ungraded", "grey", "gray", "dull", "washed out", "desaturated", "drab", "gloomy", "dark", "overcast", "dreary", "depressing", "storms", "people", "buildings", "vehicles", "timelapse", "text"],
  "generated_queries": ["sunlight through forest trees", "sunlit wildflower meadow", "crystal clear calm sea", "still alpine lake reflection"],
  "planned_environments": [
    {{
      "id": "sunlit_forest",
      "name": "Sunlit Forest & Woodland Canopy",
      "icon": "🌲",
      "keywords": ["sunlight through forest trees", "bright green woodland canopy", "sunlit quiet forest path"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "wildflower_meadow",
      "name": "Sun-Drenched Wildflower Meadow",
      "icon": "🌸",
      "keywords": ["sunlit wildflower meadow", "blooming wildflower field", "gentle breeze colorful meadow"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "mountain_lake",
      "name": "Crystal Mountain Lakes",
      "icon": "🏞️",
      "keywords": ["still alpine lake reflection", "crystal clear mountain lake", "peaceful lake shore"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "calm_ocean",
      "name": "Calm Ocean & Turquoise Waves",
      "icon": "🌊",
      "keywords": ["crystal clear calm sea", "calm turquoise shoreline", "gentle shallow sea ripples"],
      "suggested_clips": 4,
      "enabled": true
    }}
  ]
}}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"}
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return IntentAnalysisResult(**parsed)
        return None

    def _analyze_heuristic(
        self,
        title: Optional[str],
        script: Optional[str],
        manual_intent: Optional[str],
        manual_mood: Optional[List[str]],
        target_clips: int
    ) -> IntentAnalysisResult:
        combined = f"{title or ''} {script or ''}".lower()

        # Extract emotional intent
        if manual_intent and manual_intent.strip():
            intent = manual_intent.strip()
        elif "heart" in combined or "soften" in combined:
            intent = "emotional softening, warmth, and peaceful self-acceptance"
        elif "sleep" in combined or "rest" in combined:
            intent = "gentle calming of the nervous system and serene tranquility"
        elif "clarity" in combined or "focus" in combined:
            intent = "gentle mental clarity and spacious daytime peace"
        else:
            intent = "peaceful grounding, bright warmth, and deep relaxation"

        # Determine moods
        mood = manual_mood if (manual_mood and len(manual_mood) > 0) else ["peaceful", "warm", "gentle", "spacious", "uplifting"]

        # Select 4 complementary bright environments from the 20 available
        selected_envs = []
        if "ocean" in combined or "beach" in combined or "sea" in combined:
            keys = ["calm_ocean", "sandy_beach", "tropical_lagoons", "sunset_twilight"]
        elif "mountain" in combined or "lake" in combined or "stream" in combined:
            keys = ["mountain_lake", "cascading_waterfalls", "alpine_valleys", "sunlit_forest"]
        elif "meadow" in combined or "flower" in combined or "grass" in combined:
            keys = ["wildflower_meadow", "golden_grasslands", "cherry_blossoms", "golden_sunrise"]
        elif "zen" in combined or "bamboo" in combined or "lotus" in combined:
            keys = ["bamboo_groves", "lotus_ponds", "fern_canyon", "sunlit_forest"]
        elif "autumn" in combined or "fall" in combined:
            keys = ["autumn_woodlands", "golden_sunrise", "riverbed_pebbles", "mountain_lake"]
        else:
            # Default balanced diverse nature journey
            keys = ["sunlit_forest", "wildflower_meadow", "mountain_lake", "calm_ocean"]

        clips_per_env = max(2, target_clips // len(keys))
        all_queries = []

        for k in keys:
            env_def = NATURE_ENVIRONMENTS.get(k)
            if env_def:
                selected_envs.append(PlannedEnvironment(
                    id=env_def.id,
                    name=env_def.name,
                    icon=env_def.icon,
                    keywords=env_def.queries[:3],
                    suggested_clips=clips_per_env,
                    enabled=True
                ))
                all_queries.extend(env_def.queries[:2])

        return IntentAnalysisResult(
            intent=intent,
            mood=mood,
            energy_level="very low",
            visual_style="bright, sunlit, crystal-clear serene nature landscape",
            preferred_colors=["warm gold", "fresh green", "turquoise blue", "soft white"],
            visual_motifs=["sunbeams through green trees", "blooming wildflowers", "crystal clear water", "gentle morning light"],
            avoid_visuals=[
                "boat", "boats", "ship", "ships", "yacht", "vessel", "canoe", "kayak", "speedboat", "motorboat", "jetski", "sailing", "ferry",
                "dock", "docks", "pier", "piers", "marina", "harbor", "harbour", "port", "wharf", "jetty",
                "drone", "aerial", "overhead", "bird eye", "birds eye", "top down", "top-down", "satellite",
                "building", "house", "resort", "hotel", "cabin", "road", "car", "vehicle", "city", "bridge", "fence", "crowd", "traffic",
                "people", "person", "swimmer", "tourist", "tourists", "diver", "man", "woman", "human",
                "algae", "marsh", "swamp", "sludge", "scum", "murky", "muddy", "stagnant",
                "raw", "log footage", "flat profile", "ungraded", "dull", "desaturated",
                "washed out", "drab", "lifeless", "gloomy", "dark", "overcast", "grey", "gray",
                "dreary", "depressing", "bleak", "foggy dark", "night", "shadowy", "storms",
                "timelapse", "text"
            ],
            generated_queries=all_queries,
            planned_environments=selected_envs
        )


intent_service = IntentService()
