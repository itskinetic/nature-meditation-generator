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
  intent_match: number;
  theme_match: number;
  calmness: number;
  motion_intensity: number;
  visual_quality: number;
  subtheme?: string;
  environment_id?: string;
  is_approved: boolean;
  rejection_reason?: string;
  is_reused?: boolean;
  times_used?: number;
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
  environments?: string[];
  environment_clip_targets?: Record<string, number>;
  manual_intent?: string;
  manual_mood?: string[];
  target_duration: number;
  duration_unit: 'minutes' | 'hours' | 'seconds';
  maximum_unique_videos: number;
  minimum_clip_duration: number;
  maximum_clip_duration?: number;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  resolution: '1080p' | '4K';
  transition_type: string;
  transition_duration: number;
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
  preview_url?: string;
  creator_name?: string;
  duration: number;
  width: number;
  height: number;
  subtheme?: string;
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
}
