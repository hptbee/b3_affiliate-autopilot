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

export interface ScheduledPost {
  id: string;
  contentId: string;
  socialAccountId: string;
  scheduledAt: string;
  status: string;
  publishedAt: string | null;
  externalPostId: string | null;
  error: string | null;
  retryCount: number;
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

  listScheduledPosts: () => request<ScheduledPost[]>('/api/scheduled-posts'),

  listSocialAccounts: () => request<SocialAccount[]>('/api/social-accounts'),
};
