import { useEffect, useState } from 'react';
import { Card, Badge, Button } from '../components/ui';
import { api, type SocialAccount } from '../lib/api';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSocialAccounts()
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">TikTok Account</h2>
          <p className="text-muted-foreground">Tokens never appear here. OAuth runs server-side.</p>
        </div>
        <Button onClick={() => api.startTikTokOAuth()}>Connect TikTok</Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {accounts.length === 0 ? (
        <Card>
          <p className="text-muted-foreground text-sm">
            No TikTok account connected yet. Use Connect TikTok or the local seed for a mock account.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{account.displayName}</h4>
                  <p className="text-sm text-muted-foreground">TikTok</p>
                </div>
                <Badge variant={account.status === 'active' ? 'success' : 'default'}>
                  {account.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
