import { useEffect, useState } from 'react';
import { Card, Badge, Button, Input } from '../components/ui';
import { api, type Content, type ScheduledPost, type SocialAccount } from '../lib/api';

function statusVariant(status: string) {
  if (status === 'published') return 'success' as const;
  if (status === 'failed' || status === 'dead' || status === 'uncertain') return 'destructive' as const;
  if (status === 'scheduled' || status === 'publishing') return 'warning' as const;
  return 'default' as const;
}

export function ScheduledPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [contentId, setContentId] = useState('');
  const [socialAccountId, setSocialAccountId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<'self_only' | 'public'>('self_only');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [scheduledPosts, contentItems, socialAccounts] = await Promise.all([
      api.listScheduledPosts(),
      api.listContent(),
      api.listSocialAccounts(),
    ]);
    setPosts(scheduledPosts);
    setContent(contentItems.filter((item) => item.status === 'approved'));
    setAccounts(socialAccounts);
    if (!contentId && contentItems.length > 0) {
      const firstApproved = contentItems.find((item) => item.status === 'approved');
      if (firstApproved) setContentId(firstApproved.id);
    }
    if (!socialAccountId && socialAccounts.length > 0) {
      setSocialAccountId(socialAccounts[0].id);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createScheduledPost({
        contentId,
        socialAccountId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        privacyLevel,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Scheduled TikTok Posts</h2>
        <p className="text-muted-foreground">Publishing status lives on the job, not on Content</p>
      </div>

      <Card>
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Approved content</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              required
            >
              <option value="">Select content</option>
              {content.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">TikTok account</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={socialAccountId}
              onChange={(e) => setSocialAccountId(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Privacy</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value as 'self_only' | 'public')}
            >
              <option value="self_only">Only me</option>
              <option value="public">Public</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Schedule Post</Button>
        </form>
      </Card>

      {posts.length === 0 ? (
        <Card>
          <p className="text-muted-foreground text-sm">No scheduled posts yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Post {post.id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Privacy: {post.privacyLevel}</p>
                  {post.publishedAt && (
                    <p className="text-xs text-muted-foreground">
                      Published: {new Date(post.publishedAt).toLocaleString()}
                    </p>
                  )}
                  {post.externalPostId && (
                    <p className="text-xs text-muted-foreground">
                      External ID: {post.externalPostId}
                    </p>
                  )}
                  {post.error && <p className="text-xs text-destructive">Error: {post.error}</p>}
                  {post.retryCount > 0 && (
                    <p className="text-xs text-warning">Retries: {post.retryCount}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                  {(post.status === 'scheduled' || post.status === 'failed') && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        api
                          .cancelScheduledPost(post.id)
                          .then(() => load())
                          .catch((e) => setError(e.message))
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
