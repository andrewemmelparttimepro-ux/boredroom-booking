const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../services/encryptionService');

const router = express.Router();

// ═══ AUDIT LOGS ═══

// GET /api/enterprise/audit-logs
router.get('/audit-logs', verifyToken, async (req, res) => {
  try {
    const { page = 1, action, startDate, endDate } = req.query;
    const limit = 50;
    const offset = (page - 1) * limit;
    let query = `SELECT al.*, o.name as owner_name FROM audit_logs al
                 LEFT JOIN owners o ON al.owner_id = o.id
                 WHERE al.business_id = $1`;
    const values = [req.businessId];
    let idx = 2;

    if (action) { query += ` AND al.action = $${idx}`; values.push(action); idx++; }
    if (startDate) { query += ` AND al.created_at >= $${idx}`; values.push(startDate); idx++; }
    if (endDate) { query += ` AND al.created_at <= $${idx}`; values.push(endDate); idx++; }

    query += ` ORDER BY al.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

// ═══ INTAKE FORMS ═══

// GET /api/enterprise/intake-forms — list templates
router.get('/intake-forms', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM intake_form_templates WHERE business_id = $1 ORDER BY name',
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load intake forms' });
  }
});

// POST /api/enterprise/intake-forms — create template
router.post('/intake-forms', verifyToken, async (req, res) => {
  const { name, fields, serviceIds } = req.body;
  if (!name || !fields) return res.status(400).json({ error: 'Name and fields required' });

  try {
    const result = await pool.query(
      `INSERT INTO intake_form_templates (business_id, name, fields, service_ids)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.businessId, name, JSON.stringify(fields), serviceIds || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create intake form' });
  }
});

// POST /api/enterprise/intake-responses — submit response (public, by appt token)
router.post('/intake-responses', async (req, res) => {
  const { appointmentToken, responses } = req.body;
  try {
    const appt = await pool.query(
      `SELECT a.id, a.business_id, a.client_id, a.service_id, b.hipaa_mode
       FROM appointments a JOIN businesses b ON a.business_id = b.id
       WHERE a.booking_token = $1`,
      [appointmentToken]
    );
    if (appt.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const { id: apptId, business_id, client_id, service_id, hipaa_mode } = appt.rows[0];

    // Find matching template
    const template = await pool.query(
      `SELECT id FROM intake_form_templates WHERE business_id = $1
       AND (service_ids IS NULL OR $2 = ANY(service_ids)) AND is_active = true LIMIT 1`,
      [business_id, service_id]
    );

    const templateId = template.rows[0]?.id || null;
    const responseData = hipaa_mode ? encrypt(JSON.stringify(responses)) : JSON.stringify(responses);

    const result = await pool.query(
      `INSERT INTO intake_form_responses (appointment_id, client_id, template_id, responses, completed_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [apptId, client_id, templateId, responseData]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Intake response error:', err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// GET /api/enterprise/intake-responses/:appointmentId — view responses (auth required)
router.get('/intake-responses/:appointmentId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ifr.*, ift.name as form_name FROM intake_form_responses ifr
       LEFT JOIN intake_form_templates ift ON ifr.template_id = ift.id
       WHERE ifr.appointment_id = $1`,
      [req.params.appointmentId]
    );

    // Decrypt if needed
    const biz = await pool.query('SELECT hipaa_mode FROM businesses WHERE id = $1', [req.businessId]);
    const rows = result.rows.map(r => {
      if (biz.rows[0]?.hipaa_mode && typeof r.responses === 'string' && r.responses.includes(':')) {
        try { r.responses = JSON.parse(decrypt(r.responses)); } catch (e) {}
      }
      return r;
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load responses' });
  }
});

// ═══ TREATMENT NOTES ═══

// GET /api/enterprise/treatment-notes/:appointmentId
router.get('/treatment-notes/:appointmentId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tn.*, s.name as staff_name FROM treatment_notes tn
       LEFT JOIN staff s ON tn.staff_id = s.id
       WHERE tn.appointment_id = $1 AND tn.business_id = $2`,
      [req.params.appointmentId, req.businessId]
    );

    // Decrypt notes
    const biz = await pool.query('SELECT hipaa_mode FROM businesses WHERE id = $1', [req.businessId]);
    const rows = result.rows.map(r => {
      if (biz.rows[0]?.hipaa_mode && r.content.includes(':')) {
        try { r.content = decrypt(r.content); } catch (e) {}
      }
      return r;
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load treatment notes' });
  }
});

// POST /api/enterprise/treatment-notes
router.post('/treatment-notes', verifyToken, async (req, res) => {
  const { appointmentId, staffId, content } = req.body;
  try {
    const biz = await pool.query('SELECT hipaa_mode FROM businesses WHERE id = $1', [req.businessId]);
    const noteContent = biz.rows[0]?.hipaa_mode ? encrypt(content) : content;

    const result = await pool.query(
      `INSERT INTO treatment_notes (appointment_id, staff_id, business_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [appointmentId, staffId || null, req.businessId, noteContent]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save treatment note' });
  }
});

// ═══ HIPAA SETTINGS ═══

// PATCH /api/enterprise/hipaa
router.patch('/hipaa', verifyToken, async (req, res) => {
  try {
    await pool.query('UPDATE businesses SET hipaa_mode = $1 WHERE id = $2', [req.body.enabled, req.businessId]);
    res.json({ hipaaMode: req.body.enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update HIPAA mode' });
  }
});

module.exports = router;
