import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Database, Search, Film, Trash2, ExternalLink, Eye, Play, X, Download, Check, Square } from 'lucide-react';
import { LibraryItem } from '../types';

interface LibraryPanelProps {
  items: LibraryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onDeleteItem?: (id: number) => void;
  onBatchDelete?: (ids: number[]) => void;
  onClearLibrary?: () => void;
  isDeleting?: boolean;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  items,
  onDeleteItem,
  onBatchDelete,
  onClearLibrary,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApproved, setFilterApproved] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activePreviewVideo, setActivePreviewVideo] = useState<LibraryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Prevent background scrolling when preview modal is open
  useEffect(() => {
    if (activePreviewVideo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activePreviewVideo]);

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

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((item) => item.id));
    }
  };

  const handleBatchDownload = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id, index) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `/api/library/download/${item.id}`;
        const safeName = (item.subtheme || 'video').replace(/\s+/g, '_');
        link.download = `${safeName}_${item.source_video_id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 350);
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (onBatchDelete) {
      onBatchDelete(selectedIds);
      setSelectedIds([]);
      setShowBatchDeleteConfirm(false);
    }
  };

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

          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-stone-50 dark:bg-stone-950/60 hover:bg-stone-100 dark:hover:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{selectedIds.length === filtered.length ? 'Deselect All' : 'Select All'}</span>
            </button>
          )}

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

      {/* Batch Action Floating / Sticky Toolbar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/40 text-stone-900 dark:text-amber-100 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-stone-950 font-black text-xs shadow-xs">
              {selectedIds.length}
            </span>
            <span className="font-semibold text-xs">
              {selectedIds.length} of {filtered.length} clips selected
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline cursor-pointer ml-1 font-medium"
            >
              {selectedIds.length === filtered.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Batch Download Button */}
            <button
              type="button"
              onClick={handleBatchDownload}
              className="h-8 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Download all selected clips as individual MP4 files"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Selected ({selectedIds.length})</span>
            </button>

            {/* Batch Delete Button with confirmation */}
            {onBatchDelete && (
              showBatchDeleteConfirm ? (
                <div className="flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-xl border border-rose-300 dark:border-rose-800">
                  <span className="text-[11px] text-rose-800 dark:text-rose-200 font-semibold">
                    Delete {selectedIds.length} clips?
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchDelete}
                    className="h-6 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer shadow-xs"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBatchDeleteConfirm(false)}
                    className="h-6 px-1.5 rounded-lg text-[11px] text-stone-600 dark:text-stone-400 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="h-8 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedIds.length})</span>
                </button>
              )
            )}

            {/* Cancel selection */}
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setShowBatchDeleteConfirm(false);
              }}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 text-stone-600 dark:text-amber-200 cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
          {filtered.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const safeDownloadName = `${(item.subtheme || 'video').replace(/\s+/g, '_')}_${item.source_video_id}.mp4`;

            return (
            <div
              key={item.id}
              className={`bg-white dark:bg-stone-900/60 border rounded-2xl overflow-hidden shadow-sm dark:shadow-lg transition-all flex flex-col justify-between group ${
                isSelected
                  ? 'border-amber-500 ring-2 ring-amber-500/50 dark:border-amber-400'
                  : 'border-stone-200/90 dark:border-stone-800/80 hover:border-amber-300 dark:hover:border-stone-700'
              }`}
            >
              {/* Thumbnail / Header */}
              <div>
                <div
                  onClick={() => setActivePreviewVideo(item)}
                  className="relative aspect-video bg-stone-200 dark:bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer"
                >
                  {item.preview_url ? (
                    <img
                      src={item.preview_url}
                      alt={item.subtheme || 'Asset'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Film className="w-8 h-8 text-stone-400 dark:text-slate-700" />
                  )}

                  {/* Hover Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                    <div className="w-11 h-11 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-stone-950 ml-0.5" />
                    </div>
                  </div>

                  {/* Multi-Select Checkbox Top Left */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(item.id);
                    }}
                    className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 shadow-md ring-2 ring-white/70'
                        : 'bg-black/60 hover:bg-black/80 text-white/80 backdrop-blur-md border border-white/20'
                    }`}
                    title={isSelected ? 'Deselect clip' : 'Select clip for batch actions'}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <Square className="w-3 h-3 text-white/60" />
                    )}
                  </div>

                  {/* Source Badge (shifted right of checkbox) */}
                  <div className="absolute top-2.5 left-10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-md text-white/90 border border-white/20 shadow-sm">
                    {item.source}
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-full text-[10px] font-medium bg-black/50 backdrop-blur-md text-white/90 border border-white/20 shadow-sm">
                    {item.duration ? `${item.duration.toFixed(0)}s` : '--'}
                  </div>

                  {/* Top-Right Action Cluster (Download + Delete) */}
                  <div
                    className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Individual Download Button */}
                    <a
                      href={`/api/library/download/${item.id}`}
                      download={safeDownloadName}
                      title="Download this MP4 video"
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-amber-500 hover:text-stone-950 text-white backdrop-blur-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {/* Delete Button on Top Right */}
                    {onDeleteItem && (
                      confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/20">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteItem(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded text-stone-300 text-[10px] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          title="Delete video from library"
                          className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white backdrop-blur-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 capitalize leading-snug truncate">
                        {item.subtheme || 'Nature Scene'}
                      </h3>
                      <p className="text-[13px] text-stone-500 dark:text-stone-400 truncate mt-1">
                        By {item.creator_name || 'Public Creator'}
                      </p>
                    </div>

                    {/* Preview Button */}
                    <button
                      type="button"
                      onClick={() => setActivePreviewVideo(item)}
                      title="Watch full video preview"
                      className="w-8 h-8 rounded-full bg-stone-100/80 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm hover:shadow"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Score breakdown */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-0.5">Intent</span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{item.intent_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="w-px h-6 bg-stone-200 dark:bg-stone-800"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-0.5">Theme</span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{item.theme_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="w-px h-6 bg-stone-200 dark:bg-stone-800"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-0.5">Calm</span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{item.calmness_score?.toFixed(1) || '8.0'}</span>
                    </div>
                    <div className="w-px h-6 bg-stone-200 dark:bg-stone-800"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold mb-0.5">Quality</span>
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-300">{item.visual_quality_score?.toFixed(1) || '8.0'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage & Date Footer */}
              <div className="px-5 pb-5 pt-0 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between mt-auto">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></span>
                  Used {item.times_used} {item.times_used === 1 ? 'time' : 'times'}
                </span>

                <span className="text-stone-400/80 dark:text-stone-500/80">
                  {item.last_used_at
                    ? `Last used: ${new Date(item.last_used_at).toLocaleDateString()}`
                    : 'Unused'}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Full Video Preview Modal */}
      {activePreviewVideo && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setActivePreviewVideo(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 p-4 sm:p-6 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
              <div className="min-w-0 flex-1 mr-2">
                <h3 className="text-base font-semibold text-stone-900 dark:text-white capitalize truncate">
                  {activePreviewVideo.subtheme || 'Library Video Preview'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  Creator: {activePreviewVideo.creator_name || 'Public Creator'} • {activePreviewVideo.width}x{activePreviewVideo.height} • {activePreviewVideo.duration?.toFixed(0)}s
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewVideo(null)}
                className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
              <video
                src={activePreviewVideo.stream_url || activePreviewVideo.download_url || activePreviewVideo.source_url || activePreviewVideo.preview_url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Source: <strong className="uppercase">{activePreviewVideo.source}</strong></span>
                {activePreviewVideo.shot_type && (
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px] font-mono capitalize">
                    {activePreviewVideo.shot_type.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {activePreviewVideo.creator_url && (
                  <a
                    href={activePreviewVideo.creator_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Creator Profile</span>
                  </a>
                )}
                <a
                  href={`/api/library/download/${activePreviewVideo.id}`}
                  download={`${(activePreviewVideo.subtheme || 'video').replace(/\s+/g, '_')}_${activePreviewVideo.source_video_id}.mp4`}
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePreviewVideo(null)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-stone-950 transition-all cursor-pointer font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
