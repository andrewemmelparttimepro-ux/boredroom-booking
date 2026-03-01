# BoredRoom Booking — Phase 4: Notifications

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`
**Repo:** Check build-state.json for `github_repo`, `render_service_id`, `resend_api_key`

## CRITICAL RULES
1. Read build-state.json first. If phase4 "done", spawn Phase 5 and exit.
2. SMS (Twilio) is optional — if no Twilio key in build-state.json, skip Module 4.2, log it, proceed.
3. Never block phase completion on Twilio. Email is required, SMS is nice-to-have.
4. Fail forward on individual email sends — log errors, don't crash the appointment flow.


## DESIGN STANDARD — BoredRoom Aesthetic (ALL owner-facing UI)
- Background: #0A0A0A, cards #111111, borders #1E1E1E
- Accent: Cashmere gold #B8AA96 (CTAs, active states, highlights)
- Text: #FFFFFF primary, #888888 secondary
- Font: DM Sans or Inter body; Bebas Neue for display headings
- Sidebar nav: #0D0D0D, active item = gold left border + gold text
- Tables: no visible borders, #161616 zebra rows
- Buttons: primary = #B8AA96 bg / black text | secondary = #1E1E1E / white text
- Custom-styled ALL inputs, selects, modals — no browser defaults
- Public /book/:slug widget: white-labeled — uses business brand_color, NOT BoredRoom gold
- Feel: Linear/Vercel dark mode energy. Premium SaaS. Confident. Not Bootstrap.

## Module 4.1 — Email (Resend API)

Resend API key: check build-state.json for `resend_api_key`. If not present, sign up at resend.com (free tier: 100 emails/day) and store the key in build-state.json.

From address: `bookings@ndai.pro` (or `noreply@boredroom.app` if domain not configured — use onboarding@resend.dev for testing)

**Email templates** — clean, minimal HTML. Dark header (#0A0A0A), green accent (#8CC63F), white body:

1. **Booking Confirmation (Client)**
   Subject: "Your appointment at [Business Name] is confirmed"
   Body: Service, staff name, date/time, address, cancel link, add-to-calendar buttons
   
2. **Booking Notification (Owner)**
   Subject: "New booking: [Client Name] — [Service] at [Time]"
   Body: Client name, phone, email, service, time, notes if any. Link to appointment in dashboard.

3. **Reminder (24h before)**
   Subject: "Reminder: [Service] tomorrow at [Time]"
   Trigger: Cron job or scheduled check — query appointments where start_time BETWEEN now+23h AND now+25h AND status IN ('pending','confirmed') AND reminder_24h_sent = false
   After send: set `reminder_24h_sent = true` on appointment

4. **Reminder (2h before)**
   Subject: "Your appointment is in 2 hours — [Business Name]"
   Same trigger pattern, `reminder_2h_sent` flag

5. **Cancellation (Client + Owner)**
   Client: "Your [Service] appointment on [Date] has been cancelled."
   Owner: "[Client Name] cancelled their [Service] appointment on [Date]."

Implementation:
- Add `reminder_24h_sent BOOLEAN DEFAULT false`, `reminder_2h_sent BOOLEAN DEFAULT false` columns to appointments
- `src/services/emailService.js` — sendConfirmation(), sendOwnerNotification(), sendReminder24h(), sendReminder2h(), sendCancellation()
- Email trigger points: booking creation (confirmations), appointment cancellation (cancellation emails)
- Reminder cron: `src/jobs/reminderJob.js` — runs every 30 min via `node-cron`, queries due reminders, sends, marks sent

## Module 4.2 — SMS (Twilio) [OPTIONAL — skip if no key]

If Twilio credentials exist in build-state.json:
1. `src/services/smsService.js` — sendSMS(to, body) wrapper
2. SMS confirmation on booking: "Confirmed: [Service] with [Staff] on [Date] at [Time]. Reply CANCEL to cancel."
3. SMS reminder 2h before: "[Business]: Your [Service] is in 2 hours. [Address]"
4. Inbound CANCEL handling: Twilio webhook at `/webhooks/twilio` — if body is "CANCEL", find appointment by phone, cancel it, send confirmation
5. Owner SMS alert toggle in business settings (notify owner phone on new bookings)

## ON COMPLETION
1. Mark `"phase4": "done"` in build-state.json
2. Push to GitHub, redeploy
3. Smoke test: create a test appointment, verify confirmation email arrives
4. Read `/Users/crustacean/.openclaw/workspace/projects/booking/phase-tasks/phase5.md`
5. Spawn Phase 5 sub-agent: model="opus", thinking="high"
6. Notify Andrew: "✅ Phase 4 (Notifications) complete. Confirmation + reminder emails live. Phase 5 (Client Management) now running."
