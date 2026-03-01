const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { nanoid } = require('nanoid');

const router = express.Router();

// ═══ WAITLIST ═══

// GET /api/waitlist
router.get('/waitlist', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
             sv.name as service_name, s.name as staff_name
      FROM waitlist w
      LEFT JOIN clients c ON w.client_id = c.id
      LEFT JOIN services sv ON w.service_id = sv.id
      LEFT JOIN staff s ON w.staff_id = s.id
      WHERE w.business_id = $1 AND w.status = 'waiting'
      ORDER BY w.created_at
    `, [req.businessId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load waitlist' });
  }
});

// POST /api/waitlist — add to waitlist (public)
router.post('/waitlist', async (req, res) => {
  const { businessId, serviceId, staffId, preferredDate, clientName, clientEmail, clientPhone } = req.body;
  if (!businessId || !serviceId || !clientName || !clientEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Upsert client
    const clientResult = await pool.query(
      `INSERT INTO clients (business_id, name, email, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [businessId, clientName, clientEmail.toLowerCase(), clientPhone || null]
    );

    const result = await pool.query(
      `INSERT INTO waitlist (business_id, client_id, service_id, staff_id, preferred_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, clientResult.rows[0].id, serviceId, staffId || null, preferredDate || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// DELETE /api/waitlist/:id
router.delete('/waitlist/:id', verifyToken, async (req, res) => {
  await pool.query('DELETE FROM waitlist WHERE id = $1 AND business_id = $2', [req.params.id, req.businessId]);
  res.json({ deleted: true });
});

// ═══ GIFT CARDS ═══

// GET /api/gift-cards
router.get('/gift-cards', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gc.*, c.name as purchaser_name
       FROM gift_cards gc LEFT JOIN clients c ON gc.purchased_by_client_id = c.id
       WHERE gc.business_id = $1 ORDER BY gc.created_at DESC`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load gift cards' });
  }
});

// POST /api/gift-cards — create gift card
router.post('/gift-cards', verifyToken, async (req, res) => {
  const { amount, expiresAt } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount is required' });

  try {
    const code = nanoid(10).toUpperCase();
    const result = await pool.query(
      `INSERT INTO gift_cards (business_id, code, initial_balance, remaining_balance, expires_at)
       VALUES ($1, $2, $3, $3, $4) RETURNING *`,
      [req.businessId, code, amount, expiresAt || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create gift card' });
  }
});

// POST /api/gift-cards/validate — check gift card balance
router.post('/gift-cards/validate', async (req, res) => {
  const { code, businessId } = req.body;
  try {
    const result = await pool.query(
      `SELECT remaining_balance, expires_at FROM gift_cards
       WHERE code = $1 AND business_id = $2 AND remaining_balance > 0
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [code, businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gift card not found or expired' });
    res.json({ balance: result.rows[0].remaining_balance });
  } catch (err) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

// ═══ MEMBERSHIP PLANS ═══

// GET /api/memberships/plans
router.get('/memberships/plans', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM membership_plans WHERE business_id = $1 ORDER BY price',
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// POST /api/memberships/plans
router.post('/memberships/plans', verifyToken, async (req, res) => {
  const { name, price, billingInterval, visitCredits } = req.body;
  if (!name || !price || !visitCredits) return res.status(400).json({ error: 'Name, price, and credits required' });

  try {
    const result = await pool.query(
      `INSERT INTO membership_plans (business_id, name, price, billing_interval, visit_credits)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.businessId, name, price, billingInterval || 'monthly', visitCredits]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// GET /api/memberships/client/:clientId
router.get('/memberships/client/:clientId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.*, mp.name as plan_name, mp.price, mp.visit_credits
       FROM client_memberships cm JOIN membership_plans mp ON cm.plan_id = mp.id
       WHERE cm.client_id = $1 AND cm.status = 'active'`,
      [req.params.clientId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load client memberships' });
  }
});

// POST /api/memberships/enroll
router.post('/memberships/enroll', verifyToken, async (req, res) => {
  const { clientId, planId } = req.body;
  try {
    const plan = await pool.query('SELECT * FROM membership_plans WHERE id = $1', [planId]);
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `INSERT INTO client_memberships (client_id, plan_id, credits_remaining, credits_reset_at)
       VALUES ($1, $2, $3, NOW() + interval '1 month') RETURNING *`,
      [clientId, planId, plan.rows[0].visit_credits]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

// ═══ PACKAGES ═══

// GET /api/packages
router.get('/packages', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, sv.name as service_name FROM packages p
       LEFT JOIN services sv ON p.service_id = sv.id
       WHERE p.business_id = $1 ORDER BY p.name`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

// POST /api/packages
router.post('/packages', verifyToken, async (req, res) => {
  const { name, serviceId, quantity, price } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO packages (business_id, name, service_id, quantity, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.businessId, name, serviceId, quantity, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

module.exports = router;
