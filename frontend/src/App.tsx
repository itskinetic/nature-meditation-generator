import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Sparkles, Film, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { StudioSetup } from './components/StudioSetup';
import { SelectedNatureItem } from './components/NatureSelector';
import { CandidatePanel } from './components/CandidatePanel';
import { SelectedSequenceTray } from './components/SelectedSequenceTray';
import { GenerationPanel } from './components/GenerationPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { QueueDrawer } from './components/QueueDrawer';
import { api } from './api/client';
import {
  GenerationRequest,
  JobDetail,
  CandidateItem,
  ActiveJobItem
} from './types';

export function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'generator' | 'library' | 'history'>('generator');

  // Theme state (default light theme, saved to localStorage)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme_mode');
    return saved === 'dark'; // default is false (light)
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_mode', 'light');
    }
  }, [isDark]);

  // Input states
  const [title, setTitle] = useState('Softening the Heart');
  const [script, setScript] = useState('');
  const [analysis, setAnalysis] = useState<import('./types').IntentAnalysisResult | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [customMusicName, setCustomMusicName] = useState<string>('');

  // 20 Nature Selection state (Default 4 popular themes with 4 clips each = 16 clips)
  const [selectedNatures, setSelectedNatures] = useState<Record<string, SelectedNatureItem>>({
    sunlit_forest: {
      id: 'sunlit_forest',
      name: 'Sunlit Forest',
      icon: '',
      category: 'Forest',
      clipCount: 4,
      queries: ['sunlight through forest trees', 'bright green woodland canopy', 'sunlit quiet forest path'],
    },
    calm_ocean: {
      id: 'calm_ocean',
      name: 'Calm Ocean',
      icon: '',
      category: 'Water',
      clipCount: 4,
      queries: ['crystal clear calm sea', 'calm turquoise shoreline', 'gentle shallow sea ripples'],
    },
    wildflower_meadow: {
      id: 'wildflower_meadow',
      name: 'Wildflower Meadow',
      icon: '',
      category: 'Meadow',
      clipCount: 4,
      queries: ['sunlit wildflower meadow', 'blooming wildflower field', 'gentle breeze colorful meadow'],
    },
    mountain_lake: {
      id: 'mountain_lake',
      name: 'Mountain Lakes',
      icon: '',
      category: 'Water',
      clipCount: 4,
      queries: ['still alpine lake reflection', 'crystal clear mountain lake', 'peaceful lake shore'],
    },
  });

  // Generation Settings State
  const [settings, setSettings] = useState<GenerationRequest>({
    title: 'Softening the Heart',
    script: '',
    preset: 'sunlit_forest',
    target_duration: 30,
    duration_unit: 'minutes',
    maximum_unique_videos: 16,
    minimum_clip_duration: 15,
    maximum_clip_duration: undefined,
    aspect_ratio: '16:9',
    resolution: '1080p',
    transition_type: 'crossfade',
    transition_duration: 2.0,
    allow_reuse: true,
    avoid_recently_used: true,
    enable_pexels: true,
    enable_pixabay: true,
    audio_mode: 'none',
  });

  // Active Job ID & Queue Drawer State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [excludeAllHistory, setExcludeAllHistory] = useState<boolean>(false);

  // Sync title / script into settings
  useEffect(() => {
    setSettings((prev) => ({ ...prev, title, script }));
  }, [title, script]);

  // Sync total clips from nature selector into settings.maximum_unique_videos
  useEffect(() => {
    const totalSelectedClips = Object.values(selectedNatures).reduce((acc, n) => acc + n.clipCount, 0);
    if (totalSelectedClips > 0) {
      setSettings((prev) => ({ ...prev, maximum_unique_videos: totalSelectedClips }));
    }
  }, [selectedNatures]);

  // Load Presets
  const { data: presets = {} } = useQuery({
    queryKey: ['presets'],
    queryFn: api.getPresets,
  });

  // Load Library Items
  const { data: libraryItems = [], isLoading: isLibraryLoading, refetch: refetchLibrary } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
  });

  // Load History Items
  const { data: historyItems = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['history'],
    queryFn: api.getHistory,
  });

  // Background Active Queue Polling (Every 2.5s if active, 8s otherwise)
  const { data: activeJobs = [], refetch: refetchActiveJobs } = useQuery({
    queryKey: ['activeJobs'],
    queryFn: api.getActiveJobs,
    refetchInterval: (query) => {
      const data = query.state.data as ActiveJobItem[] | undefined;
      return data && data.length > 0 ? 2500 : 8000;
    },
  });

  // Active Job Polling
  const { data: jobDetail, refetch: refetchJob } = useQuery({
    queryKey: ['job', activeJobId],
    queryFn: () => (activeJobId ? api.getJobDetail(activeJobId) : null),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const data = query.state.data as JobDetail | undefined;
      if (!data) return 1500;
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        return false;
      }
      return 1500;
    },
  });

  // Keep candidates in sync when job updates
  useEffect(() => {
    if (jobDetail?.candidates && jobDetail.candidates.length > 0) {
      setCandidates(jobDetail.candidates);
      setSelectedCandidateIds(
        jobDetail.candidates.filter((c: CandidateItem) => c.is_approved).map((c: CandidateItem) => c.source_video_id)
      );
    }
  }, [jobDetail]);

  // Target duration in seconds
  const targetSeconds = settings.duration_unit === 'hours'
    ? settings.target_duration * 3600
    : settings.target_duration * 60;

  // Search Mutation using selected nature specs
  const searchMutation = useMutation({
    mutationFn: (envSpecs?: Array<{ id: string; name: string; queries: string[]; clip_count: number }>) => {
      const specs = envSpecs || Object.values(selectedNatures).map((item) => ({
        id: item.id,
        name: item.name,
        queries: item.queries,
        clip_count: item.clipCount,
      }));

      return api.searchCandidates({
        environments_spec: specs,
        preset_name: settings.preset,
        enable_pexels: settings.enable_pexels,
        enable_pixabay: settings.enable_pixabay,
        min_duration: settings.minimum_clip_duration,
        max_duration: settings.maximum_clip_duration,
        aspect_ratio: settings.aspect_ratio,
        resolution: settings.resolution,
        exclude_all_history: excludeAllHistory,
        shot_preference: settings.shot_preference,
      });
    },
    onSuccess: (data) => {
      setCandidates(data.candidates);
      // Auto-select approved candidates up to maximum_unique_videos
      const approvedIds = data.candidates
        .filter((c: CandidateItem) => c.is_approved)
        .slice(0, settings.maximum_unique_videos)
        .map((c: CandidateItem) => c.source_video_id);
      setSelectedCandidateIds(approvedIds);
    },
  });

  // AI Auto-Plan Mutation (Populates themes and intent for interactive review)
  const autoPlanMutation = useMutation({
    mutationFn: () =>
      api.analyzeContent(
        title,
        script,
        undefined,
        undefined,
        settings.maximum_unique_videos
      ),
    onSuccess: (data) => {
      setAnalysis(data);
      if (data.planned_environments && data.planned_environments.length > 0) {
        const newSel: Record<string, SelectedNatureItem> = {};
        data.planned_environments.forEach((pe) => {
          newSel[pe.id] = {
            id: pe.id,
            name: pe.name,
            icon: pe.icon,
            category: 'Planned',
            clipCount: pe.suggested_clips,
            queries: pe.keywords,
          };
        });
        setSelectedNatures(newSel);
      }
    },
  });

  // Selection toggle handlers
  const handleToggleSelect = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllApproved = () => {
    const approvedIds = candidates.filter((c: CandidateItem) => c.is_approved).map((c: CandidateItem) => c.source_video_id);
    setSelectedCandidateIds(approvedIds);
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds([]);
  };

  // 1-Click Ban Candidate Handler
  const handleBanCandidate = async (candidate: CandidateItem) => {
    try {
      await api.banCandidate({
        source_video_id: candidate.source_video_id,
        source: candidate.source,
        source_url: candidate.source_url,
        creator_name: candidate.creator_name,
        preview_url: candidate.preview_url,
      });
      // Instantly remove candidate from current UI pool
      setCandidates((prev) => prev.filter((c) => c.source_video_id !== candidate.source_video_id));
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.source_video_id));
      queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (err) {
      console.error('Failed to ban candidate:', err);
    }
  };

  // Generate Mutation
  const generateMutation = useMutation({
    mutationFn: () => {
      const selectedList = Object.values(selectedNatures);
      const envTargets: Record<string, number> = {};
      selectedList.forEach((e) => {
        envTargets[e.id] = e.clipCount;
      });

      return api.startGeneration({
        ...settings,
        title,
        script,
        environments: selectedList.map((e) => e.name),
        environment_clip_targets: envTargets,
        selected_candidate_ids: selectedCandidateIds.length > 0 ? selectedCandidateIds : undefined,
        candidate_pool: candidates.length > 0 ? candidates : undefined,
      });
    },
    onSuccess: (data) => {
      setActiveJobId(data.job_id);
      setIsQueueOpen(true);
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  // Cancel Mutation (Cancels active or queued job)
  const cancelMutation = useMutation({
    mutationFn: (jobId?: string) => api.cancelJob(jobId || activeJobId || ''),
    onSuccess: () => {
      refetchJob();
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  // Music Upload Mutation
  const musicUploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadMusic(file),
    onSuccess: (data) => {
      setSettings((prev) => ({ ...prev, music_file: data.filename, audio_mode: 'upload' }));
      setCustomMusicName(data.filename);
    },
  });

  // Library Save & Delete Mutations
  const saveCandidateMutation = useMutation({
    mutationFn: (candidate: CandidateItem) => api.saveCandidateToLibrary(candidate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const deleteLibraryMutation = useMutation({
    mutationFn: (id: number) => api.deleteLibraryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const clearLibraryMutation = useMutation({
    mutationFn: () => api.clearLibrary(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  // Get selected candidate objects
  const selectedCandidatesList = candidates.filter((c) =>
    selectedCandidateIds.includes(c.source_video_id)
  );

  const numClipsUsed = selectedCandidatesList.length > 0 ? selectedCandidatesList.length : settings.maximum_unique_videos;
  const estimatedSequenceClipsNeeded = Math.ceil(targetSeconds / (settings.minimum_clip_duration - settings.transition_duration));
  const estimatedRepeats = estimatedSequenceClipsNeeded > numClipsUsed
    ? Math.ceil(estimatedSequenceClipsNeeded / numClipsUsed) - 1
    : 0;

  return (
    <div className="min-h-screen bg-[#fbfaf7] dark:bg-[#0c0e12] text-stone-800 dark:text-stone-100 flex flex-col transition-colors duration-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        setIsDark={setIsDark}
        activeJobsCount={activeJobs.length}
        onOpenQueue={() => setIsQueueOpen(true)}
      />

      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        activeJobs={activeJobs}
        recentCompleted={historyItems}
        onCancelJob={(id) => cancelMutation.mutate(id)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {activeTab === 'generator' && (
          <div className="space-y-6 sm:space-y-8">
            {/* STAGE 1: UNIFIED STUDIO SETUP & NATURE SELECTOR */}
            <StudioSetup
              title={title}
              setTitle={setTitle}
              script={script}
              setScript={setScript}
              settings={settings}
              setSettings={setSettings}
              presets={presets}
              selectedNatures={selectedNatures}
              setSelectedNatures={setSelectedNatures}
              onUploadMusic={(file) => musicUploadMutation.mutate(file)}
              isUploadingMusic={musicUploadMutation.isPending}
              customMusicName={customMusicName}
              onSearchFootage={() => searchMutation.mutate()}
              isSearching={searchMutation.isPending}
              onAutoPlanAI={() => autoPlanMutation.mutate()}
              isPlanningAI={autoPlanMutation.isPending}
              analysis={analysis}
              excludeAllHistory={excludeAllHistory}
              setExcludeAllHistory={setExcludeAllHistory}
            />

            {/* STAGE 2: FOOTAGE REVIEW & SEQUENCE CURATION (Appears when candidates exist) */}
            {candidates.length > 0 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 text-xs font-bold flex items-center justify-center shadow-sm">
                    2
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    Review & Curate Footage
                  </h3>
                </div>

                <CandidatePanel
                  candidates={candidates}
                  selectedIds={selectedCandidateIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAllApproved={handleSelectAllApproved}
                  onDeselectAll={handleDeselectAll}
                  onSaveCandidate={(c) => saveCandidateMutation.mutate(c)}
                  onBanCandidate={handleBanCandidate}
                />

                {selectedCandidatesList.length > 0 && (
                  <SelectedSequenceTray
                    selectedCandidates={selectedCandidatesList}
                    onRemove={handleToggleSelect}
                    transitionDuration={settings.transition_duration}
                  />
                )}
              </div>
            )}

            {/* STAGE 3: RENDER & EXPORT (Appears when footage has been fetched) */}
            {candidates.length > 0 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 text-xs font-bold flex items-center justify-center shadow-xs">
                    3
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    Render Final Video
                  </h3>
                </div>

                {/* Render Launch Bar */}
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-5 sm:p-6 shadow-xs backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-200">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Ready to Render Meditation Video</span>
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      Target: <strong className="text-amber-800 dark:text-amber-300">{settings.target_duration} {settings.duration_unit}</strong> ({settings.aspect_ratio}, {settings.resolution}) • Using <strong className="text-stone-900 dark:text-stone-200">{selectedCandidatesList.length || settings.maximum_unique_videos} curated clips</strong> from <strong className="text-amber-800 dark:text-amber-300">{Object.keys(selectedNatures).length} nature themes</strong>
                      {estimatedRepeats > 0 && (
                        <span className="text-amber-800 dark:text-amber-300 ml-1.5 font-semibold">
                          (Sequence loops ~{estimatedRepeats}x)
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || !title.trim()}
                    className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-stone-950" />
                    <span>{generateMutation.isPending ? 'Queuing Video Job...' : 'Queue for Render'}</span>
                  </button>
                </div>
              </div>
            )}

              {/* Generation Progress & Completed Video Player */}
              {activeJobId && (
                <GenerationPanel
                  job={jobDetail || null}
                  onCancel={() => cancelMutation.mutate()}
                  isCancelling={cancelMutation.isPending}
                  onStartNewVideo={() => {
                    setActiveJobId(null);
                    setCandidates([]);
                    setSelectedCandidateIds([]);
                  }}
                />
              )}
            </div>
          )}

        {activeTab === 'library' && (
          <LibraryPanel
            items={libraryItems}
            isLoading={isLibraryLoading}
            onRefresh={() => refetchLibrary()}
            onDeleteItem={(id) => deleteLibraryMutation.mutate(id)}
            onClearLibrary={() => clearLibraryMutation.mutate()}
            isDeleting={deleteLibraryMutation.isPending || clearLibraryMutation.isPending}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPanel
            history={historyItems}
            isLoading={isHistoryLoading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
