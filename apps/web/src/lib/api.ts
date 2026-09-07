const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  return json.data ?? json;
}

export interface Content {
  id: string;
  userId: string;
  title: string;
  body: string;
  status: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  contentId: string;
  bucket: string;
  key: string;
  mediaType: string;
  mimeType: string;
  size: number;
  duration: number | null;
  createdAt: string;
}

export interface ScheduledPost {
  id: string;
  contentId: string;
  socialAccountId: string;
  scheduledAt: string;
  privacyLevel: string;
  status: string;
  publishedAt: string | null;
  externalPostId: string | null;
  error: string | null;
  retryCount: number;
  queuedAt: string | null;
  publishingStartedAt: string | null;
}

export interface SocialAccount {
  id: string;
  platform: string;
  displayName: string;
  status: string;
  createdAt: string;
}

export const api = {
  health: () => request<{ status: string; environment: string }>('/health'),

  listContent: () => request<Content[]>('/api/content'),

  createContent: (data: { title: string; body: string }) =>
    request<Content>('/api/content', { method: 'POST', body: JSON.stringify(data) }),

  approveContent: (id: string) =>
    request<Content>(`/api/content/${id}/approve`, { method: 'POST' }),

  uploadMedia: async (contentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/api/content/${contentId}/media`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Upload failed' } }));
      throw new Error(error.error?.message ?? `HTTP ${response.status}`);
    }
    const json = await response.json();
    return (json.data ?? json) as Media;
  },

  getMedia: (contentId: string) => request<Media | null>(`/api/content/${contentId}/media`),

  listScheduledPosts: () => request<ScheduledPost[]>('/api/scheduled-posts'),

  createScheduledPost: (data: {
    contentId: string;
    socialAccountId: string;
    scheduledAt: string;
    privacyLevel?: 'self_only' | 'public';
  }) =>
    request<ScheduledPost>('/api/scheduled-posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelScheduledPost: (id: string) =>
    request<ScheduledPost>(`/api/scheduled-posts/${id}/cancel`, { method: 'POST' }),

  listSocialAccounts: () => request<SocialAccount[]>('/api/social-accounts'),

  startTikTokOAuth: () => {
    window.location.href = `${API_BASE}/api/oauth/tiktok/start`;
  },
};
