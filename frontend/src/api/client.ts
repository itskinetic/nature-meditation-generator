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
  AudioProjectListResult
} from '../types';

const API_BASE = '/api';

export const api = {
  async healthCheck() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getPresets(mode: string = 'meditation'): Promise<Record<string, Preset>> {
    const res = await fetch(`${API_BASE}/presets?mode=${encodeURIComponent(mode)}`);
    if (!res.ok) throw new Error('Failed to load presets');
    return res.json();
  },

  async analyzeContent(
    title: string,
    script: string,
    manual_intent?: string,
    manual_mood?: string[],
    target_clips?: number,
    studio_mode?: string
  ): Promise<IntentAnalysisResult> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, script, manual_intent, manual_mood, target_clips, studio_mode }),
    });
    if (!res.ok) throw new Error('Failed to analyze content');
    return res.json();
  },

  async breakdownStoryboard(params: {
    title?: string;
    script: string;
    target_duration?: number;
    studio_mode?: string;
    audio_file?: string;
  }): Promise<import('../types').StoryboardBreakdownResult> {
    const res = await fetch(`${API_BASE}/storyboard/breakdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to breakdown storyboard beats');
    return res.json();
  },

  async generateSubtitles(
    script: string,
    target_duration: number = 30.0,
    style: string = 'documentary_classic'
  ): Promise<{ segments: any[]; srt: string; ass: string }> {
    const res = await fetch(
      `${API_BASE}/subtitles/generate?target_duration=${target_duration}&style=${encodeURIComponent(style)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      }
    );
    if (!res.ok) throw new Error('Failed to generate subtitles');
    return res.json();
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
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to search candidate videos');
    return res.json();
  },

  async banCandidate(candidate: {
    source_video_id: string;
    source?: string;
    source_url?: string;
    creator_name?: string;
    preview_url?: string;
    reason?: string;
  }): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/candidates/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!res.ok) throw new Error('Failed to ban video candidate');
    return res.json();
  },

  async unbanCandidate(sourceVideoId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/candidates/unban?source_video_id=${encodeURIComponent(sourceVideoId)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to unban video candidate');
    return res.json();
  },

  async startGeneration(data: GenerationRequest): Promise<{ job_id: string; status: string; message: string }> {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to start video generation');
    return res.json();
  },

  async getJobProgress(jobId: string): Promise<JobProgress> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error('Failed to get job progress');
    return res.json();
  },

  async getJobDetail(jobId: string): Promise<JobDetail> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/detail`);
    if (!res.ok) throw new Error('Failed to get job details');
    return res.json();
  },

  async cancelJob(jobId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel job');
    return res.json();
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
    const res = await fetch(`${API_BASE}/music/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload music');
    return res.json();
  },

  async getLibrary(minCalmness?: number, minQuality?: number): Promise<LibraryItem[]> {
    const params = new URLSearchParams();
    if (minCalmness) params.append('min_calmness', minCalmness.toString());
    if (minQuality) params.append('min_quality', minQuality.toString());

    const res = await fetch(`${API_BASE}/library?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to get library items');
    return res.json();
  },

  async saveCandidateToLibrary(candidate: CandidateItem): Promise<{ status: string; id: number; message: string }> {
    const res = await fetch(`${API_BASE}/library/save-candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!res.ok) throw new Error('Failed to save video to library');
    return res.json();
  },

  async batchSaveCandidates(candidates: CandidateItem[], title?: string): Promise<{ status: string; saved_count: number; title?: string; message: string }> {
    const res = await fetch(`${API_BASE}/library/batch-save-candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates, title }),
    });
    if (!res.ok) throw new Error('Failed to batch save candidates to library');
    return res.json();
  },

  async downloadSelectedClipsZip(candidates: CandidateItem[], title?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/candidates/download-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates, title }),
    });
    if (!res.ok) throw new Error('Failed to create ZIP of selected clips');

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
    const res = await fetch(`${API_BASE}/library/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete library item');
    return res.json();
  },

  async batchDeleteLibraryItems(itemIds: number[]): Promise<{ status: string; deleted_count: number }> {
    const res = await fetch(`${API_BASE}/library/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: itemIds }),
    });
    if (!res.ok) throw new Error('Failed to batch delete library items');
    return res.json();
  },

  async clearLibrary(): Promise<{ status: string; count: number }> {
    const res = await fetch(`${API_BASE}/library`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear library');
    return res.json();
  },

  async getHistory(): Promise<HistoryItem[]> {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error('Failed to get history');
    return res.json();
  },

  async getActiveJobs(): Promise<ActiveJobItem[]> {
    const res = await fetch(`${API_BASE}/jobs/active`);
    if (!res.ok) throw new Error('Failed to get active jobs');
    return res.json();
  },

  async getKeywordBank(params?: { category?: string; favorites_only?: boolean }): Promise<import('../types').KeywordBankItem[]> {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.favorites_only) q.append('favorites_only', 'true');
    const res = await fetch(`${API_BASE}/keywords/bank?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch keyword bank');
    return res.json();
  },

  async addKeywordToBank(data: { keyword: string; category?: string; is_favorite?: boolean }): Promise<import('../types').KeywordBankItem> {
    const res = await fetch(`${API_BASE}/keywords/bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add keyword to bank');
    return res.json();
  },

  async toggleKeywordFavorite(data: { keyword: string; is_favorite: boolean }): Promise<{ status: string; keyword: string; is_favorite: boolean }> {
    const res = await fetch(`${API_BASE}/keywords/bank/toggle-favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to toggle keyword favorite');
    return res.json();
  },

  async deleteKeywordFromBank(id: number): Promise<{ status: string; id: number }> {
    const res = await fetch(`${API_BASE}/keywords/bank/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete keyword from bank');
    return res.json();
  },

  // --- AUDIO LAB / SPACER API ---

  async uploadAndAnalyzeAudio(file: File, scriptText?: string): Promise<AudioAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (scriptText) {
      formData.append('script_text', scriptText);
    }
    const res = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload audio' }));
      throw new Error(err.detail || 'Failed to upload and analyze audio');
    }
    return res.json();
  },

  async reanalyzeAudio(fileId: string, scriptText?: string): Promise<AudioAnalysisResult> {
    const res = await fetch(`${API_BASE}/audio/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, script_text: scriptText }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to re-analyze audio' }));
      throw new Error(err.detail || 'Failed to re-analyze audio');
    }
    return res.json();
  },

  async processAudioSpacing(fileId: string, segments: AudioSegment[], fadeDuration: number = 0.05): Promise<AudioProcessResult> {
    const res = await fetch(`${API_BASE}/audio/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, segments, fade_duration: fadeDuration }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to process audio' }));
      throw new Error(err.detail || 'Failed to process audio spacing');
    }
    return res.json();
  },

  async sendAudioToStudio(filename: string): Promise<{
    filename: string;
    original_name: string;
    path: string;
    duration_seconds: number;
    duration_minutes: number;
    audio_url: string;
  }> {
    const res = await fetch(`${API_BASE}/audio/send-to-studio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to send audio to studio' }));
      throw new Error(err.detail || 'Failed to send audio to studio');
    }
    return res.json();
  },

  async getAudioProjects(status?: string): Promise<AudioProjectListResult> {
    const q = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/audio/projects${q}`);
    if (!res.ok) throw new Error('Failed to load audio projects');
    return res.json();
  },

  async batchUploadAudioFiles(files: File[]): Promise<AudioProjectItem[]> {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    const res = await fetch(`${API_BASE}/audio/projects/batch-upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to batch upload audio files' }));
      throw new Error(err.detail || 'Failed to batch upload audio files');
    }
    return res.json();
  },

  async getAudioProject(projectId: number): Promise<AudioProjectItem> {
    const res = await fetch(`${API_BASE}/audio/projects/${projectId}`);
    if (!res.ok) throw new Error('Failed to load audio project');
    return res.json();
  },

  async deleteAudioProject(projectId: number): Promise<{ status: string; id: number }> {
    const res = await fetch(`${API_BASE}/audio/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete audio project');
    return res.json();
  },

  async updateProjectScript(projectId: number, scriptText: string): Promise<{ status: string; id: number; script_text: string }> {
    const res = await fetch(`${API_BASE}/audio/projects/${projectId}/script`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_text: scriptText }),
    });
    if (!res.ok) throw new Error('Failed to save script to database');
    return res.json();
  },

  async updateProjectSegments(projectId: number, segments: AudioSegment[]): Promise<{ status: string; id: number; segments_count: number }> {
    const res = await fetch(`${API_BASE}/audio/projects/${projectId}/segments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments }),
    });
    if (!res.ok) throw new Error('Failed to save updated phrases to database');
    return res.json();
  },

  async alignReferenceScript(fileId: string, scriptText: string): Promise<AudioAnalysisResult> {
    const res = await fetch(`${API_BASE}/audio/align-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, script_text: scriptText }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to align script' }));
      throw new Error(err.detail || 'Failed to align reference script');
    }
    return res.json();
  },

  async transcribeAudio(fileId: string): Promise<AudioAnalysisResult> {
    const res = await fetch(`${API_BASE}/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to transcribe audio' }));
      throw new Error(err.detail || 'Failed to transcribe audio');
    }
    return res.json();
  },

  async transcribeProjectAsync(projectId: number): Promise<{ status: string; project_id: number; message: string }> {
    const res = await fetch(`${API_BASE}/audio/projects/${projectId}/transcribe-async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to start background transcription' }));
      throw new Error(err.detail || 'Failed to start background transcription');
    }
    return res.json();
  },
};
