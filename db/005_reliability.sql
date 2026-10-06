CREATE TABLE IF NOT EXISTS system_jobs (
  job_name TEXT PRIMARY KEY,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT 'never',
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_pending_created
  ON purchases(status, created_at);

CREATE INDEX IF NOT EXISTS idx_memberships_expiry
  ON memberships(active, expires_at);

CREATE INDEX IF NOT EXISTS idx_content_access_expiry
  ON content_access(expires_at);
