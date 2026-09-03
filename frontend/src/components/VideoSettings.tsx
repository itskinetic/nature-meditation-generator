import React, { useRef } from 'react';
import { Settings, Music, VolumeX, Sparkles, Upload, Repeat } from 'lucide-react';
import { GenerationRequest, Preset } from '../types';

interface VideoSettingsProps {
  settings: GenerationRequest;
  setSettings: React.Dispatch<React.SetStateAction<GenerationRequest>>;
  presets: Record<string, Preset>;
  onUploadMusic: (file: File) => void;
  isUploadingMusic: boolean;
  customMusicName?: string;
}

export const VideoSettings: React.FC<VideoSettingsProps> = ({
  settings,
  setSettings,
  onUploadMusic,
  isUploadingMusic,
  customMusicName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSetting = <K extends keyof GenerationRequest>(key: K, value: GenerationRequest[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200/90 dark:border-stone-800/80 rounded-2xl p-7 shadow-sm dark:shadow-xl dark:shadow-black/20 backdrop-blur-sm space-y-7 transition-colors duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">
            Video & Audio Settings
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Target Duration & Unit */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Target Duration
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={360}
              value={settings.target_duration}
              onChange={(e) => updateSetting('target_duration', Number(e.target.value))}
              className="w-2/3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />
            <select
              value={settings.duration_unit}
              onChange={(e) => updateSetting('duration_unit', e.target.value as any)}
              className="w-1/3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            >
              <option value="minutes">Mins</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>

        {/* Maximum Unique Videos */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Max Unique Clips: {settings.maximum_unique_videos}
          </label>
          <input
            type="range"
            min={4}
            max={100}
            value={settings.maximum_unique_videos}
            onChange={(e) => updateSetting('maximum_unique_videos', Number(e.target.value))}
            className="w-full h-2 bg-stone-200 dark:bg-stone-950 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-3"
          />
        </div>

        {/* Clip Duration Range (Min & Max) */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Clip Duration (Min - Max sec)
          </label>
          <div className="flex gap-2">
            <div className="w-1/2">
              <input
                type="number"
                min={5}
                max={120}
                placeholder="Min sec"
                value={settings.minimum_clip_duration}
                onChange={(e) => updateSetting('minimum_clip_duration', Number(e.target.value))}
                className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>
            <div className="w-1/2">
              <input
                type="number"
                min={5}
                max={300}
                placeholder="Max sec (optional)"
                value={settings.maximum_clip_duration || ''}
                onChange={(e) => updateSetting('maximum_clip_duration', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Aspect Ratio
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['16:9', '9:16', '1:1'] as const).map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => updateSetting('aspect_ratio', ar)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  settings.aspect_ratio === ar
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                {ar}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Output Resolution
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['1080p', '4K'] as const).map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => updateSetting('resolution', res)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  settings.resolution === res
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-300 shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Transition Type */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            Transition: {settings.transition_duration}s
          </label>
          <div className="flex gap-2">
            <select
              value={settings.transition_type}
              onChange={(e) => updateSetting('transition_type', e.target.value)}
              className="w-2/3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="crossfade">Crossfade (Smooth Dissolve)</option>
              <option value="fade">Fade through ambient</option>
              <option value="wipeleft">Gentle Soft Wipe</option>
              <option value="smoothleft">Smooth Pan</option>
            </select>
            <input
              type="number"
              step={0.5}
              min={0.5}
              max={5.0}
              value={settings.transition_duration}
              onChange={(e) => updateSetting('transition_duration', Number(e.target.value))}
              className="w-1/3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Sequence Playback & Looping Mode */}
      <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800/80">
        <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider flex items-center gap-2">
          <Repeat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Sequence Looping Mode
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateSetting('loop_mode', 'single_pass')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
              (settings.loop_mode || 'single_pass') === 'single_pass'
                ? 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                1 Loop (Single Pass - No Looping)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                Default
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Plays each selected clip once sequentially with no repeating loop cycles.
            </p>
          </button>

          <button
            type="button"
            onClick={() => updateSetting('loop_mode', 'loop_to_target')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
              settings.loop_mode === 'loop_to_target'
                ? 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                Loop Sequence to Duration
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold">
                Repeating
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Repeats the selected sequence across multiple cycles to fill the full target duration.
            </p>
          </button>
        </div>
      </div>

      {/* Audio Soundscape Mode Selector */}
      <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800/80">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Audio Track & Soundscape
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option 1: No Audio / Silent */}
          <button
            type="button"
            onClick={() => updateSetting('audio_mode', 'none')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${
              settings.audio_mode === 'none'
                ? 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5 text-stone-500" />
                No Audio (Silent)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold">
                Default
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Renders silent video ready for voiceover or external background music.
            </p>
          </button>

          {/* Option 2: Upload Custom Music */}
          <div
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
              settings.audio_mode === 'upload'
                ? 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            }`}
          >
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
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  updateSetting('audio_mode', 'upload');
                  if (!customMusicName) {
                    fileInputRef.current?.click();
                  }
                }}
                className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5 text-left"
              >
                <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Custom Audio File
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingMusic}
              className="text-[11px] font-medium py-1 px-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-amber-600 truncate text-left"
            >
              {isUploadingMusic ? 'Uploading...' : customMusicName ? customMusicName : 'Click to choose audio (.mp3, .wav)...'}
            </button>
          </div>

          {/* Option 3: Auto Ambient Drone */}
          <button
            type="button"
            onClick={() => updateSetting('audio_mode', 'ambient_synth')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${
              settings.audio_mode === 'ambient_synth'
                ? 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Ambient Soundscape
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              Generates a subtle 432Hz deep harmonic meditation drone with soft fade.
            </p>
          </button>
        </div>
      </div>

      {/* Provider & Reuse Checkbox Toggles */}
      <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-stone-700 dark:text-stone-300">
        <label className="flex items-center gap-2.5 cursor-pointer hover:text-stone-900 dark:hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={settings.allow_reuse}
            onChange={(e) => updateSetting('allow_reuse', e.target.checked)}
            className="rounded bg-stone-100 dark:bg-stone-950 border-stone-300 dark:border-stone-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
          />
          <span>Reuse Library Clips</span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer hover:text-stone-900 dark:hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={settings.avoid_recently_used}
            onChange={(e) => updateSetting('avoid_recently_used', e.target.checked)}
            className="rounded bg-stone-100 dark:bg-stone-950 border-stone-300 dark:border-stone-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
          />
          <span>Avoid Recent (24h)</span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer hover:text-stone-900 dark:hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={settings.enable_pexels}
            onChange={(e) => updateSetting('enable_pexels', e.target.checked)}
            className="rounded bg-stone-100 dark:bg-stone-950 border-stone-300 dark:border-stone-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
          />
          <span>Search Pexels API</span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer hover:text-stone-900 dark:hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={settings.enable_pixabay}
            onChange={(e) => updateSetting('enable_pixabay', e.target.checked)}
            className="rounded bg-stone-100 dark:bg-stone-950 border-stone-300 dark:border-stone-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
          />
          <span>Search Pixabay API</span>
        </label>
      </div>
    </div>
  );
};
