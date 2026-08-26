import React, { useState } from 'react';
import {
  Sparkles, Activity, Palette, Plus, X,
  Layers, Check, Search, ChevronDown, Wand2
} from 'lucide-react';
import { IntentAnalysisResult, PlannedEnvironment, Preset } from '../types';

interface AnalysisPanelProps {
  analysis: IntentAnalysisResult | null;
  plannedEnvironments: PlannedEnvironment[];
  setPlannedEnvironments: React.Dispatch<React.SetStateAction<PlannedEnvironment[]>>;
  presets: Record<string, Preset>;
  onSearchFootage: (queries: string[]) => void;
  isSearching: boolean;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  plannedEnvironments,
  setPlannedEnvironments,
  presets,
  onSearchFootage,
  isSearching,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customEnvName, setCustomEnvName] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');
  const [newKeywordInputs, setNewKeywordInputs] = useState<Record<string, string>>({});

  if (!analysis) return null;

  // Toggle environment enable/disable
  const toggleEnv = (id: string) => {
    setPlannedEnvironments((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  // Update clip count
  const updateClipCount = (id: string, count: number) => {
    setPlannedEnvironments((prev) =>
      prev.map((e) => (e.id === id ? { ...e, suggested_clips: Math.max(1, count) } : e))
    );
  };

  // Remove keyword
  const removeKeyword = (envId: string, kwIdx: number) => {
    setPlannedEnvironments((prev) =>
      prev.map((e) =>
        e.id === envId ? { ...e, keywords: e.keywords.filter((_, i) => i !== kwIdx) } : e
      )
    );
  };

  // Add keyword
  const addKeyword = (envId: string) => {
    const val = (newKeywordInputs[envId] || '').trim();
    if (!val) return;
    setPlannedEnvironments((prev) =>
      prev.map((e) => (e.id === envId ? { ...e, keywords: [...e.keywords, val] } : e))
    );
    setNewKeywordInputs((prev) => ({ ...prev, [envId]: '' }));
  };

  // Add preset environment
  const addPresetEnvironment = (p: Preset) => {
    const newEnv: PlannedEnvironment = {
      id: p.id,
      name: p.name,
      icon: p.icon || '🌿',
      keywords: p.queries.slice(0, 3),
      suggested_clips: 4,
      enabled: true,
    };
    setPlannedEnvironments((prev) => [...prev.filter((e) => e.id !== p.id), newEnv]);
    setShowAddMenu(false);
  };

  // Add completely custom environment
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEnvName.trim()) return;
    const kws = customKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const newEnv: PlannedEnvironment = {
      id: `custom_${Date.now()}`,
      name: customEnvName.trim(),
      icon: '✨',
      keywords: kws.length > 0 ? kws : [customEnvName.trim()],
      suggested_clips: 4,
      enabled: true,
    };
    setPlannedEnvironments((prev) => [...prev, newEnv]);
    setCustomEnvName('');
    setCustomKeywords('');
    setShowAddMenu(false);
  };

  // Collect all enabled search queries
  const handleTriggerSearch = () => {
    const allQueries: string[] = [];
    plannedEnvironments
      .filter((e) => e.enabled)
      .forEach((e) => {
        allQueries.push(...e.keywords);
      });
    onSearchFootage(allQueries.length > 0 ? allQueries : analysis.generated_queries);
  };

  const enabledCount = plannedEnvironments.filter((e) => e.enabled).length;
  const totalClips = plannedEnvironments
    .filter((e) => e.enabled)
    .reduce((acc, e) => acc + e.suggested_clips, 0);

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-7 animate-in fade-in duration-300 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-2.5">
          <Wand2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">
            AI Video Director & Multi-Scene Plan
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-700/60">
            {enabledCount} scenes planned • {totalClips} target clips
          </span>
        </div>
      </div>

      {/* Aesthetic Guidelines Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Emotional Intent
          </span>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 capitalize">
            {analysis.intent}
          </p>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Atmosphere & Energy
          </span>
          <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
            {analysis.energy_level} energy • Softly Sunlit & Calm
          </p>
        </div>

        <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/70 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Visual Style
          </span>
          <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
            Bright, clear daylight nature (Gloomy excluded)
          </p>
        </div>
      </div>

      {/* Planned Environment Scene Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Planned Nature Environments ({plannedEnvironments.length})
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Customize scenes, keywords, and clip distribution before searching footage.
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300 text-xs font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Environment Theme</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {/* Dropdown Menu to Add from 20 Pre-built Themes or Custom */}
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-2xl z-40 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                {/* Custom Environment Form */}
                <form onSubmit={handleAddCustom} className="space-y-2.5 pb-3 border-b border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-bold text-stone-900 dark:text-white block">
                    Create Custom Environment
                  </span>
                  <input
                    type="text"
                    value={customEnvName}
                    onChange={(e) => setCustomEnvName(e.target.value)}
                    placeholder="e.g. Bamboo Grove, Coral Reef..."
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="text"
                    value={customKeywords}
                    onChange={(e) => setCustomKeywords(e.target.value)}
                    placeholder="Keywords (comma-separated)..."
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-lg text-xs font-bold transition-colors"
                  >
                    Add Custom Scene
                  </button>
                </form>

                {/* 20 Preset Themes */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                    Browse 20 Nature Themes
                  </span>
                  <div className="space-y-1">
                    {Object.values(presets).map((p) => {
                      const alreadyAdded = plannedEnvironments.some((e) => e.id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addPresetEnvironment(p)}
                          className="w-full text-left p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-2 font-medium text-stone-800 dark:text-stone-200 truncate">
                            <span>{p.icon || '🌿'}</span>
                            <span className="truncate">{p.name}</span>
                          </span>
                          {alreadyAdded ? (
                            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scene Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plannedEnvironments.map((env) => (
            <div
              key={env.id}
              className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between space-y-3.5 ${
                env.enabled
                  ? 'bg-stone-50 dark:bg-stone-950/60 border-amber-300/80 dark:border-amber-800/40 shadow-sm'
                  : 'bg-stone-100/60 dark:bg-stone-950/20 border-stone-200 dark:border-stone-800/60 opacity-60'
              }`}
            >
              {/* Top row: Icon, Name, Enable switch, Clip count */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">{env.icon}</span>
                  <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                    {env.name}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Clip count input */}
                  <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg px-2 py-0.5 text-xs">
                    <span className="text-stone-500 text-[10px]">Clips:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={env.suggested_clips}
                      onChange={(e) => updateClipCount(env.id, Number(e.target.value))}
                      className="w-8 bg-transparent text-center font-bold text-amber-700 dark:text-amber-300 focus:outline-none"
                    />
                  </div>

                  {/* Toggle enable button */}
                  <button
                    type="button"
                    onClick={() => toggleEnv(env.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      env.enabled
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {env.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Keywords Tag Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                  Search Keywords
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {env.keywords.map((kw, kwIdx) => (
                    <span
                      key={kwIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs border border-stone-200 dark:border-stone-800 shadow-sm"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => removeKeyword(env.id, kwIdx)}
                        className="hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {/* Inline Add Keyword Input */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="+ keyword"
                      value={newKeywordInputs[env.id] || ''}
                      onChange={(e) =>
                        setNewKeywordInputs((prev) => ({ ...prev, [env.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addKeyword(env.id);
                        }
                      }}
                      className="w-24 bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-700 rounded-lg px-2 py-0.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => addKeyword(env.id)}
                      className="p-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 text-stone-600 hover:text-amber-800 text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer: Search Footage for Configured Plan */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200 dark:border-stone-800">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Happy with the scene plan? Click search to fetch and evaluate footage from Pexels & Pixabay.
        </p>

        <button
          type="button"
          onClick={handleTriggerSearch}
          disabled={isSearching || enabledCount === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{isSearching ? 'Searching Online Footage...' : 'Search Footage for This Plan'}</span>
        </button>
      </div>
    </div>
  );
};
