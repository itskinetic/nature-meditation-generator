import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HardDrive, X, Trash2, Zap, RefreshCw, AlertTriangle,
  CheckCircle2, Film, Layers, Sparkles, FolderArchive, ShieldCheck
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { StorageStats } from '../types';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: stats, isLoading, refetch, isRefetching } = useQuery<StorageStats>({
    queryKey: ['storageStats'],
    queryFn: () => api.getStorageStats(),
    enabled: isOpen,
    staleTime: 5000,
  });

  const purgeMutation = useMutation({
    mutationFn: ({ target, keepFinal }: { target: string; keepFinal: boolean }) =>
      api.purgeStorage(target, keepFinal),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['storageStats'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      setConfirmTarget(null);
      setToastMessage(`Successfully reclaimed ${data.reclaimed_mb} MB (${data.deleted_count} files removed)`);
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage(`Error: ${err.message || 'Failed to purge storage'}`);
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const totalFormatted = stats?.total.formatted || '0 MB';
  const categories = stats?.categories;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  Storage & Disk Cleaner
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50 shadow-xs">
                  {totalFormatted} Total Data
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Purge intermediate render slices and cached stock assets to free server disk space.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching || isLoading}
              title="Refresh storage metrics"
              className="p-2 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Quick 1-Click Master Purge Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>1-Click Safe Optimization</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-md">
                Deletes 100+ temporary 15s clip cuts, intermediate audio files, and search caches while <strong>preserving all your final exported videos and stock library</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => purgeMutation.mutate({ target: 'scratch_jobs', keepFinal: true })}
              disabled={purgeMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{purgeMutation.isPending ? 'Cleaning...' : 'Purge Scratch Slices'}</span>
            </button>
          </div>

          {/* Granular Categories List */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Storage Breakdown & Cleanup Actions
            </h3>

            {isLoading ? (
              <div className="py-12 text-center text-stone-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Calculating disk usage...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Scratch Jobs */}
                {categories?.scratch_jobs && (
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {categories.scratch_jobs.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-900 dark:text-amber-300">
                            {categories.scratch_jobs.formatted}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {categories.scratch_jobs.count} temporary files in <code className="text-[10px] font-mono">data/jobs</code>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => purgeMutation.mutate({ target: 'scratch_jobs', keepFinal: true })}
                      disabled={purgeMutation.isPending || categories.scratch_jobs.bytes === 0}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                    >
                      Purge Scratch
                    </button>
                  </div>
                )}

                {/* 2. API Cache & Previews */}
                {categories?.cache_previews && (
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {categories.cache_previews.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-900 dark:text-blue-300">
                            {categories.cache_previews.formatted}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {categories.cache_previews.count} cached search results & preview thumbnails
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => purgeMutation.mutate({ target: 'cache_previews', keepFinal: true })}
                      disabled={purgeMutation.isPending || categories.cache_previews.bytes === 0}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                    >
                      Clear Cache
                    </button>
                  </div>
                )}

                {/* 3. Completed Video Renders */}
                {categories?.renders && (
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 shrink-0 mt-0.5">
                        <Film className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {categories.renders.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-900 dark:text-purple-300">
                            {categories.renders.formatted}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {categories.renders.count} finished video files in <code className="text-[10px] font-mono">data/renders</code>
                        </p>
                      </div>
                    </div>

                    {confirmTarget === 'renders' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => purgeMutation.mutate({ target: 'renders', keepFinal: false })}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget(null)}
                          className="px-2 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-xs text-stone-600 dark:text-stone-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget('renders')}
                        disabled={purgeMutation.isPending || categories.renders.bytes === 0}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-rose-400 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:text-rose-600 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                      >
                        Delete Renders
                      </button>
                    )}
                  </div>
                )}

                {/* 4. Stock Video Library */}
                {categories?.library && (
                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                        <FolderArchive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {categories.library.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-900 dark:text-emerald-300">
                            {categories.library.formatted}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {categories.library.count} downloaded stock video files in <code className="text-[10px] font-mono">data/library</code>
                        </p>
                      </div>
                    </div>

                    {confirmTarget === 'library' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => purgeMutation.mutate({ target: 'library', keepFinal: false })}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget(null)}
                          className="px-2 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-xs text-stone-600 dark:text-stone-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget('library')}
                        disabled={purgeMutation.isPending || categories.library.bytes === 0}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-rose-400 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:text-rose-600 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                      >
                        Clear Library
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>SQLite database & settings are always protected</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
