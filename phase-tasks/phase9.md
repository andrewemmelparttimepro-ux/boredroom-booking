# BoredRoom Booking — Phase 9: Advanced Features

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json. If phase9 "done", spawn Phase 10 and exit.
2. Each module here is independent — if one fails, skip and log it, move to next.
3. Push after every module. Fail forward always.

## DESIGN STANDARD — BoredRoom Aesthetic
- Background: #0A0A0A, cards #111111, accent: #B8AA96

## Module 9.1 — Memberships & Packages

Schema additions:
```sql
CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  billing_interval VARCHAR(20) DEFAULT 'monthly', -- monthly/yearly
  visit_credits SMALLINT NOT NULL, -- visits per billing period
  services_included TEXT[], -- service_ids covered, null = all
  is_active BOOLEAN DEFAULT true
);
CREATE TABLE IF NOT EXISTS client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES membership_plans(id),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  credits_remaining SMALLINT DEFAULT 0,
  credits_reset_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  service_id UUID REFERENCES services(id),
  quantity SMALLINT NOT NULL, -- e.g. 10 haircuts
  price DECIMAL(10,2) NOT NULL -- discounted bundle price
);
CREATE TABLE IF NOT EXISTS client_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  package_id UUID REFERENCES packages(id),
  remaining SMALLINT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);
```

1. Membership plans CRUD (owner creates plans, sets price + visit credits)
2. Client membership enrollment: owner assigns plan to client, Stripe subscription created
3. Packages: owner creates bundles (e.g. "10 Haircuts for $200"), client buys via widget or owner assigns
4. Credit redemption: at checkout, if client has membership/package credits, offer "Use Credit" option
5. Membership management UI: list client memberships, remaining credits, renewal date, cancel option

## Module 9.2 — Gift Cards

```sql
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  initial_balance DECIMAL(10,2) NOT NULL,
  remaining_balance DECIMAL(10,2) NOT NULL,
  purchased_by_client_id UUID REFERENCES clients(id),
  redeemed_by_client_id UUID REFERENCES clients(id),
  stripe_payment_intent_id VARCHAR(255),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

1. Gift card purchase flow on booking widget: "Buy a Gift Card" link → amount input → Stripe checkout
2. Code generation: `nanoid(10).toUpperCase()` — unique per business
3. Redemption at checkout: "Apply Gift Card" input → validate code + balance → deduct from total
4. Gift card management in dashboard: list all issued cards, balance remaining, redemption history
5. Gift card confirmation email: sends pretty email with the code to purchaser + optional recipient email

## Module 9.3 — Waitlist

```sql
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  service_id UUID REFERENCES services(id),
  staff_id UUID REFERENCES staff(id), -- null = any staff
  preferred_date DATE,
  notified_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting/notified/booked/expired
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

1. Waitlist join from booking widget: "No slots available? Join the waitlist" → client info + preferred date
2. On appointment cancellation: query waitlist for matching service/staff/date, notify first match via email
3. Waitlist management in dashboard: list waiting clients, manually notify, remove
4. Auto-expire waitlist entries older than 30 days
5. "Book now" link in waitlist notification email (pre-fills widget with their service/date preference)

## Module 9.4 — Recurring Appointments

1. `recurring_rule` JSON column on appointments: `{frequency: "weekly"|"biweekly"|"monthly", endsAfter: N, endsOn: date}`
2. Owner can mark any appointment as recurring in create/edit modal
3. On save: generate all future instances up to endsAfter or endsOn (max 52 instances)
4. Cancel single vs cancel all recurring (dialog choice)
5. Calendar shows recurring appointments with a repeat icon badge

## Module 9.5 — Email Marketing

1. `POST /api/marketing/campaign` — compose + send email to filtered client list
2. Filter options: all clients | visited in last X days | no visit in X days | by tag | by service
3. Simple email composer in dashboard: subject, body (rich text via simple contenteditable), preview
4. Send via Resend with rate limiting (batch 50 per minute)
5. Campaign history: list sent campaigns with recipient count and sent date

## ON COMPLETION
1. Mark `"phase9": "done"` in build-state.json, push, redeploy
2. Read phase10.md, spawn Phase 10: model="opus", thinking="high", label="booking-phase10"
3. Notify Andrew (Slack): "✅ Phase 9 (Advanced Features) complete. Memberships, packages, gift cards, waitlist, recurring appointments, email marketing all built. Phase 10 (Enterprise/HIPAA) now running — final phase."
