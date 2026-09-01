import asyncio
import base64
import json
import logging
import math
import os
import re
import struct
import subprocess
import uuid
import wave
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import httpx

from backend.app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_PAUSE_DURATIONS: Dict[str, float] = {
    "natural": 0.0,
    "short": 4.0,
    "pause": 6.0,
    "medium": 7.5,
    "double pause": 10.0,
    "long pause": 12.0,
    "pause long pause": 16.0,
    "double long pause": 20.0,
    "triple long pause": 28.0,
    "deep rest": 20.0,
}


class AudioSpacerService:
    def __init__(self):
        self.ffmpeg_bin = "ffmpeg"
        self.ffprobe_bin = "ffprobe"

    def parse_script(self, script_text: str) -> List[Dict[str, Any]]:
        """
        Parses script text into lines and their requested pause durations.
        Recognizes notation such as:
          - (pause) -> 6.0s
          - (short pause) -> 4.0s
          - (long pause) -> 12.0s
          - (double long pause) -> 20.0s
          - (15s pause) or (10s) -> explicit float seconds
        """
        if not script_text or not script_text.strip():
            return []

        lines = [l.strip() for l in script_text.splitlines() if l.strip()]
        parsed_entries: List[Dict[str, Any]] = []
        current_text: List[str] = []

        for line in lines:
            # Check for parenthetical pause notation
            pause_match = re.search(r'\((.*?pause.*?|\d+(?:\.\d+)?\s*s.*?)\)', line, re.IGNORECASE)
            if pause_match:
                tag = pause_match.group(1).lower().strip()
                # Check for explicit seconds e.g. (8s pause) or (15s)
                sec_match = re.search(r'(\d+(?:\.\d+)?)\s*s', tag)
                if sec_match:
                    dur = float(sec_match.group(1))
                elif "triple" in tag or tag.count("long") >= 3:
                    dur = DEFAULT_PAUSE_DURATIONS["triple long pause"]
                elif tag.count("long") == 2 or "double long" in tag:
                    dur = DEFAULT_PAUSE_DURATIONS["double long pause"]
                elif "pause long" in tag or ("long" in tag and "pause" in tag and len(tag.split()) > 2):
                    dur = DEFAULT_PAUSE_DURATIONS["pause long pause"]
                elif "long" in tag:
                    dur = DEFAULT_PAUSE_DURATIONS["long pause"]
                elif "short" in tag or "brief" in tag:
                    dur = DEFAULT_PAUSE_DURATIONS["short"]
                elif tag.count("pause") >= 2 or "double pause" in tag:
                    dur = DEFAULT_PAUSE_DURATIONS["double pause"]
                else:
                    dur = DEFAULT_PAUSE_DURATIONS["pause"]

                text_before = line[:pause_match.start()].strip()
                if text_before:
                    current_text.append(text_before)

                full_phrase = " ".join(current_text).strip()
                if full_phrase:
                    parsed_entries.append({
                        "text": full_phrase,
                        "pause_tag": tag,
                        "pause_duration": dur
                    })
                    current_text = []
                
                # Check if there's text after the pause tag on the same line
                text_after = line[pause_match.end():].strip()
                if text_after:
                    current_text.append(text_after)
            else:
                current_text.append(line)

        if current_text:
            parsed_entries.append({
                "text": " ".join(current_text).strip(),
                "pause_tag": "end",
                "pause_duration": 4.0
            })

        return parsed_entries

    async def decode_to_pcm_wav(self, input_path: Path, output_wav: Path) -> Path:
        """Decodes any audio format (MP3, M4A, AAC, FLAC) into standard 44.1kHz 16-bit stereo PCM WAV."""
        cmd = [
            self.ffmpeg_bin, "-y",
            "-i", str(input_path),
            "-ar", "44100",
            "-ac", "2",
            "-c:a", "pcm_s16le",
            str(output_wav)
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg decoding failed for {input_path}")
        return output_wav

    def extract_waveform_peaks(self, wav_path: Path, num_peaks: int = 800) -> List[float]:
        """
        Extracts normalized amplitude peaks [0.0 - 1.0] from a 16-bit PCM WAV for fast frontend canvas rendering.
        """
        try:
            with wave.open(str(wav_path), 'rb') as wf:
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                n_frames = wf.getnframes()
                if n_frames == 0 or sampwidth != 2:
                    return [0.0] * num_peaks

                raw_bytes = wf.readframes(n_frames)
                total_samples = len(raw_bytes) // 2
                
                # Unpack as signed 16-bit integers
                samples = struct.unpack(f"<{total_samples}h", raw_bytes)
                
                # Downsample into num_peaks buckets
                samples_per_bucket = max(1, total_samples // (num_peaks * n_channels))
                peaks = []
                
                max_possible = 32768.0
                for i in range(num_peaks):
                    start_idx = i * samples_per_bucket * n_channels
                    end_idx = min(total_samples, start_idx + samples_per_bucket * n_channels)
                    if start_idx >= total_samples:
                        peaks.append(0.0)
                        continue
                    
                    bucket = samples[start_idx:end_idx]
                    if not bucket:
                        peaks.append(0.0)
                        continue
                    
                    # Calculate max peak in bucket
                    max_val = max(abs(s) for s in bucket)
                    normalized = round(min(1.0, max_val / max_possible), 4)
                    peaks.append(normalized)
                    
                return peaks
        except Exception as e:
            logger.warning(f"Error extracting waveform peaks: {e}")
            return [0.1] * num_peaks

    async def detect_silences(
        self,
        wav_path: Path,
        noise_db: str = "-28dB",
        min_dur: float = 0.25
    ) -> List[Dict[str, float]]:
        """
        Runs ffmpeg silencedetect to find natural pause intervals with exact midpoints.
        """
        cmd = [
            self.ffmpeg_bin,
            "-i", str(wav_path),
            "-af", f"silencedetect=noise={noise_db}:d={min_dur}",
            "-f", "null", "-"
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr_bytes = await proc.communicate()
        stderr_text = stderr_bytes.decode("utf-8", errors="ignore")

        starts = [float(x) for x in re.findall(r'silence_start: ([\d\.]+)', stderr_text)]
        ends = [float(x) for x in re.findall(r'silence_end: ([\d\.]+)', stderr_text)]

        silences: List[Dict[str, float]] = []
        for s, e in zip(starts, ends):
            silences.append({
                "start": round(s, 3),
                "end": round(e, 3),
                "mid": round((s + e) / 2.0, 3),
                "duration": round(e - s, 3)
            })
        return silences

    async def transcribe_audio(self, audio_file_path: Path) -> List[Dict[str, Any]]:
        """
        Transcribes speech audio into timestamped spoken phrases using Gemini Audio API.
        Converts audio to 16kHz mono WAV and uses candidate models (gemini-3.5-flash, gemini-3.6-flash).
        """
        api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if not api_key or len(api_key.strip()) < 5:
            logger.info("No Gemini API key configured for audio transcription.")
            return []

        # Get audio duration
        try:
            with wave.open(str(audio_file_path), 'rb') as wf:
                total_duration = wf.getnframes() / wf.getframerate()
        except Exception:
            total_duration = 300.0

        candidate_models = [
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-3-flash-preview",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.6-flash"
        ]
        chunk_duration = 180.0  # 3-minute chunks for guaranteed sub-10MB payload and fast processing
        num_chunks = max(1, math.ceil(total_duration / chunk_duration))
        all_transcriptions = []

        prompt = """Transcribe this voiceover speech into timestamped phrases/sentences.
Return ONLY a valid JSON array of objects with keys start_seconds, end_seconds, text.
Example:
[
  {
    "start_seconds": 0.0,
    "end_seconds": 3.5,
    "text": "You feel it coming."
  }
]
Do not wrap in markdown, return pure JSON."""

        for chunk_idx in range(num_chunks):
            start_offset = chunk_idx * chunk_duration
            chunk_wav = settings.CACHE_DIR / f"{audio_file_path.stem}_chunk_{chunk_idx}.wav"

            try:
                cmd = [
                    self.ffmpeg_bin, "-y",
                    "-ss", str(start_offset),
                    "-t", str(chunk_duration),
                    "-i", str(audio_file_path),
                    "-ar", "16000", "-ac", "1",
                    str(chunk_wav)
                ]
                await asyncio.to_thread(lambda: subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))

                with open(chunk_wav, "rb") as f:
                    audio_bytes = f.read()

                if len(audio_bytes) < 1000:
                    continue

                b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
                payload = {
                    "contents": [{
                        "parts": [
                            {"inline_data": {"mime_type": "audio/wav", "data": b64_audio}},
                            {"text": prompt}
                        ]
                    }],
                    "generationConfig": {
                        "temperature": 0.1,
                        "response_mime_type": "application/json"
                    }
                }

                chunk_success = False
                async with httpx.AsyncClient(timeout=60.0) as client:
                    for model_name in candidate_models:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                        try:
                            resp = await client.post(url, json=payload)
                            if resp.status_code == 200:
                                data = resp.json()
                                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                                raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text, flags=re.IGNORECASE)
                                raw_text = re.sub(r'\s*```$', '', raw_text)

                                match = re.search(r'(\[.*\]|\{.*\})', raw_text, re.DOTALL)
                                raw_json = match.group(1) if match else raw_text

                                try:
                                    parsed = json.loads(raw_json)
                                except Exception:
                                    array_match = re.search(r'\[\s*\{.*?\}\s*\]', raw_text, re.DOTALL)
                                    if array_match:
                                        parsed = json.loads(array_match.group(0))
                                    else:
                                        continue

                                if isinstance(parsed, dict):
                                    for k in ["phrases", "segments", "transcriptions", "transcript", "items", "results"]:
                                        if k in parsed and isinstance(parsed[k], list):
                                            parsed = parsed[k]
                                            break

                                chunk_items = []
                                if isinstance(parsed, list):
                                    for item in parsed:
                                        if isinstance(item, dict):
                                            txt = str(item.get("text") or item.get("phrase") or item.get("transcript") or "").strip()
                                            if txt:
                                                start_val = item.get("start_seconds") or item.get("start") or item.get("startTime") or item.get("start_time") or 0.0
                                                end_val = item.get("end_seconds") or item.get("end") or item.get("endTime") or item.get("end_time") or (float(start_val) + 2.0)
                                                chunk_items.append({
                                                    "start_seconds": round(float(start_val) + start_offset, 2),
                                                    "end_seconds": round(float(end_val) + start_offset, 2),
                                                    "text": txt
                                                })

                                if chunk_items:
                                    all_transcriptions.extend(chunk_items)
                                    chunk_success = True
                                    break
                            else:
                                logger.warning(f"Model {model_name} status {resp.status_code}: {resp.text[:100]}")
                        except Exception as ex:
                            logger.warning(f"Model {model_name} chunk {chunk_idx} error: {ex}")

            except Exception as e:
                logger.warning(f"Error processing chunk {chunk_idx}: {e}")
            finally:
                if chunk_wav.exists():
                    try:
                        chunk_wav.unlink()
                    except Exception:
                        pass

        return all_transcriptions

    def align_segments(
        self,
        parsed_script: List[Dict[str, Any]],
        silences: List[Dict[str, float]],
        total_duration: float,
        transcriptions: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Aligns script entries, transcriptions, or audio speech blocks with detected silence boundaries
        to produce a clean editable segment list for the UI.
        """
        segments: List[Dict[str, Any]] = []

        if parsed_script and len(parsed_script) > 0:
            # Script-driven alignment
            num_script_items = len(parsed_script)
            num_silences = len(silences)
            prev_split = 0.0

            for idx, entry in enumerate(parsed_script):
                text = entry["text"]
                pause_tag = entry.get("pause_tag", "pause")
                pause_dur = entry.get("pause_duration", 6.0)

                # Match with corresponding silence gap if available
                if num_silences > 0:
                    expected_ratio = (idx + 1) / (num_script_items + 1)
                    target_time = total_duration * expected_ratio
                    
                    valid_silences = [s for s in silences if s["mid"] > prev_split + 0.8]
                    if valid_silences:
                        best_sil = min(valid_silences, key=lambda s: abs(s["mid"] - target_time))
                        split_time = best_sil["mid"]
                        natural_gap = best_sil["duration"]
                    else:
                        split_time = min(total_duration, prev_split + (total_duration - prev_split) / max(1, num_script_items - idx))
                        natural_gap = 0.5
                else:
                    split_time = min(total_duration, (idx + 1) * (total_duration / num_script_items))
                    natural_gap = 0.5

                seg_start = round(prev_split, 2)
                seg_end = round(split_time, 2)
                prev_split = split_time

                segments.append({
                    "id": f"seg_{idx}_{uuid.uuid4().hex[:6]}",
                    "index": idx,
                    "text": text,
                    "start_time": seg_start,
                    "end_time": seg_end,
                    "split_time": round(split_time, 3),
                    "natural_silence_dur": round(natural_gap, 2),
                    "pause_tag": pause_tag,
                    "pause_duration": round(pause_dur, 1),
                })
        elif transcriptions and len(transcriptions) > 0:
            # Real speech-to-text transcription alignment
            prev_split = 0.0
            num_transcripts = len(transcriptions)

            for idx, item in enumerate(transcriptions):
                phrase_start = max(prev_split, item["start_seconds"])
                phrase_end = item["end_seconds"]

                # Find closest silence after phrase_end
                valid_silences = [s for s in silences if s["mid"] >= phrase_end - 0.2]
                if valid_silences:
                    sil = valid_silences[0]
                    split_time = sil["mid"]
                    natural_gap = sil["duration"]
                else:
                    split_time = min(total_duration, phrase_end + 0.5)
                    natural_gap = 0.5

                seg_start = round(prev_split, 2)
                seg_end = round(split_time, 2)
                prev_split = split_time

                pause_dur = 6.0
                if idx % 5 == 4:
                    pause_dur = 12.0

                segments.append({
                    "id": f"seg_{idx}_{uuid.uuid4().hex[:6]}",
                    "index": idx,
                    "text": item["text"],
                    "start_time": seg_start,
                    "end_time": seg_end,
                    "split_time": round(split_time, 3),
                    "natural_silence_dur": round(natural_gap, 2),
                    "pause_tag": "pause" if pause_dur <= 6.0 else "long pause",
                    "pause_duration": round(pause_dur, 1),
                })
        else:
            # Fallback: Silence / VAD driven segments
            if not silences:
                chunk_len = 25.0
                num_chunks = max(1, math.ceil(total_duration / chunk_len))
                for idx in range(num_chunks):
                    s_time = idx * chunk_len
                    e_time = min(total_duration, (idx + 1) * chunk_len)
                    segments.append({
                        "id": f"seg_{idx}_{uuid.uuid4().hex[:6]}",
                        "index": idx,
                        "text": f"Spoken Section {idx + 1}",
                        "start_time": round(s_time, 2),
                        "end_time": round(e_time, 2),
                        "split_time": round(e_time, 3),
                        "natural_silence_dur": 0.5,
                        "pause_tag": "pause",
                        "pause_duration": 6.0,
                    })
            else:
                prev_pos = 0.0
                for idx, sil in enumerate(silences):
                    seg_start = prev_pos
                    seg_end = sil["start"]
                    split_time = sil["mid"]
                    prev_pos = sil["end"]

                    pause_dur = 6.0
                    if idx % 5 == 4:
                        pause_dur = 12.0

                    segments.append({
                        "id": f"seg_{idx}_{uuid.uuid4().hex[:6]}",
                        "index": idx,
                        "text": f"Spoken Section {idx + 1}",
                        "start_time": round(seg_start, 2),
                        "end_time": round(seg_end, 2),
                        "split_time": round(split_time, 3),
                        "natural_silence_dur": round(sil["duration"], 2),
                        "pause_tag": "pause" if pause_dur <= 6.0 else "long pause",
                        "pause_duration": round(pause_dur, 1),
                    })

                if prev_pos < total_duration:
                    segments.append({
                        "id": f"seg_{len(silences)}_{uuid.uuid4().hex[:6]}",
                        "index": len(silences),
                        "text": f"Closing Section",
                        "start_time": round(prev_pos, 2),
                        "end_time": round(total_duration, 2),
                        "split_time": round(total_duration, 3),
                        "natural_silence_dur": 0.5,
                        "pause_tag": "end",
                        "pause_duration": 4.0,
                    })

        return segments

    def align_script_with_transcript(
        self,
        script_text: str,
        current_segments: List[Dict[str, Any]],
        silences: List[Dict[str, float]],
        total_duration: float
    ) -> List[Dict[str, Any]]:
        """
        Aligns a pasted reference script with existing audio silences and timestamps,
        attaching user's pause tags (e.g. (pause), (15s)) to the corresponding phrase blocks.
        """
        parsed_script = self.parse_script(script_text)
        if not parsed_script:
            return current_segments

        return self.align_segments(parsed_script, silences, total_duration)



    def apply_smooth_fade(
        self,
        pcm_data: bytes,
        num_frames: int,
        n_channels: int,
        fade_type: str = "in"
    ) -> bytes:
        """Applies a smooth S-curve (half-cosine) fade-in or fade-out to 16-bit PCM bytes."""
        if not pcm_data:
            return b""
        total_samples = len(pcm_data) // 2
        total_frames = total_samples // n_channels
        actual_fade_frames = min(num_frames, total_frames)
        if actual_fade_frames <= 0:
            return pcm_data

        samples = list(struct.unpack(f"<{total_samples}h", pcm_data))

        for frame in range(actual_fade_frames):
            progress = frame / actual_fade_frames
            if fade_type == "in":
                factor = 0.5 * (1.0 - math.cos(math.pi * progress))
            else:
                factor = 0.5 * (1.0 + math.cos(math.pi * progress))

            for ch in range(n_channels):
                idx = (frame if fade_type == "in" else (total_frames - actual_fade_frames + frame)) * n_channels + ch
                if idx < total_samples:
                    samples[idx] = int(samples[idx] * factor)

        return struct.pack(f"<{total_samples}h", *samples)

    async def splice_and_render_spaced_audio(
        self,
        input_wav: Path,
        segments: List[Dict[str, Any]],
        output_mp3: Path,
        output_wav: Optional[Path] = None,
        fade_duration: float = 0.05
    ) -> Dict[str, Any]:
        """
        Slices raw PCM audio at exact silence midpoints, applies 50ms S-curve soft fades,
        and injects pristine zero-silence buffers. Encodes final mastered MP3/WAV.
        """
        with wave.open(str(input_wav), 'rb') as wf_in:
            n_channels = wf_in.getnchannels()
            sampwidth = wf_in.getsampwidth()
            framerate = wf_in.getframerate()
            total_frames = wf_in.getnframes()
            total_dur = total_frames / framerate
            raw_audio = wf_in.readframes(total_frames)

        bytes_per_frame = n_channels * sampwidth
        fade_frames = int(framerate * fade_duration)
        out_frames = bytearray()
        prev_pos = 0.0

        # Sort segments by split_time
        sorted_segs = sorted(segments, key=lambda s: s.get("split_time", 0.0))

        total_inserted_silence = 0.0
        active_pauses_count = 0

        # Optional initial subtle lead-in silence (1.5s)
        lead_in_bytes = b'\x00' * int(1.5 * framerate * bytes_per_frame)
        out_frames.extend(lead_in_bytes)
        total_inserted_silence += 1.5

        for seg in sorted_segs:
            split_t = float(seg.get("split_time", 0.0))
            pause_dur = float(seg.get("pause_duration", 0.0))

            t = max(0.0, min(total_dur, split_t))
            if t <= prev_pos:
                continue

            start_frame = int(prev_pos * framerate)
            end_frame = int(t * framerate)

            chunk = raw_audio[start_frame * bytes_per_frame : end_frame * bytes_per_frame]
            
            # Apply smooth envelope at boundaries
            if len(chunk) > fade_frames * bytes_per_frame * 2:
                # S-curve fade in at chunk start
                start_faded = self.apply_smooth_fade(
                    chunk[:fade_frames * bytes_per_frame],
                    fade_frames,
                    n_channels,
                    fade_type="in"
                )
                # S-curve fade out at chunk end
                end_faded = self.apply_smooth_fade(
                    chunk[-fade_frames * bytes_per_frame:],
                    fade_frames,
                    n_channels,
                    fade_type="out"
                )
                chunk = start_faded + chunk[fade_frames * bytes_per_frame : -fade_frames * bytes_per_frame] + end_faded

            out_frames.extend(chunk)

            # Insert clean silence buffer
            if pause_dur > 0.0:
                silence_bytes = b'\x00' * int(pause_dur * framerate * bytes_per_frame)
                out_frames.extend(silence_bytes)
                total_inserted_silence += pause_dur
                active_pauses_count += 1

            prev_pos = t

        # Append remaining audio after last split
        remaining_start_frame = int(prev_pos * framerate)
        if remaining_start_frame < total_frames:
            rem_chunk = raw_audio[remaining_start_frame * bytes_per_frame :]
            out_frames.extend(rem_chunk)

        # Final quiet resting buffer (3.0s)
        out_frames.extend(b'\x00' * int(3.0 * framerate * bytes_per_frame))
        total_inserted_silence += 3.0

        temp_out_wav = output_wav or (settings.AUDIO_DIR / f"temp_{uuid.uuid4().hex[:8]}.wav")
        with wave.open(str(temp_out_wav), 'wb') as wf_out:
            wf_out.setnchannels(n_channels)
            wf_out.setsampwidth(sampwidth)
            wf_out.setframerate(framerate)
            wf_out.writeframes(out_frames)

        # Calculate final spaced duration
        final_dur = len(out_frames) / (framerate * bytes_per_frame)

        # Master & encode to high-bitrate MP3 via FFmpeg
        cmd_mp3 = [
            self.ffmpeg_bin, "-y",
            "-i", str(temp_out_wav),
            "-codec:a", "libmp3lame",
            "-b:a", "192k",
            str(output_mp3)
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd_mp3,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await proc.communicate()

        # Extract waveform peaks for spaced output
        spaced_peaks = self.extract_waveform_peaks(temp_out_wav, num_peaks=800)

        # If temp_out_wav wasn't explicitly requested as output_wav, clean it up
        if not output_wav and temp_out_wav.exists():
            try:
                temp_out_wav.unlink()
            except Exception:
                pass

        return {
            "original_duration": round(total_dur, 2),
            "spaced_duration": round(final_dur, 2),
            "total_pauses_count": active_pauses_count,
            "total_silence_added": round(total_inserted_silence, 2),
            "waveform_peaks": spaced_peaks,
            "mp3_path": str(output_mp3)
        }

    async def analyze_audio_file(
        self,
        input_file_path: Path,
        script_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full analysis pipeline:
        1. Decodes to PCM WAV
        2. Computes duration & waveform peak data
        3. Detects silence intervals
        4. Parses script pause tags
        5. Aligns into interactive segments
        """
        file_id = uuid.uuid4().hex[:10]
        temp_wav_path = settings.AUDIO_DIR / f"{file_id}_norm.wav"

        await self.decode_to_pcm_wav(input_file_path, temp_wav_path)

        with wave.open(str(temp_wav_path), 'rb') as wf:
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            total_duration = n_frames / framerate

        waveform_peaks = self.extract_waveform_peaks(temp_wav_path, num_peaks=800)
        silences = await self.detect_silences(temp_wav_path)
        
        parsed_script = []
        transcriptions = []
        if script_text and script_text.strip():
            parsed_script = self.parse_script(script_text)
        else:
            transcriptions = await self.transcribe_audio(temp_wav_path)

        segments = self.align_segments(parsed_script, silences, total_duration, transcriptions)

        return {
            "file_id": file_id,
            "original_name": input_file_path.name,
            "normalized_wav_path": str(temp_wav_path),
            "duration": round(total_duration, 2),
            "waveform_peaks": waveform_peaks,
            "silence_intervals": silences,
            "segments": segments,
            "parsed_script": parsed_script,
            "transcriptions": transcriptions
        }


audio_spacer_service = AudioSpacerService()
