const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { validateBody, validateSlug } = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validateBody(['businessName', 'slug', 'ownerName', 'email', 'password']), async (req, res) => {
  const { businessName, slug, ownerName, email, password } = req.body;
  const client = await pool.connect();

  try {
    // Validate slug
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!validateSlug(cleanSlug)) {
      return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
    }

    // Check slug uniqueness
    const slugCheck = await client.query('SELECT id FROM businesses WHERE slug = $1', [cleanSlug]);
    if (slugCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Business slug already taken' });
    }

    // Check email uniqueness
    const emailCheck = await client.query('SELECT id FROM owners WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    // Create business
    const bizResult = await client.query(
      `INSERT INTO businesses (name, slug) VALUES ($1, $2) RETURNING id`,
      [businessName, cleanSlug]
    );
    const businessId = bizResult.rows[0].id;

    // Create default business hours (Mon-Sat 9-5, Sun closed)
    for (let day = 0; day < 7; day++) {
      const isOpen = day !== 0; // Sunday = 0, closed
      await client.query(
        `INSERT INTO business_hours (business_id, day_of_week, is_open, open_time, close_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [businessId, day, isOpen, isOpen ? '09:00' : null, isOpen ? '17:00' : null]
      );
    }

    // Create owner
    const passwordHash = await bcrypt.hash(password, 12);
    const ownerResult = await client.query(
      `INSERT INTO owners (business_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, role`,
      [businessId, ownerName, email.toLowerCase(), passwordHash]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { userId: ownerResult.rows[0].id, businessId, role: ownerResult.rows[0].role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, businessId, slug: cleanSlug });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', validateBody(['email', 'password']), async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT o.id, o.password_hash, o.role, o.name, o.business_id, b.name as business_name, b.slug
       FROM owners o JOIN businesses b ON o.business_id = b.id
       WHERE o.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const owner = result.rows[0];
    const valid = await bcrypt.compare(password, owner.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: owner.id, businessId: owner.business_id, role: owner.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: owner.id, name: owner.name, email, role: owner.role },
      business: { id: owner.business_id, name: owner.business_name, slug: owner.slug }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, o.email, o.role, b.id as business_id, b.name as business_name, b.slug, b.brand_color
       FROM owners o JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      user: { id: row.id, name: row.name, email: row.email, role: row.role },
      business: { id: row.business_id, name: row.business_name, slug: row.slug, brandColor: row.brand_color }
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
