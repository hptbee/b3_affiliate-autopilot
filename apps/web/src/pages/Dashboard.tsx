import { useEffect, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle, Badge } from '../components/ui';
import { api, type Content, type ScheduledPost } from '../lib/api';

function statusVariant(status: string) {
  if (status === 'published') return 'success' as const;
  if (status === 'failed') return 'destructive' as const;
  if (status === 'scheduled' || status === 'publishing') return 'warning' as const;
  return 'default' as const;
}

export function DashboardPage() {
  const [health, setHealth] = useState<{ status: string; environment: string } | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.health(), api.listContent(), api.listScheduledPosts()])
      .then(([h, c, s]) => {
        setHealth(h);
        setContent(c);
        setScheduled(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  const stats = [
    { label: 'Total Content', value: content.length },
    { label: 'Drafts', value: content.filter((c) => c.status === 'draft').length },
    { label: 'Scheduled Posts', value: scheduled.filter((s) => s.status === 'scheduled').length },
    { label: 'Published', value: scheduled.filter((s) => s.status === 'published').length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your social automation</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <p className="text-destructive text-sm">API Error: {error}</p>
          <p className="text-muted-foreground text-xs mt-1">
            Make sure the API worker is running: pnpm cf:dev
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          {health ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">API</span>
                <Badge variant="success">{health.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment</span>
                <span>{health.environment}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Connecting...</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Content</CardTitle>
          </CardHeader>
          {content.length === 0 ? (
            <p className="text-sm text-muted-foreground">No content yet</p>
          ) : (
            <ul className="space-y-2">
              {content.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.title}</span>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
