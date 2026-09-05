# Seed data for local development
# Run: wrangler d1 execute social-autopilot-db --local --file=scripts/seed.sql

INSERT OR IGNORE INTO users (id, email, display_name, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'dev@social-autopilot.local',
  'Dev User',
  unixepoch(),
  unixepoch()
);

INSERT OR IGNORE INTO social_accounts (
  id, user_id, platform, external_account_id, display_name,
  access_token_ref, refresh_token_ref, token_expires_at,
  metadata, status, created_at, updated_at
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'tiktok',
  'mock-tiktok-1',
  'Dev TikTok',
  'token-ref-tiktok',
  NULL,
  NULL,
  '{}',
  'active',
  unixepoch(),
  unixepoch()
);
