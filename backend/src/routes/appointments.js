const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { nanoid } = require('nanoid');

const router = express.Router();

// Valid status transitions
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  blocked: ['cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

function isValidTransition(from, to) {
  if (from === to) return true;
  const allowed = STATUS_TRANSITIONS[from];
  return allowed && allowed.includes(to);
}

// GET /api/appointments
router.get('/', verifyToken, async (req, res) => {
  try {
    const { date, staff_id, status, start_date, end_date } = req.query;
    let query = `
      SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
             s.name as staff_name, sv.name as service_name, sv.duration_minutes, 
             sv.price as service_price, sv.color as service_color
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN staff s ON a.staff_id = s.id
      LEFT JOIN services sv ON a.service_id = sv.id
      WHERE a.business_id = $1
    `;
    const values = [req.businessId];
    let idx = 2;

    if (date) {
      query += ` AND a.start_time::date = $${idx}`;
      values.push(date);
      idx++;
    }
    if (start_date && end_date) {
      query += ` AND a.start_time >= $${idx}::date AND a.start_time < ($${idx + 1}::date + interval '1 day')`;
      values.push(start_date, end_date);
      idx += 2;
    }
    if (staff_id) {
      query += ` AND a.staff_id = $${idx}`;
      values.push(staff_id);
      idx++;
    }
    if (status) {
      query += ` AND a.status = $${idx}`;
      values.push(status);
      idx++;
    }

    query += ' ORDER BY a.start_time';
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
              s.name as staff_name, sv.name as service_name, sv.duration_minutes, sv.price as service_price
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE a.id = $1 AND a.business_id = $2`,
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get appointment error:', err);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments
router.post('/', verifyToken, validateBody(['staff_id', 'service_id', 'start_time']), async (req, res) => {
  const { client_id, staff_id, service_id, start_time, notes, source, status } = req.body;

  try {
    // Get service duration to calculate end_time
    const svcResult = await pool.query('SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1', [service_id]);
    if (svcResult.rows.length === 0) return res.status(400).json({ error: 'Service not found' });

    const { duration_minutes, buffer_minutes } = svcResult.rows[0];
    const startDt = new Date(start_time);
    const endDt = new Date(startDt.getTime() + (duration_minutes + (buffer_minutes || 0)) * 60000);

    // Check for conflicts (skip for blocked time)
    const apptStatus = status || 'pending';
    if (apptStatus !== 'blocked') {
      const conflict = await pool.query(
        `SELECT id FROM appointments
         WHERE staff_id = $1 AND status NOT IN ('cancelled')
         AND start_time < $3 AND end_time > $2`,
        [staff_id, startDt.toISOString(), endDt.toISOString()]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: 'Time slot conflicts with existing appointment' });
      }
    }

    // Generate booking token
    const bookingToken = nanoid(12);

    const result = await pool.query(
      `INSERT INTO appointments (business_id, client_id, staff_id, service_id, start_time, end_time, notes, source, status, booking_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.businessId, client_id || null, staff_id, service_id, startDt.toISOString(), endDt.toISOString(),
       notes || null, source || 'owner', apptStatus, bookingToken]
    );

    // Fetch with joins for response
    const full = await pool.query(
      `SELECT a.*, c.name as client_name, s.name as staff_name, sv.name as service_name, sv.color as service_color
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE a.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PATCH /api/appointments/:id
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    // Get current appointment for status validation
    const current = await pool.query(
      'SELECT status, service_id FROM appointments WHERE id = $1 AND business_id = $2',
      [req.params.id, req.businessId]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Validate status transition
    if (req.body.status && req.body.status !== current.rows[0].status) {
      if (!isValidTransition(current.rows[0].status, req.body.status)) {
        return res.status(400).json({
          error: `Cannot transition from '${current.rows[0].status}' to '${req.body.status}'`
        });
      }
    }

    const allowed = ['status', 'notes', 'start_time', 'staff_id', 'service_id', 'client_id'];
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

    // Recalculate end_time if start_time or service changed
    if (req.body.start_time || req.body.service_id) {
      const svcId = req.body.service_id || current.rows[0].service_id;
      const svcQuery = await pool.query('SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1', [svcId]);
      if (svcQuery.rows.length > 0) {
        const { duration_minutes, buffer_minutes } = svcQuery.rows[0];
        const startTime = req.body.start_time || null;
        if (startTime) {
          const startDt = new Date(startTime);
          const endDt = new Date(startDt.getTime() + (duration_minutes + (buffer_minutes || 0)) * 60000);
          updates.push(`end_time = $${idx}`);
          values.push(endDt.toISOString());
          idx++;
        }
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    values.push(req.params.id, req.businessId);
    const result = await pool.query(
      `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${idx} AND business_id = $${idx + 1} RETURNING *`,
      values
    );

    // Fetch with joins
    const full = await pool.query(
      `SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
              s.name as staff_name, sv.name as service_name, sv.color as service_color
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    res.json(full.rows[0]);
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete appointment error:', err);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

module.exports = router;
