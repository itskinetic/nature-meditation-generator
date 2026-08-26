import React from 'react';
import { History, Film, Download, CheckCircle2, AlertCircle, Clock, Repeat } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  isLoading: boolean;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center">
            <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">Generation History</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">{history.length} completed and past rendering sessions</p>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white/50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-2xl p-12 text-center text-stone-400">
          <Film className="w-8 h-8 mx-auto mb-3 text-stone-400 dark:text-stone-600" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">No previous generations</p>
          <p className="text-xs text-stone-500 mt-1">Start generating a meditation video from the Studio tab to view history.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((job) => (
            <div
              key={job.job_id}
              className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-6 shadow-sm dark:shadow-lg hover:border-amber-300 dark:hover:border-stone-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                    {job.title || 'Untitled Meditation Video'}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize flex items-center gap-1 ${
                      job.status === 'completed'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 shadow-sm'
                        : job.status === 'failed'
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-900/50 shadow-sm'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                    {job.status === 'failed' && <AlertCircle className="w-3 h-3 text-rose-500" />}
                    {job.status}
                  </span>
                </div>

                {job.detected_intent && (
                  <p className="text-xs text-amber-700 dark:text-amber-400/90 font-medium">
                    Intent: {job.detected_intent}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Duration: {(job.duration / 60).toFixed(1)}m ({job.duration.toFixed(0)}s)
                  </span>

                  <span className="flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-stone-400" />
                    Clips: {job.number_of_clips} (Reused: {job.number_of_reused_clips}, New: {job.number_of_new_clips})
                  </span>

                  {job.repeat_count > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                      <Repeat className="w-3.5 h-3.5" />
                      Loops: {job.repeat_count}
                    </span>
                  )}

                  {job.render_date && (
                    <span className="text-stone-400 dark:text-stone-500">
                      {new Date(job.render_date).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {job.status === 'completed' && job.download_url && (
                <div className="flex items-center gap-3">
                  <a
                    href={job.download_url}
                    download
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 text-xs font-semibold transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download MP4
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
