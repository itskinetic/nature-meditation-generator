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
  ActiveJobItem
} from '../types';

const API_BASE = '/api';

export const api = {
  async healthCheck() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getPresets(): Promise<Record<string, Preset>> {
    const res = await fetch(`${API_BASE}/presets`);
    if (!res.ok) throw new Error('Failed to load presets');
    return res.json();
  },

  async analyzeContent(
    title: string,
    script: string,
    manual_intent?: string,
    manual_mood?: string[],
    target_clips?: number
  ): Promise<IntentAnalysisResult> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, script, manual_intent, manual_mood, target_clips }),
    });
    if (!res.ok) throw new Error('Failed to analyze content');
    return res.json();
  },

  async searchCandidates(params: {
    queries?: string[];
    preset_name?: string;
    environments?: string[];
    environments_spec?: Array<{ id: string; name: string; queries: string[]; clip_count: number }>;
    enable_pexels: boolean;
    enable_pixabay: boolean;
    min_duration: number;
    max_duration?: number;
    aspect_ratio: string;
    resolution: string;
    exclude_all_history?: boolean;
    shot_preference?: string;
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

  async uploadMusic(file: File): Promise<{ filename: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/music`, {
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

  async deleteLibraryItem(id: number): Promise<{ status: string; id: number }> {
    const res = await fetch(`${API_BASE}/library/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete library item');
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

  async getNotionItems(status?: string): Promise<import('../types').NotionDatabaseResponse> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/notion/items${query}`);
    if (!res.ok) throw new Error('Failed to fetch Notion database items');
    return res.json();
  },

  async updateNotionStatus(pageId: string, status: string, downloadUrl?: string): Promise<{ success: boolean; page_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/notion/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: pageId, status, download_url: downloadUrl }),
    });
    if (!res.ok) throw new Error('Failed to update Notion status');
    return res.json();
  },
};
