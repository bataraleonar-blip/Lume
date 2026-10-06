const crypto = require("crypto");
const logger = require("./logger");

function digest(value) {
  if (!value) return null;
  const salt = process.env.ADMIN_AUDIT_HASH_SALT || "change-this-salt-in-production";
  return crypto.createHmac("sha256", salt).update(String(value)).digest("hex");
}

function safeMetadata(metadata={}) {
  const allowed = {};
  for (const [key,value] of Object.entries(metadata)) {
    if (["email","phone","contact","password","token","secret","cookie","authorization"].includes(key)) continue;
    allowed[key] = value;
  }
  return allowed;
}

async function recordSecurityEvent(pool, eventType, success, req, metadata={}) {
  try {
    await pool.query(`
      INSERT INTO admin_security_events
      (event_type,success,ip_hash,user_agent_hash,metadata)
      VALUES($1,$2,$3,$4,$5)
    `, [
      eventType,
      Boolean(success),
      digest(req?.ip),
      digest(req?.headers?.["user-agent"]),
      safeMetadata(metadata)
    ]);
  } catch (err) {
    logger.error({err, eventType}, "failed to record admin security event");
  }
}

async function getSecuritySummary(pool) {
  const result = await pool.query(`
    SELECT event_type,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE success=false)::int AS failures,
           MAX(created_at) AS last_event
    FROM admin_security_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY event_type
    ORDER BY event_type
  `);
  return result.rows;
}

module.exports = { recordSecurityEvent, getSecuritySummary };
