import asyncio
import logging
from pathlib import Path
from typing import Optional
from backend.app.config import settings

logger = logging.getLogger(__name__)


class MusicService:
    async def prepare_meditation_audio(
        self,
        target_duration_seconds: float,
        music_file: Optional[str] = None,
        job_dir: Optional[Path] = None,
        audio_mode: str = "none",
        fade_duration: float = 3.0
    ) -> Path:
        """
        Prepares meditation audio:
        - "none" (default): Generates clean silent audio track.
        - "upload": Uses user-uploaded audio track with looping & fade.
        - "ambient_synth": Synthesizes soothing ambient drone soundscape.
        """
        output_audio = (job_dir or settings.MUSIC_DIR) / "meditation_audio.aac"

        # Check if user-provided music file exists in data/music
        custom_path = None
        if music_file:
            p = settings.MUSIC_DIR / music_file
            if p.exists():
                custom_path = p

        fade_out_start = max(0.0, target_duration_seconds - fade_duration)
        af_filter = f"afade=t=in:ss=0:d={fade_duration},afade=t=out:st={fade_out_start:.2f}:d={fade_duration}"

        if custom_path and (audio_mode == "upload" or audio_mode == "none"):
            # Loop and trim custom audio to target duration with fade
            cmd = [
                "ffmpeg", "-y",
                "-stream_loop", "-1",
                "-i", str(custom_path),
                "-t", str(target_duration_seconds),
                "-af", af_filter,
                "-c:a", "aac",
                "-b:a", "192k",
                str(output_audio)
            ]
        elif audio_mode == "ambient_synth":
            # Synthesize peaceful ambient drone (deep 108Hz / 432Hz harmonic warmth + lowpass)
            synth_filter = (
                "aevalsrc=exprs='0.08*sin(2*PI*108*t)+0.04*sin(2*PI*216*t)+0.02*sin(2*PI*432*t)+0.015*sin(2*PI*162*t)':s=48000:d="
                f"{target_duration_seconds},"
                f"lowpass=f=400,volume=1.8,{af_filter}"
            )
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi",
                "-i", synth_filter,
                "-t", str(target_duration_seconds),
                "-c:a", "aac",
                "-b:a", "192k",
                str(output_audio)
            ]
        else:
            # Clean silent audio track (no audio / silent mode)
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi",
                "-i", f"anullsrc=channel_layout=stereo:sample_rate=48000",
                "-t", str(target_duration_seconds),
                "-c:a", "aac",
                "-b:a", "64k",
                str(output_audio)
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.error(f"FFmpeg audio generation failed: {stderr.decode('utf-8', errors='ignore')}")
            # Fallback silent audio
            fb_cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-t", str(target_duration_seconds),
                "-c:a", "aac",
                str(output_audio)
            ]
            proc_fb = await asyncio.create_subprocess_exec(*fb_cmd)
            await proc_fb.communicate()

        return output_audio


music_service = MusicService()
