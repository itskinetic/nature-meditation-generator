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
        studio_mode: str = "meditation"
    ) -> ScoringResult:
        """
        Scores a candidate video using vision API or heuristic evaluation.
        Enforces strict mode-aware scoring criteria (meditation vs wildlife documentary).
        """
        # If Gemini API Key is available and preview_url is reachable, call Gemini Vision
        if self.api_key and len(self.api_key.strip()) > 5 and candidate.preview_url:
            try:
                result = await self._score_with_gemini(candidate, analysis, preset, studio_mode)
                if result:
                    return self._apply_scoring_thresholds(result, preset, studio_mode)
            except Exception as e:
                logger.warning(f"Gemini vision scoring failed for {candidate.source_video_id}: {e}")

        # Fallback heuristic scoring
        result = self._score_heuristic(candidate, analysis, preset, studio_mode)
        return self._apply_scoring_thresholds(result, preset, studio_mode)

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

Shot Type Classification (Classify into one of these 5 types):
- "wide_vista": Grounded expansive wide-angle landscape, horizon, or panoramic natural vista.
- "close_up": Macro or intimate close-up (dew drops, leaf texture, flower petal, water ripple).
- "low_angle": Ground-level shot looking upward through trees, grass, or rocks toward the sky.
- "still_ambient": Stationary locked-off tripod shot with subtle natural motion.
- "slow_glide": Smooth, gentle floating tracking shot or ultra-slow drift.

STRICT REJECTION CRITERIA (Mark "keep": false if ANY of these are present):
- REJECT ANY boats, ships, yachts, speedboats, motorboats, canoes, kayaks, watercraft, or sailing vessels.
- REJECT ANY docks, piers, marinas, harbors, ports, jetties, or boat slips.
- REJECT ANY high-altitude drone flyovers, high aerial survey shots, top-down satellite maps, or distant overhead drone vistas.
- REJECT ANY buildings, houses, resorts, hotels, pools, cabins, roads, cars, vehicles, bridges, fences, or man-made structures.
- REJECT ANY people, tourists, swimmers, divers, crowds, or visible human activity.
- REJECT ANY murky, muddy, stagnant water, algae scum, sludge, or brownish swamp water.
- REJECT RAW camera footage, unedited LOG profiles, flat color profiles, or washed-out ungraded video.
- REJECT dull, muddy, grey, overcast-grey, dark, or lifeless desaturated visuals.

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
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"

        # Fetch image bytes if preview_url is valid http
        image_part = None
        if candidate.preview_url.startswith("http"):
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

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return ScoringResult(**parsed)

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
        if any(w in corpus_words for w in ["macro", "close", "closeup", "detail", "portrait", "feather", "eye"]):
            detected_shot_type = "close_up"
        elif any(w in corpus_words for w in ["ground", "roots", "floor", "pebbles", "prowl", "track"]):
            detected_shot_type = "low_angle"
        elif any(w in corpus_words for w in ["still", "static", "tripod", "lock", "rest", "perch"]):
            detected_shot_type = "still_ambient"
        elif any(w in corpus_words for w in ["glide", "drift", "pan", "tracking", "flight", "soar", "swim"]):
            detected_shot_type = "slow_glide"

        # Check subtheme
        assigned_subtheme = preset.subthemes[0] if preset and preset.subthemes else ("wildlife action" if is_doc else "nature landscape")
        if preset and preset.subthemes:
            for st in preset.subthemes:
                st_words = st.lower().split()
                if any(w in corpus_words for w in st_words):
                    assigned_subtheme = st
                    break

        # Check negative triggers
        unwanted = []
        avoid_list = (preset.negative_terms if preset else []) + (analysis.avoid_visuals if analysis else [])
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

        # High-relevance nature terms
        intent_match = 9.0
        theme_match = 9.0
        calmness = 9.0
        motion_intensity = 2.0
        visual_quality = 9.0

        # Adjust for resolution
        if candidate.width >= 1920:
            visual_quality = 9.5
        elif candidate.width >= 1280:
            visual_quality = 8.0
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
            reason="Serene, slow-moving natural scene aligned with emotional intent."
        )

    def _apply_scoring_thresholds(
        self,
        res: ScoringResult,
        preset: Optional[PresetSchema],
        studio_mode: str = "meditation"
    ) -> ScoringResult:
        is_doc = (studio_mode == "documentary")
        min_intent = getattr(preset, 'minimum_intent_score', 8.0) if preset else 7.5
        min_theme = getattr(preset, 'minimum_theme_score', 8.0) if preset else 7.5
        min_calmness = getattr(preset, 'minimum_calmness_score', 8.0) if (preset and not is_doc) else (4.0 if is_doc else 8.0)
        max_motion = getattr(preset, 'maximum_motion_intensity', getattr(preset, 'maximum_motion_score', 4.0)) if (preset and not is_doc) else (8.5 if is_doc else 4.0)
        min_quality = getattr(preset, 'minimum_visual_quality', 7.0) if preset else 7.0

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
            res.reason = "Candidate did not meet required threshold scores."
        return res


scoring_service = ScoringService()
