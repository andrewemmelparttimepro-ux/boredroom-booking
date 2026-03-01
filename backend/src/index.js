require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3002;

// Auto-migrate on startup
async function autoMigrate() {
  try {
    const schema = require('fs').readFileSync(require('path').join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Auto-migration complete');
  } catch (err) {
    console.error('⚠️ Auto-migration error (non-fatal):', err.message);
  }
}
autoMigrate();

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/business', require('./routes/businesses'));
app.use('/api/services', require('./routes/services'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/slots', require('./routes/slots'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: dbResult.rows[0].now, env: process.env.NODE_ENV || 'development' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Public booking widget route
app.get('/book/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/book.html'));
});

// Cancel/reschedule routes
app.get('/cancel/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/book.html'));
});
app.get('/reschedule/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/book.html'));
});

// Public API: get business info by slug (no auth)
app.get('/api/public/business/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, address, phone, email, timezone, logo_url, brand_color
       FROM businesses WHERE slug = $1`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// Public API: get services for a business (no auth)
app.get('/api/public/services/:businessId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, duration_minutes, price, category, color, is_popular
       FROM services WHERE business_id = $1 AND is_active = true ORDER BY is_popular DESC, category, name`,
      [req.params.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Public API: get staff for a business (no auth)
app.get('/api/public/staff/:businessId', async (req, res) => {
  try {
    const { serviceId } = req.query;
    let query, values;
    if (serviceId) {
      query = `SELECT s.id, s.name, s.photo_url, s.role FROM staff s
               JOIN staff_services ss ON s.id = ss.staff_id
               WHERE s.business_id = $1 AND ss.service_id = $2 AND s.is_active = true ORDER BY s.name`;
      values = [req.params.businessId, serviceId];
    } else {
      query = `SELECT id, name, photo_url, role FROM staff WHERE business_id = $1 AND is_active = true ORDER BY name`;
      values = [req.params.businessId];
    }
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Public API: book appointment (no auth — client-facing)
app.post('/api/public/book', async (req, res) => {
  const { businessId, serviceId, staffId, startTime, clientName, clientEmail, clientPhone, notes } = req.body;
  if (!businessId || !serviceId || !staffId || !startTime || !clientName || !clientPhone || !clientEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert client
    const clientResult = await client.query(
      `INSERT INTO clients (business_id, name, email, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
       RETURNING *`,
      [businessId, clientName, clientEmail.toLowerCase(), clientPhone]
    );
    const clientId = clientResult.rows[0].id;

    // Get service
    const svcResult = await client.query('SELECT duration_minutes, buffer_minutes FROM services WHERE id = $1', [serviceId]);
    if (svcResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Service not found' }); }

    const { duration_minutes, buffer_minutes } = svcResult.rows[0];
    const startDt = new Date(startTime);
    const endDt = new Date(startDt.getTime() + (duration_minutes + (buffer_minutes || 0)) * 60000);

    // Conflict check
    const conflict = await client.query(
      `SELECT id FROM appointments WHERE staff_id = $1 AND status NOT IN ('cancelled')
       AND start_time < $3 AND end_time > $2`,
      [staffId, startDt.toISOString(), endDt.toISOString()]
    );
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This time slot is no longer available' });
    }

    const { nanoid } = require('nanoid');
    const bookingToken = nanoid(12);

    const apptResult = await client.query(
      `INSERT INTO appointments (business_id, client_id, staff_id, service_id, start_time, end_time, notes, source, booking_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'widget', $8) RETURNING *`,
      [businessId, clientId, staffId, serviceId, startDt.toISOString(), endDt.toISOString(), notes || null, bookingToken]
    );

    await client.query('COMMIT');

    // Fetch full details for confirmation
    const full = await pool.query(
      `SELECT a.*, c.name as client_name, s.name as staff_name, sv.name as service_name, sv.price as service_price, sv.duration_minutes
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       WHERE a.id = $1`,
      [apptResult.rows[0].id]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Public booking error:', err);
    res.status(500).json({ error: 'Booking failed' });
  } finally {
    client.release();
  }
});

// Public API: cancel appointment by token
app.post('/api/public/cancel/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, start_time, status FROM appointments WHERE booking_token = $1`,
      [req.params.token]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const appt = result.rows[0];
    if (appt.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    // Check 2h cutoff
    const now = new Date();
    const start = new Date(appt.start_time);
    if (start.getTime() - now.getTime() < 2 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Too late to cancel online. Please call the business.' });
    }

    await pool.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [appt.id]);
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: 'Cancel failed' });
  }
});

// Public API: get appointment by token
app.get('/api/public/appointment/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as client_name, s.name as staff_name, sv.name as service_name, sv.price as service_price, sv.duration_minutes,
              b.name as business_name, b.phone as business_phone, b.address as business_address
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN services sv ON a.service_id = sv.id
       LEFT JOIN businesses b ON a.business_id = b.id
       WHERE a.booking_token = $1`,
      [req.params.token]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🟢 BoredRoom Booking running on port ${PORT}`);
});
