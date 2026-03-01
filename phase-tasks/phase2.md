# BoredRoom Booking — Phase 2: The Booking Engine

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`
**Repo:** Check build-state.json for `github_repo` and `render_service_id`

## CRITICAL RULES
1. Read build-state.json FIRST. If phase2 is already "done", spawn Phase 3 and exit.
2. If any module fails: log the failure to build-state.json under `phase2_errors`, continue to next module. Never stop dead.
3. After all modules: mark phase2 "done" in build-state.json, push to GitHub, notify Andrew in Slack (`@andrew emmel` in the main session), then spawn Phase 3.
4. Push to GitHub after each module completes so work is never lost.


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

## Module 2.1 — Slot Generation Algorithm

The core of the entire system. Get this right.

```javascript
// src/services/slotEngine.js
// getAvailableSlots(businessId, serviceId, staffId, date) → [{ time: '09:00', staffId, staffName }]
// 
// Algorithm:
// 1. Load service duration + buffer from DB
// 2. Load staff working hours for that day (staff_availability OR business_hours if staffId='any')
// 3. Generate all possible start times (working_start to working_end - duration, in 15-min increments)
// 4. Load existing appointments for that day/staff, build blocked windows
// 5. Remove any slot where [slot_start, slot_start+duration+buffer] overlaps a blocked window
// 6. Return remaining slots
//
// 'any' staffId mode: run for each qualified staff member, union results, deduplicate times,
//   attach staffId to each slot (client picks time, system assigns best available staff)
```

Tasks:
1. Build `src/services/slotEngine.js` with full algorithm + comprehensive comments
2. Unit tests for slot engine: normal day, fully booked day, staff day-off, service longer than remaining day, buffer edge cases
3. `/api/slots` endpoint: `GET /api/slots?businessId=&serviceId=&staffId=&date=` → returns slots array
4. Test with real data (seed some test appointments, verify conflicts exclude correctly)
5. Handle timezone correctly — all DB times in UTC, convert to business timezone for slot grid

## Module 2.2 — Appointments Database

1. Verify appointments table schema matches:
   ```sql
   appointments(id, business_id, client_id, staff_id, service_id, 
                start_time TIMESTAMPTZ, end_time TIMESTAMPTZ,
                status VARCHAR(20) DEFAULT 'pending',
                notes TEXT, source VARCHAR(20) DEFAULT 'owner',
                booking_token VARCHAR(100) UNIQUE,
                created_at TIMESTAMPTZ DEFAULT NOW())
   ```
2. CRUD routes: `POST /api/appointments`, `GET /api/appointments`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`
3. Status state machine validation (only valid transitions allowed: pending→confirmed, confirmed→completed/no_show, any→cancelled)
4. Auto-calculate `end_time` from `start_time + service.duration_minutes + service.buffer_minutes`
5. `booking_token` = `nanoid(12)` on create — used for client-facing cancel/reschedule links

## Module 2.3 — Owner Calendar View

1. `GET /api/calendar?businessId=&date=&view=day|week` → returns appointments with client+staff+service data joined
2. Day view HTML/JS: vertical time grid (6am–9pm), staff as columns, appointments as positioned colored blocks
3. Week view HTML/JS: 7 columns (Mon–Sun), each cell shows appointment count, click to go to day view
4. Click appointment block → slide-out detail panel: client name, service, time, phone, status dropdown, notes
5. Status update from panel (confirm/complete/no-show/cancel) → PATCH API → UI updates without page reload

## Module 2.4 — Owner-Side Booking

1. "New Appointment" button → modal with 4 steps: pick service → pick staff → pick date+slot → client
2. Client lookup (typeahead search by name/phone/email) + "New Client" quick-add inline
3. Manual time override toggle (owner can type custom time, bypassing slot engine)
4. "Block Time" option: creates appointment with no client, status='blocked', appears as gray bar on calendar
5. Reschedule: drag appointment to new slot (or edit modal with new date/time picker)

## ON COMPLETION
1. Mark `"phase2": "done"` in build-state.json
2. Push all code to GitHub
3. Redeploy to Render
4. Run smoke test: create a test appointment via API, verify it appears in calendar
5. Read `/Users/crustacean/.openclaw/workspace/projects/booking/phase-tasks/phase3.md`
6. Spawn Phase 3 sub-agent using sessions_spawn with model="opus", thinking="high", the contents of phase3.md as the task
7. Notify Andrew: "✅ Phase 2 (Booking Engine) complete. Slot algorithm live, calendar view working, Phase 3 (Public Booking Flow) now running."
