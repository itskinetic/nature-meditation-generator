import re
import math
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
import httpx
from backend.app.config import settings
from backend.app.schemas import SubtitleSegment, SubtitleConfig

logger = logging.getLogger(__name__)


class SubtitleService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    def format_timestamp_srt(self, seconds: float) -> str:
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

    def format_timestamp_ass(self, seconds: float) -> str:
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centis = int((seconds - int(seconds)) * 100)
        return f"{hrs:01d}:{mins:02d}:{secs:02d}.{centis:02d}"

    def generate_srt_content(self, segments: List[SubtitleSegment]) -> str:
        lines = []
        for i, seg in enumerate(segments, 1):
            start = self.format_timestamp_srt(seg.start_seconds)
            end = self.format_timestamp_srt(seg.end_seconds)
            lines.append(f"{i}")
            lines.append(f"{start} --> {end}")
            lines.append(seg.text.strip())
            lines.append("")
        return "\n".join(lines)

    def generate_ass_content(
        self,
        segments: List[SubtitleSegment],
        config: Optional[SubtitleConfig] = None,
        width: int = 1920,
        height: int = 1080
    ) -> str:
        cfg = config or SubtitleConfig()
        style = cfg.style or "documentary_classic"

        if style == "dynamic_highlight":
            font_size = 48
            primary_color = "&H00FFFFFF"
            secondary_color = "&H000BB5F5"
            outline_color = "&H00000000"
            back_color = "&H80000000"
            outline = 3
            shadow = 2
            margin_v = 70
        elif style == "minimal_clean":
            font_size = 42
            primary_color = "&H00F0F0F0"
            secondary_color = "&H00FFFFFF"
            outline_color = "&H60000000"
            back_color = "&H90000000"
            outline = 2
            shadow = 1
            margin_v = 60
        else:
            font_size = 46
            primary_color = "&H00FFFFFF"
            secondary_color = "&H00FFFFFF"
            outline_color = "&H80000000"
            back_color = "&HAA000000"
            outline = 2.5
            shadow = 3
            margin_v = 75

        ass_header = f"""[Script Info]
Title: ZenHub Wildlife Documentary Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font_size},{primary_color},{secondary_color},{outline_color},{back_color},1,0,0,0,100,100,0,0,1,{outline},{shadow},2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        event_lines = []
        for seg in segments:
            start = self.format_timestamp_ass(seg.start_seconds)
            end = self.format_timestamp_ass(seg.end_seconds)
            clean_text = seg.text.strip().replace("\n", "\\N")
            event_lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{clean_text}")

        return ass_header + "\n".join(event_lines) + "\n"

    def synthesize_subtitles_from_script(
        self,
        script: str,
        total_duration: float = 30.0
    ) -> List[SubtitleSegment]:
        if not script or not script.strip():
            return []

        raw_clauses = re.split(r'(?<=[.!?])\s+|\n+', script.strip())
        clauses = [c.strip() for c in raw_clauses if len(c.strip()) > 3]

        if not clauses:
            return []

        clause_words = [max(1, len(c.split())) for c in clauses]
        total_words = sum(clause_words)

        segments = []
        current_time = 1.0
        target_span = max(total_duration - 2.0, total_words / 2.3)

        for i, (clause, words) in enumerate(zip(clauses, clause_words)):
            duration = (words / total_words) * target_span
            duration = max(2.5, min(7.0, duration))

            start_sec = current_time
            end_sec = min(total_duration, start_sec + duration)

            segments.append(
                SubtitleSegment(
                    start_seconds=round(start_sec, 2),
                    end_seconds=round(end_sec, 2),
                    text=clause
                )
            )
            current_time = end_sec + 0.35

            if current_time >= total_duration:
                break

        return segments

    async def transcribe_audio(
        self,
        audio_file_path: Path,
        script_hint: Optional[str] = None
    ) -> List[SubtitleSegment]:
        if not audio_file_path.exists():
            logger.warning(f"Audio file not found: {audio_file_path}")
            if script_hint:
                return self.synthesize_subtitles_from_script(script_hint)
            return []

        if self.api_key and len(self.api_key.strip()) > 5:
            try:
                import base64
                with open(audio_file_path, "rb") as f:
                    audio_data = f.read()

                b64_audio = base64.b64encode(audio_data).decode("utf-8")
                mime = "audio/mp3" if audio_file_path.suffix.lower() == ".mp3" else "audio/wav"

                prompt = """Transcribe this voiceover narration audio into timestamped subtitle segments.
Return ONLY valid JSON matching this schema:
[
  {
    "start_seconds": 0.0,
    "end_seconds": 4.5,
    "text": "Dawn breaks over the vast golden Serengeti."
  }
]
"""
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{
                        "parts": [
                            {"inline_data": {"mime_type": mime, "data": b64_audio}},
                            {"text": prompt}
                        ]
                    }],
                    "generationConfig": {"temperature": 0.1, "response_mime_type": "application/json"}
                }

                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        import json
                        parsed = json.loads(text)
                        segments = [
                            SubtitleSegment(
                                start_seconds=float(item["start_seconds"]),
                                end_seconds=float(item["end_seconds"]),
                                text=item["text"].strip()
                            )
                            for item in parsed if "text" in item and len(item["text"].strip()) > 0
                        ]
                        if segments:
                            return segments
            except Exception as e:
                logger.warning(f"Gemini audio transcription error: {e}")

        if script_hint:
            return self.synthesize_subtitles_from_script(script_hint)
        return []


subtitle_service = SubtitleService()
