import React from 'react';
import { Film, Clock, X, Layers, Sparkles } from 'lucide-react';
import { CandidateItem } from '../types';

interface SelectedSequenceTrayProps {
  selectedCandidates: CandidateItem[];
  onRemove: (id: string) => void;
  transitionDuration: number;
}

export const SelectedSequenceTray: React.FC<SelectedSequenceTrayProps> = ({
  selectedCandidates,
  onRemove,
  transitionDuration,
}) => {
  if (selectedCandidates.length === 0) return null;

  const totalEffectiveDuration = selectedCandidates.reduce((acc, c, idx) => {
    const usable = Math.max(5, c.duration - 0.5);
    return acc + (idx === 0 ? usable : Math.max(1, usable - transitionDuration));
  }, 0);

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-white">
              Selected Video Sequence ({selectedCandidates.length} clips)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Total unique sequence run time: ~{(totalEffectiveDuration / 60).toFixed(1)} mins ({totalEffectiveDuration.toFixed(0)}s)
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel of Selected Clips */}
      <div className="flex items-center gap-3.5 overflow-x-auto pb-2 pt-1">
        {selectedCandidates.map((c, idx) => (
          <div
            key={c.source_video_id}
            className="relative w-44 shrink-0 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 shadow-sm flex flex-col group"
          >
            <div className="relative aspect-video bg-stone-900">
              {c.preview_url ? (
                <img
                  src={c.preview_url}
                  alt={c.subtheme || 'clip'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-6 h-6 text-stone-600" />
                </div>
              )}

              {/* Order Badge */}
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold flex items-center justify-center shadow">
                {idx + 1}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(c.source_video_id)}
                title="Remove clip from sequence"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/70 text-white">
                {c.duration ? `${c.duration.toFixed(0)}s` : '--'}
              </div>
            </div>

            <div className="p-2 space-y-0.5">
              <span className="text-[11px] font-semibold text-stone-900 dark:text-stone-200 capitalize truncate block">
                {c.subtheme || 'Scene'}
              </span>
              <span className="text-[10px] text-stone-500 truncate block">
                {c.creator_name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
