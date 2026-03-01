# BoredRoom Booking — Phase 10: Enterprise / HIPAA (FINAL PHASE)

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json. If phase10 "done", skip straight to FINAL REPORT and exit.
2. HIPAA is critical for Katie's medical practice — do not cut corners on encryption or audit logging.
3. Fail forward on individual items. Log everything. Push after every module.
4. This is the LAST phase. After completion, send Andrew the complete final report.

## DESIGN STANDARD — BoredRoom Aesthetic
- Background: #0A0A0A, cards #111111, accent: #B8AA96
- HIPAA-protected content areas: subtle blue-grey tint (#0A0A14) to visually distinguish protected data

## Module 10.1 — Encryption at Rest

1. Install `npm install node-forge` for AES-256 encryption utilities
2. `src/services/encryptionService.js`:
   - `encrypt(text, key)` → encrypted string (AES-256-CBC, base64 output)
   - `decrypt(encrypted, key)` → plaintext
   - Key derived from `ENCRYPTION_KEY` env var (256-bit)
3. Encrypted columns: appointment `notes` (when business has hipaa_mode=true), all intake form responses
4. Middleware: auto-encrypt on write, auto-decrypt on read for HIPAA-mode businesses
5. Add `ENCRYPTION_KEY` to Render env vars (generate: `openssl rand -hex 32`)

## Module 10.2 — Audit Logs

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id),
  action VARCHAR(100) NOT NULL, -- 'view_record', 'edit_appointment', 'delete_client', etc.
  resource_type VARCHAR(50), -- 'appointment', 'client', 'intake_form'
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_business_date ON audit_logs(business_id, created_at);
```

1. Audit middleware: `src/middleware/audit.js` — logs every authenticated API call that reads/writes protected data
2. Audit log viewer in admin panel: filterable by date, action, owner — shows who accessed what
3. Auto-purge audit logs older than 7 years (HIPAA retention requirement) — cron job
4. Log export: CSV download for compliance review
5. Add `hipaa_mode BOOLEAN DEFAULT false` to businesses table — all audit + encryption only activates for hipaa_mode businesses

## Module 10.3 — Medical Intake Forms

```sql
CREATE TABLE IF NOT EXISTS intake_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  fields JSONB NOT NULL, -- [{label, type, required, options}]
  service_ids UUID[], -- which services trigger this form
  is_active BOOLEAN DEFAULT true
);
CREATE TABLE IF NOT EXISTS intake_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  template_id UUID REFERENCES intake_form_templates(id),
  responses JSONB NOT NULL, -- encrypted if hipaa_mode
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

1. Intake form builder in dashboard: drag-to-reorder fields, field types (text, textarea, checkbox, radio, date, signature)
2. Assign forms to services: when service requires an intake form, client receives link after booking
3. Client intake form page: `/intake/:appointmentToken` — mobile-friendly, fills before appointment
4. Owner sees completed intake forms in appointment detail panel (access logged to audit_log)
5. Incomplete intake form warning on calendar: badge on appointment block if intake not completed

## Module 10.4 — Treatment Notes (Provider-Only)

```sql
CREATE TABLE IF NOT EXISTS treatment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- AES-256 encrypted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

1. Treatment notes tab on appointment detail (hipaa_mode businesses only)
2. Rich text editor (simple contenteditable with basic formatting)
3. Notes encrypted before storage, decrypted on read — access logged
4. Notes not visible to client, not included in client-facing emails
5. Owner can restrict note visibility to specific staff roles

## Module 10.5 — 2FA + Session Security

1. `npm install speakeasy qrcode` — TOTP-based 2FA (Google Authenticator compatible)
2. `POST /api/auth/2fa/setup` — generates secret + QR code for owner to scan
3. `POST /api/auth/2fa/verify` — verifies TOTP code during login
4. 2FA required for all owners of hipaa_mode businesses (enforced at login)
5. Session management: JWT blacklist on logout (store invalidated tokens in Redis or in-memory Set), session timeout after 8h

## FINAL REPORT — Send to Andrew

After all modules complete:

1. Mark `"phase10": "done"` in build-state.json
2. Push all code to GitHub (final commit: "Phase 10: Enterprise/HIPAA complete — full build done")
3. Redeploy to Render
4. Run comprehensive smoke test:
   - Health check: GET /api/health → 200
   - Auth: register + login → JWT valid
   - Business: create business + hours
   - Services + Staff: CRUD working
   - Slots: GET /api/slots returns available times
   - Booking: POST /api/appointments via widget flow
   - Client: auto-created, appears in client list
   - Calendar: appointment visible in owner calendar
   - Email: confirmation sent (check logs)
5. Compile all errors from build-state.json (phase1_errors through phase10_errors)
6. Send Andrew the final report via Slack (message tool):

```
🚀 BoredRoom Booking — FULL BUILD COMPLETE

All 10 phases done. Here's the summary:

✅ Phase 1  — Foundation (auth, business config, services, staff)
✅ Phase 2  — Booking Engine (slot algorithm, calendar, owner booking)
✅ Phase 3  — Public Booking Flow (client widget + confirmations)
✅ Phase 4  — Notifications (email + SMS reminders)
✅ Phase 5  — Client Management (CRM-lite, profiles, history)
✅ Phase 6  — Payments (Stripe, card on file, deposits, POS)
✅ Phase 7  — Reporting (revenue, bookings, staff, client analytics)
✅ Phase 8  — Multi-Tenant (admin panel, onboarding wizard, white-label)
✅ Phase 9  — Advanced (memberships, gift cards, waitlist, recurring, email marketing)
✅ Phase 10 — Enterprise/HIPAA (encryption, audit logs, intake forms, 2FA)

🔗 Live URL: [render_url from build-state.json]
📁 GitHub: [github_repo from build-state.json]
🔐 Admin login: [render_url]/admin

⚠️ Items that need your attention:
[List anything from phase_errors that requires a real API key, manual config, or human decision]

Ready for first client onboarding.
```
