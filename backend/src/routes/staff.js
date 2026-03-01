const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

// GET /api/staff
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, 
        COALESCE(
          (SELECT json_agg(json_build_object('service_id', ss.service_id, 'service_name', sv.name))
           FROM staff_services ss JOIN services sv ON ss.service_id = sv.id
           WHERE ss.staff_id = s.id), '[]'
        ) as services
       FROM staff s WHERE s.business_id = $1 ORDER BY s.name`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// POST /api/staff
router.post('/', verifyToken, validateBody(['name']), async (req, res) => {
  const { name, email, phone, role, photo_url } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO staff (business_id, name, email, phone, role, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.businessId, name, email || null, phone || null, role || 'staff', photo_url || null]
    );
    const staffId = result.rows[0].id;

    // Copy business hours as default availability
    const hours = await client.query(
      'SELECT day_of_week, is_open, open_time, close_time FROM business_hours WHERE business_id = $1',
      [req.businessId]
    );
    for (const h of hours.rows) {
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [staffId, h.day_of_week, h.is_open, h.open_time, h.close_time]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Failed to create staff member' });
  } finally {
    client.release();
  }
});

// GET /api/staff/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM staff WHERE id = $1 AND business_id = $2',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// PATCH /api/staff/:id
router.patch('/:id', verifyToken, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'role', 'photo_url', 'is_active'];
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
      `UPDATE staff SET ${updates.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM staff WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// GET /api/staff/:id/availability
router.get('/:id/availability', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, day_of_week, is_working, start_time, end_time
       FROM staff_availability WHERE staff_id = $1 ORDER BY day_of_week`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// PUT /api/staff/:id/availability
router.put('/:id/availability', verifyToken, async (req, res) => {
  const { availability } = req.body;
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'Availability must be an array' });
  }

  // Verify staff belongs to business
  const staffCheck = await pool.query('SELECT id FROM staff WHERE id = $1 AND business_id = $2', [req.params.id, req.businessId]);
  if (staffCheck.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const a of availability) {
      await client.query(
        `INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (staff_id, day_of_week) DO UPDATE SET
           is_working = EXCLUDED.is_working,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time`,
        [req.params.id, a.dayOfWeek, a.isWorking, a.isWorking ? a.startTime : null, a.isWorking ? a.endTime : null]
      );
    }
    await client.query('COMMIT');

    const result = await pool.query(
      'SELECT * FROM staff_availability WHERE staff_id = $1 ORDER BY day_of_week',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update availability error:', err);
    res.status(500).json({ error: 'Failed to update availability' });
  } finally {
    client.release();
  }
});

// GET /api/staff/:id/services
router.get('/:id/services', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.* FROM services s
       JOIN staff_services ss ON s.id = ss.service_id
       WHERE ss.staff_id = $1 AND s.business_id = $2
       ORDER BY s.name`,
      [req.params.id, req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff services error:', err);
    res.status(500).json({ error: 'Failed to fetch staff services' });
  }
});

// PUT /api/staff/:id/services
router.put('/:id/services', verifyToken, async (req, res) => {
  const { serviceIds } = req.body;
  if (!Array.isArray(serviceIds)) {
    return res.status(400).json({ error: 'serviceIds must be an array' });
  }

  // Verify staff belongs to business
  const staffCheck = await pool.query('SELECT id FROM staff WHERE id = $1 AND business_id = $2', [req.params.id, req.businessId]);
  if (staffCheck.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM staff_services WHERE staff_id = $1', [req.params.id]);
    for (const svcId of serviceIds) {
      await client.query(
        'INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, svcId]
      );
    }
    await client.query('COMMIT');

    const result = await client.query(
      `SELECT s.* FROM services s
       JOIN staff_services ss ON s.id = ss.service_id
       WHERE ss.staff_id = $1 ORDER BY s.name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update staff services error:', err);
    res.status(500).json({ error: 'Failed to update staff services' });
  } finally {
    client.release();
  }
});

module.exports = router;
