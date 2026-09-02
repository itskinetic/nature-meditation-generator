import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  Inbox,
  Trash2,
  FolderOpen,
  ArrowLeft,
  Search,
  CheckCheck,
  Scissors,
  ArrowDownToLine,
  X
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
  const [toastNotification, setToastNotification] = useState<{
    id: number;
    title: string;
    message: string;
    projectId?: number;
  } | null>(null);

  // Load persistent Audio Projects from SQLite with smart polling during background tasks
  const { data: projectListResult, isLoading: isProjectsLoading, refetch: refetchProjects } = useQuery<AudioProjectListResult>({
    queryKey: ['audioProjects', projectStatusFilter],
    queryFn: () => api.getAudioProjects(projectStatusFilter),
    refetchInterval: (query) => {
      const projs = query.state.data?.projects || [];
      const isWorking = projs.some((p) => p.status === 'transcribing' || p.status === 'processing');
      return isWorking ? 2500 : false;
    },
  });

  // Active Editor State
  const [activeProject, setActiveProject] = useState<AudioProjectItem | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState<string>('');
  const [saveStatusText, setSaveStatusText] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAligningScript, setIsAligningScript] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const autosaveTimeoutRef = useRef<any>(null);
  const prevProjectsRef = useRef<Map<number, string>>(new Map());

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<'phrases' | 'script'>('phrases');
  const [isMasterOutdated, setIsMasterOutdated] = useState<boolean>(false);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const teleprompterRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Focus ref tracking for Enter (split) and Backspace (merge) navigation
  const pendingFocusRef = useRef<{ segId?: string; cursorPosition: number } | null>(null);
  const textareaRefs = useRef<{ [id: string]: HTMLTextAreaElement | null }>({});

  // Auto-focus target phrase card and set cursor position after Enter or Backspace
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { segId, cursorPosition } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      if (segId && textareaRefs.current[segId]) {
        const el = textareaRefs.current[segId];
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(cursorPosition, cursorPosition);
          } catch {
            // Ignore if unsupported
          }
        }
      }
    }
  }, [segments]);

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

  // Auto-restore project from session / localStorage across reloads
  useEffect(() => {
    const savedProjId = localStorage.getItem('zenhub_active_audio_project_id');
    if (savedProjId && !activeProject && projectListResult?.projects) {
      const match = projectListResult.projects.find((p) => String(p.id) === savedProjId);
      if (match) {
        handleOpenProject(match);
      }
    }
  }, [projectListResult?.projects]);

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
    localStorage.setItem('zenhub_active_audio_project_id', String(project.id));

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
    setSaveStatusText('saved');
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
    localStorage.removeItem('zenhub_active_audio_project_id');
    setActiveProject(null);
    setSelectedProjectId(null);
    setAnalysisData(null);
    setSegments([]);
    setProcessedResult(null);
    setIsPlaying(false);
    setCurrentTime(0);
    refetchProjects();
  };

  // Debounced Autosave of Reference Script directly to SQLite Database
  const handleScriptTextChange = (newText: string) => {
    setScriptText(newText);
    const projId = activeProject?.id;
    if (!projId) return;

    setSaveStatusText('saving');
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.updateProjectScript(projId, newText);
        setSaveStatusText('saved');
        queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
      } catch (err) {
        console.warn('Database autosave error:', err);
        setSaveStatusText('idle');
      }
    }, 600);
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
      setSaveStatusText('saved');
      queryClient.invalidateQueries({ queryKey: ['audioProjects'] });
    } catch (err: any) {
      console.error('Script alignment error:', err);
      setErrorMessage(err.message || 'Failed to align reference script.');
    } finally {
      setIsAligningScript(false);
    }
  };

  // Completion & Notification watcher for background tasks
  useEffect(() => {
    const projs = projectListResult?.projects;
    if (!projs || projs.length === 0) return;

    projs.forEach((proj) => {
      const prevStatus = prevProjectsRef.current.get(proj.id);
      if (prevStatus === 'transcribing' && (proj.status === 'transcribed' || proj.status === 'unprocessed')) {
        const count = proj.segments?.length || 0;
        setToastNotification({
          id: Date.now(),
          title: 'AI Transcription Complete! 🎉',
          message: `Extracted ${count} spoken phrases for "${proj.title}". Saved to database.`,
          projectId: proj.id,
        });

        // If this project is currently open in the studio, auto-sync in 0ms!
        if (activeProject?.id === proj.id) {
          setSegments(proj.segments || []);
          setAnalysisData((prev) =>
            prev
              ? {
                  ...prev,
                  segments: proj.segments || [],
                  waveform_peaks: proj.waveform_peaks || prev.waveform_peaks,
                }
              : null
          );
          setIsTranscribing(false);
        }
      } else if (prevStatus === 'transcribing' && proj.status === 'failed') {
        setErrorMessage(`Background transcription failed for "${proj.title}". Please retry.`);
        if (activeProject?.id === proj.id) {
          setIsTranscribing(false);
        }
      }
      prevProjectsRef.current.set(proj.id, proj.status);
    });
  }, [projectListResult?.projects, activeProject?.id]);

  // Directly transcribe speech audio using Gemini AI in background
  const handleTranscribeAudio = async () => {
    const projId = activeProject?.id;
    const fileId = analysisData?.file_id || activeProject?.file_id;
    if (!projId && !fileId) {
      setErrorMessage('Please load an audio file first.');
      return;
    }

    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      if (projId) {
        await api.transcribeProjectAsync(projId);
        setToastNotification({
          id: Date.now(),
          title: 'Transcription Running in Background ⚡',
          message: 'Gemini AI is transcribing in the background. You can safely switch views or leave this page!',
          projectId: projId,
        });
        refetchProjects();
      } else if (fileId) {
        const res = await api.transcribeAudio(fileId);
        setAnalysisData(res);
        setSegments(res.segments);
        refetchProjects();
        setIsTranscribing(false);
      }
    } catch (err: any) {
      console.error('Speech transcription error:', err);
      setErrorMessage(err.message || 'Speech transcription failed.');
      setIsTranscribing(false);
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
      setIsMasterOutdated(false);
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
  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.warn('Play interrupted:', e));
    }
  }, []);

  // Global Keyboard Shortcuts (Space bar to toggle Play/Pause when not editing text)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only active if an audio file is loaded and in editor view
      if (!analysisData) return;

      // Do not intercept if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent accidental page scrolling
        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [analysisData, handleTogglePlay]);

  // Pre-calculate cumulative spaced time ranges for each segment when listening to spaced audio
  const spacedSegments = useMemo(() => {
    let currentSpacedTime = 0;
    return segments.map((seg) => {
      const segDuration = Math.max(0.1, seg.end_time - seg.start_time);
      const spacedStart = currentSpacedTime;
      const spacedEnd = currentSpacedTime + segDuration;
      currentSpacedTime = spacedEnd + (seg.pause_duration || 0);
      return {
        ...seg,
        spaced_start_time: spacedStart,
        spaced_end_time: spacedEnd,
      };
    });
  }, [segments]);

  // Unified segment synchronization helper for both playback timeupdate and scrubbing/seeking
  const syncActiveSegment = useCallback(
    (t: number) => {
      if (segments.length === 0) return;

      if (activeAudioSource === 'original') {
        // Find the segment that covers time t
        let activeSeg = segments.find((s) => t >= s.start_time && t < s.end_time);
        if (!activeSeg) {
          // If in silence gap between phrases, stay on the phrase that just finished
          const nextSeg = segments.find((s) => s.start_time > t);
          if (nextSeg && nextSeg.index > 0) {
            activeSeg = segments[nextSeg.index - 1];
          } else if (!nextSeg && segments.length > 0) {
            activeSeg = segments[segments.length - 1];
          } else if (segments.length > 0) {
            activeSeg = segments[0];
          }
        }
        if (activeSeg && activeSeg.id !== activeSegmentId) {
          setActiveSegmentId(activeSeg.id);
        }
      } else {
        // Spaced master playback
        let activeSeg = spacedSegments.find((s) => t >= s.spaced_start_time && t < s.spaced_end_time + (s.pause_duration || 0));
        if (!activeSeg) {
          const nextSeg = spacedSegments.find((s) => s.spaced_start_time > t);
          if (nextSeg && nextSeg.index > 0) {
            activeSeg = spacedSegments[nextSeg.index - 1];
          } else if (!nextSeg && spacedSegments.length > 0) {
            activeSeg = spacedSegments[spacedSegments.length - 1];
          } else if (spacedSegments.length > 0) {
            activeSeg = spacedSegments[0];
          }
        }
        if (activeSeg && activeSeg.id !== activeSegmentId) {
          setActiveSegmentId(activeSeg.id);
        }
      }
    },
    [segments, spacedSegments, activeAudioSource, activeSegmentId]
  );

  const handleSeek = (seekTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
    syncActiveSegment(seekTime);
  };

  // Jump to specific segment start & play
  const handleJumpToSegment = (seg: AudioSegment) => {
    const audio = audioRef.current;
    if (!audio) return;

    let targetTime = seg.start_time;
    if (activeAudioSource === 'spaced') {
      const spaced = spacedSegments.find((s) => s.id === seg.id);
      if (spaced) {
        targetTime = spaced.spaced_start_time;
      }
    }

    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    setActiveSegmentId(seg.id);
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  // Track time update and determine active segment for synchronized script reading
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime;
    setCurrentTime(t);
    syncActiveSegment(t);
  };

  // Auto-scroll the teleprompter script view to keep active segment comfortably in view without cutting off
  useEffect(() => {
    if (!autoScrollEnabled || !isPlaying || !activeSegmentId || !teleprompterRef.current) {
      return;
    }

    const container = teleprompterRef.current;
    const cardEl = container.querySelector(`[data-segment-id="${activeSegmentId}"]`) as HTMLElement | null;
    if (!cardEl) return;

    const cardTop = cardEl.offsetTop;
    const cardHeight = cardEl.offsetHeight;
    const containerHeight = container.clientHeight;
    const currentScrollTop = container.scrollTop;

    const cardVisibleTop = cardTop - currentScrollTop;
    const cardVisibleBottom = cardVisibleTop + cardHeight;
    const margin = 70;

    // Only scroll when card moves outside comfortable margin bounds
    if (cardVisibleTop < margin || cardVisibleBottom > containerHeight - margin) {
      const targetScrollTop = cardTop - containerHeight / 2 + cardHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeSegmentId, isPlaying, autoScrollEnabled]);

  // Update a single segment's text directly
  const updateSegmentText = (id: string, newText: string) => {
    setSegments((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, text: newText } : s));
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
      }
      return updated;
    });
  };

  // 1-Click Merge with Next Phrase (Delete Enter)
  const handleMergeWithNext = (segIndex: number) => {
    if (segIndex >= segments.length - 1) return;
    const currentSeg = segments[segIndex];
    const nextSeg = segments[segIndex + 1];

    const mergedSeg: AudioSegment = {
      ...currentSeg,
      text: `${currentSeg.text.trim()} ${nextSeg.text.trim()}`,
      start_time: currentSeg.start_time,
      end_time: nextSeg.end_time,
      split_time: nextSeg.split_time,
      pause_duration: nextSeg.pause_duration,
      natural_silence_dur: nextSeg.natural_silence_dur,
      pause_tag: nextSeg.pause_tag,
    };

    const updated = [
      ...segments.slice(0, segIndex),
      mergedSeg,
      ...segments.slice(segIndex + 2),
    ].map((s, idx) => ({ ...s, index: idx }));

    pendingFocusRef.current = { segId: currentSeg.id, cursorPosition: currentSeg.text.length };
    setSegments(updated);
    setIsMasterOutdated(true);
    if (activeProject?.id) {
      api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
    }
  };

  // Find the optimal split timestamp within [startTime, endTime], snapping to natural audio silences if available
  const findOptimalSplitTime = (
    startTime: number,
    endTime: number,
    preferredRatio: number = 0.5
  ): number => {
    const duration = Math.max(0.2, endTime - startTime);
    const targetTime = startTime + duration * preferredRatio;
    const fallbackTime = Number(targetTime.toFixed(2));

    const silences = analysisData?.silence_intervals || activeProject?.silence_intervals || [];
    if (!silences || silences.length === 0) {
      return fallbackTime;
    }

    // Find silence intervals that fall inside this phrase with 0.15s margin from boundaries
    const validSilences = silences.filter(
      (s) => s.mid >= startTime + 0.15 && s.mid <= endTime - 0.15
    );

    if (validSilences.length === 0) {
      return fallbackTime;
    }

    // Pick the silence midpoint closest to the target split point
    const bestSilence = validSilences.reduce((closest, current) => {
      return Math.abs(current.mid - targetTime) < Math.abs(closest.mid - targetTime)
        ? current
        : closest;
    }, validSilences[0]);

    return Number(bestSilence.mid.toFixed(2));
  };

  // Precision Nudge: shift the start timestamp of a phrase card (and previous card's end boundary)
  const nudgeStartTime = (segIndex: number, deltaSeconds: number) => {
    const seg = segments[segIndex];
    if (!seg) return;

    if (segIndex > 0) {
      const prevSeg = segments[segIndex - 1];
      const newBoundary = Math.round((seg.start_time + deltaSeconds) * 10) / 10;

      // Keep at least 0.2s minimum duration for each card
      if (newBoundary <= prevSeg.start_time + 0.2 || newBoundary >= seg.end_time - 0.2) {
        return;
      }

      const updatedPrev = {
        ...prevSeg,
        end_time: newBoundary,
        split_time: newBoundary,
      };
      const updatedCurrent = {
        ...seg,
        start_time: newBoundary,
      };

      const updated = [
        ...segments.slice(0, segIndex - 1),
        updatedPrev,
        updatedCurrent,
        ...segments.slice(segIndex + 1),
      ];

      setSegments(updated);
      setIsMasterOutdated(true);
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave error:', e));
      }
    } else {
      const newStart = Math.max(0, Math.min(seg.end_time - 0.2, Math.round((seg.start_time + deltaSeconds) * 10) / 10));
      const updated = segments.map((s, idx) => (idx === 0 ? { ...s, start_time: newStart } : s));
      setSegments(updated);
      setIsMasterOutdated(true);
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave error:', e));
      }
    }
  };

  // 1-Click Split Phrase (Add Enter) with Intelligent Silence Snapping
  const handleSplitSegment = (segIndex: number) => {
    const seg = segments[segIndex];
    if (!seg) return;

    const words = seg.text.trim().split(/\s+/);
    let text1 = seg.text;
    let text2 = '...';

    if (words.length > 1) {
      const midWord = Math.ceil(words.length / 2);
      text1 = words.slice(0, midWord).join(' ');
      text2 = words.slice(midWord).join(' ');
    }

    // Snap to natural silence midpoint if available
    const midTime = findOptimalSplitTime(seg.start_time, seg.end_time, 0.5);

    const seg1: AudioSegment = {
      ...seg,
      id: `seg_${Date.now()}_a`,
      text: text1,
      start_time: seg.start_time,
      end_time: midTime,
      split_time: midTime,
      pause_duration: 6.0,
    };

    const seg2: AudioSegment = {
      ...seg,
      id: `seg_${Date.now()}_b`,
      text: text2,
      start_time: midTime,
      end_time: seg.end_time,
      split_time: seg.split_time,
      pause_duration: seg.pause_duration,
    };

    const updated = [
      ...segments.slice(0, segIndex),
      seg1,
      seg2,
      ...segments.slice(segIndex + 1),
    ].map((s, idx) => ({ ...s, index: idx }));

    pendingFocusRef.current = { segId: seg2.id, cursorPosition: 0 };
    setSegments(updated);
    setIsMasterOutdated(true);
    if (activeProject?.id) {
      api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
    }
  };

  // Keyboard navigation & editing: Enter splits phrase; Backspace at offset 0 merges with previous; Delete at end merges with next
  const handlePhraseKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    segIndex: number
  ) => {
    const seg = segments[segIndex];
    if (!seg) return;
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd } = textarea;
    const fullText = seg.text;

    // 1. ENTER (without Shift) -> Split into 2 phrase cards at cursor position (with silence snapping!)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const cursorPos = selectionStart ?? fullText.length;
      const textBefore = fullText.slice(0, cursorPos).trim();
      const textAfter = fullText.slice(cursorPos).trim();

      // Calculate ratio and snap split time to nearest natural silence between words
      const ratio = fullText.length > 0 ? cursorPos / fullText.length : 0.5;
      const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
      const splitTime = findOptimalSplitTime(seg.start_time, seg.end_time, clampedRatio);

      const newId = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const seg1: AudioSegment = {
        ...seg,
        text: textBefore,
        end_time: splitTime,
        split_time: splitTime,
        pause_duration: 6.0,
      };

      const seg2: AudioSegment = {
        ...seg,
        id: newId,
        text: textAfter,
        start_time: splitTime,
        pause_duration: seg.pause_duration,
      };

      const updated = [
        ...segments.slice(0, segIndex),
        seg1,
        seg2,
        ...segments.slice(segIndex + 1),
      ].map((s, idx) => ({ ...s, index: idx }));

      // Immediately focus the second (newly created) card with cursor at start
      pendingFocusRef.current = { segId: newId, cursorPosition: 0 };
      setSegments(updated);
      setIsMasterOutdated(true);
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((err) => console.warn('Autosave segments error:', err));
      }
      return;
    }

    // 2. BACKSPACE at offset 0 (cursor at start of text) -> Merge with PREVIOUS card
    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      if (segIndex > 0) {
        e.preventDefault();
        const prevSeg = segments[segIndex - 1];
        const prevTextLen = prevSeg.text.length;
        const joinPos = prevTextLen + (prevSeg.text.length > 0 && fullText.length > 0 ? 1 : 0);

        const mergedText = prevSeg.text.trim()
          ? `${prevSeg.text.trim()}${fullText.trim() ? ' ' + fullText.trim() : ''}`
          : fullText.trim();

        const mergedSeg: AudioSegment = {
          ...prevSeg,
          text: mergedText,
          start_time: prevSeg.start_time,
          end_time: seg.end_time,
          split_time: seg.split_time,
          pause_duration: seg.pause_duration,
        };

        const updated = [
          ...segments.slice(0, segIndex - 1),
          mergedSeg,
          ...segments.slice(segIndex + 1),
        ].map((s, idx) => ({ ...s, index: idx }));

        // Focus the merged segment at the joint cursor position
        pendingFocusRef.current = { segId: prevSeg.id, cursorPosition: joinPos };
        setSegments(updated);
        setIsMasterOutdated(true);
        if (activeProject?.id) {
          api.updateProjectSegments(activeProject.id, updated).catch((err) => console.warn('Autosave segments error:', err));
        }
        return;
      }
    }

    // 3. DELETE at very end of text -> Merge NEXT card into this card
    if (e.key === 'Delete' && selectionStart === fullText.length && selectionEnd === fullText.length) {
      if (segIndex < segments.length - 1) {
        e.preventDefault();
        const nextSeg = segments[segIndex + 1];
        const currentPos = fullText.length;

        const mergedText = fullText.trim()
          ? `${fullText.trim()}${nextSeg.text.trim() ? ' ' + nextSeg.text.trim() : ''}`
          : nextSeg.text.trim();

        const mergedSeg: AudioSegment = {
          ...seg,
          text: mergedText,
          start_time: seg.start_time,
          end_time: nextSeg.end_time,
          split_time: nextSeg.split_time,
          pause_duration: nextSeg.pause_duration,
        };

        const updated = [
          ...segments.slice(0, segIndex),
          mergedSeg,
          ...segments.slice(segIndex + 2),
        ].map((s, idx) => ({ ...s, index: idx }));

        pendingFocusRef.current = { segId: seg.id, cursorPosition: currentPos };
        setSegments(updated);
        if (activeProject?.id) {
          api.updateProjectSegments(activeProject.id, updated).catch((err) => console.warn('Autosave segments error:', err));
        }
        return;
      }
    }
  };

  // Update a single segment's pause duration
  const updateSegmentPause = (id: string, pauseDuration: number) => {
    setSegments((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, pause_duration: Math.max(0, pauseDuration) } : s));
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
      }
      return updated;
    });
  };

  // Bulk pause adjustments
  const applyPresetToAll = (duration: number) => {
    setSegments((prev) => {
      const updated = prev.map((s) => ({ ...s, pause_duration: duration }));
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
      }
      return updated;
    });
  };

  const adjustAllPauses = (delta: number) => {
    setSegments((prev) => {
      const updated = prev.map((s) => ({ ...s, pause_duration: Math.max(0, Math.round((s.pause_duration + delta) * 10) / 10) }));
      if (activeProject?.id) {
        api.updateProjectSegments(activeProject.id, updated).catch((e) => console.warn('Autosave segments error:', e));
      }
      return updated;
    });
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

      {/* Floating Completion Toast Notification */}
      {toastNotification && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="p-4 rounded-2xl bg-stone-900 dark:bg-stone-800 text-white shadow-2xl border border-amber-500/40 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <h4 className="text-xs font-bold text-amber-300">
                  {toastNotification.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setToastNotification(null)}
                className="text-stone-400 hover:text-white p-0.5 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed font-mono">
              {toastNotification.message}
            </p>
            {toastNotification.projectId && (!activeProject || activeProject.id !== toastNotification.projectId) && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const targetProj = projects.find((p) => p.id === toastNotification.projectId);
                    if (targetProj) handleOpenProject(targetProj);
                    setToastNotification(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-[11px] font-bold hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Open in Studio →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Sliders className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h2 className="text-base md:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              Audio Lab & Meditation Studio
            </h2>
            <p className="text-[11px] md:text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
              Upload voiceovers, view word-for-word transcripts, and master pauses.
            </p>
          </div>
        </div>

        {/* Global Preset Shortcuts when an audio is open in editor */}
        {analysisData && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleCloseEditor}
              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 flex items-center gap-1 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Inbox</span>
            </button>
            <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 shrink-0">Presets:</span>
            <button
              type="button"
              onClick={() => applyPresetToAll(5.0)}
              className="px-2 py-1 text-[11px] rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer shrink-0"
            >
              Gentle (5s)
            </button>
            <button
              type="button"
              onClick={() => applyPresetToAll(8.0)}
              className="px-2 py-1 text-[11px] rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer shrink-0"
            >
              Standard (8s)
            </button>
            <button
              type="button"
              onClick={() => applyPresetToAll(15.0)}
              className="px-2 py-1 text-[11px] rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/80 hover:text-amber-800 dark:hover:text-amber-200 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer shrink-0"
            >
              Deep Rest (15s)
            </button>
            <button
              type="button"
              onClick={() => adjustAllPauses(1.0)}
              className="px-1.5 py-1 text-[11px] rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 flex items-center gap-0.5 cursor-pointer shrink-0"
              title="Add 1s to all pauses"
            >
              <Plus className="w-2.5 h-2.5" /> 1s
            </button>
            <button
              type="button"
              onClick={() => adjustAllPauses(-1.0)}
              className="px-1.5 py-1 text-[11px] rounded-lg font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 flex items-center gap-0.5 cursor-pointer shrink-0"
              title="Subtract 1s from all pauses"
            >
              <Minus className="w-2.5 h-2.5" /> 1s
            </button>
          </div>
        )}
      </div>

      {/* Interactive Diagnostic Error Prompt */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex flex-col gap-1.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>Operation Notice / Failure Reason:</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs leading-relaxed font-mono opacity-90 pl-6 bg-red-500/5 dark:bg-red-950/30 p-2 rounded-xl border border-red-500/20">
            {errorMessage}
          </p>
          <div className="flex items-center gap-2 pl-6 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handleTranscribeAudio}
              disabled={isTranscribing}
              className="px-2.5 py-1 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3 h-3 ${isTranscribing ? 'animate-spin' : ''}`} />
              <span>Retry AI Transcription</span>
            </button>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Tip: Quota issues resolve automatically in ~60 seconds.
            </span>
          </div>
        </div>
      )}

      {/* PERSISTENT AUDIO INBOX & QUEUE TRAY */}
      {!analysisData && (
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
                        {proj.status === 'transcribing' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Transcribing in Background...
                          </span>
                        ) : proj.status === 'transcribed' ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center gap-1">
                            <CheckCheck className="w-3 h-3" /> Transcribed ({proj.segments?.length || 0})
                          </span>
                        ) : isProcessed ? (
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
                            className="p-1.5 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-600 transition-colors font-bold cursor-pointer"
                            title="Send directly to Video Studio"
                          >
                            <Film className="w-3.5 h-3.5" />
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
                No audio files in inbox yet. Click "+ Upload Audio Files" above to add voiceovers!
              </p>
            </div>
          )}
        </div>
      )}

      {/* OPTION B: FULL-WIDTH STUDIO WORKSPACE (When an audio project is opened) */}
      {analysisData && (
        <div className="flex flex-col gap-4">
          {/* 1. TOP HEADER CONTROL DECK: Source Selector, Duration Metrics & Master Export Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 md:p-4 rounded-3xl bg-white dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 shadow-xs">
            {/* Audio Source Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAudioSource('original');
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                    activeAudioSource === 'original'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  Raw ({formatTime(analysisData.duration)})
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
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeAudioSource === 'spaced'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {processedResult || activeProject?.spaced_duration
                      ? `Paced (${formatTime(processedResult?.spaced_duration || activeProject?.spaced_duration || 0)})`
                      : `Paced (${formatTime(calculatedEstimatedDuration)})`}
                  </span>
                </button>
              </div>

              {/* Duration metrics */}
              <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-mono text-stone-500">
                <span className="hidden sm:inline text-stone-400">|</span>
                <span>Raw: {formatTime(analysisData.duration)}</span>
                <ChevronRight className="w-3 h-3 text-stone-400" />
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  Master: {formatTime(processedResult?.spaced_duration || activeProject?.spaced_duration || calculatedEstimatedDuration)}
                </span>
              </div>
            </div>

            {/* Master Export Actions */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto">
              {/* Render Spaced Master */}
              <button
                type="button"
                onClick={handleProcessSpacing}
                disabled={isProcessing}
                className={`h-8 md:h-9 px-2.5 md:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  isMasterOutdated
                    ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 ring-2 ring-amber-500/40 shadow-sm'
                    : 'bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-950'
                }`}
                title={isMasterOutdated ? 'Timings changed! Click to render new spaced audio file' : 'Render master spaced audio'}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : isMasterOutdated ? (
                  <>
                    <Sparkles className="w-3 h-3 fill-current text-stone-950" />
                    <span>Update Master ⚡</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-400 dark:text-amber-600" />
                    <span>Render Master</span>
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
                className={`h-8 md:h-9 px-2.5 md:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  processedResult || activeProject?.spaced_filename
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400'
                }`}
              >
                <Download className="w-3 h-3" />
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
                className="col-span-2 sm:col-span-1 h-8 md:h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-stone-950" />
                <span>Send to Video Studio</span>
              </button>
            </div>
          </div>

          {/* 2. TOP SECTION: FULL-WIDTH 100% INTERACTIVE WAVEFORM DECK */}
          <div className="w-full">
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
          </div>

          {/* Mobile Segmented Tab Switcher (< lg) */}
          <div className="flex lg:hidden items-center p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-800/80 border border-stone-300/60 dark:border-stone-700/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileTab('phrases')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mobileTab === 'phrases'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Spoken Phrases ({filteredSegments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('script')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mobileTab === 'script'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reference Script</span>
            </button>
          </div>

          {/* 3. BOTTOM SECTION: 50/50 ON DESKTOP, TABBED ON MOBILE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* LEFT 50%: WRITTEN REFERENCE SCRIPT STUDIO */}
            <div className={`flex flex-col gap-3 p-3 md:p-4 rounded-3xl bg-white dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 shadow-sm ${mobileTab === 'script' ? 'flex' : 'hidden lg:flex'}`}>
              {/* Sticky Top Toolbar for Script Editor */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-200 dark:border-stone-800 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                    Reference Script
                  </span>

                  {/* SQLite Database Autosave Badge */}
                  {saveStatusText === 'saving' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Saving...
                    </span>
                  )}
                  {saveStatusText === 'saved' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleScriptTextChange(SAMPLE_SCRIPT_WITH_TAGS)}
                    className="text-[11px] text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline cursor-pointer"
                  >
                    Sample
                  </button>

                  {/* Prominent Sticky Align Button */}
                  <button
                    type="button"
                    onClick={handleAlignScript}
                    disabled={isAligningScript}
                    className="h-7 md:h-8 px-2.5 md:px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] md:text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {isAligningScript ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Aligning...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Align Tags</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tag guide helper pills */}
              <div className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400 overflow-x-auto no-scrollbar py-0.5">
                <span className="shrink-0">Tags:</span>
                <code className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold shrink-0">
                  (pause)
                </code>
                <code className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold shrink-0">
                  (short pause)
                </code>
                <code className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold shrink-0">
                  (long pause)
                </code>
                <code className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold shrink-0">
                  (15s pause)
                </code>
              </div>

              {/* Full-size comfortable script editor */}
              <textarea
                value={scriptText}
                onChange={(e) => handleScriptTextChange(e.target.value)}
                placeholder="Paste your written meditation script here with (pause), (long pause), or (15s) tags..."
                rows={18}
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-[#0a0c10] border border-stone-200 dark:border-stone-800 text-xs text-stone-900 dark:text-stone-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-y"
              />
            </div>

            {/* RIGHT 50%: SPOKEN PHRASE TELEPROMPTER & PAUSE EDITOR */}
            <div className={`flex flex-col gap-3 p-3 md:p-4 rounded-3xl bg-white dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 shadow-sm ${mobileTab === 'phrases' ? 'flex' : 'hidden lg:flex'}`}>
              {/* Sticky Top Toolbar for Phrases & Search (2-Row Clean Responsive Layout) */}
              <div className="flex flex-col gap-2 pb-2.5 border-b border-stone-200 dark:border-stone-800">
                {/* Row 1: Title, Status Badge, Re-transcribe & Card Count */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                        Spoken Phrases
                      </span>
                    </div>

                    {segments.length > 0 && !segments.some((s) => s.text.startsWith('Spoken Phrase') || s.text.startsWith('Spoken Section')) ? (
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-0.5">
                          <CheckCheck className="w-3 h-3" /> Saved
                        </span>
                        <button
                          type="button"
                          onClick={handleTranscribeAudio}
                          disabled={isTranscribing}
                          className="h-6 px-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                          title="Re-run AI speech transcription"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isTranscribing ? 'animate-spin' : ''}`} />
                          <span>Re-Transcribe</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTranscribeAudio}
                        disabled={isTranscribing}
                        className="h-7 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        title="Transcribe speech audio into exact spoken phrases with Gemini AI"
                      >
                        {isTranscribing ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Transcribing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 fill-current" />
                            <span>AI Transcribe</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] font-mono font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full shrink-0">
                    {filteredSegments.length} {filteredSegments.length === 1 ? 'card' : 'cards'}
                  </span>
                </div>

                {/* Row 2: Search input + Auto-scroll toggle (Never overflowing or squashed!) */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search words..."
                      className="w-full h-7.5 pl-8 pr-2 text-xs rounded-xl bg-stone-50 dark:bg-[#0a0c10] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Auto-scroll toggle button */}
                  <button
                    type="button"
                    onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                    className={`h-7.5 px-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                      autoScrollEnabled
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs'
                        : 'bg-stone-100 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                    }`}
                    title={autoScrollEnabled ? 'Auto-scroll is ON during playback' : 'Auto-scroll is OFF'}
                  >
                    <span>Scroll</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${autoScrollEnabled ? 'bg-amber-500 animate-pulse' : 'bg-stone-400'}`} />
                  </button>
                </div>
              </div>

              {/* Active Background Transcribing Banner */}
              {(activeProject?.status === 'transcribing' || isTranscribing) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5 animate-pulse shadow-xs">
                  <RefreshCw className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs">
                      ⚡ Gemini AI is transcribing this voiceover in the background...
                    </span>
                    <span className="text-[11px] opacity-80">
                      You can safely switch projects or leave this view. Extracted spoken phrases will appear here automatically when done!
                    </span>
                  </div>
                </div>
              )}

              {/* Informative helper prompt when audio is untranscribed or showing fallback sections */}
              {!isTranscribing && activeProject?.status !== 'transcribing' && segments.some((s) => s.text.startsWith('Spoken Section') || s.text.startsWith('Spoken Phrase')) && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-[11px]">
                      Audio is currently split into silence segments. Click "AI Transcribe" to extract the exact spoken words!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTranscribeAudio}
                    disabled={isTranscribing}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 fill-current" />
                    <span>AI Transcribe Now</span>
                  </button>
                </div>
              )}

              {/* Scrollable list of ultra-compact phrase cards */}
              <div
                ref={teleprompterRef}
                className="flex flex-col gap-2.5 max-h-[640px] overflow-y-auto p-0.5 pr-1.5 relative"
              >
                {filteredSegments.map((seg) => {
                  const isActive = seg.id === activeSegmentId;

                  return (
                    <div
                      key={seg.id}
                      data-segment-id={seg.id}
                      ref={isActive ? activeCardRef : null}
                      className={`flex flex-col gap-1.5 p-3 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 shadow-sm ring-2 ring-amber-500/30'
                          : 'bg-stone-50 dark:bg-[#0a0c10] border-stone-200/80 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700'
                      }`}
                    >
                      {/* Phrase Header: Timecode & Jump Play */}
                      <div className="flex items-center justify-between gap-1.5 flex-nowrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleJumpToSegment(seg)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              isActive && isPlaying
                                ? 'bg-amber-500 text-stone-950 animate-pulse shadow-xs'
                                : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-200 dark:hover:bg-amber-950/80'
                            }`}
                            title="Play this spoken phrase"
                          >
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          </button>
                          <span className="font-mono text-[11px] font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap">
                            {formatTime(seg.start_time)} - {formatTime(seg.end_time)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono font-bold text-stone-400 bg-stone-200/60 dark:bg-stone-800 px-1.5 py-0.5 rounded-full">
                            #{seg.index + 1}
                          </span>
                        </div>
                      </div>

                      {/* Phrase Text (Editable & Keyboard Split/Merge Enabled) */}
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[seg.id] = el;
                        }}
                        rows={1}
                        value={seg.text}
                        onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                        onKeyDown={(e) => handlePhraseKeyDown(e, seg.index)}
                        className={`w-full text-xs leading-relaxed font-medium bg-transparent border-0 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-lg p-1 transition-colors ${
                          isActive
                            ? 'text-amber-950 dark:text-amber-100 font-bold bg-amber-500/10'
                            : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-900/60'
                        }`}
                        title="Click to edit. Press Enter to split into 2 phrases; Backspace at start to merge with previous."
                      />

                      {/* Pause Duration Controls on a Clean Single Non-wrapping Row */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 mt-0.5 border-t border-stone-200/60 dark:border-stone-800/60 flex-nowrap">
                        <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 shrink-0">
                          Pause:
                        </span>

                        <div className="flex items-center gap-1 flex-nowrap shrink-0">
                          {[
                            { label: '0s', val: 0.0, hideOnMobile: false },
                            { label: '4s', val: 4.0, hideOnMobile: true },
                            { label: '6s', val: 6.0, hideOnMobile: false },
                            { label: '10s', val: 10.0, hideOnMobile: true },
                            { label: '15s', val: 15.0, hideOnMobile: false },
                          ].map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => updateSegmentPause(seg.id, p.val)}
                              className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                                p.hideOnMobile ? 'hidden sm:inline-block' : 'inline-block'
                              } ${
                                Math.abs(seg.pause_duration - p.val) < 0.1
                                  ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                                  : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}

                          {/* Step Adjuster Controls (< and >) */}
                          <div className="flex items-center gap-0.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-0.5 shadow-2xs ml-0.5">
                            <button
                              type="button"
                              onClick={() => updateSegmentPause(seg.id, Math.max(0, Math.round((seg.pause_duration - 0.5) * 10) / 10))}
                              className="w-5 h-5 rounded-md flex items-center justify-center text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 transition-all cursor-pointer select-none"
                              title="Decrease pause by 0.5s"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="60"
                              value={seg.pause_duration}
                              onChange={(e) => updateSegmentPause(seg.id, parseFloat(e.target.value) || 0)}
                              className="w-8 h-5 text-[11px] font-mono font-bold text-center bg-transparent border-0 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Pause in seconds"
                            />

                            <button
                              type="button"
                              onClick={() => updateSegmentPause(seg.id, Math.round((seg.pause_duration + 0.5) * 10) / 10)}
                              className="w-5 h-5 rounded-md flex items-center justify-center text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-700 transition-all cursor-pointer select-none"
                              title="Increase pause by 0.5s"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono">s</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
