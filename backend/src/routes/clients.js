const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

// GET /api/clients?search=&sort=name|last_visit|spend
router.get('/', verifyToken, async (req, res) => {
  try {
    const { search, sort } = req.query;
    let query = `
      SELECT c.*,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as visit_count,
        COALESCE(SUM(sv.price) FILTER (WHERE a.status IN ('completed')), 0) as total_spend,
        MAX(a.start_time) FILTER (WHERE a.status NOT IN ('cancelled')) as last_visit
      FROM clients c
      LEFT JOIN appointments a ON c.id = a.client_id
      LEFT JOIN services sv ON a.service_id = sv.id
      WHERE c.business_id = $1
    `;
    const values = [req.businessId];
    let idx = 2;

    if (search) {
      query += ` AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }

    query += ' GROUP BY c.id';

    if (sort === 'last_visit') query += ' ORDER BY last_visit DESC NULLS LAST';
    else if (sort === 'spend') query += ' ORDER BY total_spend DESC';
    else query += ' ORDER BY c.name';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST /api/clients
router.post('/', verifyToken, validateBody(['name']), async (req, res) => {
  const { name, email, phone, notes, tags } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (business_id, name, email, phone, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.businessId, name, email || null, phone || null, notes || null, tags || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Client with this email already exists' });
    }
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// GET /api/clients/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1 AND business_id = $2',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// GET /api/clients/:id/appointments — booking history
router.get('/:id/appointments', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, s.name as staff_name, sv.name as service_name, sv.price as service_price, sv.color as service_color
       FROM appointments a
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE a.client_id = $1 AND a.business_id = $2
       ORDER BY a.start_time DESC`,
      [req.params.id, req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get client appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch client appointments' });
  }
});

// GET /api/clients/export — CSV download
router.get('/export/csv', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.name, c.phone, c.email, c.notes, c.no_show_count,
              COUNT(DISTINCT a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as visit_count,
              COALESCE(SUM(sv.price) FILTER (WHERE a.status IN ('completed')), 0) as total_spend
       FROM clients c
       LEFT JOIN appointments a ON c.id = a.client_id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE c.business_id = $1
       GROUP BY c.id
       ORDER BY c.name`,
      [req.businessId]
    );

    const csv = 'Name,Phone,Email,Visits,Total Spend,No-Shows,Notes\n' +
      result.rows.map(r =>
        `"${(r.name || '').replace(/"/g, '""')}","${r.phone || ''}","${r.email || ''}",${r.visit_count},${r.total_spend},${r.no_show_count},"${(r.notes || '').replace(/"/g, '""')}"`
      ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// PATCH /api/clients/:id
router.patch('/:id', verifyToken, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'notes', 'tags'];
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
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM clients WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
