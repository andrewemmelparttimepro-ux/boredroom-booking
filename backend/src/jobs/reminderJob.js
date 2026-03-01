/**
 * BoredRoom Booking — Reminder Job
 * 
 * Runs every 30 minutes to send 24h and 2h appointment reminders.
 * Uses node-cron for scheduling.
 */

const cron = require('node-cron');
const pool = require('../db/pool');
const { sendReminder } = require('../services/emailService');

function startReminderJob() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ Running reminder check...');
    
    try {
      // 24-hour reminders
      const reminders24h = await pool.query(`
        SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
               s.name as staff_name, sv.name as service_name, b.name as business_name, b.address as business_address
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN staff s ON a.staff_id = s.id
        LEFT JOIN services sv ON a.service_id = sv.id
        LEFT JOIN businesses b ON a.business_id = b.id
        WHERE a.status IN ('pending', 'confirmed')
          AND a.reminder_24h_sent = false
          AND a.start_time BETWEEN NOW() + interval '23 hours' AND NOW() + interval '25 hours'
      `);

      for (const appt of reminders24h.rows) {
        await sendReminder(appt, '24h');
        await pool.query('UPDATE appointments SET reminder_24h_sent = true WHERE id = $1', [appt.id]);
        console.log(`  📧 24h reminder sent for appt ${appt.id}`);
      }

      // 2-hour reminders
      const reminders2h = await pool.query(`
        SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
               s.name as staff_name, sv.name as service_name, b.name as business_name, b.address as business_address
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN staff s ON a.staff_id = s.id
        LEFT JOIN services sv ON a.service_id = sv.id
        LEFT JOIN businesses b ON a.business_id = b.id
        WHERE a.status IN ('pending', 'confirmed')
          AND a.reminder_2h_sent = false
          AND a.start_time BETWEEN NOW() + interval '1 hour 45 minutes' AND NOW() + interval '2 hours 15 minutes'
      `);

      for (const appt of reminders2h.rows) {
        await sendReminder(appt, '2h');
        await pool.query('UPDATE appointments SET reminder_2h_sent = true WHERE id = $1', [appt.id]);
        console.log(`  📧 2h reminder sent for appt ${appt.id}`);
      }

      const total = reminders24h.rows.length + reminders2h.rows.length;
      if (total > 0) console.log(`  ✅ Sent ${total} reminder(s)`);
    } catch (err) {
      console.error('  ❌ Reminder job error:', err.message);
    }
  });

  console.log('✅ Reminder job scheduled (every 30 min)');
}

module.exports = { startReminderJob };
