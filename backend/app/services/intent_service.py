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
You are an expert AI Video Creative Director for a high-quality relaxing nature meditation video studio.
Analyze the meditation title and guidance script, detect the true emotional intent, time-of-day, and mood, then intelligently select 3 to 5 matching nature environment scenes.

Title: {title or 'Serene Meditation'}
Script: {script or 'Restful breathing and peaceful presence'}
Target Total Video Clips Needed: {target_clips}

DIRECTOR RULES:
- TIME & ATMOSPHERE MATCHING:
  * If the meditation is for Sleep, Rest, Deep Relaxation, Night, Bedtime, Slumber, or Wind-down:
    Prioritize peaceful night skies with stars, serene moonlit waters, sunset twilight horizons, and quiet night pine stillness.
  * If the meditation is for Morning, Waking, Energy, Gratitude, or Daytime Focus:
    Prioritize golden sunrise valleys, bright sunlit forest paths, wildflower meadows, and alpine mountain vistas.
  * If the meditation is for Emotional Healing, Self-Love, Grief, or Calm:
    Prioritize soothing turquoise ocean ripples, blooming lotus ponds, gentle pebble streams, and tranquil fern canyons.
  * If the meditation is for Zen, Mindfulness, Breathwork, or Deep Grounding:
    Prioritize green bamboo groves, still mirror mountain lakes, and gentle sand ripples.
- Visual Quality: Always ensure footage is calm, crystal clear, aesthetically pleasing, and free of people, buildings, vehicles, boats, fast movement, and text.

Return ONLY valid JSON matching this schema:
{{
  "intent": "gentle calming of the nervous system and deep restful sleep",
  "mood": ["restful", "peaceful", "calm", "soothing", "serene"],
  "energy_level": "very low",
  "visual_style": "peaceful starry night skies and calm moonlit waters",
  "preferred_colors": ["midnight blue", "soft silver", "starlight gold", "deep navy"],
  "visual_motifs": ["clear starry night sky", "gentle moonlight reflecting on lake", "silhouetted pine trees under stars"],
  "avoid_visuals": ["boat", "ship", "building", "car", "people", "timelapse", "storm", "foggy grey", "text", "fast motion"],
  "generated_queries": ["peaceful starry night sky stars", "calm water moonlight reflection", "still night lake water calm"],
  "planned_environments": [
    {{
      "id": "starry_night",
      "name": "Starry Night Sky",
      "icon": "✨",
      "keywords": ["peaceful starry night sky stars", "calm clear starry night horizon", "gentle night sky stars nature"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "moonlit_water",
      "name": "Moonlit Calm Waters",
      "icon": "🌙",
      "keywords": ["calm water moonlight reflection", "peaceful moonlit lake still water", "gentle moon reflection ocean calm"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "sunset_twilight",
      "name": "Sunset Twilight",
      "icon": "🌅",
      "keywords": ["soft pastel sunset sky ocean", "gentle golden evening horizon calm", "calm sunset lake reflection soft glow"],
      "suggested_clips": 4,
      "enabled": true
    }},
    {{
      "id": "night_forest",
      "name": "Night Forest Stillness",
      "icon": "🌲",
      "keywords": ["peaceful night forest trees stars", "calm pine trees night sky", "quiet night woods stars landscape"],
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

        # 1. Detect Intent, Mood & Thematic Category
        if manual_intent and manual_intent.strip():
            intent = manual_intent.strip()
            mood = manual_mood or ["peaceful", "warm", "gentle", "soothing"]
            visual_style = "calm, crystal-clear serene nature landscape"
            pref_colors = ["soft green", "warm gold", "turquoise blue", "soft white"]
            motifs = ["sunbeams through green trees", "blooming wildflowers", "crystal clear water"]
            keys = ["sunlit_forest", "wildflower_meadow", "mountain_lake", "calm_ocean"]

        # SLEEP / REST / NIGHT / EVENING
        elif any(w in combined for w in ["rest", "sleep", "night", "bed", "evening", "slumber", "dream", "moon", "twilight", "dusk", "darkness", "insomnia", "tired", "recharge"]):
            intent = "deep nervous system relaxation, peaceful evening rest, and gentle sleep"
            mood = ["restful", "peaceful", "serene", "calm", "soothing"]
            visual_style = "peaceful starry night skies, soft twilight horizons, and tranquil moonlit waters"
            pref_colors = ["midnight blue", "soft silver", "starlight gold", "lavender twilight"]
            motifs = ["peaceful starry night sky", "gentle moonlit lake reflections", "silhouetted pine canopy under stars", "soft evening twilight glow"]
            keys = ["starry_night", "moonlit_water", "sunset_twilight", "night_forest"]

        # MORNING / SUNRISE / AWAKEN / ENERGY / CLARITY
        elif any(w in combined for w in ["morning", "sunrise", "dawn", "awaken", "awake", "energy", "vitality", "start", "day", "clarity", "focus", "shine"]):
            intent = "energizing morning presence, mental clarity, and bright uplifting peace"
            mood = ["uplifting", "radiant", "peaceful", "warm", "spacious"]
            visual_style = "bright golden sunrise light, sun-dappled forests, and vibrant alpine vistas"
            pref_colors = ["warm gold", "fresh emerald", "sky blue", "amber yellow"]
            motifs = ["golden sunrise over rolling hills", "sunbeams through green trees", "dew drops on lush grass", "crystal clear mountain vistas"]
            keys = ["golden_sunrise", "sunlit_forest", "wildflower_meadow", "alpine_valleys"]

        # HEART / EMOTIONAL HEALING / LOVE / COMPASSION / GRIEF / SOFTEN
        elif any(w in combined for w in ["heart", "soften", "heal", "healing", "love", "compassion", "grief", "forgive", "kindness", "gentle", "embrace"]):
            intent = "emotional softening, warmth, inner self-compassion, and gentle presence"
            mood = ["gentle", "warm", "comforting", "peaceful", "tender"]
            visual_style = "soft pastel landscapes, soothing turquoise waves, and blooming lotus flowers"
            pref_colors = ["soft rose", "lotus pink", "turquoise blue", "warm amber"]
            motifs = ["gentle turquoise ocean waves", "blooming pink water lilies", "delicate cherry blossoms", "warm sunlit meadows"]
            keys = ["calm_ocean", "lotus_ponds", "wildflower_meadow", "cherry_blossoms"]

        # WATER / OCEAN / SEA / BEACH / WAVES / RIVERS
        elif any(w in combined for w in ["ocean", "sea", "beach", "water", "waves", "shore", "tide", "coast", "lagoon"]):
            intent = "soothing aquatic stillness, rhythmic wave breathing, and fluid peace"
            mood = ["flowing", "peaceful", "spacious", "refreshing", "calm"]
            visual_style = "crystal clear turquoise water, gentle sand ripples, and pristine shorelines"
            pref_colors = ["turquoise", "azure blue", "golden sand", "seafoam white"]
            motifs = ["crystal clear shallow ocean ripples", "gentle beach shoreline", "smooth river pebbles in clear water", "tropical turquoise lagoon"]
            keys = ["calm_ocean", "sandy_beach", "tropical_lagoons", "riverbed_pebbles"]

        # ZEN / MINDFULNESS / MEDITATION / STILLNESS / BREATH / GROUNDING
        elif any(w in combined for w in ["zen", "mindful", "mindfulness", "breath", "breathe", "still", "stillness", "ground", "grounding", "space", "spacious", "center"]):
            intent = "deep grounding presence, mindful breath awareness, and serene inner stillness"
            mood = ["grounded", "still", "spacious", "tranquil", "peaceful"]
            visual_style = "zen bamboo groves, mirror-like mountain lakes, and tranquil moss gardens"
            pref_colors = ["bamboo green", "slate grey", "sapphire blue", "moss emerald"]
            motifs = ["gently swaying tall bamboo", "still mirror mountain lake reflection", "smooth river stones", "lush fern alcoves"]
            keys = ["bamboo_groves", "mountain_lake", "riverbed_pebbles", "fern_canyon"]

        # AUTUMN / FOREST / NATURE WOODS
        elif any(w in combined for w in ["autumn", "fall", "forest", "woods", "trees", "rainforest", "woodland"]):
            intent = "peaceful woodland shelter, grounding earth connection, and leafy tranquility"
            mood = ["grounded", "peaceful", "sheltered", "warm", "serene"]
            visual_style = "lush green canopies, sunlit mossy paths, and golden autumn leaves"
            pref_colors = ["emerald green", "autumn gold", "warm amber", "moss jade"]
            motifs = ["sunbeams through green trees", "golden autumn maple leaves", "lush tropical rainforest canopy", "mossy fern hollows"]
            keys = ["sunlit_forest", "autumn_woodlands", "lush_rainforest", "fern_canyon"]

        # DEFAULT BALANCED HARMONY
        else:
            intent = "peaceful grounding, bright warmth, and deep holistic relaxation"
            mood = ["peaceful", "warm", "gentle", "spacious", "uplifting"]
            visual_style = "crystal-clear serene nature landscape with balanced forest, meadow, and water"
            pref_colors = ["warm gold", "fresh green", "turquoise blue", "soft white"]
            motifs = ["sunbeams through green trees", "blooming wildflowers", "crystal clear water", "gentle daytime light"]
            keys = ["sunlit_forest", "wildflower_meadow", "mountain_lake", "calm_ocean"]

        clips_per_env = max(2, target_clips // len(keys))
        all_queries = []
        selected_envs = []

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
            mood=manual_mood if (manual_mood and len(manual_mood) > 0) else mood,
            energy_level="very low",
            visual_style=visual_style,
            preferred_colors=pref_colors,
            visual_motifs=motifs,
            avoid_visuals=[
                "boat", "boats", "ship", "ships", "yacht", "vessel", "canoe", "kayak", "speedboat", "motorboat", "jetski", "sailing", "ferry",
                "dock", "docks", "pier", "piers", "marina", "harbor", "harbour", "port", "wharf", "jetty",
                "drone", "aerial", "overhead", "bird eye", "birds eye", "top down", "top-down", "satellite",
                "building", "house", "resort", "hotel", "cabin", "road", "car", "vehicle", "city", "bridge", "fence", "crowd", "traffic",
                "people", "person", "swimmer", "tourist", "tourists", "diver", "man", "woman", "human",
                "algae", "marsh", "swamp", "sludge", "scum", "murky", "muddy", "stagnant",
                "raw", "log footage", "flat profile", "ungraded", "dull", "desaturated",
                "washed out", "drab", "lifeless", "gloomy", "overcast", "grey", "gray",
                "dreary", "depressing", "bleak", "storms",
                "timelapse", "text"
            ],
            generated_queries=all_queries,
            planned_environments=selected_envs
        )


intent_service = IntentService()
