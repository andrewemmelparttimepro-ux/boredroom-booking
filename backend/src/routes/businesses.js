const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { validateSlug } = require('../middleware/validate');

const router = express.Router();

// GET /api/business — get current business profile
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, address, phone, email, timezone, logo_url, brand_color, created_at
       FROM businesses WHERE id = $1`,
      [req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get business error:', err);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// PATCH /api/business — update business fields
router.patch('/', verifyToken, async (req, res) => {
  const allowed = ['name', 'slug', 'address', 'phone', 'email', 'timezone', 'brand_color', 'logo_url'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      let val = req.body[key];
      if (key === 'slug') {
        val = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!validateSlug(val)) {
          return res.status(400).json({ error: 'Invalid slug format' });
        }
        // Check uniqueness
        const check = await pool.query('SELECT id FROM businesses WHERE slug = $1 AND id != $2', [val, req.businessId]);
        if (check.rows.length > 0) {
          return res.status(409).json({ error: 'Slug already taken' });
        }
      }
      updates.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.businessId);
  try {
    const result = await pool.query(
      `UPDATE businesses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update business error:', err);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

// GET /api/business/hours
router.get('/hours', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, day_of_week, is_open, open_time, close_time
       FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get hours error:', err);
    res.status(500).json({ error: 'Failed to fetch hours' });
  }
});

// PUT /api/business/hours — upsert all 7 days
router.put('/hours', verifyToken, async (req, res) => {
  const { hours } = req.body; // array of {dayOfWeek, isOpen, openTime, closeTime}
  if (!Array.isArray(hours) || hours.length !== 7) {
    return res.status(400).json({ error: 'Must provide hours for all 7 days' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const h of hours) {
      await client.query(
        `INSERT INTO business_hours (business_id, day_of_week, is_open, open_time, close_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (business_id, day_of_week) DO UPDATE SET
           is_open = EXCLUDED.is_open,
           open_time = EXCLUDED.open_time,
           close_time = EXCLUDED.close_time`,
        [req.businessId, h.dayOfWeek, h.isOpen, h.isOpen ? h.openTime : null, h.isOpen ? h.closeTime : null]
      );
    }
    await client.query('COMMIT');

    const result = await pool.query(
      `SELECT id, day_of_week, is_open, open_time, close_time
       FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update hours error:', err);
    res.status(500).json({ error: 'Failed to update hours' });
  } finally {
    client.release();
  }
});

module.exports = router;
