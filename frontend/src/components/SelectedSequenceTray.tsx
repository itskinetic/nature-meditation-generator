import React from 'react';
import { Film, X, Layers, ChevronLeft, ChevronRight, ArrowLeftToLine, ArrowRightToLine, GripHorizontal, Sparkles } from 'lucide-react';
import { CandidateItem } from '../types';

interface SelectedSequenceTrayProps {
  selectedCandidates: CandidateItem[];
  onRemove: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  transitionDuration: number;
}

export const SelectedSequenceTray: React.FC<SelectedSequenceTrayProps> = ({
  selectedCandidates,
  onRemove,
  onMove,
  transitionDuration,
}) => {
  if (selectedCandidates.length === 0) return null;

  const totalEffectiveDuration = selectedCandidates.reduce((acc, c, idx) => {
    const usable = Math.max(5, c.duration - 0.5);
    return acc + (idx === 0 ? usable : Math.max(1, usable - transitionDuration));
  }, 0);

  return (
    <div className="bg-white dark:bg-stone-900/80 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>Selected Video Sequence</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300/40">
                {selectedCandidates.length} clips curated
              </span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Use arrows or slot picker to arrange the exact playback order of your first 10 clips.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Unique cycle: ~{(totalEffectiveDuration / 60).toFixed(1)}m ({totalEffectiveDuration.toFixed(0)}s)</span>
        </div>
      </div>

      {/* Horizontal Carousel of Selected Clips with Reordering Controls */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin">
        {selectedCandidates.map((c, idx) => {
          const isFirst10 = idx < 10;
          return (
            <div
              key={c.source_video_id}
              className={`relative w-48 shrink-0 rounded-2xl overflow-hidden border transition-all flex flex-col justify-between group ${
                isFirst10
                  ? 'border-amber-400/80 dark:border-amber-600/80 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950'
              }`}
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-video bg-stone-900 overflow-hidden">
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

                {/* Slot Position Badge (1-Indexed) */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <div
                    className={`h-6 px-2 rounded-lg font-bold text-xs flex items-center justify-center shadow-md backdrop-blur-xs ${
                      idx === 0
                        ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-300'
                        : isFirst10
                        ? 'bg-amber-400/90 text-stone-950'
                        : 'bg-stone-800/90 text-stone-200'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/90 text-stone-950 uppercase tracking-wider shadow">
                      Opener
                    </span>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemove(c.source_video_id)}
                  title="Remove clip from sequence"
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Duration Badge */}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/80 text-stone-200">
                  {c.duration ? `${c.duration.toFixed(0)}s` : '--'}
                </div>
              </div>

              {/* Clip Metadata */}
              <div className="p-2.5 space-y-1">
                <span className="text-[11px] font-semibold text-stone-900 dark:text-stone-200 capitalize truncate block">
                  {c.subtheme || 'Scene'}
                </span>
                <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
                  <span className="truncate">{c.creator_name || 'Creator'}</span>
                  <span className="uppercase text-[9px] font-bold text-amber-700 dark:text-amber-400">{c.source}</span>
                </div>
              </div>

              {/* Reordering Toolbar */}
              <div className="p-1.5 bg-stone-100/90 dark:bg-stone-900/90 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-1">
                {/* Move to Start */}
                <button
                  type="button"
                  onClick={() => onMove(idx, 0)}
                  disabled={idx === 0}
                  title="Move to position #1 (Opening Clip)"
                  className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950 text-stone-600 dark:text-stone-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ArrowLeftToLine className="w-3.5 h-3.5" />
                </button>

                {/* Move Left */}
                <button
                  type="button"
                  onClick={() => onMove(idx, idx - 1)}
                  disabled={idx === 0}
                  title="Move earlier in sequence"
                  className="flex-1 py-1 px-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-600 flex items-center justify-center gap-0.5 text-[11px] font-medium text-stone-700 dark:text-stone-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Left</span>
                </button>

                {/* Move Right */}
                <button
                  type="button"
                  onClick={() => onMove(idx, idx + 1)}
                  disabled={idx === selectedCandidates.length - 1}
                  title="Move later in sequence"
                  className="flex-1 py-1 px-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-600 flex items-center justify-center gap-0.5 text-[11px] font-medium text-stone-700 dark:text-stone-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shadow-2xs"
                >
                  <span>Right</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Move to End */}
                <button
                  type="button"
                  onClick={() => onMove(idx, selectedCandidates.length - 1)}
                  disabled={idx === selectedCandidates.length - 1}
                  title="Move to last position"
                  className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950 text-stone-600 dark:text-stone-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <ArrowRightToLine className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

