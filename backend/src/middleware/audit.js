/**
 * BoredRoom Booking — Audit Log Middleware
 * Logs data access for HIPAA-mode businesses.
 */

const pool = require('../db/pool');

function auditLog(action, resourceType) {
  return async (req, res, next) => {
    // Only audit for authenticated users
    if (req.user && req.businessId) {
      try {
        // Check if business has HIPAA mode
        const biz = await pool.query('SELECT hipaa_mode FROM businesses WHERE id = $1', [req.businessId]);
        if (biz.rows[0]?.hipaa_mode) {
          await pool.query(
            `INSERT INTO audit_logs (business_id, owner_id, action, resource_type, resource_id, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.businessId,
              req.user.userId,
              action,
              resourceType,
              req.params.id || null,
              req.ip,
              req.headers['user-agent'] || null
            ]
          );
        }
      } catch (e) {
        console.error('Audit log error:', e.message);
      }
    }
    next();
  };
}

module.exports = { auditLog };
