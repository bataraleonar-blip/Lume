CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  price_idr BIGINT NOT NULL CHECK (price_idr >= 0),
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id),
  title TEXT NOT NULL DEFAULT '',
  media_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  access_type TEXT NOT NULL CHECK (access_type IN ('free','member','premium')),
  price_idr BIGINT NOT NULL DEFAULT 0 CHECK (price_idr >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  contact TEXT NOT NULL,
  plan_id UUID REFERENCES plans(id),
  post_id UUID REFERENCES posts(id),
  amount_idr BIGINT NOT NULL CHECK (amount_idr >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  provider_transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY,
  contact TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id),
  purchase_id UUID NOT NULL UNIQUE REFERENCES purchases(id),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS content_access (
  id UUID PRIMARY KEY,
  contact TEXT NOT NULL,
  post_id UUID NOT NULL REFERENCES posts(id),
  purchase_id UUID NOT NULL UNIQUE REFERENCES purchases(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact, post_id, purchase_id)
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_creator_active ON posts(creator_id, active);
CREATE INDEX IF NOT EXISTS idx_posts_access_type ON posts(access_type);
CREATE INDEX IF NOT EXISTS idx_purchases_contact ON purchases(contact);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_memberships_contact_active ON memberships(contact, active, expires_at);
CREATE INDEX IF NOT EXISTS idx_content_access_contact_post ON content_access(contact, post_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit(created_at DESC);

INSERT INTO plans(id,name,price_idr,duration_days,active)
SELECT gen_random_uuid(),'Lume Member 30 Hari',99000,30,true
WHERE NOT EXISTS (
  SELECT 1 FROM plans WHERE duration_days=30 AND price_idr=99000 AND active=true
);
