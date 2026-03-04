const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// POST /api/pour-request
// Public endpoint — no auth required. Contractors submit pour requests.
router.post('/', async (req, res) => {
  try {
    const {
      job_date,
      job_time,
      yards,
      address = '',
      client_name = '',
      client_phone = '',
      client_email = '',
      notes = ''
    } = req.body;

    if (!job_date || !job_time || !yards || yards < 1) {
      return res.status(400).json({ error: 'Date, time, and yards are required.' });
    }

    // Build a combined notes field with all the context
    const fullNotes = [
      address ? `Location: ${address}` : '',
      notes || ''
    ].filter(Boolean).join('\n');

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pour_requests (
        id SERIAL PRIMARY KEY,
        job_date DATE NOT NULL,
        job_time TIME NOT NULL,
        yards INTEGER NOT NULL,
        address TEXT DEFAULT '',
        client_name TEXT DEFAULT '',
        client_phone TEXT DEFAULT '',
        client_email TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO pour_requests (job_date, job_time, yards, address, client_name, client_phone, client_email, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id, job_date, job_time, yards, status, created_at`,
      [job_date, job_time, yards, address, client_name, client_phone, client_email, fullNotes]
    );

    console.log(`✅ Pour request #${result.rows[0].id}: ${yards} yds on ${job_date} at ${job_time}`);
    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error('Pour request error:', err);
    res.status(500).json({ error: 'Failed to submit request.' });
  }
});

// GET /api/pour-request — list all (for Andrew's admin view)
router.get('/', async (req, res) => {
  // Simple secret check
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (secret !== (process.env.ADMIN_SECRET || 'BoredRoom2025!')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pour_requests (
        id SERIAL PRIMARY KEY,
        job_date DATE NOT NULL,
        job_time TIME NOT NULL,
        yards INTEGER NOT NULL,
        address TEXT DEFAULT '',
        client_name TEXT DEFAULT '',
        client_phone TEXT DEFAULT '',
        client_email TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `SELECT * FROM pour_requests ORDER BY job_date ASC, job_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// PATCH /api/pour-request/:id — confirm or cancel
router.patch('/:id', async (req, res) => {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (secret !== (process.env.ADMIN_SECRET || 'BoredRoom2025!')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { status } = req.body;
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await pool.query(
      `UPDATE pour_requests SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update.' });
  }
});

module.exports = router;
