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
        allow_looping: bool = False
    ) -> Dict[str, Any]:
        """
        Plans a varied, harmonic clip sequence to fulfill target duration.
        In documentary mode or when looping is disabled, plays each unique clip
        exactly once sequentially without repeating/cycling clips.
        """
        if not approved_candidates:
            raise ValueError("No approved candidates available to build sequence.")

        # 1. Sort & prioritize approved candidate pool with controlled randomness
        def candidate_weight(c: CandidateItem) -> float:
            base = (
                c.intent_match * 0.35
                + c.theme_match * 0.25
                + c.calmness * 0.25
                + c.visual_quality * 0.15
                - min(c.times_used * 0.8, 3.0)
            )
            return max(0.1, base + random.uniform(-0.2, 0.2))

        sorted_pool = sorted(approved_candidates, key=candidate_weight, reverse=True)

        # 2. Select up to max_unique_videos ensuring balanced environment variety and subtheme interleaving
        unique_sequence: List[CandidateItem] = []
        
        # Group candidates by environment or subtheme
        env_groups: Dict[str, List[CandidateItem]] = {}
        for c in sorted_pool:
            key = c.environment_id or c.subtheme or "theme"
            if key not in env_groups:
                env_groups[key] = []
            env_groups[key].append(c)

        env_keys = list(env_groups.keys())
        env_idx = 0
        last_creator = None

        while len(unique_sequence) < max_unique_videos and any(len(g) > 0 for g in env_groups.values()):
            curr_env = env_keys[env_idx % len(env_keys)]
            group = env_groups[curr_env]

            if group:
                chosen_idx = 0
                for idx, c in enumerate(group):
                    if last_creator is None or c.creator_name != last_creator:
                        chosen_idx = idx
                        break
                chosen = group.pop(chosen_idx)
                unique_sequence.append(chosen)
                last_creator = chosen.creator_name

            env_idx += 1

        # If user explicitly provided candidates up to max_unique_videos
        if len(unique_sequence) == 0:
            unique_sequence = approved_candidates[:max_unique_videos]

        # 3. If in Documentary mode or looping is disabled: Exact 1-Pass Sequential Playback
        is_doc = (studio_mode == "documentary")
        if not allow_looping or is_doc:
            num_clips = len(unique_sequence)
            total_play_time = target_duration_seconds + max(0, num_clips - 1) * transition_duration
            clip_dur = max(4.0, total_play_time / max(1, num_clips))

            # Track offset per source video to chunk long videos across multiple occurrences
            video_offsets: Dict[str, float] = {}

            full_clip_sequence = []
            accumulated_duration = 0.0
            for idx, cand in enumerate(unique_sequence):
                is_first = (idx == 0)
                eff_add = clip_dur if is_first else max(1.0, clip_dur - transition_duration)

                # Calculate non-overlapping start offset for this chunk
                cand_id = cand.source_video_id
                current_offset = video_offsets.get(cand_id, 0.0)
                
                # If source video is long and has remaining headroom, use current offset then advance
                if cand.duration and cand.duration > (current_offset + clip_dur + 2.0):
                    next_offset = current_offset + clip_dur
                else:
                    current_offset = 0.0
                    next_offset = clip_dur

                video_offsets[cand_id] = next_offset

                full_clip_sequence.append({
                    "sequence_index": idx,
                    "cycle": 0,
                    "candidate_id": cand.source_video_id,
                    "source": cand.source,
                    "creator_name": cand.creator_name,
                    "creator_url": cand.creator_url,
                    "source_url": cand.source_url,
                    "subtheme": cand.subtheme,
                    "duration": round(clip_dur, 2),
                    "start_offset": round(current_offset, 2),
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

        # 4. Standard Looping Mode (For Extended Ambient Meditation Channels)
        unique_durations: List[float] = []
        unique_effective_total = 0.0

        for i, c in enumerate(unique_sequence):
            dur = max(c.duration, 15.0)
            usable = max(5.0, dur - trimming)
            unique_durations.append(usable)
            if i == 0:
                unique_effective_total += usable
            else:
                unique_effective_total += max(1.0, usable - transition_duration)

        full_clip_sequence: List[Dict[str, Any]] = []
        accumulated_duration = 0.0
        cycle_count = 0
        video_offsets: Dict[str, float] = {}

        while accumulated_duration < target_duration_seconds:
            cycle_len = len(unique_sequence)
            start_offset_idx = (cycle_count * 3) % cycle_len

            for step in range(cycle_len):
                clip_idx = (start_offset_idx + step) % cycle_len
                cand = unique_sequence[clip_idx]
                usable_dur = unique_durations[clip_idx]

                is_first_clip = (len(full_clip_sequence) == 0)
                eff_add = usable_dur if is_first_clip else (usable_dur - transition_duration)

                remaining_needed = target_duration_seconds - accumulated_duration
                if remaining_needed <= 0:
                    break

                clip_play_duration = usable_dur
                if is_first_clip:
                    if usable_dur > target_duration_seconds:
                        clip_play_duration = target_duration_seconds
                        eff_add = target_duration_seconds
                else:
                    if eff_add > remaining_needed:
                        clip_play_duration = remaining_needed + transition_duration
                        eff_add = remaining_needed

                # Progressive offset chunking across loop cycles
                cand_id = cand.source_video_id
                curr_seek = video_offsets.get(cand_id, 0.0)
                if cand.duration and cand.duration > (curr_seek + clip_play_duration + 2.0):
                    video_offsets[cand_id] = curr_seek + clip_play_duration
                else:
                    curr_seek = 0.0
                    video_offsets[cand_id] = clip_play_duration

                full_clip_sequence.append({
                    "sequence_index": len(full_clip_sequence),
                    "cycle": cycle_count,
                    "candidate_id": cand.source_video_id,
                    "source": cand.source,
                    "creator_name": cand.creator_name,
                    "creator_url": cand.creator_url,
                    "source_url": cand.source_url,
                    "subtheme": cand.subtheme,
                    "duration": clip_play_duration,
                    "start_offset": round(curr_seek, 2),
                    "effective_duration": eff_add,
                    "preview_url": cand.preview_url,
                    "local_file_path": cand.local_file_path,
                    "download_url": cand.download_url
                })

                accumulated_duration += eff_add
                if accumulated_duration >= target_duration_seconds:
                    break

            cycle_count += 1
            if cycle_count > 500:
                break

        repeat_count = max(0, cycle_count - 1)
        reused_count = sum(1 for c in unique_sequence if c.is_reused)
        new_count = len(unique_sequence) - reused_count

        return {
            "unique_clips": unique_sequence,
            "unique_clip_count": len(unique_sequence),
            "unique_sequence_duration": round(unique_effective_total, 2),
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
