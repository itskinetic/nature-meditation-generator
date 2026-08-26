import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface ContentInputProps {
  title: string;
  setTitle: (t: string) => void;
  script: string;
  setScript: (s: string) => void;
  manualIntent: string;
  setManualIntent: (i: string) => void;
  manualMood: string;
  setManualMood: (m: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const ContentInput: React.FC<ContentInputProps> = ({
  title,
  setTitle,
  script,
  setScript,
  manualIntent,
  setManualIntent,
  manualMood,
  setManualMood,
  onAnalyze,
  isAnalyzing,
}) => {
  const [showOverrides, setShowOverrides] = useState(false);

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-6 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">Meditation Content</h2>
        <button
          type="button"
          onClick={() => setShowOverrides(!showOverrides)}
          className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 font-medium transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Manual Overrides</span>
          {showOverrides ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-2">
            Meditation Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Softening the Heart, Deep Rest Mountain Lake"
            className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-2">
            Meditation Script (Optional)
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={3}
            placeholder="Paste your guided meditation text, spoken journey, or affirmations to extract nuanced emotional intent..."
            className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all resize-none"
          />
        </div>

        {showOverrides && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800/60 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Manual Intent Override
              </label>
              <input
                type="text"
                value={manualIntent}
                onChange={(e) => setManualIntent(e.target.value)}
                placeholder="e.g. deep nervous system reset"
                className="w-full bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Manual Mood Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={manualMood}
                onChange={(e) => setManualMood(e.target.value)}
                placeholder="e.g. peaceful, tranquil, warm, spacious"
                className="w-full bg-stone-50/80 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/20"
        >
          <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing Intent...' : 'Analyze Content'}
        </button>
      </div>
    </div>
  );
};
