# BoredRoom Booking — Phase 3: Public Booking Flow

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`
**Repo:** Check build-state.json for `github_repo` and `render_service_id`

## CRITICAL RULES
1. Read build-state.json FIRST. If phase3 is "done", spawn Phase 4 and exit.
2. If phase2 is NOT "done": check if slot engine is accessible via API. If yes, proceed anyway. If not, spawn Phase 2 first, then exit and wait.
3. Fail forward: log errors, keep building, never stop dead.
4. Push to GitHub after each module.


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

## Module 3.1 — Public Booking Widget

This is the client-facing booking page. Mobile-first. Clean. No login required.
URL: `/book/:slug` (e.g. `/book/mensroom`)

Design: dark background (#0A0A0A), green accent (#8CC63F), clean sans-serif.
Steps displayed as a horizontal progress bar at top.

**Step 1 — Service Picker**
- Card grid: service name, duration (e.g. "30 min"), price ("$25")
- Category tabs if services have categories (Haircuts / Beard / etc.)
- "Popular" services shown first

**Step 2 — Staff Picker**
- "Any Available" option first (auto-assigns)
- Staff cards with photo (or initials avatar), name
- Only show staff who can perform the selected service

**Step 3 — Date + Time**
- Calendar date picker (current month, disable past dates + business closed days)
- On date select: fetch slots from `/api/slots` → display as time buttons
- "No availability" message if no slots returned
- Real-time: slots re-fetch if user changes date

**Step 4 — Client Info + Confirm**
- Fields: Name (required), Phone (required), Email (required), Notes (optional)
- Summary sidebar: service, staff, date/time, price
- "Book Appointment" button → POST to `/api/appointments` with source='widget'
- Client created/upserted automatically

Tasks:
1. `/book/:slug` route + full HTML page (4-step flow, mobile responsive)
2. Step 1-2 UI + JS (service picker, staff picker)
3. Step 3 UI + JS (date picker, real-time slot fetching)
4. Step 4 UI + JS (client form, booking submission, error handling)
5. Embeddable iframe version: `/book/:slug?embed=1` (stripped nav, compact layout)

## Module 3.2 — Booking Confirmation + Client Links

1. Success screen after booking: confirmation number, service details, date/time, staff name
2. "Add to Google Calendar" link (builds gcal URL)
3. "Add to Apple Calendar" link (.ics file download via `/api/appointments/:token/ics`)
4. Client cancel link: `/cancel/:token` → shows appointment details + "Cancel Appointment" button
5. Client reschedule link: `/reschedule/:token` → same booking flow pre-filled, creates new + cancels old

## Module 3.3 — Client Auto-Registration + Return Detection

1. On booking: `INSERT INTO clients ... ON CONFLICT (business_id, email) DO UPDATE` (upsert)
2. Return client detection: if email matches existing client, show "Welcome back, [Name]!" and pre-fill name/phone
3. Client booking history page: `/my-bookings/:clientToken` — lists upcoming + past appointments
4. Cancel/reschedule from history page
5. Token expiry: cancel/reschedule tokens expire 2h before appointment start time (return "too late to cancel online, please call")

## ON COMPLETION
1. Mark `"phase3": "done"` in build-state.json
2. Push to GitHub, redeploy Render
3. Smoke test: complete a full booking via `/book/test` as a "client", verify it appears in owner calendar
4. Read `/Users/crustacean/.openclaw/workspace/projects/booking/phase-tasks/phase4.md`
5. Spawn Phase 4 sub-agent: model="opus", thinking="high"
6. Notify Andrew: "✅ Phase 3 (Public Booking Flow) complete. Clients can now book at /book/:slug. Phase 4 (Notifications) now running."
