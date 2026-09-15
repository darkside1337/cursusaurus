# Cursusaurus — Roadmap

Ordered by risk, not by ease — the entitlement/payment core comes before any UI polish. See `docs/PRD.md` for milestone rationale, `docs/ARCHITECTURE.md` for the system this implements, `docs/DESIGN.md` for UI tokens, `AGENTS.md` for workflow rules.

---

## Phase 0 — Foundation

- [x] PRD written (`docs/PRD.md`) — flows, non-goals, pricing/refund/trial decisions resolved
- [x] Architecture doc written (`docs/ARCHITECTURE.md`) — entitlement model, invariants, request lifecycles
- [x] Design system written (`docs/DESIGN.md`) — tokens, components, imagery/layout guidance
- [x] `AGENTS.md` written — UI/styling workflow, package manager, doc links
- [x] Design tokens ported into `globals.css` (single `@theme` block, no `:root` duplication)
- [x] Repo scaffolded: Next.js (App Router), Drizzle + Neon, Better-Auth, Supabase Storage client, Stripe SDK
- [x] Linting, type-checking, test runner (Vitest) configured
- [x] `db/schema.ts` stubbed with all tables from `ARCHITECTURE.md` §1 (empty, no migration yet)
- [x] Google Stitch project created for Cursusaurus; Project ID filled into `AGENTS.md` (currently a placeholder)
- [x] Initial shadcn primitives installed: `button`, `card`, `badge`, `input`, `progress`
- [x] Primitives above restyled per `DESIGN.md` component specs (pill radius, ink-black/peach, `font-sohne`)
- [x] `features/` directory scaffolded per `ARCHITECTURE.md` §1 (`entitlements/`, `purchases/`, `subscriptions/`, `courses/`, `video/`, `progress/`)
- [x] `globals.css` `:root` consolidated — map shadcn semantic variables (`--primary`, `--background`, etc.) to editorial tokens, remove redundant oklch defaults

---

## Phase 1 — Entitlement Core _(Milestone 0 — no UI, no Stripe yet)_

- [x] `(auth)` route group — login/register pages wired to Better-Auth (prerequisite for all auth-gated work)
- [x] Generate and apply Drizzle Kit migration for `entitlements`, `courses`, `purchases`, `subscriptions` (schema already defined in `db/schema.ts`)
- [x] `tests/helpers/` scaffolded — shared fixtures, DB seeding utility, auth helpers per `ARCHITECTURE.md` §1
- [x] `hasAccess(userId, courseId)` implemented — reads only from `entitlements`, per invariant #1
- [x] Seed script: fixture users/courses/entitlements for local dev
- [x] Full `hasAccess()` test matrix (Vitest): purchase-only, subscription-only (`active`), subscription (`trialing`), both simultaneously, canceled-with-both-present, `past_due`, refunded
- [x] **Gate:** all entitlement tests green before any Stripe integration begins

---

## Phase 2 — One-Time Purchase Flow _(Milestone 1)_

- [ ] Stripe Checkout session creation (one-time mode) — Server Action
- [ ] `checkout.session.completed` webhook handler → writes `purchases` + course-scoped `entitlements` row in one transaction
- [ ] Refund webhook handler → revokes purchase-sourced `entitlements` only, leaves `lesson_progress` untouched
- [ ] `processed_stripe_events` table + migration — unique constraint on `event_id` for webhook idempotency
- [ ] `/checkout/success` polling page (`GET /api/order-status/[sessionId]`)
- [ ] Course detail page: "Buy" CTA, gated preview vs. full content
- [ ] Pricing Tier Card — one-time vs. All-Access comparison on course detail page (peach treatment on All-Access tier)
- [ ] Test: buy in Stripe test mode → entitlement row appears → gated content unlocks
- [ ] Test: refund → entitlement revoked, progress intact

---

## Phase 3 — Subscription Flow _(Milestone 2)_

- [ ] Stripe Checkout session creation (subscription mode, 7-day trial) — Server Action
- [ ] `customer.subscription.created` webhook (status `trialing`) → writes `subscriptions` + all-access `entitlements` row (`course_id = null`)
- [ ] `customer.subscription.updated` webhook → `trialing`/`active` keep entitlement live; `past_due` revokes immediately (no grace period, per PRD §8)
- [ ] `customer.subscription.deleted` webhook → revokes all-access entitlement; purchase-sourced entitlements for the same course untouched
- [ ] Handle `customer.subscription.updated` with `cancel_at_period_end` — entitlement remains active until period end, then `customer.subscription.deleted` fires and revokes
- [ ] Overlap test: subscribe + buy one course outright + cancel subscription → that course still accessible, rest aren't
- [ ] Stripe Customer Portal session (self-serve cancel/upgrade) — `/billing` page
- [ ] Test: full subscription state matrix (trial → active → past_due → canceled) against `hasAccess()`
- [ ] Test: cancel via Customer Portal → access preserved until period end → then revoked

---

## Phase 4 — Video Delivery & Progress _(Milestone 3)_

- [ ] Generate and apply Drizzle Kit migration for `lesson_progress` (schema already defined in `db/schema.ts`)
- [ ] `getSignedPlaybackUrl(userId, courseId)` — calls `hasAccess()` internally, 403s if false, else mints 60s Supabase Storage signed URL
- [ ] `GET /api/video/signed-url` route handler
- [ ] `/learn/[courseSlug]/[lessonSlug]` page — Video Player Shell component, gated by signed-URL endpoint
- [ ] Progress tracking: Server Action to update `lesson_progress` on playback milestones
- [ ] Progress Bar component wired to real progress data (ink-black fill, never peach — per `DESIGN.md`)
- [ ] Access Badge component — All-Access / Purchased / Locked states wired to real entitlement data
- [ ] Test: signed URL only issued after `hasAccess()` passes; expires after 60s

---

## Phase 5 — Creator/Admin Tools _(Milestone 4)_

- [ ] `/dashboard/courses` — list view
- [ ] Course create/edit — Server Action, price constrained to $19–$199 range (per PRD §8)
- [ ] Video upload flow into Supabase Storage (private bucket)
- [ ] Publish/unpublish toggle
- [ ] Course Card component wired to catalog query — `(marketplace)` browse page, filterable grid

---

## Phase 6 — Polish & Billing Ops _(Milestone 5)_

- [ ] Email receipts (Stripe-driven)
- [ ] Dunning handling for failed renewal charges (beyond the immediate `past_due` revoke)
- [ ] `/library` page — owned/subscribed courses with progress, no pricing chrome
- [ ] Full `components/ui/` restyle audit — confirm no default shadcn styles remain unaddressed

---

## Phase 7 — Pre-Launch QA & Deploy

- [ ] Manual QA pass across all flows: purchase, subscribe, trial, cancel, refund, video playback, creator upload
- [ ] Webhook retry/duplicate-delivery test (Stripe resends) — confirm idempotency holds under load
- [ ] Vercel deployment configured; environment variables (Stripe, Neon, Supabase, Better-Auth) set
- [ ] Decide and configure: CI/CD, reconciliation cron for missed webhooks _(both flagged TBD in `ARCHITECTURE.md` §10)_
- [ ] Final review of `docs/PRD.md`, `ARCHITECTURE.md`, `DESIGN.md` for drift against what was actually built
