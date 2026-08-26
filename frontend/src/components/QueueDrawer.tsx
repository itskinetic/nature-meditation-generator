import React from 'react';
import { createPortal } from 'react-dom';
import {
  Zap, X, Loader2, Download, Trash2, Clock, CheckCircle2,
  Film, AlertCircle
} from 'lucide-react';
import { ActiveJobItem, HistoryItem } from '../types';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeJobs: ActiveJobItem[];
  recentCompleted: HistoryItem[];
  onCancelJob: (jobId: string) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  activeJobs,
  recentCompleted,
  onCancelJob,
}) => {
  if (!isOpen) return null;

  const renderingJobs = activeJobs.filter((j) =>
    ['rendering', 'stitching', 'downloading', 'analyzing', 'evaluating'].includes(j.status)
  );
  const queuedJobs = activeJobs.filter((j) =>
    ['pending', 'queued'].includes(j.status)
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                Background Queue
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {activeJobs.length} active/queued • 2 rendering slots
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* 1. Actively Processing Jobs */}
          {renderingJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Actively Processing ({renderingJobs.length}/2 slots)</span>
              </h3>

              <div className="space-y-3">
                {renderingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                          {job.title || 'Meditation Video'}
                        </h4>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium block truncate">
                          {job.current_stage}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                        {job.progress}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(5, job.progress)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 dark:text-stone-400">
                      <span>Target: {Math.round(job.target_duration_seconds / 60)} mins</span>
                      <button
                        type="button"
                        onClick={() => onCancelJob(job.id)}
                        className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Queued Jobs Waiting Next */}
          {queuedJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Next in Line ({queuedJobs.length})</span>
              </h3>

              <div className="space-y-2">
                {queuedJobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                          {job.title || 'Queued Video'}
                        </h4>
                        <span className="text-[10px] text-stone-400 truncate block">
                          Waiting for free render slot
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCancelJob(job.id)}
                      title="Cancel queued job"
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty Queue State */}
          {activeJobs.length === 0 && (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
                <Film className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
                  No active render jobs
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto mt-1">
                  Queue videos from the Studio and they will render quietly in the background!
                </p>
              </div>
            </div>
          )}

          {/* 3. Recently Completed Jobs (With Direct Downloads) */}
          {recentCompleted.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Recently Finished</span>
              </h3>

              <div className="space-y-2">
                {recentCompleted.slice(0, 3).map((job) => (
                  <div
                    key={job.job_id}
                    className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                        {job.title || 'Completed Meditation'}
                      </h4>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">
                        {job.duration ? `${Math.round(job.duration / 60)} mins` : 'Ready'}
                      </span>
                    </div>

                    {job.download_url && (
                      <a
                        href={job.download_url}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-stone-950 text-xs font-bold transition-all shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>Concurrency: 2 slots</span>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-700 dark:text-stone-300 font-bold hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
