const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/revenue?period=today|week|month|year&staffId=&serviceId=
router.get('/revenue', verifyToken, async (req, res) => {
  try {
    const { period, staffId, serviceId } = req.query;
    let dateFilter = "start_time::date = CURRENT_DATE";
    if (period === 'week') dateFilter = "start_time >= CURRENT_DATE - interval '7 days'";
    else if (period === 'month') dateFilter = "start_time >= CURRENT_DATE - interval '30 days'";
    else if (period === 'year') dateFilter = "start_time >= CURRENT_DATE - interval '365 days'";

    let extraFilter = '';
    const values = [req.businessId];
    let idx = 2;
    if (staffId) { extraFilter += ` AND a.staff_id = $${idx}`; values.push(staffId); idx++; }
    if (serviceId) { extraFilter += ` AND a.service_id = $${idx}`; values.push(serviceId); idx++; }

    const result = await pool.query(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(sv.price), 0) as total,
             COALESCE(AVG(sv.price), 0) as avg_per_booking
      FROM appointments a
      JOIN services sv ON a.service_id = sv.id
      WHERE a.business_id = $1 AND a.status IN ('completed','confirmed','pending') AND ${dateFilter} ${extraFilter}
    `, values);

    // Revenue by day
    const byDay = await pool.query(`
      SELECT a.start_time::date as date, COALESCE(SUM(sv.price), 0) as amount, COUNT(*) as count
      FROM appointments a
      JOIN services sv ON a.service_id = sv.id
      WHERE a.business_id = $1 AND a.status NOT IN ('cancelled') AND ${dateFilter} ${extraFilter}
      GROUP BY a.start_time::date ORDER BY date
    `, values);

    // Cancellation rate
    const cancelRate = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
             COUNT(*) as total
      FROM appointments WHERE business_id = $1 AND ${dateFilter}
    `, [req.businessId]);

    const cr = cancelRate.rows[0];
    const cancellationRate = cr.total > 0 ? (parseInt(cr.cancelled) / parseInt(cr.total) * 100).toFixed(1) : 0;

    res.json({
      ...result.rows[0],
      cancellationRate,
      byDay: byDay.rows
    });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
});

// GET /api/reports/bookings?period=
router.get('/bookings', verifyToken, async (req, res) => {
  try {
    const period = req.query.period || 'month';
    let dateFilter = "start_time >= CURRENT_DATE - interval '30 days'";
    if (period === 'week') dateFilter = "start_time >= CURRENT_DATE - interval '7 days'";
    else if (period === 'year') dateFilter = "start_time >= CURRENT_DATE - interval '365 days'";

    // By day of week
    const byDow = await pool.query(`
      SELECT EXTRACT(DOW FROM start_time) as dow, COUNT(*) as count
      FROM appointments WHERE business_id = $1 AND ${dateFilter} AND status NOT IN ('cancelled')
      GROUP BY dow ORDER BY dow
    `, [req.businessId]);

    // By hour
    const byHour = await pool.query(`
      SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
      FROM appointments WHERE business_id = $1 AND ${dateFilter} AND status NOT IN ('cancelled')
      GROUP BY hour ORDER BY hour
    `, [req.businessId]);

    // Source breakdown
    const bySource = await pool.query(`
      SELECT source, COUNT(*) as count
      FROM appointments WHERE business_id = $1 AND ${dateFilter} AND status NOT IN ('cancelled')
      GROUP BY source
    `, [req.businessId]);

    // Status breakdown
    const byStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM appointments WHERE business_id = $1 AND ${dateFilter}
      GROUP BY status
    `, [req.businessId]);

    res.json({ byDow: byDow.rows, byHour: byHour.rows, bySource: bySource.rows, byStatus: byStatus.rows });
  } catch (err) {
    console.error('Bookings report error:', err);
    res.status(500).json({ error: 'Failed to generate bookings report' });
  }
});

// GET /api/reports/services
router.get('/services', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sv.id, sv.name, sv.category, sv.price,
             COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as booking_count,
             COALESCE(SUM(sv.price) FILTER (WHERE a.status = 'completed'), 0) as revenue
      FROM services sv
      LEFT JOIN appointments a ON sv.id = a.service_id AND a.start_time >= CURRENT_DATE - interval '30 days'
      WHERE sv.business_id = $1 AND sv.is_active = true
      GROUP BY sv.id ORDER BY revenue DESC
    `, [req.businessId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate services report' });
  }
});

// GET /api/reports/staff
router.get('/staff', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name,
             COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as bookings,
             COALESCE(SUM(sv.price) FILTER (WHERE a.status = 'completed'), 0) as revenue,
             COUNT(a.id) FILTER (WHERE a.status = 'no_show') as no_shows,
             COUNT(a.id) as total
      FROM staff s
      LEFT JOIN appointments a ON s.id = a.staff_id AND a.start_time >= CURRENT_DATE - interval '30 days'
      LEFT JOIN services sv ON a.service_id = sv.id
      WHERE s.business_id = $1 AND s.is_active = true
      GROUP BY s.id ORDER BY revenue DESC
    `, [req.businessId]);

    const rows = result.rows.map(r => ({
      ...r,
      noShowRate: r.total > 0 ? (parseInt(r.no_shows) / parseInt(r.total) * 100).toFixed(1) + '%' : '0%'
    }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate staff report' });
  }
});

// GET /api/reports/clients
router.get('/clients', verifyToken, async (req, res) => {
  try {
    // New vs returning per month
    const newVsReturn = await pool.query(`
      SELECT DATE_TRUNC('month', c.created_at)::date as month, COUNT(*) as new_clients
      FROM clients c WHERE c.business_id = $1 AND c.created_at >= CURRENT_DATE - interval '12 months'
      GROUP BY month ORDER BY month
    `, [req.businessId]);

    // Top 10 by spend
    const topClients = await pool.query(`
      SELECT c.name, c.email, COALESCE(SUM(sv.price) FILTER (WHERE a.status = 'completed'), 0) as lifetime_spend,
             COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as visit_count
      FROM clients c
      LEFT JOIN appointments a ON c.id = a.client_id
      LEFT JOIN services sv ON a.service_id = sv.id
      WHERE c.business_id = $1
      GROUP BY c.id ORDER BY lifetime_spend DESC LIMIT 10
    `, [req.businessId]);

    // Retention
    const retention = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE rebookers > 0) as retained, COUNT(*) as total
      FROM (
        SELECT c.id, COUNT(a.id) FILTER (WHERE a.start_time >= CURRENT_DATE - interval '60 days' AND a.status NOT IN ('cancelled')) as rebookers
        FROM clients c LEFT JOIN appointments a ON c.id = a.client_id
        WHERE c.business_id = $1 GROUP BY c.id
      ) sub
    `, [req.businessId]);

    const ret = retention.rows[0];
    const retentionRate = ret.total > 0 ? (parseInt(ret.retained) / parseInt(ret.total) * 100).toFixed(1) : 0;

    res.json({ newPerMonth: newVsReturn.rows, topClients: topClients.rows, retentionRate });
  } catch (err) {
    console.error('Client report error:', err);
    res.status(500).json({ error: 'Failed to generate client report' });
  }
});

module.exports = router;
