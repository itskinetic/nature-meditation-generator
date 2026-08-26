import React, { useRef, useState } from 'react';
import {
  Sparkles, Music, VolumeX, Upload, Trees, Waves, Mountain, Sun, Cloud,
  Flower2, Leaf, Droplets, Compass, CheckCircle2, Circle, Plus, RefreshCw,
  Search, Sliders, Wand2, ChevronDown, ChevronUp, X, Check, Eye
} from 'lucide-react';
import { GenerationRequest, Preset, IntentAnalysisResult } from '../types';
import { SelectedNatureItem } from './NatureSelector';

export interface IntentPreset {
  id: string;
  name: string;
  tagline: string;
  themeIds: string[];
}

export const INTENT_PRESETS: IntentPreset[] = [
  {
    id: 'heart_opening',
    name: 'Heart Opening & Peace',
    tagline: 'Gentle warmth, blooming petals & sunlit foliage',
    themeIds: ['wildflower_meadow', 'cherry_blossoms', 'calm_ocean', 'sunlit_forest'],
  },
  {
    id: 'deep_sleep',
    name: 'Deep Sleep & Slumber',
    tagline: 'Soothing waves, quiet clouds & twilight glow',
    themeIds: ['calm_ocean', 'ethereal_clouds', 'sunset_twilight', 'mountain_lake'],
  },
  {
    id: 'zen_mindfulness',
    name: 'Zen Focus & Stillness',
    tagline: 'Tranquil bamboo, lotus ponds & quiet stream stones',
    themeIds: ['bamboo_groves', 'lotus_ponds', 'riverbed_pebbles', 'fern_canyon'],
  },
  {
    id: 'morning_vitality',
    name: 'Morning Vitality & Light',
    tagline: 'Golden morning light, cascades & sun-drenched hills',
    themeIds: ['golden_sunrise', 'cascading_waterfalls', 'golden_grasslands', 'sunlit_forest'],
  },
  {
    id: 'inner_clarity',
    name: 'Clarity & Mountain Peace',
    tagline: 'Mirror alpine lakes, crisp ridges & pure horizons',
    themeIds: ['mountain_lake', 'alpine_valleys', 'ethereal_clouds', 'sandy_beach'],
  },
  {
    id: 'tropical_grounding',
    name: 'Tropical Paradise',
    tagline: 'Turquoise lagoons, lush rainforests & soft sand',
    themeIds: ['tropical_lagoons', 'lush_rainforest', 'sandy_beach', 'calm_ocean'],
  },
  {
    id: 'gratitude_warmth',
    name: 'Warmth & Gratitude',
    tagline: 'Autumn golden foliage, sandstone & sunset glow',
    themeIds: ['autumn_woodlands', 'desert_dunes', 'golden_sunrise', 'sunset_twilight'],
  },
];

const renderNatureIcon = (category: string, id: string) => {
  const cat = (category || '').toLowerCase();
  const nameId = (id || '').toLowerCase();
  const iconClass = "w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0";

  if (cat.includes('forest') || nameId.includes('woodland') || nameId.includes('tree') || nameId.includes('rainforest')) {
    return <Trees className={iconClass} />;
  }
  if (cat.includes('water') || nameId.includes('ocean') || nameId.includes('wave') || nameId.includes('sea') || nameId.includes('beach') || nameId.includes('lagoon')) {
    return <Waves className={iconClass} />;
  }
  if (nameId.includes('waterfall') || nameId.includes('cascade') || nameId.includes('stream')) {
    return <Droplets className={iconClass} />;
  }
  if (cat.includes('mountain') || nameId.includes('lake') || nameId.includes('valley') || nameId.includes('alpine')) {
    return <Mountain className={iconClass} />;
  }
  if (cat.includes('meadow') || nameId.includes('grass') || nameId.includes('pasture')) {
    return <Leaf className={iconClass} />;
  }
  if (cat.includes('flora') || nameId.includes('flower') || nameId.includes('blossom') || nameId.includes('lotus')) {
    return <Flower2 className={iconClass} />;
  }
  if (cat.includes('sky') || nameId.includes('sunrise') || nameId.includes('sun') || nameId.includes('sunset')) {
    return <Sun className={iconClass} />;
  }
  if (nameId.includes('cloud') || nameId.includes('fog') || nameId.includes('mist')) {
    return <Cloud className={iconClass} />;
  }
  if (cat.includes('zen') || nameId.includes('bamboo') || nameId.includes('pebble')) {
    return <Compass className={iconClass} />;
  }
  return <Sparkles className={iconClass} />;
};

interface StudioSetupProps {
  title: string;
  setTitle: (val: string) => void;
  script: string;
  setScript: (val: string) => void;
  settings: GenerationRequest;
  setSettings: React.Dispatch<React.SetStateAction<GenerationRequest>>;
  presets: Record<string, Preset>;
  selectedNatures: Record<string, SelectedNatureItem>;
  setSelectedNatures: React.Dispatch<React.SetStateAction<Record<string, SelectedNatureItem>>>;
  onUploadMusic: (file: File) => void;
  isUploadingMusic: boolean;
  customMusicName?: string;
  onSearchFootage: () => void;
  isSearching: boolean;
  onAutoPlanAI: () => void;
  isPlanningAI: boolean;
  analysis?: IntentAnalysisResult | null;
  excludeAllHistory?: boolean;
  setExcludeAllHistory?: (val: boolean) => void;
}

export const StudioSetup: React.FC<StudioSetupProps> = ({
  title,
  setTitle,
  script,
  setScript,
  settings,
  setSettings,
  presets,
  selectedNatures,
  setSelectedNatures,
  onUploadMusic,
  isUploadingMusic,
  customMusicName,
  onSearchFootage,
  isSearching,
  onAutoPlanAI,
  isPlanningAI,
  analysis,
  excludeAllHistory = false,
  setExcludeAllHistory,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeIntentPreset, setActiveIntentPreset] = useState<string | null>('heart_opening');
  const [showManualThemes, setShowManualThemes] = useState<boolean>(false);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customQueries, setCustomQueries] = useState<string>('');

  const updateSetting = <K extends keyof GenerationRequest>(key: K, value: GenerationRequest[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Apply an intent preset (automatically picks 4 fitting nature themes)
  const applyIntentPreset = (intent: IntentPreset) => {
    setActiveIntentPreset(intent.id);
    const newSelected: Record<string, SelectedNatureItem> = {};
    const countPer = Math.max(2, Math.floor(settings.maximum_unique_videos / intent.themeIds.length));

    intent.themeIds.forEach((id) => {
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

  // Remove a theme from active plan
  const removeNature = (id: string) => {
    setSelectedNatures((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Toggle selection of a preset nature theme manually
  const toggleNature = (preset: Preset) => {
    setActiveIntentPreset(null); // Clear active preset label when user customizes
    setSelectedNatures((prev) => {
      const next = { ...prev };
      if (next[preset.id]) {
        delete next[preset.id];
      } else {
        const count = Math.max(2, Math.round(settings.maximum_unique_videos / (Object.keys(next).length + 1)) || 4);
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
    const countPerTheme = Math.max(1, Math.floor(settings.maximum_unique_videos / keys.length));
    const remainder = settings.maximum_unique_videos % keys.length;

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

  const selectedList = Object.values(selectedNatures);
  const totalAllocatedClips = selectedList.reduce((acc, curr) => acc + curr.clipCount, 0);

  const categories = ['all', 'Forest', 'Water', 'Meadow', 'Sky', 'Mountain', 'Zen', 'Flora'];
  const uniquePresets = Array.from(new Map(Object.values(presets).map((p) => [p.id, p])).values());
  const filteredPresetList = uniquePresets.filter((p) => {
    if (filterCategory === 'all') return true;
    return p.category === filterCategory;
  });

  return (
    <div className="bg-white dark:bg-stone-900/80 border border-stone-200/90 dark:border-stone-800/80 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-5 sm:space-y-6 transition-colors duration-200">
      
      {/* 1. CONCEPT & AI SCRIPT DIRECTOR */}
      <div className="space-y-3.5">
        <div className="pb-3 border-b border-stone-200 dark:border-stone-800/80">
          <h2 className="text-base font-semibold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Meditation Concept & AI Script Director</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Enter your meditation title or guidance script to automatically discover matching nature themes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Title Input */}
          <div className="lg:col-span-5 space-y-1">
            <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Meditation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Softening the Heart, Morning Awakening, Deep Sleep..."
              className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Guidance Script Input */}
          <div className="lg:col-span-7 space-y-1">
            <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Script or Spoken Guidance <span className="text-stone-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste guidance script to extract emotional intent, pace, and visual metaphors..."
              className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Action button placed directly below the inputs (left-aligned) */}
        <div className="flex justify-start pt-0.5">
          <button
            type="button"
            onClick={onAutoPlanAI}
            disabled={isPlanningAI || !title.trim()}
            className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-800/60 disabled:opacity-50 text-amber-950 dark:text-amber-200 font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{isPlanningAI ? 'Analyzing Script...' : 'Analyze & Suggest Themes'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUGGESTED VISUAL JOURNEY (Primary Interactive Visual Stage) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
              Suggested Visual Journey
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
              {selectedList.length} Themes • {totalAllocatedClips} Clips
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedList.length > 0 && (
              <button
                type="button"
                onClick={autoBalanceClips}
                className="h-9 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                <span>Balance Clips</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="h-9 px-3.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 font-medium text-xs flex items-center gap-1 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>Custom Theme</span>
            </button>
          </div>
        </div>

        {/* AI Intent & Mood Metadata Banner */}
        {analysis && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 rounded-xl bg-white/90 dark:bg-stone-900/90 border border-amber-200/60 dark:border-amber-800/40 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-semibold text-stone-500 dark:text-stone-400">Detected Intent:</span>
              <span className="font-medium text-stone-800 dark:text-stone-200 italic truncate">"{analysis.intent}"</span>
            </div>
            {analysis.mood && analysis.mood.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {analysis.mood.slice(0, 3).map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Themes Review List */}
        {selectedList.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">
            No themes active. Click <strong>"Analyze & Suggest Themes"</strong> above or pick themes from the manual list below.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {selectedList.map((item) => (
              <div
                key={item.id}
                className="h-9 flex items-center justify-between gap-2.5 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800/90 shadow-xs hover:border-amber-400/60 dark:hover:border-amber-600/60 transition-colors shrink-0"
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {renderNatureIcon(item.category, item.id)}
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Clip Stepper */}
                  <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-1.5 py-0.5">
                    <button
                      type="button"
                      onClick={() => updateClipCount(item.id, item.clipCount - 1)}
                      className="text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white px-0.5 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 w-3.5 text-center">
                      {item.clipCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateClipCount(item.id, item.clipCount + 1)}
                      className="text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white px-0.5 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Remove Theme Button */}
                  <button
                    type="button"
                    onClick={() => removeNature(item.id)}
                    title="Remove theme from plan"
                    className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Nature Inline Form */}
        {showCustomForm && (
          <form
            onSubmit={handleAddCustom}
            className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Theme name (e.g. Nordic Fjords)"
                className="h-9 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 text-xs text-stone-900 dark:text-white"
                required
              />
              <input
                type="text"
                value={customQueries}
                onChange={(e) => setCustomQueries(e.target.value)}
                placeholder="Search keywords (e.g. fjord calm water)"
                className="h-9 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 text-xs text-stone-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomForm(false)}
                className="h-9 px-3.5 rounded-xl text-xs text-stone-500 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-3.5 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 font-medium rounded-xl text-xs transition-colors cursor-pointer"
              >
                Add to Plan
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 3. COMPACT MANUAL THEME SELECTOR (Collapsible Accordion) */}
      <div className="border border-stone-200/80 dark:border-stone-800/80 rounded-2xl overflow-hidden bg-stone-50/50 dark:bg-stone-950/30">
        <button
          type="button"
          onClick={() => setShowManualThemes(!showManualThemes)}
          className="w-full flex items-center justify-between p-3 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100/70 dark:hover:bg-stone-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-stone-400" />
            <span>Customize / Pick Themes Manually (20 Nature Environments)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-400">{showManualThemes ? 'Hide' : 'Show'}</span>
            {showManualThemes ? <ChevronUp className="w-3.5 h-3.5 text-stone-400" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
          </div>
        </button>

        {showManualThemes && (
          <div className="p-4 border-t border-stone-200/80 dark:border-stone-800 space-y-3 animate-in fade-in duration-200">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                    filterCategory === cat
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                      : 'bg-stone-200/70 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Compact Themes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1">
              {filteredPresetList.map((preset) => {
                const isSelected = !!selectedNatures[preset.id];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => toggleNature(preset)}
                    className={`h-9 flex items-center justify-between px-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-100/70 dark:bg-amber-950/60 border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 shadow-xs font-medium'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                      {renderNatureIcon(preset.category, preset.id)}
                      <span className="text-xs font-medium truncate">{preset.name}</span>
                    </div>
                    {isSelected ? <Check className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" /> : <div className="w-3.5 h-3.5 rounded border border-stone-300 dark:border-stone-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. SETTINGS & HISTORY REUSE CONTROLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 pt-3 border-t border-stone-200 dark:border-stone-800">
        {/* Target Duration */}
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Target Duration
          </label>
          <div className="flex h-9 w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/70 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500">
            <input
              type="number"
              min={1}
              max={360}
              value={settings.target_duration}
              onChange={(e) => updateSetting('target_duration', Number(e.target.value))}
              className="w-1/2 h-full bg-transparent px-3 text-xs font-semibold text-stone-900 dark:text-white focus:outline-none"
            />
            <div className="w-[1px] h-4 my-auto bg-stone-300 dark:bg-stone-800" />
            <select
              value={settings.duration_unit}
              onChange={(e) => updateSetting('duration_unit', e.target.value as any)}
              className="w-1/2 h-full bg-transparent px-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="minutes">Mins</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>

        {/* Format & Quality */}
        <div className="lg:col-span-4 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Format & Quality
          </label>
          <div className="flex h-9 gap-1.5 w-full">
            <div className="flex-1 p-0.5 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 flex items-center gap-0.5">
              {(['16:9', '9:16', '1:1'] as const).map((ar) => (
                <button
                  key={ar}
                  type="button"
                  onClick={() => updateSetting('aspect_ratio', ar)}
                  className={`flex-1 h-full rounded-lg text-xs font-medium transition-all ${
                    settings.aspect_ratio === ar
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {ar}
                </button>
              ))}
            </div>
            <div className="w-24 p-0.5 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 flex items-center gap-0.5">
              {(['1080p', '4K'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => updateSetting('resolution', res)}
                  className={`flex-1 h-full rounded-lg text-xs font-medium transition-all ${
                    settings.resolution === res
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Shot Diversity Selector */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Cinematic Shot Cadence
          </label>
          <select
            value={settings.shot_preference || 'balanced'}
            onChange={(e) => updateSetting('shot_preference', e.target.value as any)}
            className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 text-xs font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
          >
            <option value="balanced">Balanced Variety</option>
            <option value="macro">Mindful Close-Ups</option>
            <option value="still">Deep Stillness</option>
            <option value="wide">Expansive Vistas</option>
          </select>
        </div>

        {/* History Control Toggle */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            History Filter
          </label>
          <label className="h-9 flex items-center justify-between px-3.5 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl cursor-pointer hover:border-stone-300 dark:hover:border-stone-700 transition-colors">
            <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Exclude Past History
            </span>
            <input
              type="checkbox"
              checked={excludeAllHistory}
              onChange={(e) => setExcludeAllHistory && setExcludeAllHistory(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 5. PRIMARY ACTION BUTTON */}
      <div className="pt-3 border-t border-stone-200 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
          Target: <strong className="text-stone-900 dark:text-stone-200">{settings.target_duration} {settings.duration_unit}</strong> • <strong className="text-amber-700 dark:text-amber-400">{selectedList.length} nature themes</strong> ({totalAllocatedClips} clips) • Bright sunlit aesthetic.
        </div>

        <button
          type="button"
          onClick={onSearchFootage}
          disabled={isSearching || selectedList.length === 0}
          className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-800/60 disabled:opacity-50 text-amber-950 dark:text-amber-200 font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>{isSearching ? 'Searching & Evaluating Footage...' : `Fetch Footage for Plan (${totalAllocatedClips} clips)`}</span>
        </button>
      </div>
    </div>
  );
};
