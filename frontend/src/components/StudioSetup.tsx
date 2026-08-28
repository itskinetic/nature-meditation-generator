import React, { useRef, useState, useEffect } from 'react';
import {
  Sparkles, Music, VolumeX, Upload, Trees, Waves, Mountain, Sun, Moon, Cloud,
  Flower2, Leaf, Droplets, Compass, CheckCircle2, Circle, Plus, RefreshCw,
  Search, Sliders, Wand2, ChevronDown, ChevronUp, X, Check, Eye, Film, Image as ImageIcon, Layers, Mic, FileText,
  Bookmark, Star, BookMarked, Tag
} from 'lucide-react';
import { GenerationRequest, Preset, IntentAnalysisResult, VisualBeat, CandidateItem, KeywordBankItem } from '../types';
import { api } from '../api/client';
import { SelectedNatureItem } from './NatureSelector';
import { StoryboardBeatTimeline } from './StoryboardBeatTimeline';

export interface IntentPreset {
  id: string;
  name: string;
  tagline: string;
  themeIds: string[];
}

export const INTENT_PRESETS: IntentPreset[] = [
  {
    id: 'deep_rest',
    name: 'Deep Rest & Night Slumber',
    tagline: 'Starry night skies, moonlit waters & twilight stillness',
    themeIds: ['starry_night', 'moonlit_water', 'sunset_twilight', 'night_forest'],
  },
  {
    id: 'heart_opening',
    name: 'Heart Opening & Peace',
    tagline: 'Soft ocean waves, blooming lotus & cherry blossoms',
    themeIds: ['calm_ocean', 'lotus_ponds', 'wildflower_meadow', 'cherry_blossoms'],
  },
  {
    id: 'deep_sleep',
    name: 'Deep Sleep & Slumber',
    tagline: 'Soothing waves, quiet clouds & twilight glow',
    themeIds: ['calm_ocean', 'ethereal_clouds', 'sunset_twilight', 'mountain_lake'],
  },
  {
    id: 'mindful_presence',
    name: 'Mindful Presence & Calm',
    tagline: 'Bamboo groves, fern canyons & smooth pebble streams',
    themeIds: ['bamboo_groves', 'fern_canyon', 'riverbed_pebbles', 'mountain_lake'],
  },
  {
    id: 'morning_vitality',
    name: 'Morning Awakening',
    tagline: 'Golden sunrise, sunlit forests & cascading streams',
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

export const WILDLIFE_INTENT_PRESETS: IntentPreset[] = [
  {
    id: 'savanna_predators',
    name: 'Savanna & Big Cats',
    tagline: 'Lions, cheetahs, leopards, elephants & zebras',
    themeIds: ['savanna_predators', 'sky_predators', 'wetland_wildlife'],
  },
  {
    id: 'marine_giants',
    name: 'Deep Ocean Giants',
    tagline: 'Humpback whales, sea turtles, orcas & dolphins',
    themeIds: ['marine_giants', 'wetland_wildlife', 'tropical_lagoons'],
  },
  {
    id: 'jungle_wildlife',
    name: 'Jungle & Rainforest',
    tagline: 'Jaguars, primates, toucans & exotic tree frogs',
    themeIds: ['jungle_rainforest', 'macro_insects', 'wetland_wildlife'],
  },
  {
    id: 'arctic_polar',
    name: 'Arctic & Polar Survivors',
    tagline: 'Polar bears on sea ice, penguins & arctic foxes',
    themeIds: ['arctic_wildlife', 'marine_giants', 'mountain_predators'],
  },
  {
    id: 'sky_raptors',
    name: 'Birds of Prey & Sky',
    tagline: 'Bald eagles, golden hawks & snowy owls in flight',
    themeIds: ['sky_predators', 'mountain_predators', 'savanna_predators'],
  },
  {
    id: 'mountain_predators',
    name: 'Mountain Predators',
    tagline: 'Grizzly bears, timber wolves, elk & cougars',
    themeIds: ['mountain_predators', 'sky_predators', 'savanna_predators'],
  },
];

const renderNatureIcon = (category: string, id: string) => {
  const cat = (category || '').toLowerCase();
  const nameId = (id || '').toLowerCase();
  const iconClass = "w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0";

  if (cat.includes('savanna') || cat.includes('lion') || nameId.includes('savanna') || nameId.includes('lion') || nameId.includes('cat')) {
    return <Compass className={iconClass} />;
  }
  if (cat.includes('polar') || cat.includes('arctic') || nameId.includes('polar') || nameId.includes('arctic') || nameId.includes('bear')) {
    return <Mountain className={iconClass} />;
  }
  if (cat.includes('bird') || nameId.includes('eagle') || nameId.includes('hawk') || nameId.includes('owl') || nameId.includes('raptor')) {
    return <Sun className={iconClass} />;
  }
  if (cat.includes('jungle') || nameId.includes('jungle') || nameId.includes('jaguar') || nameId.includes('monkey')) {
    return <Trees className={iconClass} />;
  }
  if (nameId.includes('whale') || nameId.includes('turtle') || nameId.includes('orca') || nameId.includes('dolphin') || cat.includes('water') || nameId.includes('ocean')) {
    return <Waves className={iconClass} />;
  }
  if (cat.includes('macro') || nameId.includes('insect') || nameId.includes('butterfly')) {
    return <Sparkles className={iconClass} />;
  }
  if (cat.includes('wetland') || nameId.includes('wetland') || nameId.includes('flamingo') || nameId.includes('otter') || nameId.includes('stream')) {
    return <Droplets className={iconClass} />;
  }
  if (cat.includes('night') || nameId.includes('night') || nameId.includes('star') || nameId.includes('moon')) {
    return <Moon className={iconClass} />;
  }
  if (cat.includes('forest') || nameId.includes('woodland') || nameId.includes('tree') || nameId.includes('rainforest')) {
    return <Trees className={iconClass} />;
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
  storyboardBeats?: VisualBeat[];
  onBreakdownStoryboard?: () => void;
  isBreakingDownStoryboard?: boolean;
  candidates?: CandidateItem[];
  selectedCandidateIds?: string[];
  onPreviewCandidate?: (candidate: CandidateItem) => void;
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
  storyboardBeats = [],
  onBreakdownStoryboard,
  isBreakingDownStoryboard = false,
  candidates = [],
  selectedCandidateIds = [],
  onPreviewCandidate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customQueries, setCustomQueries] = useState<string>('');
  const [editingKeyword, setEditingKeyword] = useState<{ sceneId: string; index: number } | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState<{ [sceneId: string]: string }>({});

  // Keyword Bank & Favorites State
  const [showKeywordBank, setShowKeywordBank] = useState<boolean>(false);
  const [bankItems, setBankItems] = useState<KeywordBankItem[]>([]);
  const [bankCategory, setBankCategory] = useState<string>('All');
  const [bankSearch, setBankSearch] = useState<string>('');
  const [newBankKeyword, setNewBankKeyword] = useState<string>('');
  const [newBankCategory, setNewBankCategory] = useState<string>('General');
  const [selectedTargetSceneId, setSelectedTargetSceneId] = useState<string>('');
  const [favoriteKeywordSet, setFavoriteKeywordSet] = useState<Set<string>>(new Set());

  const loadKeywordBank = async () => {
    try {
      const items = await api.getKeywordBank();
      setBankItems(items);
      const favs = new Set(items.filter((i) => i.is_favorite).map((i) => i.keyword.toLowerCase().trim()));
      setFavoriteKeywordSet(favs);
    } catch (e) {
      console.warn('Could not load keyword bank:', e);
    }
  };

  useEffect(() => {
    loadKeywordBank();
  }, []);

  const handleToggleFavorite = async (keyword: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const clean = keyword.trim();
    if (!clean) return;
    const isCurrentlyFav = favoriteKeywordSet.has(clean.toLowerCase());
    const newStatus = !isCurrentlyFav;

    // Optimistic UI update
    setFavoriteKeywordSet((prev) => {
      const next = new Set(prev);
      if (newStatus) next.add(clean.toLowerCase());
      else next.delete(clean.toLowerCase());
      return next;
    });

    try {
      await api.toggleKeywordFavorite({ keyword: clean, is_favorite: newStatus });
      loadKeywordBank();
    } catch (err) {
      console.warn('Failed to toggle favorite:', err);
    }
  };

  const handleSaveToBank = async (keyword: string, category: string = 'General') => {
    const clean = keyword.trim();
    if (!clean) return;
    try {
      await api.addKeywordToBank({ keyword: clean, category, is_favorite: true });
      loadKeywordBank();
      setNewBankKeyword('');
    } catch (err) {
      console.warn('Failed to add to bank:', err);
    }
  };

  const handleDeleteFromBank = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteKeywordFromBank(id);
      loadKeywordBank();
    } catch (err) {
      console.warn('Failed to delete from bank:', err);
    }
  };

  const handleInsertFromBank = (keyword: string, targetSceneId?: string) => {
    const clean = keyword.trim();
    if (!clean) return;
    const sceneKeys = Object.keys(selectedNatures);
    const destId = targetSceneId || selectedTargetSceneId || sceneKeys[0];

    if (destId && selectedNatures[destId]) {
      setSelectedNatures((prev) => {
        const queries = [...(prev[destId].queries || [])];
        if (!queries.includes(clean)) {
          queries.push(clean);
        }
        return {
          ...prev,
          [destId]: {
            ...prev[destId],
            queries,
          },
        };
      });
    }
  };

  const isDocMode = settings.studio_mode === 'documentary';

  const updateSetting = <K extends keyof GenerationRequest>(key: K, value: GenerationRequest[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Remove a scene from active plan
  const removeNature = (id: string) => {
    setSelectedNatures((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Keyword management handlers
  const handleUpdateKeyword = (sceneId: string, index: number, value: string) => {
    const val = value.trim();
    setSelectedNatures((prev) => {
      if (!prev[sceneId]) return prev;
      const queries = [...(prev[sceneId].queries || [])];
      if (val) {
        queries[index] = val;
      } else {
        queries.splice(index, 1);
      }
      return {
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          queries,
        },
      };
    });
    setEditingKeyword(null);
  };

  const handleRemoveKeyword = (sceneId: string, index: number) => {
    setSelectedNatures((prev) => {
      if (!prev[sceneId]) return prev;
      const queries = [...(prev[sceneId].queries || [])];
      queries.splice(index, 1);
      return {
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          queries,
        },
      };
    });
  };

  const handleAddKeywordToScene = (sceneId: string) => {
    const text = (newKeywordInput[sceneId] || '').trim();
    if (!text) return;
    setSelectedNatures((prev) => {
      if (!prev[sceneId]) return prev;
      const queries = [...(prev[sceneId].queries || []), text];
      return {
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          queries,
        },
      };
    });
    setNewKeywordInput((prev) => ({ ...prev, [sceneId]: '' }));
  };

  // Update clip count for a selected scene
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

  // Auto-balance clips evenly across all selected themes
  const autoBalanceClips = () => {
    const keys = Object.keys(selectedNatures);
    if (keys.length === 0) return;
    const totalMax = settings.maximum_unique_videos || 16;
    const countPerTheme = Math.max(1, Math.floor(totalMax / keys.length));
    const remainder = totalMax % keys.length;

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

  const uniquePresets = Array.from(new Map(Object.values(presets).map((p) => [p.id, p])).values());
  const filteredPresetList = uniquePresets;

  return (
    <div className="bg-white dark:bg-stone-900/80 border border-stone-200/90 dark:border-stone-800/80 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-5 sm:space-y-6 transition-colors duration-200">
      
      {/* 1. STUDIO MODE & MEDIA TYPE TOGGLE */}
      <div className="space-y-3.5">
        <div className="pb-3 border-b border-stone-200 dark:border-stone-800/80">
          <h2 className="text-base font-semibold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{isDocMode ? 'Wildlife Documentary AI Studio' : 'Meditation Concept & AI Script Director'}</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {isDocMode
              ? 'Generate cinematic 4K wildlife documentaries featuring authentic animals in natural habitats'
              : 'Enter your meditation title or guidance script to automatically discover matching nature themes'}
          </p>
        </div>

        {/* Media Format Selector (Only visible in Wildlife Documentary Mode) */}
        {isDocMode && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 py-1 px-3 bg-stone-50/70 dark:bg-stone-950/50 rounded-xl border border-stone-200/60 dark:border-stone-800/60 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Media Format:
              </label>
              <div className="inline-flex p-0.5 bg-stone-200/60 dark:bg-stone-800 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => updateSetting('media_type', 'video')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    (settings.media_type || 'video') === 'video'
                      ? 'bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-xs font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-950'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span>Video Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('media_type', 'image')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    settings.media_type === 'image'
                      ? 'bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-xs font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-950'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Photos Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('media_type', 'both')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    settings.media_type === 'both'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-950'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Both (Video & Photo)</span>
                </button>
              </div>
            </div>

            {(settings.media_type === 'image' || settings.media_type === 'both') && (
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium bg-amber-100/60 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-800/50 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Smooth Ken Burns slow zoom & pan active on photos</span>
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Title Input */}
          <div className="lg:col-span-5 space-y-1">
            <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              {isDocMode ? 'Documentary Title / Topic' : 'Meditation Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isDocMode ? 'e.g. Predators of the Serengeti, Ocean Giants, Arctic Wolves...' : 'e.g. Softening the Heart, Morning Awakening, Guided Rest...'}
              className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Guidance Script Input */}
          <div className="lg:col-span-7 space-y-1">
            <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              {isDocMode ? 'Documentary Voiceover / Narrative Script' : 'Script or Spoken Guidance'} <span className="text-stone-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={isDocMode ? 'Paste narration script or wildlife behaviors to spotlight...' : 'Paste guidance script to extract emotional intent, pace, and visual metaphors...'}
              className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Action button placed directly below the inputs (left-aligned) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onAutoPlanAI}
            disabled={isPlanningAI || !title.trim()}
            className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-200/70 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-300/90 dark:border-amber-700/80 disabled:opacity-50 text-stone-950 dark:text-amber-100 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-stone-900 dark:text-amber-300" />
            <span>{isPlanningAI ? 'Analyzing Concept...' : (isDocMode ? 'AI Director: Plan Wildlife Scenes' : 'Analyze & Suggest Themes')}</span>
          </button>

          {isDocMode && onBreakdownStoryboard && (
            <button
              type="button"
              onClick={onBreakdownStoryboard}
              disabled={isBreakingDownStoryboard || !script.trim()}
              className="w-full sm:w-auto h-9 px-4 rounded-xl bg-white dark:bg-stone-900 hover:bg-amber-50 dark:hover:bg-stone-800 border border-amber-300/80 dark:border-amber-700/60 disabled:opacity-50 text-amber-950 dark:text-amber-200 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{isBreakingDownStoryboard ? 'Matching Visual Beats...' : 'AI Director: Match Visual Beats to Script'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Storyboard Beats Timeline (Strictly in Wildlife Documentary mode) */}
      {isDocMode && storyboardBeats && storyboardBeats.length > 0 && (
        <StoryboardBeatTimeline
          beats={storyboardBeats}
          candidates={candidates}
          selectedCandidateIds={selectedCandidateIds}
          onPreviewCandidate={onPreviewCandidate}
        />
      )}

      {/* 2. DYNAMIC AI-EXTRACTED VISUAL SCENES & NARRATIVE CUES */}
      {(selectedList.length > 0 || !!analysis) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-semibold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                Dynamic AI Visual Scenes & Keywords
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                {selectedList.length} Scenes • {totalAllocatedClips} Clips
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  loadKeywordBank();
                  setShowKeywordBank(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Open Saved & Favorite Keyword Bank"
              >
                <BookMarked className="w-3.5 h-3.5 text-amber-500" />
                <span>Keyword Bank ({bankItems.length})</span>
              </button>

              {selectedList.length > 0 && (
                <button
                  type="button"
                  onClick={autoBalanceClips}
                  className="h-9 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                  <span>Balance Clips</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="h-9 px-3.5 rounded-xl bg-amber-200/70 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-300/90 dark:border-amber-700/80 text-stone-950 dark:text-amber-100 font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-stone-900 dark:text-amber-300" />
                <span>+ Custom Scene</span>
              </button>
            </div>
          </div>

          {/* AI Intent & Mood Metadata Banner */}
          {analysis && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 rounded-xl bg-white/90 dark:bg-stone-900/90 border border-amber-200/60 dark:border-amber-800/40 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-semibold text-stone-500 dark:text-stone-400">Narrative Intent:</span>
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

          {/* Dynamic AI Scenes Review Grid */}
          {selectedList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {selectedList.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800/90 shadow-xs hover:border-amber-400/60 dark:hover:border-amber-600/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base">{item.icon || '🌲'}</span>
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
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

                      {/* Remove Scene Button */}
                      <button
                        type="button"
                        onClick={() => removeNature(item.id)}
                        title="Remove scene from plan"
                        className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Keywords Review & Edit Section */}
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span className="font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Search Keywords ({item.queries?.length || 0})
                      </span>
                      <span className="text-[9px] text-stone-400">Click keyword to edit</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.queries?.map((q, qIdx) => {
                        const isEditing = editingKeyword?.sceneId === item.id && editingKeyword?.index === qIdx;
                        return isEditing ? (
                          <input
                            key={qIdx}
                            type="text"
                            defaultValue={q}
                            autoFocus
                            onBlur={(e) => handleUpdateKeyword(item.id, qIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateKeyword(item.id, qIdx, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingKeyword(null);
                            }}
                            className="h-6 px-2 text-[11px] font-medium bg-amber-50 dark:bg-amber-950 border border-amber-400 rounded-md text-amber-950 dark:text-amber-100 outline-none shadow-xs"
                          />
                        ) : (
                          <div
                            key={qIdx}
                            className="group/kw flex items-start gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100/90 dark:bg-stone-800/90 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 border border-stone-200/80 dark:border-stone-700/80 hover:border-amber-300 dark:hover:border-amber-700 transition-all text-[11px] text-stone-800 dark:text-stone-200 w-full"
                          >
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(q, e)}
                              title={favoriteKeywordSet.has(q.toLowerCase().trim()) ? "Saved Favorite (in Keyword Bank)" : "Save to Favorite Keyword Bank"}
                              className="p-0.5 rounded cursor-pointer transition-colors mt-0.5 shrink-0"
                            >
                              <Star className={`w-3 h-3 ${favoriteKeywordSet.has(q.toLowerCase().trim()) ? 'text-amber-500 fill-amber-500' : 'text-stone-300 dark:text-stone-600 hover:text-amber-400'}`} />
                            </button>
                            <span
                              onClick={() => setEditingKeyword({ sceneId: item.id, index: qIdx })}
                              className="cursor-pointer hover:underline whitespace-normal break-words leading-tight flex-1 select-text"
                              title="Click to edit keyword"
                            >
                              {q}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(item.id, qIdx)}
                              title="Remove keyword"
                              className="text-stone-400 hover:text-rose-600 rounded p-0.5 cursor-pointer opacity-70 hover:opacity-100 shrink-0 mt-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add Keyword Chip */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newKeywordInput[item.id] || ''}
                          onChange={(e) => setNewKeywordInput((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddKeywordToScene(item.id);
                            }
                          }}
                          placeholder="+ Add keyword..."
                          className="h-6 px-2 text-[10px] bg-transparent border border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-400 rounded-md text-stone-700 dark:text-stone-300 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-stone-900 w-28 transition-all"
                        />
                        {newKeywordInput[item.id] && (
                          <button
                            type="button"
                            onClick={() => handleAddKeywordToScene(item.id)}
                            className="h-6 px-1.5 rounded bg-amber-500 text-stone-950 text-[10px] font-bold cursor-pointer"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Scene Inline Form */}
          {showCustomForm && (
            <form
              onSubmit={handleAddCustom}
              className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Scene name (e.g. Bioluminescent Deep Sea)"
                  className="h-9 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 text-xs text-stone-900 dark:text-white"
                  required
                />
                <input
                  type="text"
                  value={customQueries}
                  onChange={(e) => setCustomQueries(e.target.value)}
                  placeholder="Stock search keywords (e.g. bioluminescent jellyfish ocean 4k)"
                  className="h-9 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 text-xs text-stone-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="h-9 px-3.5 rounded-xl text-xs text-stone-500 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-3.5 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 border border-amber-300/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 font-medium rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Add Scene
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 4. SETTINGS & HISTORY REUSE CONTROLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 pt-3 border-t border-stone-200 dark:border-stone-800">
        {/* Target Duration */}
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Target Duration
          </label>
          <div className="flex items-center h-9 w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/70 px-2 focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500 justify-between">
            <input
              type="number"
              min={1}
              max={settings.duration_unit === 'seconds' ? 3600 : 360}
              value={settings.target_duration}
              onChange={(e) => updateSetting('target_duration', Math.max(1, Number(e.target.value)))}
              className="w-10 bg-transparent text-xs font-semibold text-stone-900 dark:text-white focus:outline-none"
            />
            <div className="flex items-center gap-0.5 bg-stone-200/70 dark:bg-stone-800/80 p-0.5 rounded-lg text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => updateSetting('duration_unit', 'minutes')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  settings.duration_unit !== 'seconds' && settings.duration_unit !== 'hours'
                    ? 'bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                mins
              </button>
              <button
                type="button"
                onClick={() => updateSetting('duration_unit', 'seconds')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  settings.duration_unit === 'seconds'
                    ? 'bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                }`}
              >
                secs
              </button>
            </div>
          </div>
        </div>

        {/* Clip Duration Range (Min / Max) */}
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Clip Length (s)
          </label>
          <div className="flex items-center h-9 w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/70 px-2 gap-1 focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500">
            <input
              type="number"
              min={1}
              max={120}
              placeholder="Min"
              value={settings.minimum_clip_duration || 10}
              onChange={(e) => updateSetting('minimum_clip_duration', Math.max(1, Number(e.target.value)))}
              className="w-10 bg-transparent text-xs font-semibold text-stone-900 dark:text-white focus:outline-none text-center"
              title="Minimum Clip Duration in seconds"
            />
            <span className="text-stone-400 text-xs">-</span>
            <input
              type="number"
              min={settings.minimum_clip_duration || 10}
              max={300}
              placeholder="Max"
              value={settings.maximum_clip_duration || ''}
              onChange={(e) => updateSetting('maximum_clip_duration', e.target.value ? Number(e.target.value) : undefined)}
              className="w-10 bg-transparent text-xs font-semibold text-stone-900 dark:text-white focus:outline-none text-center"
              title="Maximum Clip Duration in seconds (blank = no limit)"
            />
            <span className="text-[10px] text-stone-400 font-medium ml-auto">s</span>
          </div>
        </div>

        {/* Format & Quality */}
        <div className="lg:col-span-3 space-y-1.5">
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
            <div className="w-20 p-0.5 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 flex items-center gap-0.5">
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
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Shot Cadence
          </label>
          <select
            value={settings.shot_preference || 'balanced'}
            onChange={(e) => updateSetting('shot_preference', e.target.value as any)}
            className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2.5 text-xs font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
          >
            <option value="balanced">Balanced Variety</option>
            <option value="macro">Mindful Close-Ups</option>
            <option value="still">Deep Stillness</option>
            <option value="wide">Expansive Vistas</option>
          </select>
        </div>

        {/* Auto-Subtitles / WhisperFlow */}
        <div className="lg:col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Subtitles
            </label>
            {settings.subtitle_config?.enabled && (
              <label className="text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.subtitle_config?.burn_into_video !== false}
                  onChange={(e) =>
                    updateSetting('subtitle_config', {
                      ...(settings.subtitle_config || { style: 'documentary_classic', enabled: true, burn_into_video: true }),
                      burn_into_video: e.target.checked,
                    })
                  }
                  className="w-3 h-3 rounded accent-amber-500"
                />
                <span>Burn</span>
              </label>
            )}
          </div>
          <select
            value={settings.subtitle_config?.enabled ? settings.subtitle_config.style : 'off'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'off') {
                updateSetting('subtitle_config', { enabled: false, style: 'documentary_classic', burn_into_video: false });
              } else {
                updateSetting('subtitle_config', {
                  enabled: true,
                  style: val as any,
                  burn_into_video: true,
                });
              }
            }}
            className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2.5 text-xs font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
          >
            <option value="off">Off (None)</option>
            <option value="documentary_classic">Doc Classic</option>
            <option value="dynamic_highlight">Dynamic Highlight</option>
            <option value="minimal_clean">Minimal Box</option>
          </select>
        </div>

        {/* Clip Pacing & Slow-Motion Playback Speed */}
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider" title="Slow down clip playback for ultra-tranquil meditative pacing">
            Clip Speed / Pacing
          </label>
          <select
            value={settings.playback_speed ?? 0.5}
            onChange={(e) => updateSetting('playback_speed', parseFloat(e.target.value))}
            className="w-full h-9 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-2.5 text-xs font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
          >
            <option value="0.4">0.4x Ultra Slow-Mo</option>
            <option value="0.5">0.5x Half-Speed (Calm)</option>
            <option value="0.75">0.75x Gentle Drift</option>
            <option value="1.0">1.0x Real-Time (Normal)</option>
          </select>
        </div>

        {/* Fresh Only / Ignore Saved & Past History Toggle */}
        <div className="lg:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider" title="Ignore all previously saved library clips and past video history to guarantee 100% fresh, original footage">
            Footage Pool
          </label>
          <label className="h-9 flex items-center justify-between px-2.5 bg-stone-50/70 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl cursor-pointer hover:border-amber-400/60 dark:hover:border-amber-600/60 transition-colors" title="Check to ignore previously saved & past used footage">
            <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
              Fresh Only
            </span>
            <input
              type="checkbox"
              checked={excludeAllHistory}
              onChange={(e) => setExcludeAllHistory && setExcludeAllHistory(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Audio Track & Voiceover Upload */}
        <div className="lg:col-span-12 space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            {isDocMode ? 'Soundtrack & Voiceover Audio' : 'Meditation Audio Bed'}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Instant client-side metadata probe to update duration immediately
                  try {
                    const audio = new Audio();
                    const objectUrl = URL.createObjectURL(file);
                    audio.src = objectUrl;
                    audio.onloadedmetadata = () => {
                      const secs = audio.duration;
                      if (!isNaN(secs) && secs > 0) {
                        if (secs < 60) {
                          updateSetting('target_duration', Math.max(1, Math.round(secs)));
                          updateSetting('duration_unit', 'seconds');
                        } else {
                          const mins = Math.max(1, Math.round(secs / 60));
                          updateSetting('target_duration', mins);
                          updateSetting('duration_unit', 'minutes');
                        }
                      }
                      URL.revokeObjectURL(objectUrl);
                    };
                  } catch (err) {
                    console.warn('Instant audio duration probe skipped:', err);
                  }

                  onUploadMusic(file);
                }
              }}
            />

            {/* Audio Mode Selectors */}
            <div className="p-0.5 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => updateSetting('audio_mode', 'none')}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  settings.audio_mode === 'none'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>No Audio</span>
              </button>

              <button
                type="button"
                onClick={() => updateSetting('audio_mode', 'ambient_synth')}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  settings.audio_mode === 'ambient_synth'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ambient Drone Synth</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  settings.audio_mode === 'upload'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {isUploadingMusic ? (
                  <>
                    <Upload className="w-3.5 h-3.5 animate-bounce" />
                    <span>Uploading Audio...</span>
                  </>
                ) : settings.audio_mode === 'upload' && customMusicName ? (
                  <div className="flex items-center gap-1.5 max-w-[260px]">
                    <Music className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
                    <span className="truncate font-medium">{customMusicName}</span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSetting('music_file', undefined);
                        updateSetting('audio_mode', 'none');
                      }}
                      className="p-0.5 rounded-full hover:bg-amber-300/80 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 ml-1 cursor-pointer shrink-0"
                      title="Remove uploaded audio"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isDocMode ? 'Upload Narration / Music (.mp3, .wav)' : 'Upload Audio Track (.mp3, .wav)'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. PRIMARY ACTION BAR */}
      <div className="pt-3 border-t border-stone-200 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
          {selectedList.length > 0 ? (
            <>
              Target: <strong className="text-stone-900 dark:text-stone-200">{settings.target_duration} {settings.duration_unit || 'mins'}</strong> •{' '}
              <strong className="text-amber-700 dark:text-amber-400">{selectedList.length} {selectedList.length === 1 ? 'scene' : 'scenes'}</strong> ({totalAllocatedClips} clips) •{' '}
              <span className="font-medium text-stone-700 dark:text-stone-300">{settings.aspect_ratio} {settings.resolution}</span>
            </>
          ) : (
            <span>Enter your narrative concept or script to discover and fetch matching 4K stock footage.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onSearchFootage}
          disabled={isSearching || (!title.trim() && !script.trim() && selectedList.length === 0)}
          className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-200/70 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-300/90 dark:border-amber-700/80 disabled:opacity-50 text-stone-950 dark:text-amber-100 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5 text-stone-900 dark:text-amber-300" />
          <span>{isSearching ? 'Searching & Evaluating Footage...' : (selectedList.length > 0 ? `Fetch Footage for Plan (${totalAllocatedClips} clips)` : 'Fetch Footage for Plan')}</span>
        </button>
      </div>

      {/* KEYWORD BANK MODAL / DRAWER */}
      {showKeywordBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/70">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Favorite & Saved Keyword Bank
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                  {bankItems.length} Keywords
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeywordBank(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Custom Keyword to Bank */}
            <div className="p-3.5 border-b border-stone-100 dark:border-stone-800 bg-amber-50/30 dark:bg-amber-950/20 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newBankKeyword}
                onChange={(e) => setNewBankKeyword(e.target.value)}
                placeholder="Add high-aesthetic search keyword (e.g. golden sunrise redwood misty 4k)..."
                className="flex-1 min-w-[200px] h-8 px-3 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-stone-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBankKeyword.trim()) {
                    handleSaveToBank(newBankKeyword, newBankCategory);
                  }
                }}
              />
              <select
                value={newBankCategory}
                onChange={(e) => setNewBankCategory(e.target.value)}
                className="h-8 px-2 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                <option value="General">General</option>
                <option value="Forest">Forest</option>
                <option value="Water">Water</option>
                <option value="Sky">Sky</option>
                <option value="Meadow">Meadow</option>
                <option value="Mountain">Mountain</option>
                <option value="Wildlife">Wildlife</option>
              </select>
              <button
                type="button"
                onClick={() => handleSaveToBank(newBankKeyword, newBankCategory)}
                disabled={!newBankKeyword.trim()}
                className="h-8 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save to Bank</span>
              </button>
            </div>

            {/* Target Scene Selector & Search */}
            <div className="p-3 border-b border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 bg-stone-50/30 dark:bg-stone-950/30">
              <div className="flex items-center gap-2 min-w-[220px]">
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Insert into:</span>
                <select
                  value={selectedTargetSceneId || (selectedList[0]?.id || '')}
                  onChange={(e) => setSelectedTargetSceneId(e.target.value)}
                  className="h-8 px-2 text-xs bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-medium cursor-pointer"
                >
                  {selectedList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon || '🌲'} {s.name}
                    </option>
                  ))}
                  {selectedList.length === 0 && (
                    <option value="">(No active scenes)</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search bank keywords..."
                  className="w-full h-8 px-2.5 text-xs bg-stone-100/80 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-stone-900 dark:text-white"
                />
              </div>
            </div>

            {/* Keywords List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh]">
              {bankItems
                .filter((i) => !bankSearch.trim() || i.keyword.toLowerCase().includes(bankSearch.toLowerCase().trim()))
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-700/60 hover:border-amber-400/60 dark:hover:border-amber-600/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(item.keyword, e)}
                        title={item.is_favorite ? 'Favorited' : 'Add to Favorites'}
                        className="p-1 rounded text-amber-500 cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${item.is_favorite ? 'fill-amber-500 text-amber-500' : 'text-stone-300 dark:text-stone-600 hover:text-amber-400'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                          {item.keyword}
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-stone-700/60 text-stone-600 dark:text-stone-300">{item.category}</span>
                          <span>•</span>
                          <span>Used {item.times_used}x</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleInsertFromBank(item.keyword)}
                          className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Insert</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFromBank(item.id, e)}
                        title="Delete from bank"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-50 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {bankItems.length === 0 && (
                <div className="text-center py-8 text-stone-400 text-xs">
                  No keywords saved yet. Star any keyword pill in your scenes or type one above to save it to your bank!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
