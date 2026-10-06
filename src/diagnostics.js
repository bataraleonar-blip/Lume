const logger = require("./logger");

async function getDiagnostics(pool) {
  const result = {
    generatedAt: new Date().toISOString(),
    version: "4.3.0",
    database: {},
    payments: {},
    access: {},
    finance: {}
  };

  try {
    const db = await pool.query("SELECT NOW() AS now, current_database() AS database");
    result.database = { ok: true, now: db.rows[0].now, database: db.rows[0].database };

    const p = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='paid')::int AS paid,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='failed')::int AS failed,
        COUNT(*) FILTER (WHERE status='paid' AND refunded_idr > 0)::int AS refunded_orders
      FROM purchases
    `);
    result.payments = p.rows[0];

    const a = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE active=true)::int AS active_members,
        COUNT(*) FILTER (WHERE active=false)::int AS inactive_members
      FROM memberships
    `);
    result.access = a.rows[0];

    const f = await pool.query(`
      SELECT
        COALESCE(SUM(amount_idr) FILTER (WHERE type='refund'),0)::bigint AS refund_adjustments,
        COUNT(*)::int AS adjustment_count
      FROM financial_adjustments
    `);
    result.finance = f.rows[0];

    return result;
  } catch (err) {
    logger.error({err}, "diagnostics query failed");
    return { ...result, ok:false };
  }
}

module.exports = { getDiagnostics };
