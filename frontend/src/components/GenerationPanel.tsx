import React from 'react';
import {
  CheckCircle2, AlertCircle, RefreshCw,
  Download, XCircle, Sparkles
} from 'lucide-react';
import { JobDetail, JobProgress } from '../types';

interface GenerationPanelProps {
  job: JobDetail | JobProgress | null;
  onCancel: () => void;
  isCancelling: boolean;
}

export const GenerationPanel: React.FC<GenerationPanelProps> = ({
  job,
  onCancel,
  isCancelling,
}) => {
  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isRunning = !isCompleted && !isFailed && job.status !== 'cancelled';

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-7 animate-in fade-in duration-300 transition-colors duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">Generation Status & Render</h2>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {isCancelling ? 'Cancelling...' : 'Cancel Job'}
            </button>
          )}

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1.5 ${
              isCompleted
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 shadow-sm'
                : isFailed
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-900/50 shadow-sm'
                : 'bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/40 animate-pulse'
            }`}
          >
            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            {isFailed && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
            {isRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />}
            {job.status}
          </span>
        </div>
      </div>

      {/* Progress Bar & Stage */}
      <div className="space-y-2.5">
        <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
          <span className="text-stone-900 dark:text-stone-200">{job.current_stage || 'Processing...'}</span>
          <span className="font-mono text-amber-600 dark:text-amber-400">{job.progress}%</span>
        </div>
        <div className="w-full h-3 bg-stone-100 dark:bg-stone-950 rounded-full overflow-hidden border border-stone-200 dark:border-stone-800/80">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isFailed ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600'
            }`}
            style={{ width: `${Math.max(5, job.progress)}%` }}
          />
        </div>
      </div>

      {/* Generation Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Candidates</span>
          <span className="text-base font-bold text-stone-800 dark:text-stone-200">{job.candidate_count}</span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Approved</span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-400">{job.approved_video_count}</span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Filtered Out</span>
          <span className="text-base font-bold text-rose-600 dark:text-rose-400">{job.rejected_video_count}</span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Reused</span>
          <span className="text-base font-bold text-amber-700 dark:text-amber-300">{job.reused_video_count}</span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">New Clips</span>
          <span className="text-base font-bold text-stone-800 dark:text-stone-200">{job.new_video_count}</span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Seq Duration</span>
          <span className="text-base font-bold text-stone-800 dark:text-stone-200">
            {job.estimated_sequence_duration ? `${job.estimated_sequence_duration.toFixed(0)}s` : '--'}
          </span>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-3 text-center">
          <span className="text-[10px] uppercase text-stone-500 dark:text-stone-400 font-semibold block">Repeats</span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-300">{job.expected_repeat_count}</span>
        </div>
      </div>

      {/* Error display if failed */}
      {isFailed && job.error_message && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Generation Error</p>
            <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">{job.error_message}</p>
          </div>
        </div>
      )}

      {/* Completed Video Player & Actions */}
      {isCompleted && (
        <div className="space-y-4 pt-2 border-t border-stone-200 dark:border-stone-800/80">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-stone-200 dark:border-stone-800 shadow-xl">
            <video
              src={`/api/jobs/${job.job_id}/preview`}
              controls
              autoPlay
              loop
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Final render verified & stored locally.
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/jobs/${job.job_id}/download`}
                download
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/20"
              >
                <Download className="w-4 h-4" />
                Download Final MP4
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
