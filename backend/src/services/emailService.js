/**
 * BoredRoom Booking — Email Service (Resend)
 * 
 * Sends booking confirmations, reminders, and cancellation notices.
 * Falls back to console logging if no Resend API key is configured.
 */

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

let Resend;
let resendClient;

if (RESEND_KEY) {
  try {
    Resend = require('resend').Resend;
    resendClient = new Resend(RESEND_KEY);
    console.log('✅ Email service initialized (Resend)');
  } catch (e) {
    console.warn('⚠️ Resend not available:', e.message);
  }
}

async function sendEmail(to, subject, html) {
  if (!resendClient) {
    console.log(`📧 [EMAIL STUB] To: ${to} | Subject: ${subject}`);
    return { id: 'stub-' + Date.now() };
  }

  try {
    const result = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    return null;
  }
}

// ── Email Templates ──

function emailWrapper(businessName, content) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;">
      <div style="background:#0A0A0A;padding:24px 32px;">
        <h1 style="margin:0;color:#B8AA96;font-size:20px;letter-spacing:2px;">${businessName}</h1>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
      <div style="padding:16px 32px;background:#f8f8f8;font-size:12px;color:#888;text-align:center;">
        Powered by BoredRoom Booking
      </div>
    </div>
  </body>
  </html>`;
}

async function sendBookingConfirmation(appt) {
  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const cancelUrl = `${process.env.APP_URL || 'https://boredroom-booking.onrender.com'}/cancel/${appt.booking_token}`;

  const html = emailWrapper(appt.business_name || 'Your Business', `
    <h2 style="margin:0 0 8px;color:#333;font-size:22px;">Appointment Confirmed ✓</h2>
    <p style="color:#666;margin:0 0 24px;">Here are your booking details:</p>
    
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:12px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Service</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${appt.service_name}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">With</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${appt.staff_name}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Date</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${dateStr}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Time</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${appt.service_price ? `<tr><td style="padding:12px 0;color:#888;font-size:13px;">Price</td>
          <td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;">$${Number(appt.service_price).toFixed(2)}</td></tr>` : ''}
    </table>
    
    <p style="margin:24px 0 8px;font-size:13px;color:#888;">Confirmation #: <code>${appt.booking_token}</code></p>
    
    <div style="margin:24px 0;text-align:center;">
      <a href="${cancelUrl}" style="display:inline-block;padding:10px 24px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;color:#333;text-decoration:none;font-size:13px;">Need to cancel?</a>
    </div>
  `);

  if (appt.client_email) {
    await sendEmail(appt.client_email, `Your appointment at ${appt.business_name || 'our business'} is confirmed`, html);
  }
}

async function sendOwnerNotification(appt, ownerEmail) {
  if (!ownerEmail) return;

  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const html = emailWrapper(appt.business_name || 'Your Business', `
    <h2 style="margin:0 0 16px;color:#333;">New Booking 🎯</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Client</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${appt.client_name || 'Walk-in'}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Phone</td>
          <td style="padding:8px 0;text-align:right;">${appt.client_phone || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Service</td>
          <td style="padding:8px 0;text-align:right;">${appt.service_name}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">With</td>
          <td style="padding:8px 0;text-align:right;">${appt.staff_name}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">When</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${dateStr} at ${timeStr}</td></tr>
      ${appt.notes ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Notes</td>
          <td style="padding:8px 0;text-align:right;">${appt.notes}</td></tr>` : ''}
    </table>
  `);

  await sendEmail(ownerEmail, `New booking: ${appt.client_name || 'Walk-in'} — ${appt.service_name} at ${timeStr}`, html);
}

async function sendReminder(appt, type) {
  if (!appt.client_email) return;

  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const subject = type === '24h'
    ? `Reminder: ${appt.service_name} tomorrow at ${timeStr}`
    : `Your appointment is in 2 hours — ${appt.business_name || ''}`;

  const html = emailWrapper(appt.business_name || 'Your Business', `
    <h2 style="margin:0 0 16px;color:#333;">Appointment Reminder ⏰</h2>
    <p style="color:#666;">Just a friendly reminder about your upcoming appointment:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Service</td>
          <td style="padding:8px 0;text-align:right;">${appt.service_name}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Date</td>
          <td style="padding:8px 0;text-align:right;">${dateStr}</td></tr>
      <tr><td style="padding:8px 0;color:#888;font-size:13px;">Time</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
    </table>
    ${appt.business_address ? `<p style="font-size:13px;color:#888;">📍 ${appt.business_address}</p>` : ''}
  `);

  await sendEmail(appt.client_email, subject, html);
}

async function sendCancellationClient(appt) {
  if (!appt.client_email) return;

  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const html = emailWrapper(appt.business_name || 'Your Business', `
    <h2 style="margin:0 0 16px;color:#333;">Appointment Cancelled</h2>
    <p style="color:#666;">Your ${appt.service_name} appointment on ${dateStr} has been cancelled.</p>
    <p style="color:#888;font-size:13px;margin-top:16px;">Want to rebook? Visit our booking page anytime.</p>
  `);

  await sendEmail(appt.client_email, `Your ${appt.service_name} appointment on ${dateStr} has been cancelled`, html);
}

async function sendCancellationOwner(appt, ownerEmail) {
  if (!ownerEmail) return;

  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const html = emailWrapper(appt.business_name || 'Your Business', `
    <h2 style="margin:0 0 16px;color:#C0392B;">Booking Cancelled ✕</h2>
    <p style="color:#666;">${appt.client_name || 'A client'} cancelled their ${appt.service_name} appointment on ${dateStr} at ${timeStr}.</p>
  `);

  await sendEmail(ownerEmail, `${appt.client_name || 'Client'} cancelled their ${appt.service_name} appointment on ${dateStr}`, html);
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendOwnerNotification,
  sendReminder,
  sendCancellationClient,
  sendCancellationOwner,
};
