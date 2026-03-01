const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

// GET /api/services
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM services WHERE business_id = $1 ORDER BY category, name`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/services
router.post('/', verifyToken, validateBody(['name', 'duration_minutes']), async (req, res) => {
  const { name, description, duration_minutes, buffer_minutes, price, category, color, is_popular } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO services (business_id, name, description, duration_minutes, buffer_minutes, price, category, color, is_popular)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.businessId, name, description || null, duration_minutes, buffer_minutes || 0, price || null, category || null, color || '#8CC63F', is_popular || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// POST /api/services/seed — seed starter services
router.post('/seed', verifyToken, async (req, res) => {
  try {
    const check = await pool.query('SELECT COUNT(*) FROM services WHERE business_id = $1', [req.businessId]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Business already has services' });
    }

    const starters = [
      { name: 'Haircut', category: 'Cuts', duration: 30, price: 25.00, popular: true },
      { name: 'Beard Trim', category: 'Grooming', duration: 20, price: 15.00, popular: false },
      { name: 'Haircut + Beard', category: 'Combos', duration: 45, price: 35.00, popular: true },
      { name: 'Straight Razor Shave', category: 'Grooming', duration: 30, price: 30.00, popular: false },
      { name: 'Lineup', category: 'Cuts', duration: 15, price: 10.00, popular: false },
    ];

    const results = [];
    for (const s of starters) {
      const r = await pool.query(
        `INSERT INTO services (business_id, name, category, duration_minutes, price, is_popular)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.businessId, s.name, s.category, s.duration, s.price, s.popular]
      );
      results.push(r.rows[0]);
    }
    res.status(201).json(results);
  } catch (err) {
    console.error('Seed services error:', err);
    res.status(500).json({ error: 'Failed to seed services' });
  }
});

// GET /api/services/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND business_id = $2',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// PATCH /api/services/:id
router.patch('/:id', verifyToken, async (req, res) => {
  const allowed = ['name', 'description', 'duration_minutes', 'buffer_minutes', 'price', 'category', 'color', 'is_active', 'is_popular'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${idx}`);
      values.push(req.body[key]);
      idx++;
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id, req.businessId);
  try {
    const result = await pool.query(
      `UPDATE services SET ${updates.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM services WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
