import React from 'react';
import {
  Compass, Sparkles, Clock, Film, Image as ImageIcon,
  CheckCircle2, RefreshCw, Layers, ChevronRight, Play, Eye
} from 'lucide-react';
import { VisualBeat, CandidateItem } from '../types';

interface StoryboardBeatTimelineProps {
  beats: VisualBeat[];
  candidates: CandidateItem[];
  selectedCandidateIds: string[];
  onAssignCandidateToBeat?: (beatIndex: number, candidateId: string) => void;
  onPreviewCandidate?: (candidate: CandidateItem) => void;
}

export const StoryboardBeatTimeline: React.FC<StoryboardBeatTimelineProps> = ({
  beats,
  candidates,
  selectedCandidateIds,
  onAssignCandidateToBeat,
  onPreviewCandidate,
}) => {
  if (!beats || beats.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-3.5 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-semibold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
            Visual Story Beats Timeline ({beats.length} Scenes)
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
            Chronological Narrative Sync
          </span>
        </div>
        <span className="text-[11px] text-stone-500 dark:text-stone-400">
          Clips cut in sync with spoken voiceover
        </span>
      </div>

      {/* Storyboard Beat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {beats.map((beat, idx) => {
          // Find assigned or matched candidate for this beat
          const matchedCand =
            candidates.find((c) => c.source_video_id === beat.assigned_candidate_id) ||
            candidates.find((c) => c.beat_index === beat.beat_index && selectedCandidateIds.includes(c.source_video_id)) ||
            candidates.find((c) => c.beat_index === beat.beat_index) ||
            candidates[idx % Math.max(1, candidates.length)];

          return (
            <div
              key={beat.beat_index}
              className="bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5 shadow-xs hover:border-amber-400 dark:hover:border-amber-700 transition-all"
            >
              {/* Beat Header: Index & Timestamps */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-amber-950 dark:text-amber-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-[11px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[140px]">{beat.visual_subject}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{beat.start_time.toFixed(0)}s - {beat.end_time.toFixed(0)}s ({beat.duration_seconds.toFixed(0)}s)</span>
                </div>
              </div>

              {/* Narrative Cue Excerpt */}
              <p className="text-xs text-stone-700 dark:text-stone-300 italic line-clamp-2 bg-stone-50/60 dark:bg-stone-950/40 p-2 rounded-lg border border-stone-200/50 dark:border-stone-800/60">
                "{beat.narrative_cue}"
              </p>

              {/* Matched Visual Clip Preview */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center group">
                {matchedCand?.preview_url ? (
                  <img
                    src={matchedCand.preview_url}
                    alt={beat.visual_subject}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center text-stone-400 text-xs">
                    <Film className="w-6 h-6 mb-1 text-amber-500/50" />
                    <span>Searching scene footage...</span>
                  </div>
                )}

                {/* Media Type Overlay */}
                {matchedCand && (
                  <div className="absolute top-1.5 left-1.5 pointer-events-none">
                    {matchedCand.media_type === 'image' ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/90 text-stone-950 shadow flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5" />
                        <span>Ken Burns</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600/90 text-white shadow flex items-center gap-1">
                        <Film className="w-2.5 h-2.5" />
                        <span>Video</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Preview Trigger */}
                {matchedCand && onPreviewCandidate && (
                  <button
                    type="button"
                    onClick={() => onPreviewCandidate(matchedCand)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-white text-xs gap-1 font-medium"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Preview Clip</span>
                  </button>
                )}
              </div>

              {/* Habitat & Camera Tags */}
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-stone-100 dark:border-stone-800 text-[10px] text-stone-500">
                <span className="font-medium text-stone-600 dark:text-stone-400">
                  📍 {beat.habitat}
                </span>
                <span className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-600 dark:text-stone-300">
                  🎥 {beat.camera_shot || 'Wide Vista'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
