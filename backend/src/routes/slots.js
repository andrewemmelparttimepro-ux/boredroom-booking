const express = require('express');
const pool = require('../db/pool');
const { getAvailableSlots } = require('../services/slotEngine');

const router = express.Router();

// GET /api/slots?businessId=xxx&serviceId=xxx&staffId=xxx&date=YYYY-MM-DD
// Public endpoint — no auth required (for public booking widget)
router.get('/', async (req, res) => {
  const { businessId, serviceId, staffId, date, slug } = req.query;

  // Can look up by slug instead of businessId
  let bizId = businessId;
  if (!bizId && slug) {
    const bizResult = await pool.query('SELECT id FROM businesses WHERE slug = $1', [slug]);
    if (bizResult.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    bizId = bizResult.rows[0].id;
  }

  if (!bizId || !serviceId || !date) {
    return res.status(400).json({ error: 'businessId (or slug), serviceId, and date are required' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Date must be YYYY-MM-DD format' });
  }

  try {
    const slots = await getAvailableSlots(bizId, serviceId, staffId || 'any', date);
    res.json(slots);
  } catch (err) {
    console.error('Slots error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
