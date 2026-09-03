import json
import logging
from typing import Optional
import httpx

from backend.app.config import settings
from backend.app.schemas import ScoringResult, CandidateItem, IntentAnalysisResult, PresetSchema

logger = logging.getLogger(__name__)


class ScoringService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    async def score_candidate(
        self,
        candidate: CandidateItem,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema] = None,
        studio_mode: str = "meditation",
        shot_preference: str = "balanced"
    ) -> ScoringResult:
        """
        Scores a candidate video using vision API or heuristic evaluation.
        Enforces strict mode-aware scoring criteria (meditation vs wildlife documentary)
        and rejects still shots unless 'still' shot preference is explicitly selected.
        """
        # If Gemini API Key is available and preview_url is reachable, call Gemini Vision
        if self.api_key and len(self.api_key.strip()) > 5 and candidate.preview_url:
            try:
                result = await self._score_with_gemini(candidate, analysis, preset, studio_mode)
                if result:
                    return self._apply_scoring_thresholds(result, preset, studio_mode, shot_preference=shot_preference)
            except Exception as e:
                logger.warning(f"Gemini vision scoring failed for {candidate.source_video_id}: {e}")

        # Fallback heuristic scoring
        result = self._score_heuristic(candidate, analysis, preset, studio_mode)
        return self._apply_scoring_thresholds(result, preset, studio_mode, shot_preference=shot_preference)

    async def _score_with_gemini(
        self,
        candidate: CandidateItem,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema],
        studio_mode: str = "meditation"
    ) -> Optional[ScoringResult]:
        is_doc = (studio_mode == "documentary")
        
        if is_doc:
            prompt = f"""
Evaluate this video/preview for a high-production BBC Planet Earth / National Geographic style Wildlife Documentary.

Target Theme / Animal Subject: {analysis.intent}
Target Mood: {', '.join(analysis.mood)}
Visual Style: {analysis.visual_style}
Preferred Motifs: {', '.join(analysis.visual_motifs)}
Avoid Elements: {', '.join(analysis.avoid_visuals)}
Preset Name: {preset.name if preset else 'Wildlife'}

Keep the video ONLY if:
- it features authentic, living wild animals, birds, marine life, or dynamic fauna in their natural habitat
- it fits the wildlife theme ({preset.name if preset else analysis.intent})
- the visual quality is crisp, cinematic, high production value, vibrant, and well-lit
- the animals are active, majestic, or engaged in natural behavior (flying, hunting, resting, swimming, grazing)

Shot Type Classification (Classify into one of these 5 types):
- "wide_vista": Wide panoramic landscape showing wildlife in its expansive habitat.
- "close_up": Intimate portrait or macro close-up of animal features (eyes, paws, feathers, scales).
- "low_angle": Dramatic low-angle view tracking animal movement across terrain.
- "still_ambient": Steady tripod recording peaceful animal presence or resting.
- "slow_glide": Smooth gliding or tracking shot following wildlife action.

STRICT REJECTION CRITERIA (Mark "keep": false if ANY of these are present):
- REJECT ANY empty landscapes or generic scenery with NO animals or wildlife visible.
- REJECT ANY cages, zoo enclosures, concrete pens, fences, or captivity signs.
- REJECT ANY domestic household pets (dogs, pet cats, hamsters, cows in barns) unless specifically requested.
- REJECT ANY tourists, safari buses, cars, roads, buildings, boats, or human interference.
- REJECT blurry, low-resolution, pixelated, or heavily compressed footage.
- REJECT RAW/LOG flat profile unedited footage.

Return ONLY valid JSON matching this schema:
{{
  "intent_match": 9,
  "theme_match": 9,
  "calmness": 7,
  "motion_intensity": 5,
  "visual_quality": 9,
  "shot_type": "wide_vista",
  "unwanted_elements": [],
  "subtheme": "{preset.subthemes[0] if preset and preset.subthemes else 'wildlife action'}",
  "keep": true,
  "reason": "Authentic wildlife footage showing animal subject in natural habitat with cinematic quality."
}}
"""
        else:
            prompt = f"""
Evaluate this video/preview for a calm nature meditation and relaxation video.

Target Emotional Intent: {analysis.intent}
Target Mood: {', '.join(analysis.mood)}
Visual Style: {analysis.visual_style}
Preferred Motifs: {', '.join(analysis.visual_motifs)}
Avoid Elements: {', '.join(analysis.avoid_visuals)}
Preset Name: {preset.name if preset else 'General Nature'}

Keep the video ONLY if:
- it is a pure, tranquil, untouched natural landscape
- it fits the emotional intent and preset theme
- the colors are vibrant, natural, bright, and pleasing (NOT raw footage, NOT flat/LOG profile, NOT dull, NOT grey, NOT washed-out)
- the atmosphere is peaceful, spacious, and meditative
- the movement is slow and subtle

Shot Type Classification (Classify accurately based on the framing):
- "slow_glide": Smooth, cinematic gliding camera drift, forward push-in drone shot, tracking aerial through trees/water/valleys. (HIGHLY PREFERRED).
- "wide_vista": Expansive wide-angle landscape, horizon, mountain range, river, or ocean horizon.
- "low_angle": Ground-level shot looking upward through trees or tall grass toward the sky.
- "still_ambient": Stationary locked-off tripod shot of a natural environment.
- "close_up": Intimate close-up or macro shot (e.g. leaf detail, water ripple, rock texture, single plant).

STRICT REJECTION CRITERIA (Mark "keep": false if ANY of these are present):
- REJECT ANY top-down or straight-down bird's-eye camera angles looking down at ground or water.
- REJECT ANY cluttered or chaotic textures (e.g. dense bumpy tree canopies filling 100% of the frame with no sky or ground, choppy water textures filling the frame with no shoreline).
- REJECT ANY ski resorts, ski lifts, chairlifts, pistes, snow tracks, ski ramps, winter sports equipment, or man-made terrain marks.
- REJECT dark, underexposed, gloomy, overcast-grey, muddy, foggy dark, or lifeless desaturated visuals. ONLY bright, vivid, sun-drenched, luminous landscapes allowed.
- REJECT ANY close-up, macro, extreme close-up, or detail shots focusing on individual small objects (flowers, petals, leaves, tree bark, rocks, pebbles).
- REJECT ANY flower close-ups, macro flowers, individual flower blossoms, petals, lotus flowers, or waterlilies.
- REJECT ANY bees, wasps, bugs, insects, spiders, or crawling creatures on plants or flowers.
- REJECT ANY boats, ships, yachts, speedboats, motorboats, canoes, kayaks, watercraft, or sailing vessels.
- REJECT ANY docks, piers, marinas, harbors, ports, jetties, or boat slips.
- REJECT ANY buildings, houses, resorts, hotels, pools, cabins, roads, cars, vehicles, bridges, fences, or man-made structures.
- REJECT ANY people, tourists, swimmers, divers, crowds, or visible human activity.
- REJECT ANY murky, muddy, stagnant water, algae scum, sludge, or brownish swamp water.
- REJECT RAW camera footage, unedited LOG profiles, flat color profiles, or washed-out ungraded video.
- REQUIRE A VISIBLE HORIZON, OPEN SKY, OR PEACEFUL GROUND-LEVEL FOCAL POINT (e.g. lake shore, calm beach, open meadow, peaceful woodland path).

Return ONLY valid JSON matching this schema:
{{
  "intent_match": 9,
  "theme_match": 9,
  "calmness": 8,
  "motion_intensity": 3,
  "visual_quality": 9,
  "shot_type": "wide_vista",
  "unwanted_elements": [],
  "subtheme": "{preset.subthemes[0] if preset and preset.subthemes else 'nature landscape'}",
  "keep": true,
  "reason": "Pure tranquil natural landscape with no boats, docks, drone survey, or man-made elements."
}}
"""
        # Fetch image bytes if preview_url is valid http
        image_part = None
        if candidate.preview_url and candidate.preview_url.startswith("http"):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    img_resp = await client.get(candidate.preview_url)
                    if img_resp.status_code == 200:
                        import base64
                        b64 = base64.b64encode(img_resp.content).decode("utf-8")
                        content_type = img_resp.headers.get("content-type", "image/jpeg")
                        image_part = {
                            "inline_data": {
                                "mime_type": content_type,
                                "data": b64
                            }
                        }
            except Exception as e:
                logger.debug(f"Could not download preview image: {e}")

        parts = [{"text": prompt}]
        if image_part:
            parts.append(image_part)

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"response_mime_type": "application/json"}
        }

        candidate_models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]
        async with httpx.AsyncClient(timeout=20.0) as client:
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text)
                        return ScoringResult(**parsed)
                    else:
                        logger.warning(f"Gemini scoring model {model_name} returned status {resp.status_code}")
                except Exception as ex:
                    logger.warning(f"Gemini scoring request to {model_name} failed: {ex}")

        return None

    def _score_heuristic(
        self,
        candidate: CandidateItem,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema],
        studio_mode: str = "meditation"
    ) -> ScoringResult:
        """
        Mode-aware heuristic scorer matching keywords, subthemes, shot types, and quality indicators.
        """
        import re
        raw_corpus = f"{candidate.source_url or ''} {candidate.search_query or ''} {candidate.creator_name or ''} {candidate.preview_url or ''} {candidate.subtheme or ''}".lower()
        cleaned_corpus = re.sub(r'[^a-z0-9\s]', ' ', raw_corpus)
        corpus_words = set(cleaned_corpus.split())
        is_doc = (studio_mode == "documentary")

        # Classify Shot Type from corpus
        detected_shot_type = "wide_vista"
        if any(w in corpus_words for w in ["macro", "close", "closeup", "detail", "portrait", "feather", "eye", "flower", "flowers", "petal", "blossom", "bee", "bug", "insect", "lotus"]):
            detected_shot_type = "close_up"
        elif any(w in corpus_words for w in ["ground", "roots", "floor", "pebbles", "prowl", "track"]):
            detected_shot_type = "low_angle"
        elif any(w in corpus_words for w in ["drone", "aerial", "glide", "drift", "pan", "tracking", "flight", "soar", "swim", "flyover", "forward", "push"]):
            detected_shot_type = "slow_glide"

        # Check subtheme
        assigned_subtheme = preset.subthemes[0] if preset and preset.subthemes else ("wildlife action" if is_doc else "nature landscape")
        if preset and preset.subthemes:
            for st in preset.subthemes:
                st_words = st.lower().split()
                if any(w in corpus_words for w in st_words):
                    assigned_subtheme = st
                    break

        # Check negative triggers (Enforces global prohibitions against people, boats, cars, buildings, timelapse)
        from backend.app.services.candidate_service import GLOBAL_PROHIBITED_TERMS
        unwanted = []
        avoid_list = list(GLOBAL_PROHIBITED_TERMS) + (preset.negative_terms if preset else []) + (analysis.avoid_visuals if analysis else [])
        for term in avoid_list:
            t = term.lower().strip()
            if not t:
                continue
            if ' ' in t:
                if t in cleaned_corpus:
                    unwanted.append(t)
            else:
                if t in corpus_words:
                    unwanted.append(t)

        # Baseline scores for nature meditation
        if unwanted:
            return ScoringResult(
                intent_match=3.0,
                theme_match=3.0,
                calmness=3.0,
                motion_intensity=8.0,
                visual_quality=5.0,
                shot_type=detected_shot_type,
                unwanted_elements=unwanted,
                subtheme=assigned_subtheme,
                keep=False,
                reason=f"Rejected: Contains banned element '{unwanted[0]}'"
            )

        # Check fast-motion cues
        fast_motion_words = {"fast", "rapid", "rushing", "speed", "storm", "torrent", "chase", "running", "gallop", "wild", "rush", "blizzard"}
        slow_motion_words = {"slow", "slow-mo", "slowmo", "glide", "drift", "still", "ambient", "peaceful", "calm", "steady", "smooth", "tranquil", "relaxing"}

        has_fast_motion = any(w in corpus_words for w in fast_motion_words)
        has_slow_motion = any(w in corpus_words for w in slow_motion_words) or ("slow motion" in cleaned_corpus)

        if has_fast_motion and not is_doc:
            return ScoringResult(
                intent_match=4.0,
                theme_match=4.0,
                calmness=3.0,
                motion_intensity=8.5,
                visual_quality=6.0,
                shot_type=detected_shot_type,
                unwanted_elements=["fast motion / high speed"],
                subtheme=assigned_subtheme,
                keep=False,
                reason="Rejected: Footage is too fast or turbulent for calm meditation."
            )

        # Check clutter vs serenity cues
        clutter_indicators = {"cluttered", "dense", "canopy", "treetop", "treetops", "choppy", "rough", "ski", "skier", "resort", "slope", "overhead", "topdown", "bumpy"}
        serene_indicators = {"peaceful", "calm", "lake", "reflection", "horizon", "shore", "meadow", "gentle", "tranquil", "serene", "soft", "sunny", "path", "clearing"}

        has_clutter = any(w in corpus_words for w in clutter_indicators)
        has_serenity = any(w in corpus_words for w in serene_indicators)

        if has_clutter and not is_doc:
            return ScoringResult(
                intent_match=4.0,
                theme_match=4.0,
                calmness=4.0,
                motion_intensity=7.0,
                visual_quality=6.0,
                shot_type=detected_shot_type,
                unwanted_elements=["visual clutter / overhead canopy / choppy texture"],
                subtheme=assigned_subtheme,
                keep=False,
                reason="Rejected: High visual clutter, overhead canopy, or choppy texture not suitable for calm meditation."
            )

        if has_serenity:
            intent_match = 9.8
            theme_match = 9.8
            calmness = 9.8
            motion_intensity = 1.2
            visual_quality = 9.5
        elif has_slow_motion:
            intent_match = 9.0
            theme_match = 9.0
            calmness = 9.0
            motion_intensity = 2.0
            visual_quality = 9.0
        else:
            intent_match = 8.5
            theme_match = 8.5
            calmness = 8.5
            motion_intensity = 2.5
            visual_quality = 8.5

        # Adjust for resolution
        if candidate.width >= 1920:
            visual_quality = max(visual_quality, 9.5)
        elif candidate.width >= 1280:
            visual_quality = min(visual_quality, 8.0)
        else:
            visual_quality = 6.5

        return ScoringResult(
            intent_match=intent_match,
            theme_match=theme_match,
            calmness=calmness,
            motion_intensity=motion_intensity,
            visual_quality=visual_quality,
            shot_type=detected_shot_type,
            unwanted_elements=[],
            subtheme=assigned_subtheme,
            keep=True,
            reason="Pristine, slow-motion tranquil natural scene ideal for meditation." if has_slow_motion else "Serene, slow-moving natural scene aligned with emotional intent."
        )

    def _apply_scoring_thresholds(
        self,
        res: ScoringResult,
        preset: Optional[PresetSchema],
        studio_mode: str = "meditation",
        shot_preference: str = "balanced"
    ) -> ScoringResult:
        is_doc = (studio_mode == "documentary")
        pref = (shot_preference or "balanced").lower()

        # Reject static still shots unless user explicitly specified "still" shot preference
        if not is_doc and pref != "still":
            if res.shot_type == "still_ambient" or res.motion_intensity < 1.0:
                res.keep = False
                res.reason = f"Rejected: Static still shot with no camera/nature motion (shot preference is '{pref}', not 'still')"
                return res

        # Reject close-up / macro shots unless user explicitly selected "macro" shot preference
        if not is_doc and pref != "macro" and res.shot_type in ("close_up", "macro"):
            res.keep = False
            res.reason = "Rejected: Close-up / Macro shot (only wide expansive vistas are allowed)"
            return res

        min_intent = getattr(preset, 'minimum_intent_score', 8.0) if preset else 7.5
        min_theme = getattr(preset, 'minimum_theme_score', 8.0) if preset else 7.5
        min_calmness = getattr(preset, 'minimum_calmness_score', 8.0) if (preset and not is_doc) else (4.0 if is_doc else 8.0)
        max_motion = getattr(preset, 'maximum_motion_intensity', 3.5) if (preset and not is_doc) else (8.5 if is_doc else 3.5)
        min_quality = getattr(preset, 'minimum_visual_quality', 7.0) if preset else 7.0

        if not is_doc and res.motion_intensity > max_motion:
            res.keep = False
            res.calmness = min(res.calmness, 4.0)
            res.reason = f"Rejected: Motion intensity ({res.motion_intensity:.1f}/10) is too fast/turbulent for tranquil meditation (max {max_motion:.1f})"
            return res

        if not is_doc and res.calmness < min_calmness:
            res.keep = False
            res.reason = f"Rejected: Calmness score ({res.calmness:.1f}/10) is below minimum threshold ({min_calmness:.1f})"
            return res

        passed = (
            res.intent_match >= min_intent
            and res.theme_match >= min_theme
            and res.calmness >= min_calmness
            and res.motion_intensity <= max_motion
            and res.visual_quality >= min_quality
            and len(res.unwanted_elements) == 0
        )

        res.keep = passed
        if not passed and not res.reason:
            res.reason = "Did not meet visual standards or intent match threshold."
        return res


scoring_service = ScoringService()
