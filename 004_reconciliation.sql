ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS refunded_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none','requested','refunded','rejected')),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS financial_adjustments (
  id UUID PRIMARY KEY,
  purchase_id UUID REFERENCES purchases(id),
  creator_id UUID REFERENCES creators(id),
  type TEXT NOT NULL CHECK (type IN ('refund','fee','tax','manual_credit','manual_debit')),
  amount_idr BIGINT NOT NULL CHECK (amount_idr <> 0),
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_purchase ON financial_adjustments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_creator ON financial_adjustments(creator_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_created ON financial_adjustments(created_at DESC);

-- Existing memberships should be inactive once their expiry has passed.
UPDATE memberships
SET active=false
WHERE active=true AND expires_at<=NOW();
