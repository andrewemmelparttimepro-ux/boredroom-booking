# BoredRoom Booking — Phase 6: Payments (Stripe)

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json first. If phase6 "done", spawn Phase 7 and exit.
2. Fail forward — log errors, keep moving. Never stop dead.
3. Push to GitHub after every module.
4. Stripe Connect (multi-tenant) is the target architecture. If Connect setup fails, fall back to single Stripe account with metadata for business_id — log the fallback in build-state.json.

## DESIGN STANDARD — BoredRoom Aesthetic (ALL owner-facing UI)
- Background: #0A0A0A, cards #111111, borders #1E1E1E
- Accent: Cashmere gold #B8AA96 (CTAs, active states, highlights)
- Text: #FFFFFF primary, #888888 secondary
- Font: DM Sans body; Bebas Neue display
- Public booking widget: white-labeled, uses business brand_color

## Stripe Setup

Install: `npm install stripe` in backend/

Add to env vars on Render:
- `STRIPE_SECRET_KEY` — Andrew's Stripe secret key. If not in build-state.json, use test mode key: `sk_test_placeholder` and note in build-state.json that real key needed.
- `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard webhook setup

Add to schema:
```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_charged DECIMAL(10,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(20) DEFAULT 'none'; -- none/fixed/percent
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
```

## Module 6.1 — Stripe Connect + Card on File

1. Stripe Connect OAuth flow: `GET /api/stripe/connect` → redirect to Stripe onboarding. On return: `GET /api/stripe/connect/callback` → save `stripe_account_id` to business record
2. If Connect fails/unavailable: fall back to platform Stripe account, tag by business_id in metadata
3. Card on file: `POST /api/stripe/setup-intent` → creates SetupIntent → returns `client_secret` for frontend
4. Frontend: Stripe Elements card input on booking confirmation step (Step 4) — "Save card for no-show protection" checkbox (optional for client)
5. Save `stripe_customer_id` to client record after successful SetupIntent

## Module 6.2 — No-Show Charge

1. `POST /api/appointments/:id/charge-noshow` — requires auth (owner only)
2. Fetches client's stripe_customer_id, charges a configurable no-show fee (default $25, set in business settings)
3. Updates appointment status to 'no_show', logs charge amount to `total_charged`
4. Owner UI: "Charge No-Show Fee" button appears on appointment detail when status = no_show
5. Refund: `POST /api/appointments/:id/refund` — refunds last charge via Stripe, updates appointment record

## Module 6.3 — Deposits

1. Deposit config per service in service edit modal: None / Fixed ($) / Percent (%)
2. On booking widget: if service requires deposit, Step 4 shows Stripe Elements card input + deposit amount
3. `POST /api/stripe/charge-deposit` — creates PaymentIntent for deposit amount, charges immediately
4. Stores `deposit_paid` on appointment record
5. Balance display in owner calendar appointment detail: "Deposit paid: $X | Balance due: $Y"

## Module 6.4 — POS / Checkout

1. "Check Out" button on completed appointments in calendar
2. Checkout modal: shows service price, minus deposit paid, = balance. Tip buttons (15% / 20% / 25% / custom). Optional retail add-ons (text input).
3. `POST /api/stripe/checkout` — charges balance + tip to card on file OR processes new card
4. Receipt email sent automatically after successful checkout (extend emailService.js)
5. `GET /api/payments/summary?date=today` — daily revenue summary for dashboard widget

## ON COMPLETION
1. Mark `"phase6": "done"` in build-state.json, push to GitHub, redeploy
2. Read phase7.md, spawn Phase 7: model="opus", thinking="high", label="booking-phase7"
3. Notify Andrew (Slack): "✅ Phase 6 (Payments) complete. Card on file, deposits, no-show charges, POS checkout all live. Phase 7 (Reporting) now running."
