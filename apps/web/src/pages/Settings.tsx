import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Configure your automation platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Provider</CardTitle>
            <CardDescription>Configure via environment variables on the API worker</CardDescription>
          </CardHeader>
          <div className="text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Provider:</span> Set{' '}
              <code className="text-xs bg-muted px-1 rounded">AI_PROVIDER</code>
            </p>
            <p>
              <span className="text-muted-foreground">OpenAI:</span> Set{' '}
              <code className="text-xs bg-muted px-1 rounded">OPENAI_API_KEY</code> secret
            </p>
            <p>
              <span className="text-muted-foreground">Workers AI:</span> Uses built-in{' '}
              <code className="text-xs bg-muted px-1 rounded">AI</code> binding
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Coming in Phase 5</CardDescription>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            Multi-user authentication, teams, and role-based access control are planned for a
            future release.
          </p>
        </Card>
      </div>
    </div>
  );
}
