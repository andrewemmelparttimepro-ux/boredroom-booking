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

// SPA fallback — serve index.html for non-API, non-file routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // Check if requesting a specific HTML file
  const htmlFile = path.join(__dirname, '../../frontend', req.path);
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🟢 BoredRoom Booking running on port ${PORT}`);
});
