const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const stripeService = require('../services/stripeService');

const router = express.Router();

// GET /api/payments/status — check if Stripe is configured
router.get('/status', verifyToken, (req, res) => {
  res.json({ configured: stripeService.isConfigured() });
});

// POST /api/payments/setup-intent — card on file
router.post('/setup-intent', verifyToken, async (req, res) => {
  try {
    const result = await stripeService.createSetupIntent(req.body.clientId, req.businessId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/payments/charge-noshow/:id
router.post('/charge-noshow/:id', verifyToken, async (req, res) => {
  try {
    const result = await stripeService.chargeNoShow(req.params.id, req.businessId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/payments/checkout/:id
router.post('/checkout/:id', verifyToken, async (req, res) => {
  try {
    const result = await stripeService.checkout(req.params.id, req.businessId, req.body.tip || 0);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/payments/summary?date=YYYY-MM-DD
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_charged), 0) as total,
              COALESCE(SUM(deposit_paid), 0) as deposits
       FROM appointments
       WHERE business_id = $1 AND start_time::date = $2 AND status = 'completed'`,
      [req.businessId, date]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payment summary' });
  }
});

module.exports = router;
