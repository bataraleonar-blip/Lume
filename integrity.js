async function inspectIntegrity(pool) {
  const checks = {};

  const duplicateProviders = await pool.query(`
    SELECT provider_transaction_id, COUNT(*)::int AS count
    FROM purchases
    WHERE provider_transaction_id IS NOT NULL
    GROUP BY provider_transaction_id
    HAVING COUNT(*) > 1
    LIMIT 100
  `);

  const duplicateOrders = await pool.query(`
    SELECT order_id, COUNT(*)::int AS count
    FROM purchases
    GROUP BY order_id
    HAVING COUNT(*) > 1
    LIMIT 100
  `);

  const accessWithoutPurchase = await pool.query(`
    SELECT ca.id
    FROM content_access ca
    LEFT JOIN purchases p ON p.id=ca.purchase_id
    WHERE p.id IS NULL
    LIMIT 100
  `);

  const activeExpired = await pool.query(`
    SELECT id
    FROM memberships
    WHERE active=true AND expires_at <= NOW()
    LIMIT 100
  `);

  checks.duplicateProviderTransactions = duplicateProviders.rows;
  checks.duplicateOrderIds = duplicateOrders.rows;
  checks.accessWithoutPurchase = accessWithoutPurchase.rows;
  checks.activeExpiredMemberships = activeExpired.rows;

  const issueCount =
    checks.duplicateProviderTransactions.length +
    checks.duplicateOrderIds.length +
    checks.accessWithoutPurchase.length +
    checks.activeExpiredMemberships.length;

  return { ok: issueCount === 0, issueCount, checks };
}

module.exports = { inspectIntegrity };
