const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/slots?slug=xxx&service_id=xxx&date=YYYY-MM-DD
// Public endpoint — no auth required (Phase 2 will expand this)
router.get('/', async (req, res) => {
  res.json({ message: 'Slot engine will be implemented in Phase 2' });
});

module.exports = router;
