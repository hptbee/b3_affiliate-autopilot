import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, Badge, Button, Input, Textarea } from '../components/ui';
import { api, type Content, type Media } from '../lib/api';

function statusVariant(status: string) {
  if (status === 'approved') return 'success' as const;
  if (status === 'cancelled') return 'destructive' as const;
  if (status === 'draft') return 'warning' as const;
  return 'default' as const;
}

export function ContentPage() {
  const [items, setItems] = useState<Content[]>([]);
  const [mediaByContent, setMediaByContent] = useState<Record<string, Media | null>>({});
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const content = await api.listContent();
    setItems(content);
    const mediaEntries = await Promise.all(
      content.map(async (item) => {
        try {
          const media = await api.getMedia(item.id);
          return [item.id, media] as const;
        } catch {
          return [item.id, null] as const;
        }
      }),
    );
    setMediaByContent(Object.fromEntries(mediaEntries));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createContent({ title, body });
      setTitle('');
      setBody('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (contentId: string, file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await api.uploadMedia(contentId, file);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">TikTok Content</h2>
        <p className="text-muted-foreground">
          Upload a video, approve the draft, then schedule it from the Scheduled page
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Draft</CardTitle>
        </CardHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            placeholder="Hook"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            placeholder="Script and caption..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Draft'}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">All Content</h3>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No content yet. Create your first draft.</p>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {mediaByContent[item.id] ? (
                    <p className="text-xs text-muted-foreground">
                      Video: {mediaByContent[item.id]?.mimeType} (
                      {Math.round((mediaByContent[item.id]?.size ?? 0) / 1024)} KB)
                    </p>
                  ) : (
                    <p className="text-xs text-warning">No video uploaded</p>
                  )}
                  <Input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={(e) => handleUpload(item.id, e.target.files?.[0])}
                  />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  {item.status === 'draft' && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        api
                          .approveContent(item.id)
                          .then(() => load())
                          .catch((e) => setError(e.message))
                      }
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
