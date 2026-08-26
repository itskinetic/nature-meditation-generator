import React, { useRef, useState } from 'react';
import {
  Sparkles, Music, VolumeX, Upload, Trees,
  CheckCircle2, Circle, Plus, RefreshCw, Search, Sliders, Wand2, Compass
} from 'lucide-react';
import { GenerationRequest, Preset } from '../types';
import { SelectedNatureItem } from './NatureSelector';

export interface IntentPreset {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  themeIds: string[];
}

export const INTENT_PRESETS: IntentPreset[] = [
  {
    id: 'heart_opening',
    name: 'Heart Opening & Peace',
    icon: '🌸',
    tagline: 'Gentle warmth, blooming petals & sunlit foliage',
    themeIds: ['wildflower_meadow', 'cherry_blossoms', 'calm_ocean', 'sunlit_forest'],
  },
  {
    id: 'deep_sleep',
    name: 'Deep Sleep & Slumber',
    icon: '🌙',
    tagline: 'Soothing waves, quiet clouds & twilight glow',
    themeIds: ['calm_ocean', 'ethereal_clouds', 'sunset_twilight', 'mountain_lake'],
  },
  {
    id: 'zen_mindfulness',
    name: 'Zen Focus & Stillness',
    icon: '🎋',
    tagline: 'Tranquil bamboo, lotus ponds & quiet stream stones',
    themeIds: ['bamboo_groves', 'lotus_ponds', 'riverbed_pebbles', 'fern_canyon'],
  },
  {
    id: 'morning_vitality',
    name: 'Morning Vitality & Light',
    icon: '☀️',
    tagline: 'Golden morning light, cascades & sun-drenched hills',
    themeIds: ['golden_sunrise', 'cascading_waterfalls', 'golden_grasslands', 'sunlit_forest'],
  },
  {
    id: 'inner_clarity',
    name: 'Clarity & Mountain Peace',
    icon: '🏔️',
    tagline: 'Mirror alpine lakes, crisp ridges & pure horizons',
    themeIds: ['mountain_lake', 'alpine_valleys', 'ethereal_clouds', 'sandy_beach'],
  },
  {
    id: 'tropical_grounding',
    name: 'Tropical Paradise',
    icon: '🌴',
    tagline: 'Turquoise lagoons, lush rainforests & soft sand',
    themeIds: ['tropical_lagoons', 'lush_rainforest', 'sandy_beach', 'calm_ocean'],
  },
  {
    id: 'gratitude_warmth',
    name: 'Warmth & Gratitude',
    icon: '🍁',
    tagline: 'Autumn golden foliage, sandstone & sunset glow',
    themeIds: ['autumn_woodlands', 'desert_dunes', 'golden_sunrise', 'sunset_twilight'],
  },
];

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
  analysis?: import('../types').IntentAnalysisResult | null;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeIntentPreset, setActiveIntentPreset] = useState<string | null>('heart_opening');
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
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-8 transition-colors duration-200">
      
      {/* QUICK INTENT THEME TEMPLATES DROPDOWN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
              Meditation Intent Preset:
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block sm:inline sm:ml-2">
              (Auto-selects fitting nature themes)
            </span>
          </div>
        </div>

        <div className="relative sm:w-80">
          <select
            value={activeIntentPreset || ''}
            onChange={(e) => {
              const selected = INTENT_PRESETS.find((i) => i.id === e.target.value);
              if (selected) {
                applyIntentPreset(selected);
              } else {
                setActiveIntentPreset(null);
              }
            }}
            className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 cursor-pointer shadow-sm"
          >
            <option value="" disabled>Choose Intent Preset...</option>
            {INTENT_PRESETS.map((intent) => (
              <option key={intent.id} value={intent.id}>
                {intent.icon} {intent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Concept, Duration, Resolution, Audio (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800/80">
            <h2 className="text-base font-bold text-stone-900 dark:text-white tracking-tight">
              1. Title, Script & Settings
            </h2>
            <button
              type="button"
              onClick={onAutoPlanAI}
              disabled={isPlanningAI || !title.trim()}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{isPlanningAI ? 'AI Planning...' : 'Auto-Plan with AI'}</span>
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
              Meditation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Softening the Heart, Deep Restful Sleep..."
              className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />
          </div>

          {/* Script (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
              Script or Guidance <span className="text-stone-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste guidance script to guide tone, emotional journey, and aesthetic atmosphere..."
              className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
            />

            {/* Prominent AI Director Auto-Plan Action */}
            <button
              type="button"
              onClick={onAutoPlanAI}
              disabled={isPlanningAI || !title.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 mt-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                {isPlanningAI
                  ? 'AI Director is analyzing title & script...'
                  : '✨ AI Director: Auto-Select Fitting Themes from Script'}
              </span>
            </button>
          </div>

          {/* AI Analysis Visual Result (If planned by AI) */}
          {analysis && (
            <div className="bg-amber-50/50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  AI Scene Journey Planned
                </span>
                <span className="text-[10px] font-mono text-amber-800 dark:text-amber-400">
                  {analysis.mood?.slice(0, 3).join(', ')}
                </span>
              </div>
              <p className="text-[11px] text-stone-700 dark:text-stone-300 italic">
                "{analysis.intent}"
              </p>
            </div>
          )}

          {/* Duration & Clip Length */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                Target Duration
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={settings.target_duration}
                  onChange={(e) => updateSetting('target_duration', Number(e.target.value))}
                  className="w-3/5 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <select
                  value={settings.duration_unit}
                  onChange={(e) => updateSetting('duration_unit', e.target.value as any)}
                  className="w-2/5 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2 py-2 text-xs text-stone-900 dark:text-white focus:outline-none"
                >
                  <option value="minutes">Mins</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                Clip Duration (Min-Max)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={5}
                  max={60}
                  placeholder="Min"
                  value={settings.minimum_clip_duration}
                  onChange={(e) => updateSetting('minimum_clip_duration', Number(e.target.value))}
                  className="w-1/2 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2 py-2 text-xs text-stone-900 dark:text-white focus:outline-none"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  placeholder="Max"
                  value={settings.maximum_clip_duration || ''}
                  onChange={(e) => updateSetting('maximum_clip_duration', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-1/2 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Aspect Ratio & Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['16:9', '9:16', '1:1'] as const).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => updateSetting('aspect_ratio', ar)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      settings.aspect_ratio === ar
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                Resolution
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(['1080p', '4K'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => updateSetting('resolution', res)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      settings.resolution === res
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio Soundscape Mode */}
          <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Audio Track
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateSetting('audio_mode', 'none')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                  settings.audio_mode === 'none'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                    : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="text-[11px] flex items-center justify-center gap-1">
                  <VolumeX className="w-3 h-3" />
                  <span>Silent Track</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateSetting('audio_mode', 'upload');
                  if (!customMusicName) fileInputRef.current?.click();
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                  settings.audio_mode === 'upload'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                    : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="text-[11px] flex items-center justify-center gap-1 truncate">
                  <Upload className="w-3 h-3" />
                  <span className="truncate">{customMusicName ? 'Audio Loaded' : 'Upload MP3'}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSetting('audio_mode', 'ambient_synth')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                  settings.audio_mode === 'ambient_synth'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                    : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="text-[11px] flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>432Hz Drone</span>
                </div>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onUploadMusic(e.target.files[0]);
                  updateSetting('audio_mode', 'upload');
                }
              }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: 20 Nature Themes Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800/80">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900 dark:text-white tracking-tight">
                2. Nature Themes ({selectedList.length} Selected)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-bold">
                {totalAllocatedClips} clips total
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedList.length > 0 && (
                <button
                  type="button"
                  onClick={autoBalanceClips}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3 text-stone-400" />
                  <span>Auto-Balance</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          {/* Custom Nature Inline Form */}
          {showCustomForm && (
            <form
              onSubmit={handleAddCustom}
              className="bg-amber-50/40 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 rounded-xl p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Theme name (e.g. Nordic Fjords)"
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={customQueries}
                  onChange={(e) => setCustomQueries(e.target.value)}
                  placeholder="Keywords (e.g. fjord reflection)"
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-2.5 py-1 text-xs text-stone-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 text-stone-950 font-bold rounded-lg text-xs"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all ${
                  filterCategory === cat
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Nature Checkbox List (Compact, Clean & Uncluttered) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredPresetList.map((preset) => {
              const isSelected = !!selectedNatures[preset.id];
              const item = selectedNatures[preset.id];

              return (
                <div
                  key={preset.id}
                  onClick={() => toggleNature(preset)}
                  className={`flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-500 shadow-sm'
                      : 'bg-stone-50/60 dark:bg-stone-950/30 border-stone-200 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                >
                  {/* Left: Checkbox + Icon + Theme Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container click
                      className="w-4 h-4 rounded border-stone-300 dark:border-stone-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer shrink-0"
                    />
                    <span className="text-base shrink-0 leading-none">{preset.icon || '🌲'}</span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate leading-tight">
                        {preset.name}
                      </h4>
                      <span className="text-[10px] text-stone-400 capitalize truncate block">
                        {preset.category}
                      </span>
                    </div>
                  </div>

                  {/* Right: Inline Clip Count Stepper (Only when checked) */}
                  {isSelected && item && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700/80 rounded-lg px-1.5 py-0.5 shrink-0 ml-2 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => updateClipCount(preset.id, item.clipCount - 1)}
                        className="text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-amber-600 px-1"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 w-4 text-center">
                        {item.clipCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateClipCount(preset.id, item.clipCount + 1)}
                        className="text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-amber-600 px-1"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SINGLE PRIMARY ACTION BUTTON: Search & Review Footage */}
      <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-stone-500 dark:text-stone-400">
          Target: <span className="font-bold text-stone-900 dark:text-stone-200">{settings.target_duration} {settings.duration_unit}</span> • <span className="font-bold text-amber-700 dark:text-amber-400">{selectedList.length} nature themes</span> ({totalAllocatedClips} clips) • Bright sunlit aesthetic.
        </div>

        <button
          type="button"
          onClick={onSearchFootage}
          disabled={isSearching || selectedList.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-stone-950 font-bold text-sm transition-all shadow-md shadow-amber-500/25 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>{isSearching ? 'Searching & Evaluating Footage...' : 'Search & Review Footage'}</span>
        </button>
      </div>
    </div>
  );
};
