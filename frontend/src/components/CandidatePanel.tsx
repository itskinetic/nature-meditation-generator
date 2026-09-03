import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Film, CheckCircle2, XCircle, AlertCircle,
  ExternalLink, Clock, Play, Pause, X, CheckSquare, Square, Eye, Bookmark, BookmarkCheck, Ban,
  Sparkles, Mountain, Leaf, Waves, Search as SearchIcon, Compass, Image as ImageIcon, PlusCircle,
  Download, Loader2
} from 'lucide-react';
import { CandidateItem } from '../types';

interface CandidatePanelProps {
  candidates: CandidateItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAllApproved: () => void;
  onDeselectAll: () => void;
  onSaveCandidate?: (candidate: CandidateItem) => void;
  onBanCandidate?: (candidate: CandidateItem) => void;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  projectTitle?: string;
  onBatchSaveSelected?: (candidates: CandidateItem[]) => void;
  onDownloadSelectedZip?: (candidates: CandidateItem[]) => void;
  isBatchSaving?: boolean;
  isDownloadingZip?: boolean;
}

const renderShotTypeBadge = (shotType?: string) => {
  const st = (shotType || 'wide_vista').toLowerCase();
  if (st.includes('macro') || st.includes('close')) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/90 text-white shadow backdrop-blur-md">
        <SearchIcon className="w-2.5 h-2.5" />
        <span>Macro</span>
      </span>
    );
  }
  if (st.includes('low') || st.includes('ground')) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-600/90 text-white shadow backdrop-blur-md">
        <Leaf className="w-2.5 h-2.5" />
        <span>Low Angle</span>
      </span>
    );
  }
  if (st.includes('still') || st.includes('ambient') || st.includes('static')) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-700/90 text-white shadow backdrop-blur-md">
        <Clock className="w-2.5 h-2.5" />
        <span>Still</span>
      </span>
    );
  }
  if (st.includes('glide') || st.includes('pan') || st.includes('drift')) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/90 text-white shadow backdrop-blur-md">
        <Waves className="w-2.5 h-2.5" />
        <span>Slow Glide</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-stone-950 shadow backdrop-blur-md">
      <Mountain className="w-2.5 h-2.5" />
      <span>Wide Vista</span>
    </span>
  );
};

export const CandidatePanel: React.FC<CandidatePanelProps> = ({
  candidates,
  selectedIds,
  onToggleSelect,
  onSelectAllApproved,
  onDeselectAll,
  onSaveCandidate,
  onBanCandidate,
  onFetchMore,
  isFetchingMore,
  projectTitle,
  onBatchSaveSelected,
  onDownloadSelectedZip,
  isBatchSaving,
  isDownloadingZip,
}) => {
  const [filter, setFilter] = useState<'all' | 'approved' | 'selected' | 'rejected'>('all');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [activePreviewVideo, setActivePreviewVideo] = useState<CandidateItem | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  if (!candidates || candidates.length === 0) return null;

  // Extract unique themes present in the candidate pool
  const uniqueThemes = Array.from(
    new Set(candidates.map((c) => c.subtheme || c.environment_id || 'Nature').filter(Boolean))
  );

  const approvedCandidates = candidates.filter((c) => c.is_approved);
  const approvedCount = approvedCandidates.length;
  const rejectedCount = candidates.length - approvedCount;
  const selectedCount = selectedIds.length;

  const filtered = candidates.filter((c) => {
    // Theme filter
    if (themeFilter !== 'all') {
      const cTheme = c.subtheme || c.environment_id || 'Nature';
      if (cTheme !== themeFilter) return false;
    }
    // Status filter
    if (filter === 'approved') return c.is_approved;
    if (filter === 'selected') return selectedIds.includes(c.source_video_id);
    if (filter === 'rejected') return !c.is_approved;
    return true;
  });

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-6 transition-colors duration-200">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">
                Review & Select Footage
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-semibold font-mono">
                {selectedCount} selected for render
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Click any clip to watch preview, and check/uncheck clips to curate your exact video sequence.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Select Actions */}
          <div className="flex items-center gap-1.5 mr-1">
            <button
              type="button"
              onClick={onSelectAllApproved}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-stone-700 dark:text-stone-300 hover:text-amber-900 dark:hover:text-amber-300 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer"
            >
              Select All Approved
            </button>
            <button
              type="button"
              onClick={onDeselectAll}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Bulk Actions for Selected Clips */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              {onDownloadSelectedZip && (
                <button
                  type="button"
                  onClick={() => {
                    const selectedList = candidates.filter((c) => selectedIds.includes(c.source_video_id));
                    onDownloadSelectedZip(selectedList);
                  }}
                  disabled={isDownloadingZip}
                  title="Download all selected raw video clips in a single ZIP without rendering"
                  className="h-9 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingZip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isDownloadingZip ? 'Packaging ZIP...' : `Download ${selectedCount} Clips (ZIP)`}</span>
                </button>
              )}

              {onBatchSaveSelected && (
                <button
                  type="button"
                  onClick={() => {
                    const selectedList = candidates.filter((c) => selectedIds.includes(c.source_video_id));
                    onBatchSaveSelected(selectedList);
                  }}
                  disabled={isBatchSaving}
                  title={`Save all ${selectedCount} selected clips to Library and tag as used in "${projectTitle || 'this project'}"`}
                  className="h-9 px-3 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isBatchSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{isBatchSaving ? 'Saving...' : 'Save to Library'}</span>
                </button>
              )}
            </div>
          )}

          {/* Fetch More Videos (Next Batch) */}
          {onFetchMore && (
            <button
              type="button"
              onClick={onFetchMore}
              disabled={isFetchingMore}
              className="h-9 px-3.5 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
              <span>{isFetchingMore ? 'Fetching Next Batch...' : 'Fetch More Videos'}</span>
            </button>
          )}

          {/* Filter tabs */}
          <div className="h-9 flex items-center gap-1 bg-stone-100 dark:bg-stone-950/80 p-1 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`h-7 px-3 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('selected')}
              className={`h-7 px-3 rounded-lg font-bold transition-all ${
                filter === 'selected'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              Selected ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('approved')}
              className={`h-7 px-3 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                filter === 'approved'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Approved ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('rejected')}
              className={`h-7 px-3 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                filter === 'rejected'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-900/50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              Filtered ({rejectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Theme Filter Row */}
      {uniqueThemes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-stone-400 font-semibold mr-1">Filter by Theme:</span>
          <button
            type="button"
            onClick={() => setThemeFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              themeFilter === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            All Themes ({candidates.length})
          </button>
          {uniqueThemes.map((th) => {
            const count = candidates.filter((c) => (c.subtheme || c.environment_id || 'Nature') === th).length;
            return (
              <button
                key={th}
                type="button"
                onClick={() => setThemeFilter(th)}
                className={`px-3 py-1 rounded-lg font-medium transition-all capitalize ${
                  themeFilter === th
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {th} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((c) => {
          const isSelected = selectedIds.includes(c.source_video_id);
          const isCardPlaying = playingId === c.source_video_id;
          const videoSrc = c.download_url || (c.local_file_path ? `/api/jobs/preview` : undefined);

          return (
            <div
              key={c.source_video_id}
              className={`rounded-2xl border overflow-hidden transition-all bg-stone-50 dark:bg-stone-950/60 flex flex-col ${
                isSelected
                  ? 'ring-2 ring-amber-500 border-amber-500 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                  : c.is_approved
                  ? 'border-stone-200 dark:border-stone-800 shadow-sm hover:border-amber-300 dark:hover:border-stone-700'
                  : 'border-stone-200 dark:border-stone-800/80 opacity-60 hover:opacity-100'
              }`}
            >
              {/* Media Frame (Video or Thumbnail) */}
              <div className="relative aspect-video bg-black overflow-hidden group flex items-center justify-center">
                {isCardPlaying && videoSrc ? (
                  <video
                    src={videoSrc}
                    autoPlay
                    loop
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : c.preview_url ? (
                  <img
                    src={c.preview_url}
                    alt={c.subtheme || 'Footage Preview'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-100/60 dark:from-amber-950/40 via-stone-200 dark:via-slate-900 to-stone-300 dark:to-slate-950 flex items-center justify-center">
                    <Film className="w-8 h-8 text-amber-700/60 dark:text-amber-500/50" />
                  </div>
                )}

                {/* Video Play Overlay */}
                {!isCardPlaying && videoSrc && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewVideo(c)}
                    className="absolute inset-0 bg-black/30 hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-500/90 text-stone-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-stone-950 ml-0.5" />
                    </div>
                  </button>
                )}

                {/* Source, Media Type, Reused, and Shot Type Tags */}
                <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-black/70 backdrop-blur-md text-white border border-white/10">
                    {c.source}
                  </span>
                  {c.media_type === 'image' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-stone-950 shadow backdrop-blur-md flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5 text-stone-950" />
                      <span>Photo • Ken Burns</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600/90 text-white shadow backdrop-blur-md flex items-center gap-1">
                      <Film className="w-2.5 h-2.5 text-white" />
                      <span>Video</span>
                    </span>
                  )}
                  {renderShotTypeBadge(c.shot_type)}
                  {c.is_reused && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500 text-stone-950 shadow">
                      Reused
                    </span>
                  )}
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/70 backdrop-blur-md text-white border border-white/10 flex items-center gap-1 pointer-events-none">
                  <Clock className="w-3 h-3 text-stone-300" />
                  {c.duration ? `${c.duration.toFixed(0)}s` : '--'}
                </div>

                {/* Approval Badge */}
                <div className="absolute top-2.5 right-2.5 pointer-events-none">
                  {c.is_approved ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500 text-stone-950 shadow">
                      <CheckCircle2 className="w-3 h-3" />
                      Approved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-600 text-white shadow">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* Details & Selection Control */}
              <div className="p-4.5 space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-900 dark:text-stone-200 capitalize truncate">
                      {c.subtheme || c.search_query || 'Nature Scene'}
                    </span>
                    <span className="text-stone-500 font-mono text-[11px]">
                      {c.width}x{c.height}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                    Creator: {c.creator_name || 'Public Creator'}
                  </p>
                </div>

                {/* Score Pills */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800/80 text-center">
                  <div className="bg-white dark:bg-stone-900/80 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block uppercase font-medium">Theme</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{c.theme_match.toFixed(1)}</span>
                  </div>
                  <div className="bg-white dark:bg-stone-900/80 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block uppercase font-medium">Calm</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{c.calmness.toFixed(1)}</span>
                  </div>
                  <div className="bg-white dark:bg-stone-900/80 p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block uppercase font-medium">Motion</span>
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{c.motion_intensity.toFixed(1)}</span>
                  </div>
                </div>

                {/* Rejection / Note */}
                {!c.is_approved && c.rejection_reason && (
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-tight">{c.rejection_reason}</span>
                  </div>
                )}

                {/* Selection Button & Actions Bar */}
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(c.source_video_id)}
                    className={`h-9 px-3.5 flex-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 shadow-xs hover:bg-amber-200/80'
                        : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" /> : <Square className="w-3.5 h-3.5" />}
                    <span>{isSelected ? 'Selected for Video' : 'Select for Video'}</span>
                  </button>

                  {/* Bookmark / Save to Library */}
                  {onSaveCandidate && (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveCandidate(c);
                        setSavedIds((prev) => new Set(prev).add(c.source_video_id));
                      }}
                      title={savedIds.has(c.source_video_id) ? 'Saved in Library' : 'Save this clip to Library for future use'}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                        savedIds.has(c.source_video_id)
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-stone-700 dark:text-stone-300 hover:text-amber-800 dark:hover:text-amber-400'
                      }`}
                    >
                      {savedIds.has(c.source_video_id) ? (
                        <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* 1-Click Ban Video */}
                  {onBanCandidate && (
                    <button
                      type="button"
                      onClick={() => onBanCandidate(c)}
                      title="Permanently ban this footage (never show again)"
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}

                  {videoSrc && (
                    <button
                      type="button"
                      onClick={() => setActivePreviewVideo(c)}
                      title="Watch video preview"
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-stone-700 dark:text-stone-300 hover:text-amber-800 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Load More Videos Bar */}
      {onFetchMore && (
        <div className="pt-2 flex items-center justify-center">
          <button
            type="button"
            onClick={onFetchMore}
            disabled={isFetchingMore}
            className="h-10 px-6 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            <span>{isFetchingMore ? 'Fetching Next Batch of Videos...' : 'Fetch More Videos (Load Next Batch)'}</span>
          </button>
        </div>
      )}

      {/* Full Video Preview Modal (Rendered via React Portal at document.body for instant screen-center positioning) */}
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
                  {activePreviewVideo.subtheme || activePreviewVideo.search_query || 'Footage Preview'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  Creator: {activePreviewVideo.creator_name} • {activePreviewVideo.width}x{activePreviewVideo.height} • {activePreviewVideo.duration}s
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
                src={activePreviewVideo.download_url || activePreviewVideo.preview_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Source: <strong className="uppercase">{activePreviewVideo.source}</strong></span>
                {renderShotTypeBadge(activePreviewVideo.shot_type)}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {onBanCandidate && (
                  <button
                    type="button"
                    onClick={() => {
                      onBanCandidate(activePreviewVideo);
                      setActivePreviewVideo(null);
                    }}
                    title="Permanently ban this clip from future searches"
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ban Footage</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onToggleSelect(activePreviewVideo.source_video_id);
                  }}
                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedIds.includes(activePreviewVideo.source_video_id)
                      ? 'bg-amber-500 text-stone-950 hover:bg-amber-600 font-bold shadow-xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-amber-500 hover:text-stone-950'
                  }`}
                >
                  {selectedIds.includes(activePreviewVideo.source_video_id) ? 'Deselect from Video' : 'Select for Video'}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewVideo(null)}
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                >
                  Close
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
