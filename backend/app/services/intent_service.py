import json
import logging
from typing import Optional, List, Dict
import httpx
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.schemas import IntentAnalysisResult, PlannedEnvironment, VisualBeat, StoryboardBreakdownResult
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
        target_clips: int = 10,
        studio_mode: str = "meditation",
        avoid_queries: Optional[List[str]] = None,
        db: Optional[Session] = None
    ) -> IntentAnalysisResult:
        """
        AI Video Director: Analyzes meditation or wildlife documentary concepts and dynamically extracts
        rich search keywords directly tailored to the narrative, avoiding recently used or rejected keywords.
        """
        cooldown_keywords: List[str] = []
        if db:
            try:
                from backend.app.models import KeywordBankItem
                import datetime
                cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=14)
                recent = db.query(KeywordBankItem.keyword).filter(KeywordBankItem.last_used_at > cutoff).order_by(KeywordBankItem.last_used_at.desc()).limit(30).all()
                cooldown_keywords = [r[0] for r in recent if r[0]]
            except Exception as e:
                logger.warning(f"Error querying keyword cooldown: {e}")

        if self.api_key and len(self.api_key.strip()) > 5:
            try:
                result = await self._analyze_with_gemini(
                    title, script, manual_intent, manual_mood, target_clips, studio_mode,
                    cooldown_keywords=cooldown_keywords,
                    avoid_queries=avoid_queries
                )
                if result:
                    return result
            except Exception as e:
                logger.warning(f"Gemini AI Director analysis failed, falling back to heuristic director: {e}")

        return self._analyze_heuristic(title, script, manual_intent, manual_mood, target_clips, studio_mode)

    async def _analyze_with_gemini(
        self,
        title: Optional[str],
        script: Optional[str],
        manual_intent: Optional[str],
        manual_mood: Optional[List[str]],
        target_clips: int,
        studio_mode: str = "meditation",
        cooldown_keywords: Optional[List[str]] = None,
        avoid_queries: Optional[List[str]] = None
    ) -> Optional[IntentAnalysisResult]:
        cooldown_str = ""
        if cooldown_keywords:
            cooldown_str = f"\nRECENTLY USED KEYWORDS ON COOLDOWN (Do NOT reuse these exact phrases; explore fresh terminology and diverse natural angles):\n{json.dumps(cooldown_keywords[:20])}\n"

        avoid_str = ""
        if avoid_queries and len(avoid_queries) > 0:
            clean_avoids = [q.strip() for q in avoid_queries if q and q.strip()][:25]
            if clean_avoids:
                avoid_str = f"\nREGENERATION DIRECTIVE — AVOID PREVIOUS KEYWORDS (Generate completely different, fresh, alternative visual scenes):\n{json.dumps(clean_avoids)}\n"

        if studio_mode == "documentary":
            prompt = f"""
You are an expert AI Wildlife Documentary Director (BBC Planet Earth / National Geographic style).
Analyze the title and narrative storyline script, detect the specific wildlife subjects, habitats, actions, and narrative arc, then plan 3 to 6 dynamic, highly specific visual scenes with rich search queries.

Title: {title or 'Wild Kingdom'}
Script: {script or 'Wildlife roaming their natural habitats'}
Target Total Clips Needed: {target_clips or 50}
{cooldown_str}
{avoid_str}
DIRECTOR INSTRUCTIONS:
- Extract dynamic, custom visual scenes directly from what is being narrated without being constrained to any fixed list.
- KEYWORD VOLUME REQUIREMENT (MANDATORY): For EACH scene, generate AT LEAST 5 to 7 distinct, diverse search queries (minimum 5 queries per scene) to provide abundant footage selection.
- Generate highly descriptive, specific 4K stock video search queries (e.g. "snow leopard stalking rocky mountain cliff 4k", "humpback whale breaching blue ocean 4k", "red eyed tree frog rainforest leaf close up", "lion pride savanna wildlife 4k").
- STRICTLY EXCLUDE: zoos, cages, enclosures, domestic pets (dogs/cats), aquariums, human trainers, fences, vehicles, tourists, text overlays.

Return ONLY valid JSON matching this schema:
{{
  "intent": "epic narrative arc and survival dynamics of the featured wildlife",
  "mood": ["majestic", "cinematic", "wild", "dramatic", "awe-inspiring"],
  "energy_level": "medium",
  "visual_style": "cinematic 4K wildlife footage with animal tracking shots and natural habitat vistas",
  "preferred_colors": ["golden amber", "deep ocean blue", "savanna ochre", "jungle green"],
  "visual_motifs": ["lion pride stalking grassland", "cheetah running sprint", "elephant herd at waterhole"],
  "avoid_visuals": ["zoo", "cage", "enclosure", "aquarium", "pet", "dog", "cat", "human", "tourist", "fence", "car", "text", "timelapse"],
  "generated_queries": ["query 1", "query 2", "query 3", "query 4", "query 5", "query 6", "query 7", "query 8", "query 9", "query 10"],
  "planned_environments": [
    {{
      "id": "scene_1",
      "name": "Savanna Predators & Big Cats",
      "icon": "🦁",
      "keywords": [
        "lion pride savanna wildlife 4k",
        "cheetah hunting grassland sprint 4k",
        "leopard resting on acacia branch 4k",
        "african lion walking golden grass 4k",
        "cheetah cubs playing savanna daylight 4k"
      ],
      "suggested_clips": 8,
      "enabled": true
    }},
    {{
      "id": "scene_2",
      "name": "Deep Ocean Giants",
      "icon": "🐋",
      "keywords": [
        "humpback whale swimming underwater 4k",
        "sea turtle coral reef clear water 4k",
        "pod of dolphins gliding blue ocean 4k",
        "orca whale surfacing peaceful ocean 4k",
        "manta ray gliding crystal clear water 4k"
      ],
      "suggested_clips": 8,
      "enabled": true
    }}
  ]
}}
"""
        else:
            prompt = f"""
You are an expert AI Video Creative Director for a high-quality relaxing nature meditation video studio.
Analyze the meditation title and guidance script, detect the true emotional intent, atmosphere, pacing, and mood, then dynamically extract 10 to 18 rich, diverse, and authentic 4K stock video search keywords based directly on what is described or evoked in the title and script.

Title: {title or 'Serene Meditation'}
Script: {script or 'Restful breathing and peaceful presence'}
Target Total Video Clips Needed: {target_clips or 50}
{cooldown_str}
{avoid_str}
DIRECTOR INSTRUCTIONS (FRESH, AUTHENTIC KEYWORDS — NO PRESET REPETITION):
- DO NOT default to generic forest or mountain lake tropes unless specifically called for by the script.
- DECODE the specific nature imagery, geography, elements, textures, and metaphors described in the script (e.g. desert sands, ocean tide pools, gentle rainfall on leaves, misty redwood giants, alpine meadows, crystal brooks, bamboo groves, calm seas, sunlit rolling hills).
- KEYWORD REQUIREMENT: Generate at least 10 to 18 diverse, specific, high-aesthetic 4K stock video search queries in "generated_queries".
- Formulate queries that stock footage engines (Pexels & Pixabay) index cleanly:
  * Combine: [Serene Atmosphere] + [Specific Nature Element] + [Horizon/Reflection/Water/Sky] + [Daylight] + [4k]
- VISUAL COMPOSITION:
  * Footage MUST be peaceful, spacious, minimalist, and serene.
  * Mandate wide open landscape vistas, visible horizons, or calm reflections.
  * STRICTLY EXCLUDE: ski resorts, chairlifts, fences, roads, cars, boats, people, timelapse, rapid motion, text, logos.
  * STRICTLY FORBIDDEN: "canopy", "treetops", "drone glide", "aerial tracking", "overhead", "top down", "dark", "sunset", "golden hour", "dusk", "night" (unless sleep theme is explicitly requested).

Return ONLY valid JSON matching this schema:
{{
  "intent": "narrative intent description reflecting the script",
  "mood": ["peaceful", "calm", "serene", "soothing", "grounding"],
  "energy_level": "very low",
  "visual_style": "spacious, tranquil, uncluttered bright natural daylight landscapes with clear horizons and calm waters",
  "preferred_colors": ["emerald green", "azure sky blue", "crystal turquoise", "fresh spring jade"],
  "visual_motifs": ["open horizons", "gentle flowing water", "peaceful nature vistas"],
  "avoid_visuals": ["canopy", "treetops", "top down", "overhead", "choppy water", "ski", "skier", "chairlift", "ski resort", "snow slope", "cluttered", "dense", "dark", "gloomy", "grey overcast", "murky", "underexposed", "silhouette", "backlit", "sunset", "golden hour", "dusk", "twilight", "sunbeams", "macro", "close up", "closeup", "detail", "flower", "flowers", "macro flower", "petal", "lotus", "bee", "insect", "bug", "boat", "ship", "building", "car", "people", "timelapse", "storm", "foggy grey", "text", "fast motion"],
  "generated_queries": [
    "distinct 4k stock video query 1 matching script",
    "distinct 4k stock video query 2 matching script",
    "distinct 4k stock video query 3 matching script",
    "distinct 4k stock video query 4 matching script",
    "distinct 4k stock video query 5 matching script",
    "distinct 4k stock video query 6 matching script",
    "distinct 4k stock video query 7 matching script",
    "distinct 4k stock video query 8 matching script",
    "distinct 4k stock video query 9 matching script",
    "distinct 4k stock video query 10 matching script"
  ],
  "planned_environments": [
    {{
      "id": "scene_1",
      "name": "Distinct Visual Setting 1",
      "icon": "🌿",
      "keywords": [
        "distinct query 1 4k",
        "distinct query 2 4k",
        "distinct query 3 4k"
      ],
      "suggested_clips": 10,
      "enabled": true
    }}
  ]
}}
"""
        candidate_models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"}
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text)
                        self._ensure_min_scene_keywords(parsed, studio_mode=studio_mode)
                        return IntentAnalysisResult(**parsed)
                    else:
                        logger.warning(f"Gemini model {model_name} returned status {resp.status_code}: {resp.text[:100]}")
                except Exception as ex:
                    logger.warning(f"Gemini model {model_name} request failed: {ex}")
        return None

    def _ensure_min_scene_keywords(self, parsed: dict, studio_mode: str = "meditation") -> None:
        """Guarantees that every planned environment has at least 5 distinct search keywords and normalizes energy_level."""
        if not isinstance(parsed, dict):
            return

        if studio_mode == "meditation":
            parsed["energy_level"] = "very low"
        elif "energy_level" not in parsed:
            parsed["energy_level"] = "medium"
        if not isinstance(parsed, dict) or "planned_environments" not in parsed:
            return

        all_gen_queries = list(parsed.get("generated_queries") or [])
        for pe in parsed.get("planned_environments", []):
            kws = pe.get("keywords") or []
            unique_kws: List[str] = []
            seen = set()
            for k in kws:
                cleaned = str(k).strip()
                if cleaned and cleaned.lower() not in seen:
                    seen.add(cleaned.lower())
                    unique_kws.append(cleaned)

            clean_name = str(pe.get("name") or "Nature Scene").strip().lower()
            supplements = [
                f"peaceful {clean_name} landscape horizon blue sky 4k",
                f"calm {clean_name} reflection sunny day tranquil 4k",
                f"serene {clean_name} open vista daylight 4k",
                f"tranquil {clean_name} shore clear water daylight 4k",
                f"peaceful {clean_name} meadow distant hills sunny day 4k",
                f"quiet {clean_name} nature path sunlight daylight 4k",
                f"calm {clean_name} gentle shoreline horizon sunny day 4k"
            ]
            for supp in supplements:
                if len(unique_kws) >= 5:
                    break
                if supp.lower() not in seen:
                    seen.add(supp.lower())
                    unique_kws.append(supp)

            pe["keywords"] = unique_kws
            pe["suggested_clips"] = max(5, int(pe.get("suggested_clips", 5)))
            for q in unique_kws:
                if q not in all_gen_queries:
                    all_gen_queries.append(q)

        parsed["generated_queries"] = all_gen_queries

    def _analyze_heuristic(
        self,
        title: Optional[str],
        script: Optional[str],
        manual_intent: Optional[str],
        manual_mood: Optional[List[str]],
        target_clips: int,
        studio_mode: str = "meditation"
    ) -> IntentAnalysisResult:
        from backend.app.presets.nature_presets import WILDLIFE_ENVIRONMENTS
        combined = f"{title or ''} {script or ''}".lower()

        # WILDLIFE DOCUMENTARY HEURISTIC
        if studio_mode == "documentary":
            if any(w in combined for w in ["savanna", "africa", "lion", "cheetah", "leopard", "elephant", "zebra", "safari"]):
                intent = "epic African savanna wildlife survival and big cat predator dynamics"
                mood = ["majestic", "wild", "cinematic", "dynamic"]
                visual_style = "golden savanna plains with roaming big cats and elephant herds"
                pref_colors = ["golden amber", "savanna ochre", "earth brown", "acacia green"]
                motifs = ["lion pride in golden grass", "cheetah hunting sprint", "elephant herd at waterhole"]
                keys = ["savanna_predators", "sky_predators", "wetland_wildlife"]
            elif any(w in combined for w in ["ocean", "sea", "whale", "shark", "dolphin", "turtle", "marine", "underwater", "reef"]):
                intent = "awe-inspiring marine life exploration and deep ocean giant behaviors"
                mood = ["wondrous", "serene", "majestic", "fluid"]
                visual_style = "crystal clear ocean depths with swimming whales and gliding sea turtles"
                pref_colors = ["deep navy", "turquoise blue", "coral orange", "seafoam"]
                motifs = ["humpback whale surfacing", "sea turtle gliding over reef", "dolphins in clear water"]
                keys = ["marine_giants", "wetland_wildlife", "sky_predators"]
            elif any(w in combined for w in ["jungle", "rainforest", "amazon", "jaguar", "monkey", "toucan", "macaw", "tropical"]):
                intent = "rich rainforest biodiversity and exotic jungle wildlife behavior"
                mood = ["vibrant", "stealthy", "cinematic", "lush"]
                visual_style = "dense green rainforest canopies with prowling jaguars and colorful macaws"
                pref_colors = ["emerald green", "jaguar gold", "scarlet red", "bright yellow"]
                motifs = ["jaguar prowling through jungle", "monkeys swinging in trees", "toucan on mossy branch"]
                keys = ["jungle_rainforest", "macro_insects", "wetland_wildlife"]
            elif any(w in combined for w in ["arctic", "polar", "ice", "snow", "penguin", "fox", "seal", "walrus", "antarctica"]):
                intent = "harsh polar wilderness and resilient arctic wildlife survival"
                mood = ["epic", "stark", "majestic", "resilient"]
                visual_style = "vast glaciers and sea ice with roaming polar bears and penguin colonies"
                pref_colors = ["glacier white", "ice blue", "polar grey", "slate navy"]
                motifs = ["polar bear on sea ice", "emperor penguin colony", "arctic fox hunting in snow"]
                keys = ["arctic_wildlife", "marine_giants", "sky_predators"]
            elif any(w in combined for w in ["bird", "eagle", "hawk", "owl", "flight", "raptor", "sky"]):
                intent = "aerial mastery and keen hunting instincts of apex birds of prey"
                mood = ["focused", "majestic", "soaring", "dramatic"]
                visual_style = "mountain skies with soaring bald eagles and poised hunting raptors"
                pref_colors = ["sky azure", "feather amber", "mountain white", "cloud grey"]
                motifs = ["bald eagle soaring mountain vista", "snowy owl perched on branch", "hawk in flight"]
                keys = ["sky_predators", "mountain_predators", "savanna_predators"]
            else: # Default balanced wildlife documentary
                intent = "captivating wildlife documentary journey across diverse natural animal habitats"
                mood = ["majestic", "cinematic", "wild", "awe-inspiring"]
                visual_style = "cinematic wildlife footage celebrating magnificent animals in the wild"
                pref_colors = ["golden amber", "deep ocean blue", "emerald green", "earth ochre"]
                motifs = ["big cats roaming savanna", "whales swimming in deep ocean", "eagles soaring over mountains"]
                keys = ["savanna_predators", "marine_giants", "mountain_predators", "sky_predators"]

            clips_per_env = max(2, target_clips // len(keys))
            all_queries = []
            selected_envs = []
            for k in keys:
                env_def = WILDLIFE_ENVIRONMENTS.get(k) or NATURE_ENVIRONMENTS.get(k)
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
                energy_level="medium",
                visual_style=visual_style,
                preferred_colors=pref_colors,
                visual_motifs=motifs,
                avoid_visuals=[
                    "zoo", "cage", "caged", "enclosure", "aquarium", "pet", "dog", "cat", "puppy", "kitten",
                    "leash", "collar", "domestic", "human", "tourist", "trainer", "crowd",
                    "fence", "bars", "car", "road", "city", "building", "text", "watermark", "timelapse"
                ],
                generated_queries=all_queries,
                planned_environments=selected_envs
            )

        # 1. NATURE MEDITATION HEURISTIC
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

        clips_per_env = max(5, target_clips // max(1, len(keys)))
        all_queries = []
        selected_envs = []

        for k in keys:
            env_def = NATURE_ENVIRONMENTS.get(k) or WILDLIFE_ENVIRONMENTS.get(k)
            if env_def:
                kw = list(env_def.queries)
                if len(kw) < 5:
                    clean_name = env_def.name.lower()
                    kw.extend([
                        f"peaceful {clean_name} landscape horizon blue sky 4k",
                        f"calm {clean_name} reflection sunny day tranquil 4k",
                        f"serene {clean_name} open vista daylight 4k",
                        f"tranquil {clean_name} shore clear water daylight 4k",
                        f"peaceful {clean_name} meadow distant hills sunny day 4k"
                    ])
                selected_envs.append(PlannedEnvironment(
                    id=env_def.id,
                    name=env_def.name,
                    icon=env_def.icon,
                    keywords=kw[:7],
                    suggested_clips=clips_per_env,
                    enabled=True
                ))
                all_queries.extend(kw[:5])

        return IntentAnalysisResult(
            intent=intent,
            mood=manual_mood if (manual_mood and len(manual_mood) > 0) else mood,
            energy_level="very low",
            visual_style=visual_style,
            preferred_colors=pref_colors,
            visual_motifs=motifs,
            avoid_visuals=[
                "canopy", "treetops", "dense canopy", "ski", "skier", "skiing", "chairlift", "ski resort", "snow slope", "choppy", "turbulent", "cluttered",
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

    async def breakdown_script_beats(
        self,
        title: str = "",
        script: str = "",
        target_duration: Optional[float] = None,
        studio_mode: str = "documentary",
        audio_file: Optional[str] = None
    ) -> StoryboardBreakdownResult:
        """
        AI Script Storyboard Director:
        Breaks down narration into sequential Visual Beats with animal subjects, actions,
        habitats, camera shot preferences, timestamps, and targeted search queries.
        """
        if not script or not script.strip():
            # Generate default visual beats based on title or mode
            script = f"Exploring the incredible wildlife dynamics and natural behaviors of {title or 'the wilderness'}."

        if self.api_key and len(self.api_key.strip()) > 5:
            try:
                res = await self._breakdown_beats_gemini(title, script, target_duration, studio_mode)
                if res and res.visual_beats:
                    return res
            except Exception as e:
                logger.warning(f"Gemini script beat breakdown failed, falling back to heuristic breakdown: {e}")

        return self._breakdown_beats_heuristic(title, script, target_duration, studio_mode)

    async def _breakdown_beats_gemini(
        self,
        title: str,
        script: str,
        target_duration: Optional[float],
        studio_mode: str
    ) -> Optional[StoryboardBreakdownResult]:
        prompt = f"""You are a professional BBC Earth / National Geographic Creative Director and Editor.
Break down this documentary / ambient narration script into a sequential timeline of 3 to 10 Visual Beats (individual scenes).
For each beat, extract the spoken narrative excerpt, the exact animal subject or nature focal point, the habitat, action, camera shot type, targeted search keywords, and calculated duration in seconds.

Title: {title or 'Wildlife Documentary'}
Script:
{script}
Target Total Duration: {target_duration if target_duration else 'Auto-calculate based on natural narration speed (~130-150 words per minute)'}

Return ONLY valid JSON matching this schema:
{{
  "title": "{title or 'Wildlife Documentary'}",
  "visual_beats": [
    {{
      "beat_index": 0,
      "narrative_cue": "Dawn breaks over the Serengeti, warming the golden grasslands.",
      "visual_subject": "Serengeti sunrise landscape",
      "habitat": "Savanna",
      "action_type": "ambient",
      "camera_shot": "wide_vista",
      "keywords": ["serengeti golden sunrise landscape 4k", "african savanna morning light vista", "african grassland dawn"],
      "duration_seconds": 12.0
    }},
    {{
      "beat_index": 1,
      "narrative_cue": "A pride of lions awakens, surveying the horizon for their morning hunt.",
      "visual_subject": "Lion pride in grass",
      "habitat": "Savanna",
      "action_type": "stalking",
      "camera_shot": "tracking_shot",
      "keywords": ["lion pride savanna grass 4k", "lioness stalking golden grassland", "lion cub waking savanna"],
      "duration_seconds": 15.0
    }}
  ]
}}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                beats_data = parsed.get("visual_beats", [])

                visual_beats = []
                curr_time = 0.0
                for i, b in enumerate(beats_data):
                    dur = float(b.get("duration_seconds", 12.0))
                    dur = max(6.0, min(30.0, dur))
                    start = curr_time
                    end = curr_time + dur
                    curr_time = end

                    visual_beats.append(VisualBeat(
                        beat_index=i,
                        narrative_cue=b.get("narrative_cue", f"Scene {i+1}"),
                        visual_subject=b.get("visual_subject", "Wildlife Scene"),
                        habitat=b.get("habitat", "Wilderness"),
                        action_type=b.get("action_type", "ambient"),
                        camera_shot=b.get("camera_shot", "wide_vista"),
                        keywords=b.get("keywords", [f"wildlife {title} 4k"]),
                        duration_seconds=round(dur, 1),
                        start_time=round(start, 1),
                        end_time=round(end, 1)
                    ))

                if visual_beats:
                    return StoryboardBreakdownResult(
                        title=title or parsed.get("title", "Wildlife Documentary"),
                        total_beats=len(visual_beats),
                        estimated_total_duration=round(curr_time, 1),
                        visual_beats=visual_beats
                    )
        return None

    def _breakdown_beats_heuristic(
        self,
        title: str,
        script: str,
        target_duration: Optional[float],
        studio_mode: str
    ) -> StoryboardBreakdownResult:
        import re
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', script) if len(s.strip()) > 8]
        if not sentences:
            sentences = [script.strip()] if script.strip() else ["Cinematic nature and wildlife journey."]

        visual_beats = []
        curr_time = 0.0

        for i, sent in enumerate(sentences):
            words = len(sent.split())
            dur = max(8.0, min(25.0, round(words * 0.45 + 3.0, 1)))
            start = curr_time
            end = curr_time + dur
            curr_time = end

            # Extract keywords from sentence
            clean_sent = re.sub(r'[^a-zA-Z0-9\s]', '', sent.lower())
            keywords = [f"{clean_sent[:40]} 4k", f"{title} wildlife 4k" if title else "nature 4k"]

            visual_beats.append(VisualBeat(
                beat_index=i,
                narrative_cue=sent,
                visual_subject=f"Scene {i+1}: {title or 'Wild Narrative'}",
                habitat="Natural Habitat",
                action_type="ambient",
                camera_shot="wide_vista",
                keywords=keywords,
                duration_seconds=dur,
                start_time=round(start, 1),
                end_time=round(end, 1)
            ))

        return StoryboardBreakdownResult(
            title=title or "Wildlife Storyboard",
            total_beats=len(visual_beats),
            estimated_total_duration=round(curr_time, 1),
            visual_beats=visual_beats
        )

    async def regenerate_one_keyword(
        self,
        bad_keyword: str,
        title: Optional[str] = "",
        script: Optional[str] = "",
        existing_queries: Optional[List[str]] = None,
        studio_mode: str = "meditation"
    ) -> str:
        """Generates a single fresh replacement 4K stock video keyword for a rejected/bad keyword."""
        existing_list = [q.strip().lower() for q in (existing_queries or []) if q and q.strip()]
        if bad_keyword:
            existing_list.append(bad_keyword.strip().lower())

        if self.api_key and len(self.api_key.strip()) > 5:
            try:
                candidate_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.85, "maxOutputTokens": 100}
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    for model_name in candidate_models:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            new_kw = data["candidates"][0]["content"]["parts"][0]["text"].strip().strip('"\'`')
                            if new_kw and len(new_kw) > 5 and new_kw.lower() not in existing_list:
                                return new_kw
            except Exception as e:
                logger.warning(f"Gemini regenerate_one_keyword failed: {e}")

        # Heuristic fallback
        fallbacks = [
            "golden morning sunlight misty redwood forest 4k",
            "clear turquoise ocean gentle ripples sunny day 4k",
            "peaceful alpine lake mirror reflection daylight 4k",
            "tranquil bamboo water fountain slow motion 4k",
            "serene wildflower meadow distant mountains sunny day 4k",
            "crystal clear mountain river mossy rocks 4k",
            "peaceful starry night sky horizon 4k",
            "calm desert sand dunes gentle wind 4k",
            "zen pebble garden tranquil water ripples 4k",
            "emerald green moss forest gentle daylight 4k",
            "gentle ocean waves sandy beach sunny day 4k",
            "misty mountain peaks golden morning light 4k"
        ]
        for f in fallbacks:
            if f.lower() not in existing_list:
                return f
        return f"{bad_keyword} slow motion daylight 4k"


intent_service = IntentService()

