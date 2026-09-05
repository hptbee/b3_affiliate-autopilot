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
) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'linkedin', 'mock-linkedin-1', 'Dev LinkedIn', 'token-ref-linkedin', NULL, NULL, '{}', 'active', unixepoch(), unixepoch()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'x', 'mock-x-1', 'Dev X Account', 'token-ref-x', NULL, NULL, '{}', 'active', unixepoch(), unixepoch()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'facebook', 'mock-fb-1', 'Dev Facebook', 'token-ref-fb', NULL, NULL, '{}', 'active', unixepoch(), unixepoch()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'instagram', 'mock-ig-1', 'Dev Instagram', 'token-ref-ig', NULL, NULL, '{}', 'active', unixepoch(), unixepoch());
