import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Minus
} from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { api } from '../api/client';
import { AudioAnalysisResult, AudioProcessResult, AudioSegment } from '../types';

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
  // File & script input state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    return analysisData?.audio_url || '';
  }, [activeAudioSource, processedResult, analysisData]);

  // Current active waveform peaks
  const currentPeaks = useMemo(() => {
    if (activeAudioSource === 'spaced' && processedResult?.waveform_peaks) {
      return processedResult.waveform_peaks;
    }
    return analysisData?.waveform_peaks || [];
  }, [activeAudioSource, processedResult, analysisData]);

  // Current active duration
  const activeDuration = useMemo(() => {
    if (activeAudioSource === 'spaced' && processedResult?.spaced_duration) {
      return processedResult.spaced_duration;
    }
    return analysisData?.duration || 0;
  }, [activeAudioSource, processedResult, analysisData]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAnalysisData(null);
      setProcessedResult(null);
      setErrorMessage(null);
    }
  };

  // Trigger Audio Analysis
  const handleAnalyze = async () => {
    if (!audioFile) {
      setErrorMessage('Please select or drop an audio file first.');
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
    } catch (err: any) {
      console.error('Audio analysis error:', err);
      setErrorMessage(err.message || 'Failed to analyze audio file. Please check audio format.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger Spaced Audio Processing
  const handleProcessSpacing = async () => {
    if (!analysisData?.file_id || segments.length === 0) {
      setErrorMessage('No audio segments found to process.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await api.processAudioSpacing(analysisData.file_id, segments, 0.05);
      setProcessedResult(res);
      setActiveAudioSource('spaced');
      setCurrentTime(0);
      setIsPlaying(false);
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

      // Scroll smoothly to center
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
    const orig = analysisData?.duration || 0;
    const addedPauses = segments.reduce((acc, s) => acc + (s.pause_duration || 0), 0);
    return orig + addedPauses + 4.5; // includes intro lead-in and outro quiet buffer
  }, [analysisData, segments]);

  // Filtered segments for display
  const filteredSegments = useMemo(() => {
    if (!searchFilter.trim()) return segments;
    const q = searchFilter.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q) || s.index.toString().includes(q));
  }, [segments, searchFilter]);

  // Load sample script helper
  const handleLoadSampleScript = () => {
    setScriptText(SAMPLE_SCRIPT_WITH_TAGS);
  };

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
                Drop your raw voiceover audio, auto-space pauses to match your meditation script, and verify every spoken word.
              </p>
            </div>
          </div>
        </div>

        {/* Global Preset Shortcuts */}
        {analysisData && (
          <div className="flex items-center gap-1.5 flex-wrap">
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

      {/* Step 1: Input Setup (Dropzone & Script Area) */}
      {!analysisData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-stone-50 dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-xs">
          {/* Audio Dropzone */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-amber-500" />
              <span>Step 1: Upload Raw Voiceover Audio</span>
            </label>

            <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-400 rounded-2xl bg-white dark:bg-[#0a0c10] cursor-pointer transition-all group">
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  {audioFile ? audioFile.name : 'Click to upload or drag & drop audio'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Supports MP3, WAV, M4A, AAC, FLAC (Voiceover files from ElevenLabs, Audacity, etc.)
                </p>
              </div>
              {audioFile && (
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}
            </label>
          </div>

          {/* Script Input with Pause Tag recognition */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Step 2: Paste Script with Pause Markers (Optional)</span>
              </label>
              <button
                type="button"
                onClick={handleLoadSampleScript}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Load Example Meditation Script
              </button>
            </div>

            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Paste your meditation script here...
Tags recognized:
(pause) -> 6s
(short pause) -> 4s
(long pause) -> 12s
(15s pause) -> explicit seconds"
              rows={8}
              className="w-full p-4 rounded-2xl bg-white dark:bg-[#0a0c10] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />

            {/* Analyze trigger button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!audioFile || isAnalyzing}
              className="h-12 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer mt-1"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analyzing Silences & Aligning Script...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-current" />
                  <span>Analyze & Open Audio Lab Workspace</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace (Side-by-Side: Left Waveform & Controls, Right Synchronized Script Teleprompter) */}
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
                    if (processedResult) {
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
                    {processedResult
                      ? `Paced Master (${formatTime(processedResult.spaced_duration)})`
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
                  {formatTime(processedResult?.spaced_duration || calculatedEstimatedDuration)}
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                +{formatTime((processedResult?.spaced_duration || calculatedEstimatedDuration) - analysisData.duration)} pauses
              </div>
            </div>

            {/* Re-upload / change file */}
            <button
              type="button"
              onClick={() => {
                setAnalysisData(null);
                setProcessedResult(null);
                setIsPlaying(false);
              }}
              className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change Audio File</span>
            </button>
          </div>

          {/* SIDE-BY-SIDE MAIN VIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Waveform & Master Actions (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
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
                  {processedResult && (
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
                    href={processedResult ? processedResult.download_url : '#'}
                    download={processedResult?.spaced_filename || 'paced_voiceover.mp3'}
                    onClick={(e) => {
                      if (!processedResult) {
                        e.preventDefault();
                        handleProcessSpacing();
                      }
                    }}
                    className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      processedResult
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
                      if (!processedResult) {
                        await handleProcessSpacing();
                      }
                      const activeFile = processedResult?.spaced_filename || `${analysisData.file_id}_spaced.mp3`;
                      const durSec = processedResult?.spaced_duration || calculatedEstimatedDuration;
                      
                      try {
                        const studioRes = await api.sendAudioToStudio(activeFile);
                        onUseInStudio(studioRes.filename, durSec, scriptText);
                      } catch (e) {
                        // Fallback
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

            {/* RIGHT COLUMN: SYNCHRONIZED SCRIPT READER & TELEPROMPTER (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                    Synchronized Script Reader
                  </span>
                </div>
                <span className="text-[11px] text-stone-400">Click phrase to jump & verify words</span>
              </div>

              {/* Teleprompter Scrollable Container */}
              <div
                ref={teleprompterRef}
                className="flex flex-col gap-2.5 max-h-[620px] overflow-y-auto p-3 rounded-2xl bg-stone-50 dark:bg-[#0d1017] border border-stone-200 dark:border-stone-800/80 shadow-inner"
              >
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
                          Phrase #{seg.index + 1}
                        </span>
                      </div>

                      {/* Phrase Text (Glows when active so user can read along!) */}
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
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 dark:border-stone-800/60">
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">Trailing Pause:</span>

                        {/* Quick Pause Preset Selector */}
                        <div className="flex items-center gap-1">
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
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${
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
                            className="w-12 px-1.5 py-0.5 text-[10px] font-mono font-bold text-center rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none"
                            title="Custom pause in seconds"
                          />
                          <span className="text-[10px] text-stone-400">s</span>
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
