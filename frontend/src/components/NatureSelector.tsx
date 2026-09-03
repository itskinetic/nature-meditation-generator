import React, { useState } from 'react';
import {
  Trees, CheckCircle2, Circle, Plus,
  Sliders, Sparkles, RefreshCw, Wand2, Search
} from 'lucide-react';
import { Preset } from '../types';

export interface SelectedNatureItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  clipCount: number;
  queries: string[];
  isCustom?: boolean;
}

interface NatureSelectorProps {
  presets: Record<string, Preset>;
  selectedNatures: Record<string, SelectedNatureItem>;
  setSelectedNatures: React.Dispatch<React.SetStateAction<Record<string, SelectedNatureItem>>>;
  targetTotalClips: number;
  onSearchSelectedNatures: (spec: SelectedNatureItem[]) => void;
  isSearching: boolean;
}

export const NatureSelector: React.FC<NatureSelectorProps> = ({
  presets,
  selectedNatures,
  setSelectedNatures,
  targetTotalClips,
  onSearchSelectedNatures,
  isSearching,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [customName, setCustomName] = useState<string>('');
  const [customQueries, setCustomQueries] = useState<string>('');
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);

  // Toggle selection of a preset nature theme
  const toggleNature = (preset: Preset) => {
    setSelectedNatures((prev) => {
      const next = { ...prev };
      if (next[preset.id]) {
        delete next[preset.id];
      } else {
        const count = Math.max(5, Math.round(targetTotalClips / (Object.keys(next).length + 1)) || 10);
        next[preset.id] = {
          id: preset.id,
          name: preset.name,
          icon: preset.icon || '🌲',
          category: preset.category || 'Nature',
          clipCount: count,
          queries: preset.queries,
        };
      }
      return next;
    });
  };

  // Update clip count for a selected theme
  const updateClipCount = (id: string, count: number) => {
    setSelectedNatures((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          clipCount: Math.max(1, count),
        },
      };
    });
  };

  // Auto balance clips evenly across all currently selected themes
  const autoBalanceClips = () => {
    const keys = Object.keys(selectedNatures);
    if (keys.length === 0) return;
    const countPerTheme = Math.max(1, Math.floor(targetTotalClips / keys.length));
    const remainder = targetTotalClips % keys.length;

    setSelectedNatures((prev) => {
      const next = { ...prev };
      keys.forEach((k, idx) => {
        next[k] = {
          ...next[k],
          clipCount: countPerTheme + (idx < remainder ? 1 : 0),
        };
      });
      return next;
    });
  };

  // Add custom nature theme
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const qList = customQueries
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);

    const customId = `custom_${Date.now()}`;
    setSelectedNatures((prev) => ({
      ...prev,
      [customId]: {
        id: customId,
        name: customName.trim(),
        icon: '✨',
        category: 'Custom',
        clipCount: 4,
        queries: qList.length > 0 ? qList : [customName.trim()],
        isCustom: true,
      },
    }));

    setCustomName('');
    setCustomQueries('');
    setShowCustomForm(false);
  };

  // Quick preset mixes
  const selectNatureMix = () => {
    const defaultIds = ['sunlit_forest', 'calm_ocean', 'wildflower_meadow', 'mountain_lake'];
    const newSelected: Record<string, SelectedNatureItem> = {};
    const countPer = Math.max(2, Math.floor(targetTotalClips / 4));

    defaultIds.forEach((id) => {
      const p = presets[id];
      if (p) {
        newSelected[p.id] = {
          id: p.id,
          name: p.name,
          icon: p.icon || '🌲',
          category: p.category || 'Nature',
          clipCount: countPer,
          queries: p.queries,
        };
      }
    });
    setSelectedNatures(newSelected);
  };

  const clearAll = () => {
    setSelectedNatures({});
  };

  // Calculate totals
  const selectedList = Object.values(selectedNatures);
  const totalAllocatedClips = selectedList.reduce((acc, curr) => acc + curr.clipCount, 0);

  // Search candidate videos for all selected natures
  const handleTriggerSearch = () => {
    onSearchSelectedNatures(selectedList);
  };

  // Available categories
  const categories = ['all', 'Forest', 'Water', 'Meadow', 'Sky', 'Mountain', 'Zen', 'Flora'];

  const uniquePresets = Array.from(new Map(Object.values(presets).map((p) => [p.id, p])).values());
  const filteredPresetList = uniquePresets.filter((p) => {
    if (filterCategory === 'all') return true;
    return p.category === filterCategory;
  });

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-7 transition-colors duration-200">
      {/* Section Header & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-3">
          <Trees className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">
                Choose Your Nature Themes & Clip Breakdown
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700/60 font-mono">
                {selectedList.length} themes • {totalAllocatedClips} clips
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Click to select the types of nature you want in your video, and specify how many clips for each theme.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectNatureMix}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-stone-700 dark:text-stone-300 hover:text-amber-900 dark:hover:text-amber-300 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Popular 4-Theme Mix</span>
          </button>

          {selectedList.length > 0 && (
            <>
              <button
                type="button"
                onClick={autoBalanceClips}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3 text-stone-500" />
                <span>Auto-Balance ({targetTotalClips} clips)</span>
              </button>

              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-stone-500 hover:text-rose-600 transition-colors"
              >
                Clear
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Custom Nature</span>
          </button>
        </div>
      </div>

      {/* Custom Nature Form */}
      {showCustomForm && (
        <form
          onSubmit={handleAddCustom}
          className="bg-amber-50/40 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 rounded-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Add Custom Nature Environment
            </h3>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                Environment Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Nordic Fjords, Bamboo Grove, Golden Sand Dunes"
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                Search Keywords (comma separated)
              </label>
              <input
                type="text"
                value={customQueries}
                onChange={(e) => setCustomQueries(e.target.value)}
                placeholder="e.g. nordic fjord reflection, clear mountain fjord, green fjord cliff"
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Add Nature Theme to Selection
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-stone-400 font-semibold mr-1">Filter:</span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
              filterCategory === cat
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 20 Nature Themes Grid with Selection & Clip Stepper */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPresetList.map((preset) => {
          const isSelected = !!selectedNatures[preset.id];
          const item = selectedNatures[preset.id];

          return (
            <div
              key={preset.id}
              onClick={() => toggleNature(preset)}
              className={`rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between space-y-3 select-none ${
                isSelected
                  ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/80 shadow-md transform -translate-y-0.5'
                  : 'bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800/80 hover:border-amber-300 dark:hover:border-stone-700 opacity-80 hover:opacity-100'
              }`}
            >
              {/* Header: Icon, Name & Checkmark */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl leading-none">{preset.icon || '🌲'}</span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-white leading-tight">
                      {preset.name}
                    </h4>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
                      {preset.category}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
                  ) : (
                    <Circle className="w-4 h-4 text-stone-300 dark:text-stone-700" />
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                {preset.description}
              </p>

              {/* Bottom: Clip Count Allocation (Only if selected) */}
              {isSelected && item && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-2 border-t border-amber-200/60 dark:border-amber-800/50 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                    Clip Count:
                  </span>
                  <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700/60 rounded-lg px-2 py-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => updateClipCount(preset.id, item.clipCount - 1)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:text-amber-600"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={item.clipCount}
                      onChange={(e) => updateClipCount(preset.id, Number(e.target.value))}
                      className="w-8 text-center font-bold text-xs text-amber-700 dark:text-amber-300 bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateClipCount(preset.id, item.clipCount + 1)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:text-amber-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Search CTA Footer */}
      {selectedList.length > 0 && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Selected <span className="font-bold text-stone-900 dark:text-stone-200">{selectedList.length} nature themes</span> allocating <span className="font-bold text-amber-700 dark:text-amber-300">{totalAllocatedClips} video clips</span>.
          </p>

          <button
            type="button"
            onClick={handleTriggerSearch}
            disabled={isSearching}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 font-bold text-xs transition-all shadow-md shadow-amber-500/25 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>{isSearching ? 'Searching Nature Footage...' : `Find Footage for ${selectedList.length} Selected Themes`}</span>
          </button>
        </div>
      )}
    </div>
  );
};
