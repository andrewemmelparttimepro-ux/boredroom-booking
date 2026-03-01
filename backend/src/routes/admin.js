const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'boredroom-admin-2026';

// Admin auth middleware
function verifyAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Not admin' });
    req.user = decoded;
    next();
  } catch (err) { return res.status(401).json({ error: 'Invalid token' }); }
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }
  const token = jwt.sign({ role: 'superadmin', userId: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// GET /api/admin/businesses
router.get('/businesses', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
        (SELECT COUNT(*) FROM clients c WHERE c.business_id = b.id) as client_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id AND a.status NOT IN ('cancelled')) as booking_count,
        (SELECT COUNT(*) FROM staff s WHERE s.business_id = b.id AND s.is_active = true) as staff_count
      FROM businesses b ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load businesses' });
  }
});

// GET /api/admin/stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [biz, bookings, clients] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM businesses'),
      pool.query("SELECT COUNT(*) FROM appointments WHERE status NOT IN ('cancelled')"),
      pool.query('SELECT COUNT(*) FROM clients'),
    ]);
    res.json({
      businesses: parseInt(biz.rows[0].count),
      totalBookings: parseInt(bookings.rows[0].count),
      totalClients: parseInt(clients.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// POST /api/admin/impersonate/:businessId
router.post('/impersonate/:businessId', verifyAdmin, async (req, res) => {
  try {
    const owner = await pool.query(
      'SELECT id, role FROM owners WHERE business_id = $1 LIMIT 1',
      [req.params.businessId]
    );
    if (owner.rows.length === 0) return res.status(404).json({ error: 'No owner found' });

    const token = jwt.sign(
      { userId: owner.rows[0].id, businessId: req.params.businessId, role: 'owner' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Impersonation failed' });
  }
});

module.exports = router;
