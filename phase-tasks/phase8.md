# BoredRoom Booking — Phase 8: Multi-Tenant Platform

**State file:** `/Users/crustacean/.openclaw/workspace/projects/booking/build-state.json`
**Project root:** `/Users/crustacean/.openclaw/workspace/projects/booking/`

## CRITICAL RULES
1. Read build-state.json. If phase8 "done", spawn Phase 9 and exit.
2. The entire backend is already multi-tenant (business_id scoped) — this phase exposes that properly.
3. Fail forward. Push after every module.

## DESIGN STANDARD — BoredRoom Aesthetic
- Background: #0A0A0A, cards #111111, accent: #B8AA96
- Admin panel: same aesthetic, but with a subtle "ADMIN" badge in nav to distinguish from owner view

## Module 8.1 — Tenant Routing & Isolation

1. Verify ALL existing API routes are properly scoped to `req.businessId` from JWT — audit every route file
2. Public routes (`/book/:slug`, `/cancel/:token`, `/reschedule/:token`) resolve business by slug — confirm no data leaks between businesses
3. `GET /api/businesses/:slug/public` — returns public business info (name, hours, brand_color, logo) for booking widget without auth
4. Rate limiting per business on public booking endpoint (express-rate-limit: 20 bookings/hour per IP)
5. Error pages: 404 for unknown slug, "Booking closed" page for businesses with no active hours

## Module 8.2 — BoredRoom Admin Panel

1. Separate admin auth: `ADMIN_SECRET` env var. `POST /api/admin/login` with secret → admin JWT with role='superadmin'
2. Admin dashboard at `/admin` (separate HTML page, same BoredRoom aesthetic, "SUPERADMIN" badge)
3. Businesses list: all tenants, status (active/inactive), plan, # bookings, # clients, joined date
4. Business detail: impersonate owner (generate JWT for their business), view their dashboard
5. System stats: total bookings across all businesses, MRR (if Stripe connected), active businesses count

## Module 8.3 — Tenant Onboarding Wizard

1. Public signup: `POST /api/auth/register` already exists — enhance with business type selector (barbershop, salon, med spa, etc.)
2. Onboarding wizard (multi-step modal after first login): Step 1 set hours → Step 2 add first service → Step 3 add first staff → Step 4 embed booking widget
3. Widget embed code generator: show `<iframe src="https://[render_url]/book/[slug]" width="100%" height="700"></iframe>` with copy button
4. Onboarding checklist widget on dashboard: "✅ Business profile | ✅ Hours set | ✅ Services added | ✅ Staff added | ⬜ First booking received"
5. "Setup complete" celebration when all 5 onboarding steps done

## Module 8.4 — White-Label Booking Widget

1. Booking widget (`/book/:slug`) already uses business brand_color — verify this is fully dynamic
2. Business logo displayed at top of booking widget (fetched from businesses.logo_url)
3. Booking confirmation emails use business name as sender name, business email as reply-to
4. "Powered by BoredRoom" footer on widget (small, subtle) with toggle: `show_branding BOOLEAN DEFAULT true` in businesses table — admin can disable per tenant
5. Custom domain support stub: `custom_domain VARCHAR(255)` column on businesses table + documentation comment explaining CNAME setup

## ON COMPLETION
1. Mark `"phase8": "done"` in build-state.json, push, redeploy
2. Read phase9.md, spawn Phase 9: model="opus", thinking="high", label="booking-phase9"
3. Notify Andrew (Slack): "✅ Phase 8 (Multi-Tenant) complete. Admin panel live, tenant isolation verified, onboarding wizard built, white-label widget ready. Phase 9 (Advanced Features) now running."
