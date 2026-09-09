import {
  IntentAnalysisResult,
  Preset,
  SearchResponse,
  CandidateItem,
  GenerationRequest,
  JobDetail,
  JobProgress,
  LibraryItem,
  HistoryItem,
  ActiveJobItem,
  AudioSegment,
  AudioAnalysisResult,
  AudioProcessResult,
  AudioProjectItem,
  AudioProjectListResult,
  ApiErrorInfo,
} from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  status?: number;
  statusText?: string;
  detail?: string;
  endpoint?: string;
  category: ApiErrorInfo['category'];
  title: string;

  constructor(info: {
    title: string;
    message: string;
    detail?: string;
    status?: number;
    statusText?: string;
    endpoint?: string;
    category?: ApiErrorInfo['category'];
  }) {
    super(info.message);
    this.name = 'ApiError';
    this.title = info.title;
    this.status = info.status;
    this.statusText = info.statusText;
    this.detail = info.detail;
    this.endpoint = info.endpoint;
    this.category = info.category || 'server';
  }

  toInfo(): ApiErrorInfo {
    return {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: this.title,
      message: this.message,
      detail: this.detail,
      status: this.status,
      statusText: this.statusText,
      endpoint: this.endpoint,
      timestamp: new Date().toLocaleTimeString(),
      category: this.category,
    };
  }
}

type ApiErrorListener = (error: ApiErrorInfo) => void;
const apiErrorListeners: Set<ApiErrorListener> = new Set();

export function onApiError(listener: ApiErrorListener): () => void {
  apiErrorListeners.add(listener);
  return () => {
    apiErrorListeners.delete(listener);
  };
}

export function emitApiError(
  error: ApiErrorInfo | (Omit<ApiErrorInfo, 'id' | 'timestamp'> & { id?: string; timestamp?: string })
) {
  const fullError: ApiErrorInfo = {
    id: error.id || `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: error.timestamp || new Date().toLocaleTimeString(),
    ...error,
  };
  apiErrorListeners.forEach((fn) => {
    try {
      fn(fullError);
    } catch (e) {
      console.error('Error in apiErrorListener:', e);
    }
  });
}

export async function parseResponseError(
  res: Response,
  endpoint: string,
  fallbackTitle: string
): Promise<Omit<ApiErrorInfo, 'id' | 'timestamp'>> {
  let detail = '';

  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json) {
        if (json.detail) {
          detail = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
        } else if (json.message) {
          detail = typeof json.message === 'string' ? json.message : JSON.stringify(json.message);
        } else if (json.error) {
          detail = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
        }
      }
    } catch {
      if (text && text.length <= 500 && !text.includes('<!DOCTYPE')) {
        detail = text.trim();
      }
    }
  } catch {
    // Ignore body parsing failures
  }

  let title = fallbackTitle;
  let message = detail || `${fallbackTitle} (${res.status} ${res.statusText})`;
  let category: ApiErrorInfo['category'] = 'server';

  if (res.status === 429) {
    title = 'API Rate Limit Exceeded (HTTP 429)';
    message = detail || 'Too many requests were sent to the stock footage or AI API. Please wait 30–60 seconds before retrying.';
    category = 'rate_limit';
  } else if (res.status === 502) {
    title = 'Server Gateway Error (HTTP 502)';
    message = 'The backend server is temporarily unreachable or restarting. If hosted on Easypanel/VPS, please check that the container is active and has sufficient memory.';
    category = 'server';
  } else if (res.status === 503) {
    title = 'Service Unavailable (HTTP 503)';
    message = 'The server is temporarily overloaded or undergoing maintenance. Please try again shortly.';
    category = 'server';
  } else if (res.status === 504) {
    title = 'Gateway Timeout (HTTP 504)';
    message = 'The server took too long to complete the request. For heavy jobs, please monitor progress in the Queue Drawer.';
    category = 'server';
  } else if (res.status === 413) {
    title = 'File Too Large (HTTP 413)';
    message = 'The uploaded audio or video file exceeds the server size limit (100MB). Please choose a smaller file or reduce duration.';
    category = 'validation';
  } else if (res.status === 400 || res.status === 422) {
    title = 'Invalid Request Parameters';
    message = detail || 'The server rejected the request parameters. Please check your inputs.';
    category = 'validation';
  } else if (res.status === 401 || res.status === 403) {
    title = `Authentication Error (HTTP ${res.status})`;
    message = detail || 'API access was denied. Please verify your provider credentials or API keys.';
    category = 'provider';
  } else if (res.status === 500) {
    const lower = (detail || '').toLowerCase();
    if (lower.includes('gemini') || lower.includes('google.api_core') || lower.includes('resourceexhausted') || lower.includes('quota') || lower.includes('generativeai')) {
      title = 'Gemini AI API Error';
      message = `AI Director encountered an error: ${detail}. Please check your GEMINI_API_KEY in backend configuration and account quota.`;
      category = 'ai';
    } else if (lower.includes('pexels') || lower.includes('pixabay')) {
      title = 'Stock Video Provider Error';
      message = `Stock footage provider failed: ${detail}. Check your provider API keys in backend configuration.`;
      category = 'provider';
    } else if (lower.includes('ffmpeg') || lower.includes('codec') || lower.includes('encode')) {
      title = 'Video Rendering Engine Error';
      message = `FFmpeg video engine error: ${detail}`;
      category = 'server';
    } else {
      title = 'Server Error (HTTP 500)';
      message = detail || 'The server encountered an unexpected error while processing your request.';
      category = 'server';
    }
  }

  return {
    title,
    message,
    detail: detail || undefined,
    status: res.status,
    statusText: res.statusText,
    endpoint,
    category,
  };
}

export async function apiFetch<T>(
  endpoint: string,
  init?: RequestInit,
  fallbackTitle: string = 'API Request Failed'
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    const isNetwork = err?.name === 'TypeError' || err?.message?.includes('fetch') || err?.message?.includes('Network');
    const apiErr = new ApiError({
      title: isNetwork ? 'Network Connection Error' : 'Request Connection Failed',
      message: isNetwork
        ? 'Unable to connect to the backend server. The server may be offline, restarting, or your internet connection was interrupted.'
        : (err?.message || 'An unexpected network error occurred while communicating with the server.'),
      endpoint,
      category: isNetwork ? 'network' : 'client',
      detail: err?.stack || String(err),
    });
    emitApiError(apiErr.toInfo());
    throw apiErr;
  }

  if (!res.ok) {
    const errInfo = await parseResponseError(res, endpoint, fallbackTitle);
    const apiErr = new ApiError(errInfo);
    emitApiError(apiErr.toInfo());
    throw apiErr;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return (await res.text()) as unknown as T;
}

export async function extractResponseError(res: Response, fallback: string): Promise<string> {
  const parsed = await parseResponseError(res, '', fallback);
  return parsed.message;
}

export const api = {
  async healthCheck() {
    return apiFetch('/health', undefined, 'Health Check Failed');
  },

  async getPresets(mode: string = 'meditation'): Promise<Record<string, Preset>> {
    return apiFetch<Record<string, Preset>>(
      `/presets?mode=${encodeURIComponent(mode)}`,
      undefined,
      'Failed to Load Presets'
    );
  },

  async analyzeContent(
    title: string,
    script: string,
    manual_intent?: string,
    manual_mood?: string[],
    target_clips?: number,
    studio_mode?: string,
    avoid_queries?: string[]
  ): Promise<IntentAnalysisResult> {
    return apiFetch<IntentAnalysisResult>(
      '/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, script, manual_intent, manual_mood, target_clips, studio_mode, avoid_queries }),
      },
      'AI Director Analysis Failed'
    );
  },

  async regenerateOneKeyword(params: {
    bad_keyword: string;
    title?: string;
    script?: string;
    existing_queries?: string[];
    studio_mode?: string;
  }): Promise<{ old_keyword: string; new_keyword: string }> {
    return apiFetch<{ old_keyword: string; new_keyword: string }>(
      '/keywords/regenerate-one',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      'Keyword Regeneration Failed'
    );
  },

  async breakdownStoryboard(params: {
    title?: string;
    script: string;
    target_duration?: number;
    studio_mode?: string;
    audio_file?: string;
  }): Promise<import('../types').StoryboardBreakdownResult> {
    return apiFetch<import('../types').StoryboardBreakdownResult>(
      '/storyboard/breakdown',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      'Storyboard Breakdown Failed'
    );
  },

  async generateSubtitles(
    script: string,
    target_duration: number = 30.0,
    style: string = 'documentary_classic'
  ): Promise<{ segments: any[]; srt: string; ass: string }> {
    return apiFetch<{ segments: any[]; srt: string; ass: string }>(
      `/subtitles/generate?target_duration=${target_duration}&style=${encodeURIComponent(style)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      },
      'Subtitle Generation Failed'
    );
  },

  async searchCandidates(params: {
    title?: string;
    script?: string;
    queries?: string[];
    preset_name?: string;
    environments?: string[];
    environments_spec?: Array<{ id: string; name: string; queries: string[]; clip_count: number }>;
    storyboard_beats?: import('../types').VisualBeat[];
    enable_pexels: boolean;
    enable_pixabay: boolean;
    min_duration: number;
    max_duration?: number;
    aspect_ratio: string;
    resolution: string;
    exclude_all_history?: boolean;
    shot_preference?: string;
    studio_mode?: string;
    media_type?: string;
    page?: number;
    playback_speed?: number;
    prioritize_slow_motion?: boolean;
  }): Promise<SearchResponse> {
    return apiFetch<SearchResponse>(
      '/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      'Footage Search Failed'
    );
  },

  async banCandidate(candidate: {
    source_video_id: string;
    source?: string;
    source_url?: string;
    creator_name?: string;
    preview_url?: string;
    reason?: string;
  }): Promise<{ status: string; message: string }> {
    return apiFetch<{ status: string; message: string }>(
      '/candidates/ban',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      },
      'Failed to Ban Video Candidate'
    );
  },

  async unbanCandidate(sourceVideoId: string): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(
      `/candidates/unban?source_video_id=${encodeURIComponent(sourceVideoId)}`,
      {
        method: 'POST',
      },
      'Failed to Unban Video Candidate'
    );
  },

  async startGeneration(data: GenerationRequest): Promise<{ job_id: string; status: string; message: string }> {
    return apiFetch<{ job_id: string; status: string; message: string }>(
      '/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'Video Generation Request Failed'
    );
  },

  async getJobProgress(jobId: string): Promise<JobProgress> {
    return apiFetch<JobProgress>(`/jobs/${jobId}`, undefined, 'Failed to Get Job Progress');
  },

  async getJobDetail(jobId: string): Promise<JobDetail> {
    return apiFetch<JobDetail>(`/jobs/${jobId}/detail`, undefined, 'Failed to Get Job Details');
  },

  async cancelJob(jobId: string): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(
      `/jobs/${jobId}/cancel`,
      {
        method: 'POST',
      },
      'Failed to Cancel Job'
    );
  },

  async uploadMusic(file: File): Promise<{
    filename: string;
    original_name: string;
    path: string;
    duration_seconds: number;
    duration_minutes: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(
      '/music/upload',
      {
        method: 'POST',
        body: formData,
      },
      'Audio Upload Failed'
    );
  },

  async getLibrary(minCalmness?: number, minQuality?: number): Promise<LibraryItem[]> {
    const params = new URLSearchParams();
    if (minCalmness) params.append('min_calmness', minCalmness.toString());
    if (minQuality) params.append('min_quality', minQuality.toString());
    return apiFetch<LibraryItem[]>(`/library?${params.toString()}`, undefined, 'Failed to Load Library');
  },

  async saveCandidateToLibrary(candidate: CandidateItem): Promise<{ status: string; id: number; message: string }> {
    return apiFetch<{ status: string; id: number; message: string }>(
      '/library/save-candidate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      },
      'Failed to Save Video to Library'
    );
  },

  async batchSaveCandidates(
    candidates: CandidateItem[],
    title?: string
  ): Promise<{ status: string; saved_count: number; title?: string; message: string }> {
    return apiFetch(
      '/library/batch-save-candidates',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates, title }),
      },
      'Batch Save to Library Failed'
    );
  },

  async downloadSelectedClipsZip(candidates: CandidateItem[], title?: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/candidates/download-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates, title }),
      });
    } catch (err: any) {
      const isNetwork = err?.name === 'TypeError' || err?.message?.includes('fetch');
      const apiErr = new ApiError({
        title: isNetwork ? 'Network Connection Error' : 'Download ZIP Failed',
        message: 'Could not connect to the server to create clips ZIP archive.',
        endpoint: '/candidates/download-zip',
        category: isNetwork ? 'network' : 'client',
        detail: String(err),
      });
      emitApiError(apiErr.toInfo());
      throw apiErr;
    }

    if (!res.ok) {
      const errInfo = await parseResponseError(res, '/candidates/download-zip', 'Failed to Create ZIP Archive');
      const apiErr = new ApiError(errInfo);
      emitApiError(apiErr.toInfo());
      throw apiErr;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (title || 'selected_clips').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeTitle}_clips.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async deleteLibraryItem(id: number): Promise<{ status: string; id: number }> {
    return apiFetch(`/library/${id}`, { method: 'DELETE' }, 'Failed to Delete Library Item');
  },

  async batchDeleteLibraryItems(itemIds: number[]): Promise<{ status: string; deleted_count: number }> {
    return apiFetch(
      '/library/batch-delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds }),
      },
      'Batch Delete Library Items Failed'
    );
  },

  async clearLibrary(): Promise<{ status: string; count: number }> {
    return apiFetch('/library', { method: 'DELETE' }, 'Failed to Clear Library');
  },

  async getStorageStats(): Promise<import('../types').StorageStats> {
    return apiFetch<import('../types').StorageStats>('/storage/stats', undefined, 'Failed to Get Storage Stats');
  },

  async purgeStorage(
    target: string = 'scratch_jobs',
    keepFinalVideos: boolean = true
  ): Promise<{ status: string; target: string; deleted_count: number; reclaimed_mb: number; details: any }> {
    return apiFetch(
      '/storage/purge',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, keep_final_videos: keepFinalVideos }),
      },
      'Storage Purge Failed'
    );
  },

  async getHistory(): Promise<HistoryItem[]> {
    return apiFetch<HistoryItem[]>('/history', undefined, 'Failed to Get History');
  },

  async deleteHistoryItem(jobId: string): Promise<{ status: string; job_id: string }> {
    return apiFetch(`/history/${jobId}`, { method: 'DELETE' }, 'Failed to Delete History Item');
  },

  async clearHistory(
    scope: 'all' | 'purged' | 'failed' = 'all'
  ): Promise<{ status: string; deleted_count: number; scope: string }> {
    return apiFetch(
      '/history/clear',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      },
      'Failed to Clear History'
    );
  },

  async getActiveJobs(): Promise<ActiveJobItem[]> {
    return apiFetch<ActiveJobItem[]>('/jobs/active', undefined, 'Failed to Get Active Jobs');
  },

  async getKeywordBank(params?: {
    category?: string;
    favorites_only?: boolean;
  }): Promise<import('../types').KeywordBankItem[]> {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.favorites_only) q.append('favorites_only', 'true');
    return apiFetch<import('../types').KeywordBankItem[]>(
      `/keywords/bank?${q.toString()}`,
      undefined,
      'Failed to Fetch Keyword Bank'
    );
  },

  async addKeywordToBank(data: {
    keyword: string;
    category?: string;
    is_favorite?: boolean;
  }): Promise<import('../types').KeywordBankItem> {
    return apiFetch(
      '/keywords/bank',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'Failed to Add Keyword to Bank'
    );
  },

  async toggleKeywordFavorite(data: {
    keyword: string;
    is_favorite: boolean;
  }): Promise<{ status: string; keyword: string; is_favorite: boolean }> {
    return apiFetch(
      '/keywords/bank/toggle-favorite',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'Failed to Toggle Keyword Favorite'
    );
  },

  async deleteKeywordFromBank(id: number): Promise<{ status: string; id: number }> {
    return apiFetch(`/keywords/bank/${id}`, { method: 'DELETE' }, 'Failed to Delete Keyword from Bank');
  },

  // --- AUDIO LAB / SPACER API ---

  async uploadAndAnalyzeAudio(file: File, scriptText?: string): Promise<AudioAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (scriptText) {
      formData.append('script_text', scriptText);
    }
    return apiFetch<AudioAnalysisResult>(
      '/audio/upload',
      {
        method: 'POST',
        body: formData,
      },
      'Audio Upload & Analysis Failed'
    );
  },

  async reanalyzeAudio(fileId: string, scriptText?: string): Promise<AudioAnalysisResult> {
    return apiFetch<AudioAnalysisResult>(
      '/audio/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, script_text: scriptText }),
      },
      'Audio Re-Analysis Failed'
    );
  },

  async processAudioSpacing(
    fileId: string,
    segments: AudioSegment[],
    fadeDuration: number = 0.05
  ): Promise<AudioProcessResult> {
    return apiFetch<AudioProcessResult>(
      '/audio/process',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, segments, fade_duration: fadeDuration }),
      },
      'Audio Spacing Processing Failed'
    );
  },

  async sendAudioToStudio(filename: string): Promise<{
    filename: string;
    original_name: string;
    path: string;
    duration_seconds: number;
    duration_minutes: number;
    audio_url: string;
  }> {
    return apiFetch(
      '/audio/send-to-studio',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      },
      'Failed to Send Audio to Studio'
    );
  },

  async getAudioProjects(status?: string): Promise<AudioProjectListResult> {
    const q = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<AudioProjectListResult>(`/audio/projects${q}`, undefined, 'Failed to Load Audio Projects');
  },

  async batchUploadAudioFiles(files: File[], autoTranscribe: boolean = false): Promise<AudioProjectItem[]> {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    return apiFetch<AudioProjectItem[]>(
      `/audio/projects/batch-upload?auto_transcribe=${autoTranscribe}`,
      {
        method: 'POST',
        body: formData,
      },
      'Batch Audio Upload Failed'
    );
  },

  async getAudioProject(projectId: number): Promise<AudioProjectItem> {
    return apiFetch<AudioProjectItem>(`/audio/projects/${projectId}`, undefined, 'Failed to Load Audio Project');
  },

  async deleteAudioProject(projectId: number): Promise<{ status: string; id: number }> {
    return apiFetch(`/audio/projects/${projectId}`, { method: 'DELETE' }, 'Failed to Delete Audio Project');
  },

  async updateProjectScript(
    projectId: number,
    scriptText: string
  ): Promise<{ status: string; id: number; script_text: string }> {
    return apiFetch(
      `/audio/projects/${projectId}/script`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_text: scriptText }),
      },
      'Failed to Save Script'
    );
  },

  async updateProjectSegments(
    projectId: number,
    segments: AudioSegment[]
  ): Promise<{ status: string; id: number; segments_count: number }> {
    return apiFetch(
      `/audio/projects/${projectId}/segments`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }),
      },
      'Failed to Save Phrases'
    );
  },

  async alignReferenceScript(fileId: string, scriptText: string): Promise<AudioAnalysisResult> {
    return apiFetch<AudioAnalysisResult>(
      '/audio/align-script',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, script_text: scriptText }),
      },
      'Script Alignment Failed'
    );
  },

  async transcribeAudio(fileId: string): Promise<AudioAnalysisResult> {
    return apiFetch<AudioAnalysisResult>(
      '/audio/transcribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      },
      'Audio Transcription Failed'
    );
  },

  async transcribeProjectAsync(projectId: number): Promise<{ status: string; project_id: number; message: string }> {
    return apiFetch(
      `/audio/projects/${projectId}/transcribe-async`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      'Background Transcription Failed'
    );
  },

  getProjectDocxUrl(projectId: number): string {
    return `${API_BASE}/audio/projects/${projectId}/export-docx`;
  },
};
