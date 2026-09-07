import { useEffect, useState } from 'react';
import { Card, Badge } from '../components/ui';
import { api, type ScheduledPost } from '../lib/api';

function statusVariant(status: string) {
  if (status === 'published') return 'success' as const;
  if (status === 'failed') return 'destructive' as const;
  if (status === 'scheduled' || status === 'publishing') return 'warning' as const;
  return 'default' as const;
}

export function ScheduledPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listScheduledPosts()
      .then(setPosts)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Scheduled Posts</h2>
        <p className="text-muted-foreground">Publishing status lives on the job, not on Content</p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {posts.length === 0 ? (
        <Card>
          <p className="text-muted-foreground text-sm">No scheduled posts yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Post {post.id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                  </p>
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
                <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
