export interface PlannedEnvironment {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
  suggested_clips: number;
  enabled: boolean;
}

export interface IntentAnalysisResult {
  intent: string;
  mood: string[];
  energy_level: string;
  visual_style: string;
  preferred_colors: string[];
  visual_motifs: string[];
  avoid_visuals: string[];
  generated_queries: string[];
  planned_environments: PlannedEnvironment[];
}

export interface Preset {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  queries: string[];
  subthemes: string[];
  negative_terms: string[];
  preferred_colors: string[];
  visual_style: string;
}

export interface CandidateItem {
  source: string;
  source_video_id: string;
  source_url: string;
  creator_name: string;
  creator_url?: string;
  search_query?: string;
  duration: number;
  width: number;
  height: number;
  preview_url: string;
  download_url?: string;
  local_file_path?: string;
  media_type?: 'video' | 'image';
  image_url?: string;
  motion_style?: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down';
  beat_index?: number;
  intent_match: number;
  theme_match: number;
  calmness: number;
  motion_intensity: number;
  visual_quality: number;
  shot_type?: string;
  subtheme?: string;
  environment_id?: string;
  is_approved: boolean;
  rejection_reason?: string;
  is_reused?: boolean;
  times_used?: number;
}

export interface VisualBeat {
  beat_index: number;
  narrative_cue: string;
  visual_subject: string;
  habitat: string;
  action_type?: string;
  camera_shot?: string;
  keywords: string[];
  duration_seconds: number;
  start_time: number;
  end_time: number;
  assigned_candidate_id?: string;
  assigned_candidate?: CandidateItem;
}

export interface StoryboardBreakdownResult {
  title: string;
  total_beats: number;
  estimated_total_duration: number;
  visual_beats: VisualBeat[];
}

export interface SubtitleConfig {
  enabled: boolean;
  style: 'documentary_classic' | 'dynamic_highlight' | 'minimal_clean';
  burn_into_video: boolean;
  font_size?: number;
}

export interface EnvironmentSearchSpec {
  id: string;
  name: string;
  queries: string[];
  clip_count: number;
}

export interface SearchResponse {
  candidates: CandidateItem[];
  total_found: number;
  approved_count: number;
  rejected_count: number;
}

export interface GenerationRequest {
  title: string;
  script?: string;
  preset?: string;
  studio_mode?: 'meditation' | 'documentary';
  media_type?: 'video' | 'image' | 'both';
  environments?: string[];
  environment_clip_targets?: Record<string, number>;
  manual_intent?: string;
  manual_mood?: string[];
  shot_preference?: 'balanced' | 'still' | 'macro' | 'wide';
  storyboard_beats?: VisualBeat[];
  subtitle_config?: SubtitleConfig;
  voiceover_file?: string;
  target_duration: number;
  duration_unit: 'minutes' | 'hours' | 'seconds';
  maximum_unique_videos: number;
  minimum_clip_duration: number;
  maximum_clip_duration?: number;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  resolution: '1080p' | '4K';
  transition_type: string;
  transition_duration: number;
  playback_speed: number;  // 0.4, 0.5, 0.75, 1.0
  prioritize_slow_motion: boolean;
  loop_mode?: 'single_pass' | 'loop_to_target';
  allow_reuse: boolean;
  avoid_recently_used: boolean;
  enable_pexels: boolean;
  enable_pixabay: boolean;
  audio_mode: 'none' | 'upload' | 'ambient_synth';
  music_file?: string;
  selected_candidate_ids?: string[];
  candidate_pool?: CandidateItem[];
}

export interface JobProgress {
  job_id: string;
  status: string;
  progress: number;
  current_stage: string;
  candidate_count: number;
  approved_video_count: number;
  rejected_video_count: number;
  reused_video_count: number;
  new_video_count: number;
  estimated_sequence_duration: number;
  expected_repeat_count: number;
  output_path?: string;
  error_message?: string;
}

export interface JobDetail extends JobProgress {
  title?: string;
  script?: string;
  detected_intent?: string;
  detected_mood?: string[];
  preset?: string;
  target_duration_seconds: number;
  actual_duration_seconds: number;
  selected_video_count: number;
  transition_type: string;
  transition_duration: number;
  metadata?: Record<string, any>;
  candidates?: CandidateItem[];
}

export interface LibraryItem {
  id: number;
  source: string;
  source_video_id: string;
  source_url?: string;
  download_url?: string;
  stream_url?: string;
  local_file_path?: string;
  preview_url?: string;
  creator_name?: string;
  creator_url?: string;
  duration: number;
  width: number;
  height: number;
  subtheme?: string;
  shot_type?: string;
  used_in_titles?: string[];
  intent_score: number;
  theme_score: number;
  calmness_score: number;
  visual_quality_score: number;
  times_used: number;
  last_used_at?: string;
  is_approved: boolean;
}

export interface HistoryItem {
  job_id: string;
  title?: string;
  detected_intent?: string;
  duration: number;
  target_duration: number;
  number_of_clips: number;
  number_of_reused_clips: number;
  number_of_new_clips: number;
  repeat_count: number;
  render_date?: string;
  status: string;
  download_url?: string;
  error_message?: string;
  current_stage?: string;
}

export interface ActiveJobItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  current_stage: string;
  target_duration_seconds: number;
  type?: 'video' | 'audio' | string;
  audio_project_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface KeywordBankItem {
  id: number;
  keyword: string;
  category: string;
  is_favorite: boolean;
  times_used: number;
  last_used_at?: string;
  created_at?: string;
}

export interface AudioSegment {
  id: string;
  index: number;
  text: string;
  start_time: number;
  end_time: number;
  split_time: number;
  natural_silence_dur: number;
  pause_tag: string;
  pause_duration: number;
}

export interface AudioSilenceInterval {
  start: number;
  end: number;
  mid: number;
  duration: number;
}

export interface AudioAnalysisResult {
  file_id: string;
  original_name: string;
  duration: number;
  waveform_peaks: number[];
  silence_intervals: AudioSilenceInterval[];
  segments: AudioSegment[];
  audio_url: string;
}

export interface AudioProcessResult {
  file_id: string;
  original_duration: number;
  spaced_duration: number;
  total_pauses_count: number;
  total_silence_added: number;
  waveform_peaks: number[];
  spaced_filename: string;
  audio_url: string;
  download_url: string;
}

export interface AudioProjectItem {
  id: number;
  file_id: string;
  title: string;
  original_name: string;
  filename: string;
  duration: number;
  status: 'unprocessed' | 'transcribing' | 'transcribed' | 'processing' | 'processed' | 'failed' | string;
  script_text?: string;
  waveform_peaks: number[];
  segments: AudioSegment[];
  silence_intervals: AudioSilenceInterval[];
  spaced_filename?: string;
  spaced_duration: number;
  audio_url: string;
  download_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AudioProjectListResult {
  projects: AudioProjectItem[];
  total_count: number;
  unprocessed_count: number;
  processed_count: number;
}


