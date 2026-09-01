import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileAudio,
  Sparkles,
  Play,
  Pause,
  Clock,
  Download,
  Film,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Volume2,
  FileText,
  HelpCircle,
  Eye,
  Check,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  Inbox,
  Trash2,
  FolderOpen,
  ArrowLeft,
  Columns,
  List,
  Edit3
} from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { api } from '../api/client';
import {
  AudioAnalysisResult,
  AudioProcessResult,
  AudioSegment,
  AudioProjectItem,
  AudioProjectListResult
} from '../types';

interface AudioSpacerPanelProps {
  onUseInStudio: (audioFilename: string, durationSeconds: number, scriptText?: string) => void;
  isDark?: boolean;
}

const SAMPLE_SCRIPT_WITH_TAGS = `You feel it coming. (pause)
The heart quickening. (pause)
The chest pulling tight. (pause)
Maybe the breath going shallow, or fast, or hard to find. (pause)
Good. You caught it. (pause)
Caught it early. That's it. (pause)
That is the part that matters most. (long pause)
Wherever you are right now: sitting, (short pause)
standing, (short pause)
in a car, (short pause)
in a stall, in a hallway. (pause)
You do not need to change your position. (pause)
You do not need to close your eyes unless you want to. (long pause)
Just let your attention come here to this voice while everything else keeps happening around you. (long pause)
That racing heart is not a mistake. (pause)
It is not proof that something is wrong. (pause)
It is your body doing something it knows how to do. (pause)
Getting ready. Gathering energy. Paying attention. (long pause)
So instead of pushing it away, let us use it. (pause)
Right where you feel it most: the chest, the throat, the stomach. (long pause)
Just notice it. Do not change it yet. Just notice. (15s pause)
Now, without trying to slow anything down, place one hand flat over your heart or bring your thumb to rest against one fingertip. (long pause)
Whichever is easier right now. That is it. (pause)
This is your hand on your body, right now in this moment. (long pause)
And behind you, just imagine it—you do not have to see it clearly: (pause)
A heart far bigger than your own. Steady. Warm. (long pause)
It is not asking your heart to slow down. (pause)
It is not asking anything of you at all. (pause)
It is simply there, holding the space behind you while your own heart does what it is doing. (15s pause)
Feel that hand on your chest, or that thumb against your fingertip. (long pause)
Let it be a place your attention can rest alongside the racing heart. (long pause)
Both things can be true at once: the activation, and this point of contact. (long pause)
Now, like a dial that can turn in either direction, imagine the intensity you are feeling has a setting. (long pause)
You do not need to turn it to zero. You could not if you tried, and you do not need to. (long pause)
Just imagine it turning down one notch. That is enough for now. (15s pause)`;

export const AudioSpacerPanel: React.FC<AudioSpacerPanelProps> = ({
  onUseInStudio,
  isDark = false,
}) => {
  const queryClient = useQueryClient();

  // Inbox & Projects state
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'unprocessed' | 'processed'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isBatchUploading, setIsBatchUploading] = useState<boolean>(false);

  // Load persistent Audio Projects from SQLite
  const { data: projectListResult, isLoading: isProjectsLoading, refetch: refetchProjects } = useQuery<AudioProjectListResult>({
    queryKey: ['audioProjects', projectStatusFilter],
    queryFn: () => api.getAudioProjects(projectStatusFilter),
  });

  // Active Editor State
  const [activeProject, setActiveProject] = useState<AudioProjectItem | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAligningScript, setIsAligningScript] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Right column View Mode: 'split' | 'spoken' | 'script'
  const [rightViewMode, setRightViewMode] = useState<'split' | 'spoken' | 'script'>('split');

  // Analysis & Segments State
  const [analysisData, setAnalysisData] = useState<AudioAnalysisResult | null>(null);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [processedResult, setProcessedResult] = useState<AudioProcessResult | null>(null);

  // Audio Playback State
  const [activeAudioSource, setActiveAudioSource] = useState<'original' | 'spaced'>('original');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Search & Filter state
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const teleprompterRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine current active audio URL
  const currentAudioUrl = useMemo(() => {
    if (activeAudioSource === 'spaced' && processedResult?.audio_url) {
      return processedResult.audio_url;
    }
    if (activeAudioSource === 'spaced' && activeProject?.spaced_filename) {
      return `/api/audio/stream/${activeProject.spaced_filename}`;
    }
    return analysisData?.audio_url || activeProject?.audio_url || '';
  }, [activeAudioSource, processedResult, analysisData, activeProject]);

  // Current active waveform peaks
  const currentPeaks = useMemo(() => {
    if (activeAudioSource === 'spaced' && processedResult?.waveform_peaks) {
      return processedResult.waveform_peaks;
    }
    return analysisData?.waveform_peaks || activeProject?.waveform_peaks || [];
  }, [activeAudioSource, processedResult, analysisData, activeProject]);

  // Current active duration
  const activeDuration = useMemo(() => {
    if (activeAudioSource === 'spaced' && processedResult?.spaced_duration) {
      return processedResult.spaced_duration;
    }
    if (activeAudioSource === 'spaced' && activeProject?.spaced_duration) {
      return activeProject.spaced_duration;
    }
    return analysisData?.duration || activeProject?.duration || 0;
  }, [activeAudioSource, processedResult, analysisData, activeProject]);

  // Delete Project Mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => api.deleteAudioProject(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
      if (activeProject?.id === deletedId) {
        handleCloseEditor();
      }
    },
  });

  // Handle Batch Files Upload into Inbox
  const handleBatchFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBatchUploading(true);
    setErrorMessage(null);

    try {
      const fileList = Array.from(files);
      await api.batchUploadAudioFiles(fileList);
      await queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setErrorMessage(err.message || 'Failed to upload audio files.');
    } finally {
      setIsBatchUploading(false);
      e.target.value = '';
    }
  };

  // Open a project from the Inbox into the editor
  const handleOpenProject = (project: AudioProjectItem) => {
    setActiveProject(project);
    setSelectedProjectId(project.id);
    setAnalysisData({
      file_id: project.file_id,
      original_name: project.original_name,
      duration: project.duration,
      waveform_peaks: project.waveform_peaks,
      silence_intervals: project.silence_intervals,
      segments: project.segments,
      audio_url: project.audio_url,
    });
    setSegments(project.segments || []);
    setScriptText(project.script_text || '');
    setDuration(project.duration);
    if (project.status === 'processed' && project.spaced_filename) {
      setProcessedResult({
        file_id: project.file_id,
        original_duration: project.duration,
        spaced_duration: project.spaced_duration,
        total_pauses_count: project.segments?.filter((s) => s.pause_duration > 0).length || 0,
        total_silence_added: Math.max(0, project.spaced_duration - project.duration),
        waveform_peaks: project.waveform_peaks,
        spaced_filename: project.spaced_filename,
        audio_url: `/api/audio/stream/${project.spaced_filename}`,
        download_url: `/api/audio/download/${project.spaced_filename}`,
      });
      setActiveAudioSource('spaced');
    } else {
      setProcessedResult(null);
      setActiveAudioSource('original');
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setErrorMessage(null);
  };

  // Close editor and return to Inbox view
  const handleCloseEditor = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setActiveProject(null);
    setSelectedProjectId(null);
    setAnalysisData(null);
    setSegments([]);
    setProcessedResult(null);
    setIsPlaying(false);
    setCurrentTime(0);
    refetchProjects();
  };

  // Handle single file upload & analyze in one step
  const handleAnalyze = async () => {
    if (!audioFile) {
      setErrorMessage('Please select an audio file first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const res = await api.uploadAndAnalyzeAudio(audioFile, scriptText);
      setAnalysisData(res);
      setSegments(res.segments);
      setDuration(res.duration);
      setActiveAudioSource('original');
      setCurrentTime(0);
      setIsPlaying(false);
      queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
    } catch (err: any) {
      console.error('Audio analysis error:', err);
      setErrorMessage(err.message || 'Failed to analyze audio file. Please check audio format.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Align Pasted Reference Script with Audio Timestamps & Pauses
  const handleAlignScript = async () => {
    const fileId = analysisData?.file_id || activeProject?.file_id;
    if (!fileId) {
      setErrorMessage('Please load an audio file first.');
      return;
    }
    if (!scriptText.trim()) {
      setErrorMessage('Please paste your reference script before aligning.');
      return;
    }

    setIsAligningScript(true);
    setErrorMessage(null);

    try {
      const res = await api.alignReferenceScript(fileId, scriptText);
      setAnalysisData(res);
      setSegments(res.segments);
      queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
    } catch (err: any) {
      console.error('Script alignment error:', err);
      setErrorMessage(err.message || 'Failed to align reference script.');
    } finally {
      setIsAligningScript(false);
    }
  };

  // Trigger Spaced Audio Processing
  const handleProcessSpacing = async () => {
    const fileId = analysisData?.file_id || activeProject?.file_id;
    if (!fileId || segments.length === 0) {
      setErrorMessage('No audio segments found to process.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await api.processAudioSpacing(fileId, segments, 0.05);
      setProcessedResult(res);
      setActiveAudioSource('spaced');
      setCurrentTime(0);
      setIsPlaying(false);
      queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
    } catch (err: any) {
      console.error('Spacing process error:', err);
      setErrorMessage(err.message || 'Failed to generate spaced audio master.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Playback control
  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.warn('Play interrupted:', e));
    }
  };

  const handleSeek = (seekTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Jump to specific segment start & play
  const handleJumpToSegment = (seg: AudioSegment) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seg.start_time;
    setCurrentTime(seg.start_time);
    setActiveSegmentId(seg.id);
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  // Track time update and determine active segment for synchronized script reading
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime;
    setCurrentTime(t);

    if (activeAudioSource === 'original') {
      const activeSeg = segments.find((s) => t >= s.start_time && t <= s.end_time);
      if (activeSeg && activeSeg.id !== activeSegmentId) {
        setActiveSegmentId(activeSeg.id);
      }
    }
  };

  // Auto-scroll the teleprompter script view to keep active segment centered
  useEffect(() => {
    if (activeSegmentId && activeCardRef.current && teleprompterRef.current) {
      const card = activeCardRef.current;
      const container = teleprompterRef.current;
      const cardTop = card.offsetTop;
      const cardHeight = card.offsetHeight;
      const containerHeight = container.offsetHeight;

      container.scrollTo({
        top: cardTop - containerHeight / 2 + cardHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [activeSegmentId]);

  // Update a single segment's pause duration
  const updateSegmentPause = (id: string, pauseDuration: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pause_duration: Math.max(0, pauseDuration) } : s))
    );
  };

  // Update a single segment's text
  const updateSegmentText = (id: string, newText: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
  };

  // Bulk pause adjustments
  const applyPresetToAll = (duration: number) => {
    setSegments((prev) => prev.map((s) => ({ ...s, pause_duration: duration })));
  };

  const adjustAllPauses = (delta: number) => {
    setSegments((prev) =>
      prev.map((s) => ({ ...s, pause_duration: Math.max(0, Math.round((s.pause_duration + delta) * 10) / 10) }))
    );
  };

  // Calculate total duration comparison metrics
  const calculatedEstimatedDuration = useMemo(() => {
    const orig = analysisData?.duration || activeProject?.duration || 0;
    const addedPauses = segments.reduce((acc, s) => acc + (s.pause_duration || 0), 0);
    return orig + addedPauses + 4.5;
  }, [analysisData, activeProject, segments]);

  // Filtered segments for display
  const filteredSegments = useMemo(() => {
    if (!searchFilter.trim()) return segments;
    const q = searchFilter.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q) || s.index.toString().includes(q));
  }, [segments, searchFilter]);

  const projects = projectListResult?.projects || [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || activeDuration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                Audio Lab & Meditation Pacing Studio
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Upload voiceovers to your inbox, view word-for-word transcriptions & reference scripts, and master pauses.
              </p>
            </div>
          </div>
        </div>

        {/* Global Preset Shortcuts when an audio is open in editor */}
        {analysisData && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleCloseEditor}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 flex items-center gap-1.5 transition-all cursor-pointer mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Inbox</span>
            </button>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => applyPresetToAll(5.0)}
              className="px-2.5 py-1 text-xs rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
            >
              Gentle (5s)
            </button>
            <button
              type="button"
              onClick={() => applyPresetToAll(8.0)}
              className="px-2.5 py-1 text-xs rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
            >
              Standard (8s)
            </button>
            <button
              type="button"
              onClick={() => applyPresetToAll(15.0)}
              className="px-2.5 py-1 text-xs rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
            >
              Deep Rest (15s)
            </button>
            <button
              type="button"
              onClick={() => adjustAllPauses(1.0)}
              className="px-2 py-1 text-xs rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 flex items-center gap-0.5 cursor-pointer"
              title="Add 1s to all pauses"
            >
              <Plus className="w-3 h-3" /> 1s
            </button>
            <button
              type="button"
              onClick={() => adjustAllPauses(-1.0)}
              className="px-2 py-1 text-xs rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 flex items-center gap-0.5 cursor-pointer"
              title="Subtract 1s from all pauses"
            >
              <Minus className="w-3 h-3" /> 1s
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* PERSISTENT AUDIO INBOX & QUEUE TRAY */}
      <div className="flex flex-col gap-4 bg-stone-50 dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 rounded-3xl p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                Audio Inbox & Projects Queue
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Uploaded tracks stay safely here until you are ready to space & process them.
              </p>
            </div>
          </div>

          {/* Filter Pills & Batch Upload Trigger */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/70 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => setProjectStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  projectStatusFilter === 'all'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                All ({projectListResult?.total_count || 0})
              </button>
              <button
                type="button"
                onClick={() => setProjectStatusFilter('unprocessed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  projectStatusFilter === 'unprocessed'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Inbox / Raw ({projectListResult?.unprocessed_count || 0})
              </button>
              <button
                type="button"
                onClick={() => setProjectStatusFilter('processed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  projectStatusFilter === 'processed'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Paced Masters ({projectListResult?.processed_count || 0})
              </button>
            </div>

            {/* Batch Upload Audio Button */}
            <label className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0">
              <input
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac"
                onChange={handleBatchFilesUpload}
                disabled={isBatchUploading}
                className="hidden"
              />
              {isBatchUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Batch...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Upload Audio Files</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Project Cards Grid */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
            {projects.map((proj) => {
              const isCurrent = activeProject?.id === proj.id;
              const isProcessed = proj.status === 'processed';

              return (
                <div
                  key={proj.id}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-500 shadow-md ring-2 ring-amber-500/30'
                      : 'bg-white dark:bg-[#0a0c10] border-stone-200/80 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-700'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {/* Status Badge & Actions */}
                    <div className="flex items-center justify-between gap-1.5">
                      {isProcessed ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Paced Master
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> In Inbox (Raw)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete audio "${proj.title}"?`)) {
                            deleteProjectMutation.mutate(proj.id);
                          }
                        }}
                        className="p-1 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                        title="Delete audio project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Title */}
                    <h4
                      onClick={() => handleOpenProject(proj)}
                      className="text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-2 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                      title={proj.title}
                    >
                      {proj.title}
                    </h4>

                    {/* Duration Info */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      <span>Raw: {formatTime(proj.duration)}</span>
                      {isProcessed && proj.spaced_duration > 0 && (
                        <>
                          <ChevronRight className="w-3 h-3 text-stone-400" />
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {formatTime(proj.spaced_duration)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center justify-between gap-1.5 pt-3 mt-2 border-t border-stone-100 dark:border-stone-800/80">
                    <button
                      type="button"
                      onClick={() => handleOpenProject(proj)}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-700 dark:text-stone-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>{isCurrent ? 'Editing' : 'Open in Lab'}</span>
                    </button>

                    {isProcessed && proj.download_url && (
                      <div className="flex items-center gap-1">
                        <a
                          href={proj.download_url}
                          download={proj.spaced_filename || 'spaced_voiceover.mp3'}
                          className="p-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 transition-colors"
                          title="Download Paced MP3"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const dur = proj.spaced_duration || proj.duration;
                            onUseInStudio(proj.spaced_filename || proj.filename, dur, proj.script_text);
                          }}
                          className="p-1 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-600 transition-colors font-bold"
                          title="Send directly to Video Studio"
                        >
                          <Film className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No audio files in inbox yet. Drag and drop audio files above to build your audio pacing queue!
            </p>
          </div>
        )}
      </div>

      {/* Editor Section (Shown when a file/project is opened) */}
      {analysisData && (
        <div className="flex flex-col gap-6">
          {/* Top Bar: Source Switcher & Global Duration Comparison */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-stone-100/90 dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Audio Source:</span>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/70 dark:bg-stone-900 border border-stone-300 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAudioSource('original');
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeAudioSource === 'original'
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  Raw Voiceover ({formatTime(analysisData.duration)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (processedResult || activeProject?.spaced_filename) {
                      setActiveAudioSource('spaced');
                      setCurrentTime(0);
                      setIsPlaying(false);
                    } else {
                      handleProcessSpacing();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeAudioSource === 'spaced'
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {processedResult || activeProject?.spaced_duration
                      ? `Paced Master (${formatTime(processedResult?.spaced_duration || activeProject?.spaced_duration || 0)})`
                      : `Paced Preview (${formatTime(calculatedEstimatedDuration)})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-stone-500">Original:</span>
                <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                  {formatTime(analysisData.duration)}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-stone-500">Paced Master:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatTime(processedResult?.spaced_duration || activeProject?.spaced_duration || calculatedEstimatedDuration)}
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                +{formatTime((processedResult?.spaced_duration || activeProject?.spaced_duration || calculatedEstimatedDuration) - analysisData.duration)} pauses
              </div>
            </div>
          </div>

          {/* MAIN VIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Waveform & Master Actions (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              {/* Waveform Visualizer */}
              <AudioWaveform
                peaks={currentPeaks}
                duration={activeDuration || duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                onTogglePlay={handleTogglePlay}
                segments={segments}
                activeSegmentId={activeSegmentId}
                isDark={isDark}
              />

              {/* Master Process & Export Actions Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Master & Export Paced Voiceover</span>
                  </h3>
                  {(processedResult || activeProject?.status === 'processed') && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Master Ready
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Splices raw audio losslessly at natural silence midpoints with 50ms S-curve soft fades, ensuring zero word clipping.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Process Master Button */}
                  <button
                    type="button"
                    onClick={handleProcessSpacing}
                    disabled={isProcessing}
                    className="h-11 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Rendering Master...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                        <span>Render Spaced Master</span>
                      </>
                    )}
                  </button>

                  {/* Download MP3 */}
                  <a
                    href={processedResult ? processedResult.download_url : activeProject?.download_url || '#'}
                    download={processedResult?.spaced_filename || activeProject?.spaced_filename || 'paced_voiceover.mp3'}
                    onClick={(e) => {
                      if (!processedResult && !activeProject?.spaced_filename) {
                        e.preventDefault();
                        handleProcessSpacing();
                      }
                    }}
                    className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      processedResult || activeProject?.spaced_filename
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                        : 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-400'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP3</span>
                  </a>

                  {/* Send to Video Studio */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!processedResult && !activeProject?.spaced_filename) {
                        await handleProcessSpacing();
                      }
                      const activeFile = processedResult?.spaced_filename || activeProject?.spaced_filename || `${analysisData.file_id}_spaced.mp3`;
                      const durSec = processedResult?.spaced_duration || activeProject?.spaced_duration || calculatedEstimatedDuration;

                      try {
                        const studioRes = await api.sendAudioToStudio(activeFile);
                        onUseInStudio(studioRes.filename, durSec, scriptText);
                      } catch (e) {
                        onUseInStudio(activeFile, durSec, scriptText);
                      }
                    }}
                    className="h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <Film className="w-4 h-4 fill-current" />
                    <span>Send to Video Studio</span>
                  </button>
                </div>
              </div>

              {/* Segment Search & Filter */}
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search phrases or words in script..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <span className="text-xs text-stone-400 shrink-0 font-mono">
                  {filteredSegments.length} of {segments.length} phrases
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: DUAL SCRIPT REFERENCE & SPOKEN TELEPROMPTER (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              {/* Header & View Mode Switcher */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                    Script Reference & Teleprompter
                  </span>
                </div>

                {/* View Mode Toggle Pills */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setRightViewMode('split')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      rightViewMode === 'split'
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Columns className="w-3 h-3" />
                    <span>Split View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightViewMode('spoken')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      rightViewMode === 'spoken'
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <List className="w-3 h-3" />
                    <span>Spoken Words</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightViewMode('script')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      rightViewMode === 'script'
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Reference Script</span>
                  </button>
                </div>
              </div>

              {/* DUAL WORKSPACE LAYOUT */}
              <div className={`grid gap-3 items-start ${rightViewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* 1. REFERENCE SCRIPT PANEL (Shown in 'split' or 'script' mode) */}
                {(rightViewMode === 'split' || rightViewMode === 'script') && (
                  <div className="flex flex-col gap-2.5 p-3 rounded-2xl bg-stone-50 dark:bg-[#0d1017] border border-stone-200 dark:border-stone-800/80 shadow-inner">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                          Written Reference Script
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScriptText(SAMPLE_SCRIPT_WITH_TAGS)}
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Insert Sample
                      </button>
                    </div>

                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Paste your original script with pause tags like <code className="text-amber-600 font-mono text-[10px]">(pause)</code> or <code className="text-amber-600 font-mono text-[10px]">(15s)</code>.
                    </p>

                    <textarea
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      placeholder="Paste your written meditation script here with (pause) tags..."
                      rows={rightViewMode === 'split' ? 18 : 22}
                      className="w-full p-3 rounded-xl bg-white dark:bg-[#141822] border border-stone-200 dark:border-stone-800 text-xs text-stone-900 dark:text-stone-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none font-mono"
                    />

                    {/* Align Button */}
                    <button
                      type="button"
                      onClick={handleAlignScript}
                      disabled={isAligningScript}
                      className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                    >
                      {isAligningScript ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Aligning Script with Audio...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>✨ Align Script & Pause Tags with Audio</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 2. SPOKEN PHRASE CARDS (Shown in 'split' or 'spoken' mode) */}
                {(rightViewMode === 'split' || rightViewMode === 'spoken') && (
                  <div
                    ref={teleprompterRef}
                    className={`flex flex-col gap-2.5 max-h-[640px] overflow-y-auto p-3 rounded-2xl bg-stone-50 dark:bg-[#0d1017] border border-stone-200 dark:border-stone-800/80 shadow-inner`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-stone-200/60 dark:border-stone-800/60">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        Spoken Audio Phrases ({filteredSegments.length})
                      </span>
                      <span className="text-[10px] text-stone-400">Click to jump & verify words</span>
                    </div>

                    {filteredSegments.map((seg) => {
                      const isActive = seg.id === activeSegmentId;
                      return (
                        <div
                          key={seg.id}
                          ref={isActive ? activeCardRef : null}
                          className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                            isActive
                              ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600 shadow-md ring-2 ring-amber-500/30'
                              : 'bg-white dark:bg-[#141822] border-stone-200/80 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-800'
                          }`}
                        >
                          {/* Phrase Header: Timecode & Jump Play */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleJumpToSegment(seg)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  isActive && isPlaying
                                    ? 'bg-amber-500 text-stone-950 animate-pulse'
                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-200'
                                }`}
                                title="Play this spoken phrase"
                              >
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                              </button>
                              <span className="font-mono text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                                {formatTime(seg.start_time)} - {formatTime(seg.end_time)}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono text-stone-400">
                              #{seg.index + 1}
                            </span>
                          </div>

                          {/* Editable / Clickable Phrase Text (Glows when active!) */}
                          <p
                            onClick={() => handleJumpToSegment(seg)}
                            className={`text-xs leading-relaxed font-medium cursor-pointer transition-colors ${
                              isActive
                                ? 'text-amber-950 dark:text-amber-100 font-bold'
                                : 'text-stone-800 dark:text-stone-200 hover:text-amber-600'
                            }`}
                          >
                            {seg.text}
                          </p>

                          {/* Pause Duration Controls */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 dark:border-stone-800/60 flex-wrap">
                            <span className="text-[10px] text-stone-500 dark:text-stone-400">Pause:</span>

                            {/* Quick Pause Preset Selector */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {[
                                { label: '0s', val: 0.0 },
                                { label: '4s', val: 4.0 },
                                { label: '6s', val: 6.0 },
                                { label: '10s', val: 10.0 },
                                { label: '15s', val: 15.0 },
                              ].map((p) => (
                                <button
                                  key={p.label}
                                  type="button"
                                  onClick={() => updateSegmentPause(seg.id, p.val)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${
                                    Math.abs(seg.pause_duration - p.val) < 0.1
                                      ? 'bg-amber-500 text-stone-950 font-bold'
                                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}

                              {/* Custom Input */}
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="60"
                                value={seg.pause_duration}
                                onChange={(e) => updateSegmentPause(seg.id, parseFloat(e.target.value) || 0)}
                                className="w-10 px-1 py-0.5 text-[10px] font-mono font-bold text-center rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none"
                                title="Custom pause in seconds"
                              />
                              <span className="text-[10px] text-stone-400">s</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
