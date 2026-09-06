import React, { useState, useMemo } from 'react';
import {
  History,
  Film,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Repeat,
  Trash2,
  Search,
  RefreshCw,
  Sparkles,
  HardDrive,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  Layers,
  MonitorPlay,
  RotateCcw,
  X
} from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  isLoading: boolean;
  onRefresh?: () => void;
  onDeleteItem?: (jobId: string) => void;
  onClearHistory?: (scope: 'all' | 'purged' | 'failed') => void;
  onReuseInStudio?: (job: HistoryItem) => void;
  isDeleting?: boolean;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  isLoading,
  onRefresh,
  onDeleteItem,
  onClearHistory,
  onReuseInStudio,
  isDeleting = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'purged' | 'failed'>('all');
  const [previewingJobId, setPreviewingJobId] = useState<string | null>(null);
  const [expandedScriptJobId, setExpandedScriptJobId] = useState<string | null>(null);

  // Compute category counts
  const availableCount = useMemo(
    () => history.filter((j) => j.status === 'completed' && j.file_exists).length,
    [history]
  );
  const purgedCount = useMemo(
    () => history.filter((j) => j.status === 'completed' && !j.file_exists).length,
    [history]
  );
  const failedCount = useMemo(
    () => history.filter((j) => j.status === 'failed' || j.status === 'cancelled').length,
    [history]
  );

  // Filter and search history
  const filteredHistory = useMemo(() => {
    return history.filter((job) => {
      // Filter by status tab
      if (statusFilter === 'available' && !(job.status === 'completed' && job.file_exists)) {
        return false;
      }
      if (statusFilter === 'purged' && !(job.status === 'completed' && !job.file_exists)) {
        return false;
      }
      if (statusFilter === 'failed' && !(job.status === 'failed' || job.status === 'cancelled')) {
        return false;
      }

      // Search by title, intent, or script
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = job.title?.toLowerCase().includes(query);
        const matchesIntent = job.detected_intent?.toLowerCase().includes(query);
        const matchesScript = job.script?.toLowerCase().includes(query);
        const matchesStage = job.current_stage?.toLowerCase().includes(query);
        return matchesTitle || matchesIntent || matchesScript || matchesStage;
      }

      return true;
    });
  }, [history, statusFilter, searchQuery]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m >= 60) {
      const h = (m / 60).toFixed(1);
      return `${h}h (${seconds.toFixed(0)}s)`;
    }
    if (m > 0) {
      return `${m}m ${s > 0 ? `${s}s` : ''}`;
    }
    return `${s}s`;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              Generation History
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
                {history.length}
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Track past renders, preview videos, and re-generate anytime.
            </p>
          </div>
        </div>

        {/* Global Batch Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="h-8 px-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh generation history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {purgedCount > 0 && onClearHistory && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove ${purgedCount} purged records from history?`)) {
                  onClearHistory('purged');
                }
              }}
              disabled={isDeleting}
              className="h-8 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Clear history records whose video files were purged from disk"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Purged ({purgedCount})</span>
            </button>
          )}

          {failedCount > 0 && onClearHistory && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove ${failedCount} failed records from history?`)) {
                  onClearHistory('failed');
                }
              }}
              disabled={isDeleting}
              className="h-8 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Clear failed and cancelled render records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Failed ({failedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 text-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            All ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'available'
                ? 'bg-emerald-500 text-white font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ready ({availableCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('purged')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'purged'
                ? 'bg-stone-700 text-white font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-500" />
            <span>Purged ({purgedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'failed'
                ? 'bg-rose-500 text-white font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failed ({failedCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, intent, script..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white/50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-2xl p-12 text-center text-stone-400">
          <Film className="w-9 h-9 mx-auto mb-3 text-stone-400 dark:text-stone-600 opacity-60" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            {searchQuery || statusFilter !== 'all' ? 'No matching generations found' : 'No previous generations'}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search query or switching the status filter tab.'
              : 'Create and render a meditation video from the Studio tab to view history.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHistory.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed' || job.status === 'cancelled';
            const isFileReady = isCompleted && Boolean(job.file_exists && job.download_url);
            const isPurged = isCompleted && !job.file_exists;
            const isPreviewOpen = previewingJobId === job.job_id;
            const isScriptOpen = expandedScriptJobId === job.job_id;

            return (
              <div
                key={job.job_id}
                className={`bg-white dark:bg-stone-900/70 border rounded-2xl p-4 sm:p-5 transition-all shadow-xs ${
                  isFileReady
                    ? 'border-stone-200/90 dark:border-stone-800 hover:border-emerald-500/40'
                    : isPurged
                    ? 'border-stone-200/80 dark:border-stone-800/80 opacity-95'
                    : 'border-rose-200/80 dark:border-rose-900/40'
                }`}
              >
                {/* Card Top: Title, Status Badge, Metadata Tags & Delete Action */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white truncate">
                        {job.title || 'Untitled Meditation Video'}
                      </h3>

                      {/* Dynamic Smart Status Badges */}
                      {isFileReady && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Ready to Download
                        </span>
                      )}

                      {isPurged && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1"
                          title="The video file was deleted during storage purge to reclaim disk space."
                        >
                          <HardDrive className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Storage Purged
                        </span>
                      )}

                      {isFailed && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Failed
                        </span>
                      )}

                      {/* Format tag */}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700/60">
                        {job.aspect_ratio || '16:9'} • {job.resolution || '1080p'}
                      </span>
                    </div>

                    {/* Intent Tag */}
                    {job.detected_intent && (
                      <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                        <span className="text-stone-400 font-normal">Intent:</span>
                        <span>{job.detected_intent}</span>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  {onDeleteItem && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${job.title || 'this generation'}" from history?`)) {
                          onDeleteItem(job.job_id);
                        }
                      }}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                      title="Delete record from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Metadata Details Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 dark:text-stone-400 pt-2.5">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {formatDuration(job.duration)}
                  </span>

                  <span className="flex items-center gap-1 font-mono">
                    <Film className="w-3.5 h-3.5 text-stone-400" />
                    {job.number_of_clips} clips ({job.number_of_new_clips} new, {job.number_of_reused_clips} reused)
                  </span>

                  {job.repeat_count > 0 && (
                    <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      <Repeat className="w-3.5 h-3.5" />
                      {job.repeat_count} {job.repeat_count === 1 ? 'loop' : 'loops'}
                    </span>
                  )}

                  {job.render_date && (
                    <span className="text-stone-400 dark:text-stone-500">
                      {new Date(job.render_date).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  )}

                  {job.script && (
                    <button
                      type="button"
                      onClick={() => setExpandedScriptJobId(isScriptOpen ? null : job.job_id)}
                      className="text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <span>{isScriptOpen ? 'Hide Script' : 'View Script'}</span>
                      {isScriptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Collapsible Script Preview */}
                {isScriptOpen && job.script && (
                  <div className="mt-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-xs font-mono text-stone-800 dark:text-stone-200 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
                    {job.script}
                  </div>
                )}

                {/* Failure Diagnostic Box */}
                {isFailed && (job.error_message || job.current_stage) && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-rose-900 dark:text-rose-200 block">Failure Reason</span>
                      <p className="font-mono text-[11px] opacity-90 break-words leading-relaxed">
                        {job.error_message || job.current_stage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Inline Video Player Drawer */}
                {isPreviewOpen && job.stream_url && (
                  <div className="mt-3.5 p-3 rounded-2xl bg-black border border-stone-800 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between text-xs text-stone-300 px-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        <MonitorPlay className="w-4 h-4 text-amber-400" />
                        In-Browser Video Preview
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewingJobId(null)}
                        className="p-1 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Close preview"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden bg-stone-950 aspect-video flex items-center justify-center max-h-[420px]">
                      <video
                        src={job.stream_url}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 mt-3 border-t border-stone-100 dark:border-stone-800/80">
                  {/* Left info status or action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* When file is ready on disk: Full Download + Preview buttons */}
                    {isFileReady && (
                      <>
                        <a
                          href={job.download_url}
                          download
                          className="h-8 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download MP4</span>
                        </a>

                        {job.stream_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewingJobId(isPreviewOpen ? null : job.job_id)}
                            className={`h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isPreviewOpen
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-400'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
                            }`}
                          >
                            {isPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isPreviewOpen ? 'Close Preview' : 'Preview Video'}</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* When file is purged from disk: Clear notice with no broken link */}
                    {isPurged && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 py-1">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Video file was purged to reclaim disk space. Click below to re-render.</span>
                      </div>
                    )}
                  </div>

                  {/* Right side: Re-run in Studio */}
                  {onReuseInStudio && (
                    <button
                      type="button"
                      onClick={() => onReuseInStudio(job)}
                      className="h-8 px-3 rounded-xl bg-stone-100 dark:bg-stone-800/90 hover:bg-amber-500 hover:text-stone-950 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                      title="Load prompt and parameters back into the Studio editor"
                    >
                      {isPurged ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 group-hover:text-stone-950" />
                          <span>Re-generate in Studio</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-run in Studio</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
