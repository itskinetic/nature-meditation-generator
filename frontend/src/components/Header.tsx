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
    <header className="border-b border-stone-200/80 dark:border-stone-800/80 bg-white/85 dark:bg-[#0c0e12]/85 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200 w-full overflow-hidden">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-20 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <img
            src="/logo.png"
            alt="ZenHub Logo"
            className="w-7 h-7 sm:w-9 sm:h-9 object-contain drop-shadow-sm shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-normal tracking-wide text-stone-900 dark:text-white font-logo">
              ZenHub
            </h1>
          </div>
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Active Queue Drawer Trigger */}
          {onOpenQueue && (
            <button
              type="button"
              onClick={onOpenQueue}
              className={`h-8 sm:h-9 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                activeJobsCount > 0
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 shadow-xs animate-pulse'
                  : 'bg-stone-100/90 dark:bg-stone-900/90 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:border-amber-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Queue</span>
              {activeJobsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-stone-950 dark:bg-amber-500 text-white dark:text-stone-950 text-[10px] flex items-center justify-center font-mono font-bold">
                  {activeJobsCount}
                </span>
              )}
            </button>
          )}

          {/* Nav Tabs */}
          <nav className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800">
            <button
              onClick={() => setActiveTab('generator')}
              className={`h-7 sm:h-7.5 flex items-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'generator'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`h-7 sm:h-7.5 flex items-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Library</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`h-7 sm:h-7.5 flex items-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">History</span>
            </button>
          </nav>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Switch to Light theme' : 'Switch to Night theme'}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900/90 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-amber-400 transition-all shrink-0 cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
