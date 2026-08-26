import React, { useState } from 'react';
import { Database, Search, Film, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import { LibraryItem } from '../types';

interface LibraryPanelProps {
  items: LibraryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onDeleteItem?: (id: number) => void;
  onClearLibrary?: () => void;
  isDeleting?: boolean;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  items,
  onDeleteItem,
  onClearLibrary,
  isDeleting,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApproved, setFilterApproved] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      item.creator_name?.toLowerCase().includes(term) ||
      item.subtheme?.toLowerCase().includes(term) ||
      item.source.toLowerCase().includes(term);

    const matchesStatus = filterApproved ? item.is_approved : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Search & Filter Header */}
      <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center">
            <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">
              Persistent Video Library
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {items.length} stored media assets in SQLite database
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by theme, creator..."
              className="h-9 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl pl-9 pr-3.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 w-56 transition-all"
            />
          </div>

          <label className="h-9 flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 px-3.5 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors">
            <input
              type="checkbox"
              checked={filterApproved}
              onChange={(e) => setFilterApproved(e.target.checked)}
              className="rounded bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-800 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 accent-amber-500 cursor-pointer"
            />
            <span className="font-medium">Approved Only</span>
          </label>

          {items.length > 0 && onClearLibrary && (
            <div className="relative">
              {showClearConfirm ? (
                <div className="h-9 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 px-2 rounded-xl border border-rose-300 dark:border-rose-900">
                  <span className="text-[11px] text-rose-800 dark:text-rose-200 px-1 font-medium">
                    Clear all?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearLibrary();
                      setShowClearConfirm(false);
                    }}
                    className="h-7 px-2.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 shadow-xs cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="h-7 px-2 rounded-lg text-[11px] text-stone-600 dark:text-stone-400 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Library</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Library Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white/50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-2xl p-12 text-center text-stone-400">
          <Film className="w-8 h-8 mx-auto mb-3 text-stone-400 dark:text-stone-600" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">No library assets found</p>
          <p className="text-xs text-stone-500 mt-1">
            Generated or downloaded approved videos will be automatically indexed here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-lg hover:border-amber-300 dark:hover:border-stone-700 transition-all flex flex-col justify-between"
            >
              {/* Thumbnail / Header */}
              <div>
                <div className="relative aspect-video bg-stone-200 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
                  {item.preview_url ? (
                    <img
                      src={item.preview_url}
                      alt={item.subtheme || 'Asset'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Film className="w-8 h-8 text-stone-400 dark:text-slate-700" />
                  )}

                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-black/70 backdrop-blur-md text-white border border-white/10">
                    {item.source}
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/70 backdrop-blur-md text-white border border-white/10">
                    {item.duration ? `${item.duration.toFixed(0)}s` : '--'}
                  </div>

                  {/* Delete Button on Top Right */}
                  {onDeleteItem && (
                    <div className="absolute top-2.5 right-2.5">
                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/20">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteItem(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded text-stone-300 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          title="Delete video from library"
                          className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white backdrop-blur-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4.5 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-white capitalize truncate">
                      {item.subtheme || 'Nature Scene'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      By {item.creator_name || 'Public Creator'}
                    </p>
                  </div>

                  {/* Score breakdown */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-stone-200 dark:border-stone-800/80 text-center">
                    <div className="bg-stone-50 dark:bg-stone-950/70 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800/60">
                      <span className="text-[9px] uppercase text-stone-500 dark:text-stone-400 block font-medium">Intent</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{item.intent_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-950/70 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800/60">
                      <span className="text-[9px] uppercase text-stone-500 dark:text-stone-400 block font-medium">Theme</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{item.theme_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-950/70 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800/60">
                      <span className="text-[9px] uppercase text-stone-500 dark:text-stone-400 block font-medium">Calm</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{item.calmness_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-950/70 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800/60">
                      <span className="text-[9px] uppercase text-stone-500 dark:text-stone-400 block font-medium">Quality</span>
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{item.visual_quality_score?.toFixed(1) || '8.0'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage & Date Footer */}
              <div className="p-4.5 pt-0 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between border-t border-stone-100 dark:border-stone-800/60 mt-3 pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Used {item.times_used} {item.times_used === 1 ? 'time' : 'times'}
                </span>

                <span className="text-stone-400 dark:text-stone-500">
                  {item.last_used_at
                    ? `Last used: ${new Date(item.last_used_at).toLocaleDateString()}`
                    : 'Unused'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
