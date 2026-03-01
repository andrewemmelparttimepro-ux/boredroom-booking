# BoredRoom Booking — Phase 7: Reporting & Analytics

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json. If phase7 "done", spawn Phase 8 and exit.
2. Fail forward. Push after every module.
3. If Stripe data isn't available (Phase 6 incomplete), show $0 revenue but still build all report UI.

## DESIGN STANDARD — BoredRoom Aesthetic
- Background: #0A0A0A, cards #111111, borders #1E1E1E, accent: #B8AA96
- Charts: use Chart.js (CDN) with dark theme — transparent bg, gold/green lines, no grid clutter

## Module 7.1 — Revenue Dashboard

1. `GET /api/reports/revenue?businessId=&period=today|week|month|year&staffId=&serviceId=` — returns `{total, count, avgPerBooking, byDay: [{date, amount}]}`
2. Line chart: revenue over time (Chart.js), period selector tabs (Today / Week / Month / Year)
3. Stat cards: Total Revenue | # Bookings | Avg per Booking | Cancellation Rate
4. Staff filter dropdown — see revenue for individual staff member
5. Service filter — see revenue by service type

## Module 7.2 — Booking Analytics

1. `GET /api/reports/bookings?period=` — returns booking volume, cancellations, no-shows, completion rate
2. Bar chart: bookings per day of week (which days are busiest)
3. Heat map or table: bookings per hour of day (peak time identification)
4. No-show rate trend line (rolling 30-day)
5. Source breakdown: owner-booked vs widget-booked (pie chart)

## Module 7.3 — Service & Staff Performance

1. `GET /api/reports/services` — top services by booking count + revenue, with trend vs prior period
2. `GET /api/reports/staff` — per-staff: bookings, revenue, utilization % (hours booked / hours available), no-show rate
3. Services table: rank by revenue, show avg service duration vs actual (if tracked)
4. Staff leaderboard: sortable by any metric
5. "Opportunity" callout: services with high demand but low capacity (booked >80% of available slots)

## Module 7.4 — Client Analytics

1. New vs returning clients per month (stacked bar)
2. Client retention rate (% who rebooked within 60 days)
3. At-risk count trend (clients approaching 60-day no-visit threshold)
4. Top 10 clients by lifetime spend
5. Avg days between visits per client (cohort average)

## Module 7.5 — Export & Scheduling

1. Export any report as CSV
2. `GET /api/reports/daily-summary` — auto-generated end-of-day email to owner (revenue, # clients seen, tips collected, tomorrow's schedule preview)
3. Schedule daily summary via node-cron at 8pm business timezone
4. Reports nav section in sidebar, all charts mobile-responsive
5. Print-friendly CSS for reports (for handing to accountant)

## ON COMPLETION
1. Mark `"phase7": "done"` in build-state.json, push, redeploy
2. Read phase8.md, spawn Phase 8: model="opus", thinking="high", label="booking-phase8"
3. Notify Andrew (Slack): "✅ Phase 7 (Reporting) complete. Revenue, booking, staff, client analytics all live with charts. Phase 8 (Multi-Tenant) now running."
