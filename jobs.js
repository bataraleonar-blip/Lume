const logger = require("./logger");

async function withJobLock(pool, jobName, fn) {
  const client = await pool.connect();
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [jobName]);
    if (!lock.rows[0].locked) {
      return { skipped: true, reason: "already_running" };
    }

    await client.query(`
      INSERT INTO system_jobs(job_name,last_started_at,last_status,last_error,updated_at)
      VALUES($1,NOW(),'running',NULL,NOW())
      ON CONFLICT(job_name) DO UPDATE SET
        last_started_at=NOW(), last_status='running', last_error=NULL, updated_at=NOW()
    `, [jobName]);

    try {
      const result = await fn(client);
      await client.query(`
        UPDATE system_jobs
        SET last_finished_at=NOW(), last_status='ok', last_error=NULL, updated_at=NOW()
        WHERE job_name=$1
      `, [jobName]);
      return { skipped: false, result };
    } catch (err) {
      await client.query(`
        UPDATE system_jobs
        SET last_finished_at=NOW(), last_status='failed', last_error=$2, updated_at=NOW()
        WHERE job_name=$1
      `, [jobName, String(err.message || err).slice(0,1000)]);
      throw err;
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [jobName]).catch(()=>{});
    }
  } finally {
    client.release();
  }
}

async function runIntegrityJobs(pool) {
  return withJobLock(pool, "lume_integrity", async (db) => {
    const membership = await db.query(`
      UPDATE memberships
      SET active=false
      WHERE active=true AND expires_at <= NOW()
      RETURNING id
    `);

    const orphanAccess = await db.query(`
      DELETE FROM content_access ca
      WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id=ca.post_id)
      RETURNING ca.id
    `);

    const orphanPurchases = await db.query(`
      SELECT p.id
      FROM purchases p
      LEFT JOIN creators c ON c.id = (
        SELECT creator_id FROM posts WHERE id=p.post_id
      )
      WHERE p.status='paid'
        AND p.post_id IS NOT NULL
        AND c.id IS NULL
      LIMIT 100
    `);

    const badAccounting = await db.query(`
      SELECT id
      FROM purchases
      WHERE status='paid'
        AND (
          creator_gross_idr IS NULL
          OR platform_fee_idr IS NULL
          OR creator_earning_idr IS NULL
          OR creator_gross_idr < 0
          OR platform_fee_idr < 0
          OR creator_earning_idr < 0
        )
      LIMIT 100
    `);

    return {
      expiredMemberships: membership.rowCount,
      orphanAccessRemoved: orphanAccess.rowCount,
      orphanPaidPurchases: orphanPurchases.rowCount,
      badAccountingPurchases: badAccounting.rowCount
    };
  });
}

async function getJobStatus(pool) {
  const result = await pool.query(`
    SELECT job_name,last_started_at,last_finished_at,last_status,last_error,updated_at
    FROM system_jobs
    ORDER BY job_name
  `);
  return result.rows;
}

module.exports = { withJobLock, runIntegrityJobs, getJobStatus };
