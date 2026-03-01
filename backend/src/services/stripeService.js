/**
 * BoredRoom Booking — Stripe Payment Service
 * 
 * Handles card-on-file, deposits, no-show charges, and checkout.
 * Falls back to logging stubs if STRIPE_SECRET_KEY is not set.
 */

const pool = require('../db/pool');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
let stripe;

if (STRIPE_KEY && STRIPE_KEY !== 'sk_test_placeholder') {
  stripe = require('stripe')(STRIPE_KEY);
  console.log('✅ Stripe initialized');
} else {
  console.log('⚠️ Stripe not configured — payment features will be stubbed');
}

function isConfigured() { return !!stripe; }

// Create a Stripe customer for a client
async function getOrCreateCustomer(client) {
  if (!stripe) return { id: 'stub_cus_' + Date.now() };

  if (client.stripe_customer_id) {
    try {
      return await stripe.customers.retrieve(client.stripe_customer_id);
    } catch (e) { /* Customer not found, create new */ }
  }

  const customer = await stripe.customers.create({
    name: client.name,
    email: client.email,
    phone: client.phone,
    metadata: { client_id: client.id, business_id: client.business_id }
  });

  await pool.query('UPDATE clients SET stripe_customer_id = $1 WHERE id = $2', [customer.id, client.id]);
  return customer;
}

// Create SetupIntent for card on file
async function createSetupIntent(clientId, businessId) {
  const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1 AND business_id = $2', [clientId, businessId]);
  if (clientResult.rows.length === 0) throw new Error('Client not found');

  const customer = await getOrCreateCustomer(clientResult.rows[0]);

  if (!stripe) return { clientSecret: 'stub_seti_secret', customerId: customer.id };

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    metadata: { business_id: businessId, client_id: clientId }
  });

  return { clientSecret: setupIntent.client_secret, customerId: customer.id };
}

// Charge deposit on booking
async function chargeDeposit(appointmentId, amount, customerId) {
  if (!stripe) {
    console.log(`💳 [STRIPE STUB] Deposit charge: $${amount} for appt ${appointmentId}`);
    await pool.query('UPDATE appointments SET deposit_paid = $1 WHERE id = $2', [amount, appointmentId]);
    return { id: 'stub_pi_' + Date.now() };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    customer: customerId,
    confirm: true,
    payment_method_types: ['card'],
    metadata: { appointment_id: appointmentId }
  });

  await pool.query(
    'UPDATE appointments SET deposit_paid = $1, stripe_payment_intent_id = $2 WHERE id = $3',
    [amount, paymentIntent.id, appointmentId]
  );

  return paymentIntent;
}

// Charge no-show fee
async function chargeNoShow(appointmentId, businessId) {
  const apptResult = await pool.query(
    `SELECT a.*, c.stripe_customer_id, b.noshow_fee
     FROM appointments a
     JOIN clients c ON a.client_id = c.id
     JOIN businesses b ON a.business_id = b.id
     WHERE a.id = $1 AND a.business_id = $2`,
    [appointmentId, businessId]
  );

  if (apptResult.rows.length === 0) throw new Error('Appointment not found');
  const appt = apptResult.rows[0];
  const fee = appt.noshow_fee || 25.00;

  if (!appt.stripe_customer_id) throw new Error('Client has no card on file');

  if (!stripe) {
    console.log(`💳 [STRIPE STUB] No-show charge: $${fee} for appt ${appointmentId}`);
    await pool.query('UPDATE appointments SET total_charged = $1, status = $2 WHERE id = $3', [fee, 'no_show', appointmentId]);
    return { amount: fee };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(fee * 100),
    currency: 'usd',
    customer: appt.stripe_customer_id,
    confirm: true,
    payment_method_types: ['card'],
    description: `No-show fee for appointment ${appointmentId}`,
    metadata: { appointment_id: appointmentId, type: 'noshow' }
  });

  await pool.query(
    'UPDATE appointments SET total_charged = $1, status = $2, stripe_payment_intent_id = $3 WHERE id = $4',
    [fee, 'no_show', paymentIntent.id, appointmentId]
  );

  return { amount: fee, paymentIntentId: paymentIntent.id };
}

// Checkout (charge balance + tip)
async function checkout(appointmentId, businessId, tip = 0) {
  const apptResult = await pool.query(
    `SELECT a.*, sv.price as service_price, c.stripe_customer_id
     FROM appointments a
     JOIN services sv ON a.service_id = sv.id
     JOIN clients c ON a.client_id = c.id
     WHERE a.id = $1 AND a.business_id = $2`,
    [appointmentId, businessId]
  );

  if (apptResult.rows.length === 0) throw new Error('Appointment not found');
  const appt = apptResult.rows[0];
  const balance = (parseFloat(appt.service_price) || 0) - (parseFloat(appt.deposit_paid) || 0) + tip;

  if (balance <= 0) {
    await pool.query("UPDATE appointments SET status = 'completed', total_charged = $1 WHERE id = $2",
      [parseFloat(appt.deposit_paid) || 0, appointmentId]);
    return { amount: 0, message: 'Fully covered by deposit' };
  }

  if (!stripe) {
    console.log(`💳 [STRIPE STUB] Checkout: $${balance} (incl. $${tip} tip) for appt ${appointmentId}`);
    await pool.query("UPDATE appointments SET status = 'completed', total_charged = $1 WHERE id = $2",
      [balance + (parseFloat(appt.deposit_paid) || 0), appointmentId]);
    return { amount: balance };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(balance * 100),
    currency: 'usd',
    customer: appt.stripe_customer_id,
    confirm: true,
    payment_method_types: ['card'],
    metadata: { appointment_id: appointmentId, tip: tip.toString() }
  });

  await pool.query(
    "UPDATE appointments SET status = 'completed', total_charged = $1, stripe_payment_intent_id = $2 WHERE id = $3",
    [balance + (parseFloat(appt.deposit_paid) || 0), paymentIntent.id, appointmentId]
  );

  return { amount: balance, paymentIntentId: paymentIntent.id };
}

module.exports = { isConfigured, createSetupIntent, chargeDeposit, chargeNoShow, checkout };
