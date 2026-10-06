ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 70.00
    CHECK (commission_percent >= 0 AND commission_percent <= 100);

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS creator_gross_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_earning_idr BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id),
  amount_idr BIGINT NOT NULL CHECK (amount_idr > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled')),
  reference TEXT,
  note TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator_status
ON payouts(creator_id,status);

CREATE INDEX IF NOT EXISTS idx_purchases_creator_earning
ON purchases(creator_earning_idr);

-- Backfill existing paid purchases using the creator's current commission.
UPDATE purchases p
SET creator_gross_idr = p.amount_idr,
    creator_earning_idr = CASE
      WHEN po.creator_id IS NOT NULL
      THEN ROUND(p.amount_idr * c.commission_percent / 100.0)
      ELSE 0
    END,
    platform_fee_idr = CASE
      WHEN po.creator_id IS NOT NULL
      THEN p.amount_idr - ROUND(p.amount_idr * c.commission_percent / 100.0)
      ELSE p.amount_idr
    END
FROM posts po
LEFT JOIN creators c ON c.id=po.creator_id
WHERE p.post_id=po.id AND p.status='paid'
  AND p.creator_earning_idr=0;
