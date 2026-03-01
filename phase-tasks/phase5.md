# BoredRoom Booking — Phase 5: Client Management (CRM-Lite)

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json first. If phase5 "done", this is the final automated phase — notify Andrew and stop.
2. Fail forward on any module. Log errors, proceed.
3. This is the last auto-chaining phase. After completion, notify Andrew with full summary and await his instruction for Phase 6 (Payments/Stripe).


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

## Module 5.1 — Client Database & List View

1. `GET /api/clients?businessId=&search=&sort=last_visit|spend|name&page=` — paginated, searchable
2. Client list UI: table with columns — Name, Phone, Email, Visits, Total Spend, Last Visit, No-Show Count, Tags
3. Search: real-time filter by name / phone / email
4. Sort by any column
5. "At Risk" badge: clients with no visit in 60+ days (configurable in business settings)

## Module 5.2 — Client Profile Page

1. `/dashboard/clients/:id` — full profile page
2. Contact info section (editable inline — name, phone, email, birthday optional)
3. Notes field (freeform text, autosaves on blur)
4. Tags (add/remove — e.g. "VIP", "prefers Jake", "no texting", "regulars")
5. No-show history callout (if no_show_count > 1, show warning banner)

## Module 5.3 — Booking History per Client

1. Upcoming appointments list (sorted soonest first) with status badge
2. Past appointments list (sorted newest first) — service, staff, date, price paid
3. Lifetime value summary card: total visits, total spend, avg spend per visit, last visit date, first visit date
4. "Book Again" button → opens new appointment modal pre-filled with this client + their most recent service

## Module 5.4 — Client Actions

1. Quick-add client button (name + phone minimum, email optional)
2. Merge duplicates: flag two client records as duplicates → merge keeps older record, copies all appointments
3. Export: CSV download of full client list (name, phone, email, visit count, total spend)
4. Flag / unflag no-show risk (manual toggle for owner in addition to auto-flag)
5. "Send Note" placeholder (hook for future SMS/email blast — just UI stub for now)

## Module 5.5 — Dashboard Enhancements

Add client stats to the main owner dashboard:
1. "Clients Today" count (how many unique clients have appointments today)
2. "New This Month" count (clients created in current calendar month)
3. "At Risk" count (link to filtered client list)
4. "Upcoming Appointments" widget — next 5 appointments across all staff
5. Quick-stat cards: total clients, bookings this week, revenue this week (if payment data exists)

## ON COMPLETION
1. Mark `"phase5": "done"` in build-state.json
2. Push everything to GitHub, redeploy Render
3. Run smoke test: create business → add staff + services → complete booking via public widget → verify client auto-created and visible in client list
4. Notify Andrew (Slack): "✅ Phase 5 (Client Management) complete. Full MVP live — auth, booking engine, public widget, emails, CRM all working. Phase 6 (Payments/Stripe) now running."
5. Read `/Users/crustacean/.openclaw/workspace/projects/booking/phase-tasks/phase6.md`
6. Spawn Phase 6: model="opus", thinking="high", label="booking-phase6", runTimeoutSeconds=1200
