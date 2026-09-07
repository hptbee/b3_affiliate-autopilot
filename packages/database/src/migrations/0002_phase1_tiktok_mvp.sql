CREATE TABLE IF NOT EXISTS token_blobs (
  id TEXT PRIMARY KEY NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON oauth_states(expires_at);

ALTER TABLE scheduled_posts ADD COLUMN privacy_level TEXT NOT NULL DEFAULT 'self_only';
