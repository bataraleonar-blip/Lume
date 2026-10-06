CREATE TABLE IF NOT EXISTS admin_security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_events_created
  ON admin_security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_security_events_type
  ON admin_security_events(event_type, created_at);
