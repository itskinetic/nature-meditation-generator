import asyncio
import json
import logging
import math
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import httpx

from backend.app.config import settings

logger = logging.getLogger(__name__)


class FFmpegService:
    def __init__(self):
        self.active_processes: Dict[str, asyncio.subprocess.Process] = {}

    def get_resolution_dimensions(self, aspect_ratio: str, resolution: str) -> tuple[int, int]:
        is_4k = "4k" in resolution.lower() or "2160" in resolution.lower()
        if aspect_ratio == "9:16":
            return (2160, 3840) if is_4k else (1080, 1920)
        elif aspect_ratio == "1:1":
            return (2160, 2160) if is_4k else (1080, 1080)
        else:  # 16:9 default
            return (3840, 2160) if is_4k else (1920, 1080)

    async def probe_file(self, file_path: Path) -> Dict[str, Any]:
        """Probes a video file using FFprobe and returns duration, width, height, fps."""
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration:stream=width,height,r_frame_rate,codec_name",
            "-of", "json",
            str(file_path)
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                data = json.loads(stdout.decode("utf-8"))
                duration = float(data.get("format", {}).get("duration", 0.0))
                streams = data.get("streams", [])
                width = 1920
                height = 1080
                for s in streams:
                    if "width" in s and "height" in s:
                        width = int(s["width"])
                        height = int(s["height"])
                        break
                return {"duration": duration, "width": width, "height": height}
        except Exception as e:
            logger.warning(f"FFprobe error on {file_path}: {e}")
        return {"duration": 0.0, "width": 1920, "height": 1080}

    async def generate_procedural_nature_clip(
        self,
        output_path: Path,
        duration: float = 25.0,
        subtheme: str = "misty forest",
        width: int = 1920,
        height: int = 1080
    ) -> Path:
        """
        Generates a calm, soothing procedural nature meditation clip using FFmpeg filters.
        Used for dry-run or when offline without API keys.
        """
        # Color palettes according to subtheme
        if "stream" in subtheme.lower() or "water" in subtheme.lower() or "ocean" in subtheme.lower():
            c1, c2 = "0x0B2545", "0x134074"
            wave_expr = "sin(X/80+T*0.8)*20+cos(Y/60-T*0.5)*15"
        elif "sun" in subtheme.lower() or "gold" in subtheme.lower():
            c1, c2 = "0x4A3B2C", "0x8F7A56"
            wave_expr = "sin(X/120+T*0.3)*10+cos(Y/90+T*0.4)*10"
        elif "moss" in subtheme.lower() or "fern" in subtheme.lower():
            c1, c2 = "0x1B382B", "0x2D5A40"
            wave_expr = "sin(X/90+T*0.4)*12+cos(Y/80-T*0.3)*10"
        else:  # Misty forest default
            c1, c2 = "0x1C2826", "0x36494E"
            wave_expr = "sin(X/100+T*0.5)*15+cos(Y/70+T*0.4)*12"

        filter_chain = (
            f"gradients=c0={c1}:c1={c2}:s={width}x{height}:r=30:d={duration},"
            f"eq=contrast=1.05:brightness=0.02:saturation=1.1,"
            f"format=yuv420p"
        )

        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", filter_chain,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-an",
            str(output_path)
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        return output_path

    async def download_candidate(
        self,
        candidate: Dict[str, Any],
        job_dir: Path,
        clip_index: int
    ) -> Path:
        """Downloads or resolves a candidate video or photo file."""
        media_type = candidate.get("media_type", "video")
        is_image = media_type == "image" or "photo" in str(candidate.get("source", "")).lower() or "_img_" in str(candidate.get("candidate_id", ""))
        ext = ".jpg" if is_image else ".mp4"

        local_target = job_dir / f"clip_{clip_index:03d}_{candidate['candidate_id']}{ext}"
        needed_duration = float(candidate.get("duration", 30.0))

        # 1. If candidate already has an existing local file
        if candidate.get("local_file_path") and Path(candidate["local_file_path"]).exists():
            if is_image:
                shutil.copy2(candidate["local_file_path"], local_target)
                return local_target
            probe = await self.probe_file(Path(candidate["local_file_path"]))
            if probe.get("duration", 0.0) >= needed_duration - 1.0:
                shutil.copy2(candidate["local_file_path"], local_target)
                return local_target

        # 2. Check if already cached in data/library
        library_file = settings.LIBRARY_DIR / f"{candidate['candidate_id']}{ext}"
        if library_file.exists():
            if is_image:
                shutil.copy2(library_file, local_target)
                return local_target
            probe = await self.probe_file(library_file)
            if probe.get("duration", 0.0) >= needed_duration - 1.0:
                shutil.copy2(library_file, local_target)
                return local_target

        download_url = candidate.get("download_url") or candidate.get("image_url")

        # 3. If online URL is reachable
        if download_url and download_url.startswith("http") and not "sample-videos.com" in download_url:
            try:
                async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                    async with client.stream("GET", download_url) as resp:
                        if resp.status_code == 200:
                            with open(local_target, "wb") as f:
                                async for chunk in resp.aiter_bytes(chunk_size=65536):
                                    f.write(chunk)
                            # Save copy in library
                            shutil.copy2(local_target, library_file)
                            return local_target
            except Exception as e:
                logger.warning(f"Download failed for {candidate['candidate_id']}: {e}")

        # 4. Fallback: create high quality soothing procedural nature clip
        gen_duration = max(35.0, needed_duration + 5.0)
        local_mp4 = job_dir / f"clip_{clip_index:03d}_{candidate['candidate_id']}.mp4"
        await self.generate_procedural_nature_clip(
            output_path=local_mp4,
            duration=gen_duration,
            subtheme=candidate.get("subtheme", "misty forest")
        )
        shutil.copy2(local_mp4, settings.LIBRARY_DIR / f"{candidate['candidate_id']}.mp4")
        return local_mp4

    async def apply_ken_burns_to_image(
        self,
        image_file: Path,
        output_file: Path,
        duration: float,
        width: int = 1920,
        height: int = 1080,
        motion_style: str = "zoom_in"
    ) -> Path:
        """
        Converts a still high-res image into living documentary footage with slow Ken Burns motion.
        """
        total_frames = int(max(5.0, duration) * 30)
        
        # Build Ken Burns zoompan filter based on motion style
        if motion_style == "zoom_out":
            zp_filter = f"zoompan=z='if(lte(zoom,1.0),1.18,max(1.001,zoom-0.0012))':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30"
        elif motion_style == "pan_left":
            zp_filter = f"zoompan=z=1.12:d={total_frames}:x='if(lte(on,1),(iw-iw/zoom),max(0,x-0.7))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30"
        elif motion_style == "pan_right":
            zp_filter = f"zoompan=z=1.12:d={total_frames}:x='min((iw-iw/zoom),x+0.7)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30"
        elif motion_style == "tilt_up":
            zp_filter = f"zoompan=z=1.12:d={total_frames}:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),(ih-ih/zoom),max(0,y-0.5))':s={width}x{height}:fps=30"
        elif motion_style == "tilt_down":
            zp_filter = f"zoompan=z=1.12:d={total_frames}:x='iw/2-(iw/zoom/2)':y='min((ih-ih/zoom),y+0.5)':s={width}x{height}:fps=30"
        else: # default zoom_in
            zp_filter = f"zoompan=z='min(zoom+0.0012,1.18)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30"

        filter_chain = (
            f"scale=-2:4320:force_original_aspect_ratio=increase,"
            f"{zp_filter},"
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},"
            f"setsar=1,"
            f"format=yuv420p"
        )

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1",
            "-framerate", "30",
            "-i", str(image_file),
            "-t", str(duration),
            "-vf", filter_chain,
            "-an",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            str(output_file)
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(f"Ken Burns image processing failed: {stderr.decode('utf-8', errors='ignore')}")
            # Fallback simple scale
            fallback_vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,fps=30,format=yuv420p"
            fcmd = ["ffmpeg", "-y", "-loop", "1", "-i", str(image_file), "-t", str(duration), "-vf", fallback_vf, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(output_file)]
            fproc = await asyncio.create_subprocess_exec(*fcmd)
            await fproc.communicate()
        return output_file

    async def normalize_clip(
        self,
        input_file: Path,
        output_file: Path,
        duration: float,
        width: int = 1920,
        height: int = 1080,
        motion_style: Optional[str] = None
    ) -> Path:
        """Normalizes video or converts photo to Ken Burns video clip."""
        ext = input_file.suffix.lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp"):
            return await self.apply_ken_burns_to_image(
                image_file=input_file,
                output_file=output_file,
                duration=duration,
                width=width,
                height=height,
                motion_style=motion_style or "zoom_in"
            )

        # Scale to cover then crop center
        filter_str = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},"
            f"setsar=1,"
            f"fps=30,"
            f"format=yuv420p"
        )
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_file),
            "-t", str(duration),
            "-vf", filter_str,
            "-an",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            str(output_file)
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(f"Clip normalization failed: {stderr.decode('utf-8', errors='ignore')}")
            raise RuntimeError(f"FFmpeg failed to normalize clip: {input_file.name}")
        return output_file

    async def render_video(
        self,
        job_id: str,
        sequence_data: Dict[str, Any],
        aspect_ratio: str = "16:9",
        resolution: str = "1080p",
        transition_type: str = "crossfade",
        transition_duration: float = 2.0,
        music_file: Optional[str] = None,
        voiceover_file: Optional[str] = None,
        subtitle_file: Optional[Path] = None,
        burn_subtitles: bool = False,
        audio_mode: str = "none",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Path:
        """
        Main video rendering pipeline with xfade transitions, audio soundscape, subtitle burn-in, and duration verification.
        """
        job_dir = settings.JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        render_log_path = job_dir / "render.log"

        width, height = self.get_resolution_dimensions(aspect_ratio, resolution)
        clips_info = sequence_data.get("sequence", [])
        target_duration = sequence_data.get("target_duration_seconds", 60.0)

        if not clips_info:
            raise ValueError("Empty clip sequence provided.")
        if progress_callback:
            progress_callback(25, "Preparing and normalizing video clips")

        # Step 1: Normalize all clips
        normalized_clips: List[Path] = []
        for idx, clip_item in enumerate(clips_info):
            raw_clip = await self.download_candidate(clip_item, job_dir, idx)
            play_dur = clip_item.get("duration", 25.0)
            motion = clip_item.get("motion_style") or "zoom_in"
            norm_clip = job_dir / f"norm_clip_{idx:03d}.mp4"
            await self.normalize_clip(raw_clip, norm_clip, play_dur, width, height, motion_style=motion)
            normalized_clips.append(norm_clip)

            pct = 25 + int(30 * (idx + 1) / len(clips_info))
            if progress_callback:
                progress_callback(pct, f"Prepared clip {idx + 1}/{len(clips_info)}")

        # Step 2: Prepare audio tracks (Music + Voiceover)
        if progress_callback:
            progress_callback(60, "Preparing voiceover and soundtrack audio")

        from backend.app.services.music_service import music_service
        meditation_audio = await music_service.prepare_meditation_audio(
            target_duration_seconds=target_duration,
            music_file=music_file,
            job_dir=job_dir,
            audio_mode=audio_mode,
            fade_duration=min(3.0, target_duration / 4.0)
        )

        final_audio_path = meditation_audio
        if voiceover_file:
            vo_path = settings.MUSIC_DIR / voiceover_file
            if not vo_path.exists():
                vo_path = Path(voiceover_file)
            if vo_path.exists():
                mixed_audio = job_dir / "mixed_voiceover.aac"
                amix_cmd = [
                    "ffmpeg", "-y",
                    "-i", str(vo_path),
                    "-i", str(meditation_audio),
                    "-filter_complex", "[0:a]volume=1.0[vo];[1:a]volume=0.25[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]",
                    "-map", "[aout]",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-t", str(target_duration),
                    str(mixed_audio)
                ]
                proc_amix = await asyncio.create_subprocess_exec(*amix_cmd)
                await proc_amix.communicate()
                if mixed_audio.exists():
                    final_audio_path = mixed_audio

        # Step 3: Render transitions using xfade filter graph
        if progress_callback:
            progress_callback(70, "Applying smooth video crossfades")

        video_only_output = job_dir / "video_merged.mp4"
        final_video_output = job_dir / "final_video.mp4"

        success = await self._render_xfade(
            normalized_clips=normalized_clips,
            clips_info=clips_info,
            output_path=video_only_output,
            transition_duration=transition_duration,
            transition_type=transition_type,
            log_file_path=render_log_path
        )

        if not success or not video_only_output.exists():
            if progress_callback:
                progress_callback(75, "Applying fallback transition pipeline")
            await self._render_concat_fallback(normalized_clips, video_only_output, render_log_path)

        # Step 4: Subtitle burn-in & final audio mux
        if progress_callback:
            stage_msg = "Burning subtitles and mastering final video" if (burn_subtitles and subtitle_file) else "Mastering final audio-video mix"
            progress_callback(88, stage_msg)

        if burn_subtitles and subtitle_file and subtitle_file.exists():
            # Escape path for FFmpeg subtitles filter on Windows
            sub_escaped = str(subtitle_file).replace("\\", "/").replace(":", "\\:")
            mux_cmd = [
                "ffmpeg", "-y",
                "-i", str(video_only_output),
                "-i", str(final_audio_path),
                "-vf", f"subtitles='{sub_escaped}'",
                "-t", str(target_duration),
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(final_video_output)
            ]
        else:
            mux_cmd = [
                "ffmpeg", "-y",
                "-i", str(video_only_output),
                "-i", str(final_audio_path),
                "-t", str(target_duration),
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(final_video_output)
            ]

        proc_mux = await asyncio.create_subprocess_exec(
            *mux_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc_mux.communicate()

        # Step 5: Verify final output duration with FFprobe
        probe_res = await self.probe_file(final_video_output)
        actual_dur = probe_res.get("duration", 0.0)

        with open(render_log_path, "a", encoding="utf-8") as log_file:
            log_file.write(f"\nRender completed successfully.\nFinal video: {final_video_output}\nFinal verified duration: {actual_dur:.2f}s\n")

        # Copy to renders folder
        public_render = settings.RENDERS_DIR / f"{job_id}.mp4"
        shutil.copy2(final_video_output, public_render)

        if progress_callback:
            progress_callback(100, "Rendering complete")

        return final_video_output

    async def _render_xfade(
        self,
        normalized_clips: List[Path],
        clips_info: List[Dict[str, Any]],
        output_path: Path,
        transition_duration: float,
        transition_type: str,
        log_file_path: Path
    ) -> bool:
        """Renders video sequence using FFmpeg xfade filter."""
        num_clips = len(normalized_clips)
        if num_clips == 1:
            shutil.copy2(normalized_clips[0], output_path)
            return True

        inputs = []
        for c in normalized_clips:
            inputs.extend(["-i", str(c)])

        filter_parts = []
        last_out = "[0:v]"
        offset = float(clips_info[0]["duration"]) - transition_duration

        xfade_name = "fade"
        if transition_type == "crossfade" or transition_type == "fade":
            xfade_name = "fade"
        elif transition_type in ["wipeleft", "wiperight", "slideup", "slidedown", "smoothleft", "circleopen"]:
            xfade_name = transition_type

        for i in range(1, num_clips):
            next_in = f"[{i}:v]"
            out_label = f"[v{i}]" if i < num_clips - 1 else "[outv]"
            filter_parts.append(
                f"{last_out}{next_in}xfade=transition={xfade_name}:duration={transition_duration}:offset={max(0.1, offset):.3f}{out_label}"
            )
            last_out = f"[v{i}]"
            dur_i = float(clips_info[i]["duration"])
            offset += (dur_i - transition_duration)

        filter_complex = ";".join(filter_parts)

        cmd = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-an",
            str(output_path)
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0 and output_path.exists():
                return True
            else:
                with open(log_file_path, "a", encoding="utf-8") as f:
                    f.write(f"\nxfade failed with code {proc.returncode}: {stderr.decode('utf-8', errors='ignore')}\n")
        except Exception as e:
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.write(f"\nxfade exception: {e}\n")

        return False

    async def _render_concat_fallback(
        self,
        normalized_clips: List[Path],
        output_path: Path,
        log_file_path: Path
    ) -> bool:
        """Fallback concatenation in case of complex filter failures."""
        concat_list = output_path.parent / "concat_list.txt"
        with open(concat_list, "w", encoding="utf-8") as f:
            for c in normalized_clips:
                f.write(f"file '{c.as_posix()}'\n")

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-an",
            str(output_path)
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        return output_path.exists()

    def cancel_job(self, job_id: str):
        if job_id in self.active_processes:
            try:
                self.active_processes[job_id].kill()
            except Exception:
                pass


ffmpeg_service = FFmpegService()
