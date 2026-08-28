import math
import random
from typing import List, Dict, Any, Tuple
from backend.app.schemas import CandidateItem

logger = __import__("logging").getLogger(__name__)


class SelectionService:
    def plan_sequence(
        self,
        approved_candidates: List[CandidateItem],
        target_duration_seconds: float,
        max_unique_videos: int = 20,
        transition_duration: float = 2.0,
        trimming: float = 0.5,
        studio_mode: str = "meditation",
        allow_looping: bool = True,
        playback_speed: float = 0.5,
        clip_duration_cap: float = 15.0
    ) -> Dict[str, Any]:
        """
        Plans a varied, rhythmic 15-second clip sequence to fulfill target duration.
        - Every clip cut is trimmed to max 15s playback duration.
        - Preserves user-curated clip order for the first cycle.
        - Progressively chunks longer raw videos across subsequent loop cycles
          (e.g. 0-15s in loop 1, 15-30s in loop 2, 30-45s in loop 3) before wrapping around.
        """
        if not approved_candidates:
            raise ValueError("No approved candidates available to build sequence.")

        # 1. Use the full approved candidates list preserving user order
        unique_sequence: List[CandidateItem] = list(approved_candidates[:max_unique_videos]) if max_unique_videos > 0 else list(approved_candidates)

        is_doc = (studio_mode == "documentary")
        safe_speed = max(0.2, min(2.0, playback_speed or 0.5))
        # Raw seconds needed from source file to produce 15s of slowed playback
        raw_chunk_len = max(3.0, clip_duration_cap * safe_speed)

        # 2. If in Documentary mode or looping is explicitly disabled: 1-Pass Sequential
        if not allow_looping or is_doc:
            full_clip_sequence = []
            accumulated_duration = 0.0
            video_offsets: Dict[str, float] = {}

            for idx, cand in enumerate(unique_sequence):
                cand_id = cand.source_video_id
                curr_seek = video_offsets.get(cand_id, 0.0)

                # Check duration headroom
                avail_dur = float(cand.duration or 30.0)
                if curr_seek + raw_chunk_len > avail_dur and curr_seek > 0.0:
                    curr_seek = 0.0

                video_offsets[cand_id] = curr_seek + raw_chunk_len
                is_first = (idx == 0)
                eff_add = clip_duration_cap if is_first else max(1.0, clip_duration_cap - transition_duration)

                full_clip_sequence.append({
                    "sequence_index": idx,
                    "cycle": 0,
                    "candidate_id": cand.source_video_id,
                    "source": cand.source,
                    "creator_name": cand.creator_name,
                    "creator_url": cand.creator_url,
                    "source_url": cand.source_url,
                    "subtheme": cand.subtheme,
                    "duration": clip_duration_cap,
                    "start_offset": round(curr_seek, 2),
                    "effective_duration": round(eff_add, 2),
                    "preview_url": cand.preview_url,
                    "local_file_path": cand.local_file_path,
                    "download_url": cand.download_url
                })
                accumulated_duration += eff_add

            return {
                "unique_clips": unique_sequence,
                "unique_clip_count": len(unique_sequence),
                "unique_sequence_duration": round(accumulated_duration, 2),
                "target_duration_seconds": round(target_duration_seconds, 2),
                "actual_duration_seconds": round(accumulated_duration, 2),
                "sequence": full_clip_sequence,
                "repeat_count": 0,
                "reused_count": sum(1 for c in unique_sequence if c.is_reused),
                "new_count": len(unique_sequence) - sum(1 for c in unique_sequence if c.is_reused),
                "warning": None
            }

        # 3. Standard Looping Mode for Meditation: Progressive Offset Chunking Across Cycles
        full_clip_sequence: List[Dict[str, Any]] = []
        accumulated_duration = 0.0
        cycle_count = 0
        video_offsets: Dict[str, float] = {}

        while accumulated_duration < target_duration_seconds:
            cycle_len = len(unique_sequence)

            for step in range(cycle_len):
                cand = unique_sequence[step]
                cand_id = cand.source_video_id
                avail_dur = float(cand.duration or 30.0)

                # Progressive seek offset: advance through the video on each loop cycle
                curr_seek = video_offsets.get(cand_id, 0.0)
                if curr_seek + raw_chunk_len > avail_dur:
                    # Wrapped around: start from beginning again
                    curr_seek = 0.0

                video_offsets[cand_id] = curr_seek + raw_chunk_len

                is_first_clip = (len(full_clip_sequence) == 0)
                eff_add = clip_duration_cap if is_first_clip else max(1.0, clip_duration_cap - transition_duration)

                remaining_needed = target_duration_seconds - accumulated_duration
                if remaining_needed <= 0:
                    break

                clip_play_duration = clip_duration_cap
                if is_first_clip:
                    if clip_duration_cap > target_duration_seconds:
                        clip_play_duration = target_duration_seconds
                        eff_add = target_duration_seconds
                else:
                    if eff_add > remaining_needed:
                        clip_play_duration = remaining_needed + transition_duration
                        eff_add = remaining_needed

                full_clip_sequence.append({
                    "sequence_index": len(full_clip_sequence),
                    "cycle": cycle_count,
                    "candidate_id": cand.source_video_id,
                    "source": cand.source,
                    "creator_name": cand.creator_name,
                    "creator_url": cand.creator_url,
                    "source_url": cand.source_url,
                    "subtheme": cand.subtheme,
                    "duration": round(clip_play_duration, 2),
                    "start_offset": round(curr_seek, 2),
                    "effective_duration": round(eff_add, 2),
                    "preview_url": cand.preview_url,
                    "local_file_path": cand.local_file_path,
                    "download_url": cand.download_url
                })

                accumulated_duration += eff_add
                if accumulated_duration >= target_duration_seconds:
                    break

            cycle_count += 1
            if cycle_count > 1000:
                break

        repeat_count = max(0, cycle_count - 1)
        reused_count = sum(1 for c in unique_sequence if c.is_reused)
        new_count = len(unique_sequence) - reused_count

        return {
            "unique_clips": unique_sequence,
            "unique_clip_count": len(unique_sequence),
            "unique_sequence_duration": round(sum(s["effective_duration"] for s in full_clip_sequence[:len(unique_sequence)]), 2),
            "target_duration_seconds": round(target_duration_seconds, 2),
            "actual_duration_seconds": round(accumulated_duration, 2),
            "sequence": full_clip_sequence,
            "repeat_count": repeat_count,
            "reused_count": reused_count,
            "new_count": new_count,
            "warning": "Sequence will repeat clips to achieve the requested target duration." if repeat_count > 0 else None
        }

    def plan_storyboard_sequence(
        self,
        storyboard_beats: List[Any],
        candidate_pool: List[CandidateItem],
        transition_duration: float = 2.0
    ) -> Dict[str, Any]:
        """
        Plans a chronological narrative clip sequence where each clip maps
        directly to its corresponding Visual Beat in time order, chunking long videos progressively.
        """
        if not storyboard_beats:
            raise ValueError("No storyboard beats provided.")

        cand_map: Dict[str, CandidateItem] = {c.source_video_id: c for c in candidate_pool}
        full_sequence: List[Dict[str, Any]] = []
        accumulated_duration = 0.0
        unique_clips: List[CandidateItem] = []
        seen_ids = set()
        video_offsets: Dict[str, float] = {}

        for idx, beat in enumerate(storyboard_beats):
            beat_dur = float(getattr(beat, "duration_seconds", 12.0) if hasattr(beat, "duration_seconds") else beat.get("duration_seconds", 12.0))
            beat_cue = getattr(beat, "narrative_cue", "") if hasattr(beat, "narrative_cue") else beat.get("narrative_cue", "")
            assigned_id = getattr(beat, "assigned_candidate_id", None) if hasattr(beat, "assigned_candidate_id") else beat.get("assigned_candidate_id")

            # Resolve candidate
            candidate: Optional[CandidateItem] = None
            if assigned_id and assigned_id in cand_map:
                candidate = cand_map[assigned_id]
            else:
                # Find candidate matching beat index or best available
                beat_matches = [c for c in candidate_pool if c.beat_index == idx and c.source_video_id not in seen_ids]
                if beat_matches:
                    candidate = beat_matches[0]
                elif candidate_pool:
                    # Pick round robin
                    candidate = candidate_pool[idx % len(candidate_pool)]

            if not candidate:
                continue

            if candidate.source_video_id not in seen_ids:
                seen_ids.add(candidate.source_video_id)
                unique_clips.append(candidate)

            eff_add = beat_dur if idx == 0 else max(1.0, beat_dur - transition_duration)

            # Progressive offset calculation for long video chunks across beats
            cand_id = candidate.source_video_id
            current_offset = video_offsets.get(cand_id, 0.0)
            if candidate.duration and candidate.duration > (current_offset + beat_dur + 2.0):
                next_offset = current_offset + beat_dur
            else:
                current_offset = 0.0
                next_offset = beat_dur
            video_offsets[cand_id] = next_offset

            full_sequence.append({
                "index": idx,
                "sequence_index": idx,
                "beat_index": idx,
                "narrative_cue": beat_cue,
                "candidate_id": candidate.source_video_id,
                "source_video_id": candidate.source_video_id,
                "source": candidate.source,
                "media_type": candidate.media_type,
                "image_url": candidate.image_url,
                "motion_style": candidate.motion_style,
                "duration": beat_dur,
                "start_offset": round(current_offset, 2),
                "effective_duration": eff_add,
                "preview_url": candidate.preview_url,
                "local_file_path": candidate.local_file_path,
                "download_url": candidate.download_url
            })
            accumulated_duration += eff_add

        return {
            "unique_clips": unique_clips,
            "unique_clip_count": len(unique_clips),
            "unique_sequence_duration": round(accumulated_duration, 2),
            "target_duration_seconds": round(accumulated_duration, 2),
            "actual_duration_seconds": round(accumulated_duration, 2),
            "sequence": full_sequence,
            "repeat_count": 0,
            "reused_count": sum(1 for c in unique_clips if c.is_reused),
            "new_count": len(unique_clips) - sum(1 for c in unique_clips if c.is_reused),
            "is_storyboard": True
        }


selection_service = SelectionService()
