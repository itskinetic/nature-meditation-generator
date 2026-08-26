import React from 'react';
import { Sparkles, Film, Database, History, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  activeTab: 'generator' | 'library' | 'history';
  setActiveTab: (tab: 'generator' | 'library' | 'history') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  setIsDark,
}) => {
  return (
    <header className="border-b border-stone-200/80 dark:border-stone-800/80 bg-white/85 dark:bg-[#0c0e12]/85 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950 font-bold" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-1.5">
              <span className="truncate">ZenHub</span>
              <span className="hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/40">
                Studio
              </span>
            </h1>
          </div>
        </div>

        {/* Navigation Tabs & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <nav className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800">
            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'generator'
                  ? 'bg-white dark:bg-amber-500 text-stone-900 dark:text-stone-950 shadow-sm font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-stone-950 shrink-0" />
              <span>Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-white dark:bg-amber-500 text-stone-900 dark:text-stone-950 shadow-sm font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-stone-950 shrink-0" />
              <span className="hidden xs:inline">Library</span>
              <span className="xs:hidden">Lib</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-amber-500 text-stone-900 dark:text-stone-950 shadow-sm font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-stone-950 shrink-0" />
              <span>History</span>
            </button>
          </nav>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Switch to Light theme' : 'Switch to Night theme'}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900/90 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-amber-400 transition-all shrink-0"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
