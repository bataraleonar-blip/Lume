-- Prevent duplicate provider transaction IDs when Midtrans supplies one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_provider_transaction
ON purchases(provider_transaction_id)
WHERE provider_transaction_id IS NOT NULL;

-- A single successful payment should produce at most one membership/access row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_purchase
ON memberships(purchase_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_access_purchase
ON content_access(purchase_id);
