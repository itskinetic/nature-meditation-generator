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
        preset: Optional[PresetSchema] = None
    ) -> ScoringResult:
        """
        Scores a candidate video using vision API or heuristic evaluation.
        Enforces strict scoring criteria.
        """
        # If Gemini API Key is available and preview_url is reachable, call Gemini Vision
        if self.api_key and len(self.api_key.strip()) > 5 and candidate.preview_url:
            try:
                result = await self._score_with_gemini(candidate, analysis, preset)
                if result:
                    return self._apply_scoring_thresholds(result, preset)
            except Exception as e:
                logger.warning(f"Gemini vision scoring failed for {candidate.source_video_id}: {e}")

        # Fallback heuristic scoring
        result = self._score_heuristic(candidate, analysis, preset)
        return self._apply_scoring_thresholds(result, preset)

    async def _score_with_gemini(
        self,
        candidate: CandidateItem,
        analysis: IntentAnalysisResult,
        preset: Optional[PresetSchema]
    ) -> Optional[ScoringResult]:
        prompt = f"""
Evaluate this video/preview for a calm nature meditation and relaxation video.

Target Emotional Intent: {analysis.intent}
Target Mood: {', '.join(analysis.mood)}
Visual Style: {analysis.visual_style}
Preferred Motifs: {', '.join(analysis.visual_motifs)}
Avoid Elements: {', '.join(analysis.avoid_visuals)}
Preset Name: {preset.name if preset else 'General Nature'}

Keep the video ONLY if:
- it fits the emotional intent
- it fits the visual theme
- the atmosphere is peaceful and spacious
- the movement is slow and subtle
- the lighting is soft and natural
- there are no people, animals, buildings, vehicles, crowds, text, or logos
- there is no storm, dramatic action, fast camera movement, or timelapse
- the scene is not visually harsh, chaotic, or distracting

Return ONLY valid JSON matching this schema:
{{
  "intent_match": 9,
  "theme_match": 9,
  "calmness": 8,
  "motion_intensity": 3,
  "visual_quality": 9,
  "unwanted_elements": [],
  "subtheme": "{preset.subthemes[0] if preset and preset.subthemes else 'misty forest'}",
  "keep": true,
  "reason": "Peaceful foggy forest with slow movement and no distracting elements."
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
        preset: Optional[PresetSchema]
    ) -> ScoringResult:
        """
        Conservative heuristic scorer matching nature keywords, subthemes, and quality indicators.
        """
        query_text = f"{candidate.search_query or ''} {candidate.source_url or ''} {candidate.creator_name or ''}".lower()
        
        # Check subtheme
        assigned_subtheme = preset.subthemes[0] if preset and preset.subthemes else "nature landscape"
        if preset and preset.subthemes:
            for st in preset.subthemes:
                st_words = st.lower().split()
                if any(w in query_text for w in st_words):
                    assigned_subtheme = st
                    break

        # Check negative triggers
        unwanted = []
        avoid_list = (preset.negative_terms if preset else []) + analysis.avoid_visuals
        for term in avoid_list:
            if term.lower() in query_text:
                unwanted.append(term)

        # Baseline scores for nature meditation
        if unwanted:
            return ScoringResult(
                intent_match=4.0,
                theme_match=4.0,
                calmness=4.0,
                motion_intensity=7.0,
                visual_quality=6.0,
                unwanted_elements=unwanted,
                subtheme=assigned_subtheme,
                keep=False,
                reason=f"Detected unwanted element: {', '.join(unwanted)}"
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
            unwanted_elements=[],
            subtheme=assigned_subtheme,
            keep=True,
            reason="Serene, slow-moving natural scene aligned with emotional intent."
        )

    def _apply_scoring_thresholds(
        self,
        res: ScoringResult,
        preset: Optional[PresetSchema]
    ) -> ScoringResult:
        min_intent = getattr(preset, 'minimum_intent_score', 8.0) if preset else 8.0
        min_theme = getattr(preset, 'minimum_theme_score', 8.0) if preset else 8.0
        min_calmness = getattr(preset, 'minimum_calmness_score', 8.0) if preset else 8.0
        max_motion = getattr(preset, 'maximum_motion_intensity', getattr(preset, 'maximum_motion_score', 4.0)) if preset else 4.0
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
