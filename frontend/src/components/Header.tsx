import React from 'react';
import { Sparkles, Film, Database, History, Sun, Moon, Zap } from 'lucide-react';

interface HeaderProps {
  activeTab: 'generator' | 'library' | 'history';
  setActiveTab: (tab: 'generator' | 'library' | 'history') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  activeJobsCount?: number;
  onOpenQueue?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  setIsDark,
  activeJobsCount = 0,
  onOpenQueue,
}) => {
  return (
    <>
      {/* Top Header Bar */}
      <header className="border-b border-stone-200/80 dark:border-stone-800/80 bg-white/85 dark:bg-[#0c0e12]/85 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200 w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <img
              src="/logo.png"
              alt="ZenHub Logo"
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain drop-shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-normal tracking-wide text-stone-900 dark:text-white font-logo">
                ZenHub
              </h1>
            </div>
          </div>

          {/* Desktop Nav Tabs & Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Unified Navigation & Action Bar (Hidden on Mobile) */}
            <nav className="hidden sm:flex items-center gap-1 p-1 h-9 rounded-xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 box-border">
              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'generator'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Studio</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'library'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Library</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>History</span>
              </button>

              {/* Subtle divider */}
              <div className="w-px h-4 bg-stone-300/80 dark:bg-stone-700/80 mx-0.5" />

              {/* Queue Button integrated into the same bar */}
              {onOpenQueue && (
                <button
                  type="button"
                  onClick={onOpenQueue}
                  className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeJobsCount > 0
                      ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-semibold animate-pulse'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800/50'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Queue</span>
                  {activeJobsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-stone-950 dark:bg-amber-500 text-white dark:text-stone-950 text-[10px] flex items-center justify-center font-mono font-bold">
                      {activeJobsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* Mobile Queue Button (shown on mobile header) */}
            {onOpenQueue && (
              <button
                type="button"
                onClick={onOpenQueue}
                className={`sm:hidden h-8 flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  activeJobsCount > 0
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 shadow-xs animate-pulse'
                    : 'bg-stone-100/90 dark:bg-stone-900/90 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {activeJobsCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-stone-950 dark:bg-amber-500 text-white dark:text-stone-950 text-[10px] flex items-center justify-center font-mono font-bold">
                    {activeJobsCount}
                  </span>
                )}
              </button>
            )}

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Switch to Light theme' : 'Switch to Night theme'}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900/90 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-amber-400 transition-all shrink-0 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed bottom on phones) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c0e12]/95 backdrop-blur-lg border-t border-stone-200/80 dark:border-stone-800/80 px-4 py-1.5 flex items-center justify-around shadow-lg pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
            activeTab === 'generator'
              ? 'text-amber-900 dark:text-amber-200 font-semibold bg-amber-100/70 dark:bg-amber-950/70'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
            activeTab === 'library'
              ? 'text-amber-900 dark:text-amber-200 font-semibold bg-amber-100/70 dark:bg-amber-950/70'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Library</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
            activeTab === 'history'
              ? 'text-amber-900 dark:text-amber-200 font-semibold bg-amber-100/70 dark:bg-amber-950/70'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>History</span>
        </button>
      </nav>
    </>
  );
};
