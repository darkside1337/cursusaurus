# Cursusaurus — Architecture Overview

This document provides agents with a rapid, authoritative understanding of the Cursusaurus codebase. Update it as the system evolves.

---

## 1. Project Structure

```
Cursusaurus/
├── app/                            # Next.js App Router root
│   ├── (marketplace)/              # Public route group — browse & course pages
│   │   ├── layout.tsx               # Marketplace shell (MarketplaceNav)
│   │   ├── page.tsx                 # Course catalog (server) + access-state mapping
│   │   ├── catalog-content.tsx      # Client: search/filter grid over published courses
│   │   ├── loading.tsx              # Catalog skeleton
│   │   └── [slug]/page.tsx          # Course detail scaffold (gated lessons + pricing panel)
│   ├── (auth)/                     # Auth route group
│   │   ├── layout.tsx
│   │   └── login/page.tsx           # Google + GitHub OAuth sign-in
│   ├── dashboard/                  # Creator/admin dashboard (auth-gated)
│   │   ├── layout.tsx               # Dashboard shell (DashboardNav)
│   │   └── courses/
│   │       ├── page.tsx             # Course list (CourseFilterGrid)
│   │       ├── new/
│   │       │   ├── page.tsx         # Create course
│   │       │   ├── actions.ts       # Create-course Server Actions
│   │       │   └── create-course-form.tsx
│   │       └── [id]/
│   │           ├── page.tsx         # Edit course / publish
│   │           ├── actions.ts       # Edit-course, lesson CRUD + reorder Server Actions
│   │           └── curriculum-studio.tsx
│   ├── api/                        # Route Handlers only — all external API surface
│   │   └── auth/[...all]/route.ts   # Better-Auth endpoint (built)
│   │   # TODO (Phases 3–4): webhooks/stripe, order-status/[sessionId], video/signed-url
│   ├── library/                    # Learner's owned/subscribed courses (auth-gated)   [Phase 5]
│   ├── learn/[courseSlug]/[lessonSlug]/  # Video playback, access-gated              [Phase 4]
│   ├── billing/                    # Subscription status, Customer Portal link        [Phase 3]
│   ├── checkout/success/           # Order polling page                               [Phase 3]
│   ├── fonts.ts                    # next/font/local — Signifier + Sohne
│   └── globals.css                 # @theme inline tokens + :root shadcn mapping
├── features/                       # Domain logic — one folder per bounded context
│   ├── courses/                    # Course CRUD, slug generation, publish state, readiness
│   ├── purchases/                  # One-time Checkout session creation               [scaffolded]
│   ├── subscriptions/              # Subscription Checkout, webhook handlers          [scaffolded]
│   ├── entitlements/               # hasAccess(), entitlement grant/revoke writers
│   ├── video/                      # getSignedPlaybackUrl()                           [scaffolded]
│   └── progress/                   # Lesson progress queries/mutations                 [scaffolded]
├── components/                     # Presentation components (compose shadcn/ui primitives)
│   ├── course-card.tsx             # Catalog/creator course card with access badges
│   ├── course-filter-grid.tsx      # Creator dashboard card grid + search/tabs
│   ├── marketplace-nav.tsx         # Public site navigation (mobile hamburger)
│   ├── dashboard-nav.tsx           # Dashboard navigation
│   └── ui/                         # shadcn/ui primitives (installed, restyled, not hand-edited)
├── lib/                            # Infrastructure clients
│   ├── db/                         # Drizzle client
│   │   ├── index.ts                # Drizzle + Neon client
│   │   └── schema/auth-schema.ts   # Better-Auth managed tables (user, session, account, ...)
│   ├── storage.ts                  # Supabase Storage client (video only)
│   ├── stripe.ts                   # Stripe SDK instance
│   ├── auth.ts                     # Better-Auth instance + getServerSession()
│   ├── auth-client.ts              # Better-Auth browser client
│   ├── callback-url.ts             # Open-redirect-safe callbackUrl sanitizer
│   └── utils.ts                    # cn() helper
├── config/
│   └── env.ts                      # T3 env validation (server + client vars)
├── db/
│   └── schema.ts                   # Drizzle schema (single source of truth; re-exports auth tables)
├── drizzle/                        # Drizzle Kit generated SQL migrations
├── scripts/
│   └── seed.ts                     # Fixture users, courses, lessons, entitlements
├── tests/                          # Unit + feature tests (Vitest + PGlite — see §9)
│   ├── helpers/
│   │   ├── db.ts                   # PGlite in-memory DB + migrator + cleanDb()
│   │   └── fixtures.ts             # Shared fixtures (users, courses, entitlements)
│   ├── features/
│   │   ├── callback-url.test.ts
│   │   ├── creator-dashboard.test.ts
│   │   ├── curriculum-studio.test.ts
│   │   ├── lessons.test.ts
│   │   ├── public-catalog.test.ts
│   │   └── scaffold.test.ts
│   ├── entitlements/hasAccess.test.ts
│   └── smoke.test.ts
├── PRODUCT.md                      # Product positioning, principles, audience
├── proxy.ts                        # Next.js proxy — eager auth gate (cookie-presence)
├── .plans/                         # Implementation plans shared with the workspace
└── docs/
    ├── PRD.md                      # Product spec, schema, invariants, testing decisions
    ├── ROADMAP.md                  # Phased task breakdown and current progress
    ├── DESIGN.md                   # Visual tokens, typography, component specs
    └── ARCHITECTURE.md             # This document
```

**Boundaries:**

- `app/` stays thin — renders layouts, composes feature calls. No business logic.
- `features/` encapsulates all domain queries, actions, and validation. No routing awareness.
- `components/` receives all data via props. Domain presentation components (e.g. `course-card.tsx`, `course-filter-grid.tsx`) may import **type contracts only** from `features/` for props — never domain logic, actions, or raw queries.
- `components/ui/` holds shadcn/ui primitives and is the only strictly domain-agnostic layer: no imports from `features/` or `app/`. Style them via design tokens in `globals.css`; don't hand-edit generated primitives unless fixing a genuine primitive bug.
- `app/api/` Route Handlers verify auth, call into `features/`, return HTTP responses. No inline business logic.
- Server Actions are used only for authenticated user-initiated form mutations (course create/edit, progress updates). All external API surface (webhooks, polling, signed URLs) is Route Handlers.
- `proxy.ts` is an eager, cookie-presence auth gate for authenticated areas (`/dashboard` today; `/learn`, `/library`, `/billing` in later phases). It is **optimistic only** — it never runs DB queries and is not the security boundary. Authoritative session checks live in layouts, Server Actions, and Route Handlers (see §8); `/api/auth/**` (OAuth callback), the marketplace, and `/login` pass through untouched.

---

## 2. System Diagram

```
[Browser]
    │
    ├── App Router pages ──► [Next.js Server]
    │                              │
    │                        [Neon Postgres] ◄── Drizzle ORM
    │                              │
    ├── Stripe Checkout (one-time OR subscription) ──► [Stripe]
    │                                                        │
    │                                                 webhook POST
    │                                                        │
    │                                                 [/api/webhooks/stripe]
    │                                                        │
    │                                          writes Purchase / Subscription
    │                                          + Entitlement (single tx)
    │                                                        │
    │                                                 [Neon Postgres]
    │
    └── GET /api/video/signed-url ──► hasAccess() check ──► [Supabase Storage]
                                                                (60s signed GET URL)
```

---

## 3. Core Components

### Next.js Application (monolith)

Single Next.js (App Router) application serving learner, creator/admin, and billing flows. No separate backend service.

- **Route Handlers** (`app/api/`): Better-Auth endpoint (built). Planned (Phases 3–4): Stripe webhook, video signed-URL issuance, order status polling.
- **Server Actions**: Course create/edit, lesson management, publish; lesson progress updates (Phase 4).
- **Components** (`components/`): Built on shadcn/ui primitives for accessibility, restyled per `docs/DESIGN.md` tokens.
- **Deployment**: Vercel

### Neon Postgres (via Drizzle ORM)

Single source of truth for all domain state. Schema in `db/schema.ts`. Migrations via Drizzle Kit.

Tables: `courses`, `lessons`, `purchases`, `subscriptions`, `entitlements`, `lesson_progress`, `processed_stripe_events` — plus Better-Auth managed tables.

### Supabase Storage

Object storage for video files only — not used for DB or auth in this project. Accessed via the Supabase JS client. Files are served exclusively through short-lived signed URLs issued after a server-side `hasAccess()` check; the storage bucket itself is private.

---

## 4. Data Stores

### Neon Postgres

- All domain state: courses, lessons, purchases, subscriptions, entitlements, lesson progress
- Better-Auth session/account tables
- `processed_stripe_events` — webhook idempotency (unique event ID per Stripe delivery)
- `purchases` and `subscriptions` are payment-state records; **`entitlements` is the only table read for access decisions** (see §6)

### Supabase Storage

- Binary video files only
- Private bucket — no public URLs; every read goes through a signed URL minted per-request

---

## 5. External Integrations

| Service                | Purpose                                              | Method                           |
| ---------------------- | ---------------------------------------------------- | -------------------------------- |
| Stripe Checkout        | One-time course purchases + All-Access subscriptions | SDK + webhook                    |
| Stripe Customer Portal | Self-serve subscription cancel/upgrade               | SDK-generated portal session     |
| Supabase Storage       | Video file storage                                   | Supabase JS client (signed URLs) |
| Neon                   | Managed Postgres hosting                             | Drizzle ORM                      |

---

## 6. Key Invariants

These are architectural constraints, not just conventions. Violating them breaks the access-control model or the payment audit trail.

1. **`entitlements` is the sole table read for access decisions.** `hasAccess(userId, courseId)` never queries `purchases` or `subscriptions` directly — see PRD §5.
2. **`purchases` and `subscriptions` are payment history/state, written only by Stripe webhook handlers.** Application code never mutates their status fields directly.
3. **`entitlements.course_id = null` means all-access (subscription-sourced).** A row with a specific `course_id` means purchase-sourced (or a course-scoped grant).
4. **Canceling or lapsing a subscription revokes only subscription-sourced entitlements.** A purchase-sourced entitlement for the same course is never touched by a subscription webhook.
5. **`trialing` and `active` subscription status both grant the entitlement; `past_due`, `canceled`, and `unpaid` revoke it immediately** (no grace period — see PRD §8).
6. **A refund revokes the purchase-sourced entitlement only.** `lesson_progress` rows are never deleted on refund.
7. **Webhook handlers are idempotent** — each handler inserts into `processed_stripe_events` (unique constraint on `event_id`) within the same transaction; duplicate deliveries become no-ops.
8. **`purchases`/`subscriptions` + `entitlements` are written in a single Postgres transaction** in the relevant webhook handler.
9. **Video signed URLs are only issued server-side, after `hasAccess()` returns true.** No client ever receives a storage path or long-lived URL.

---

## 7. Request Lifecycles

> Status legend: **BUILT** = fully implemented and wired; **SCAFFOLDED** = domain function exists, not yet exposed via a route/Server Action; **PLANNED** = Phase 3–4 work, not started.
>
> Payment, subscription, and video lifecycles below are the target design. Course catalog, course detail, and dashboard flows are built. Stripe webhooks, Checkout session creation, `/learn`, and `/billing` wiring land in Phases 3–4 (see `docs/ROADMAP.md`).

### One-time purchase — PLANNED (Phase 3)

1. Learner clicks "Buy course" → Server Action creates Stripe Checkout Session (one-time mode) → redirect to Stripe
2. Learner completes payment → Stripe redirects to `/checkout/success?session_id=...`
3. Success page polls `GET /api/order-status/[sessionId]` every 1–2s
4. Stripe delivers `checkout.session.completed` webhook → handler writes `purchases` + course-scoped `entitlements` row in one transaction
5. Next poll returns `completed` → success page shows confirmation, links to `/learn/...`

### Subscription signup (with trial) — PLANNED (Phase 3)

1. Learner clicks "Start All-Access" → Server Action creates Stripe Checkout Session (subscription mode, 7-day trial) → redirect to Stripe
2. Stripe delivers `customer.subscription.created` (status `trialing`) → handler writes `subscriptions` row + all-access `entitlements` row (`course_id = null`)
3. On trial end, Stripe attempts first charge: `customer.subscription.updated` (status → `active`) keeps entitlement live; failed charge → status `past_due` → handler revokes the all-access entitlement immediately

### Video playback — SCAFFOLDED (`getSignedPlaybackUrl` exists; route + player PLANNED in Phase 4)

1. `GET /api/video/signed-url?courseId=...&lessonSlug=...` (route not yet built)
2. Verify session (Better-Auth) → run `hasAccess(userId, courseId)` against `entitlements`
3. If true: call `getSignedPlaybackUrl({ userId, courseId, lessonSlug })` to mint a signed Supabase Storage URL (storage path `<courseId>/<lessonSlug>.mp4`; expiry configurable via `expiresInSeconds`, default 60s), return it
4. If false: 403

### Subscription cancellation — PLANNED (Phase 3)

1. Learner cancels via Stripe Customer Portal
2. Stripe delivers `customer.subscription.updated` with `cancel_at_period_end = true` — entitlement remains active (no change)
3. At period end, Stripe delivers `customer.subscription.deleted` → handler revokes all-access `entitlements`
4. Any course with a separate purchase-sourced entitlement remains accessible — untouched by this webhook

---

## 8. Security

| Concern             | Approach                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Auth                | Better-Auth session cookies; eager cookie-presence `proxy.ts` redirect for authenticated areas (optimistic — full session validation runs per page/action) |
| Payment             | Stripe-hosted Checkout, webhook signature verification                        |
| Video access        | `hasAccess()` check on every signed-URL request — no cached client-side state |
| Signed URL lifetime | 60-second presigned Supabase Storage GET URLs                                 |
| Webhook idempotency | Unique constraint on `stripe_event_id`                                        |

---

## 9. Testing

- **Framework**: Vitest, confirmed. Unit + feature tests run against an **in-memory PGlite** database (`@electric-sql/pglite`) — `tests/helpers/db.ts` instantiates PGlite, applies the real Drizzle migrations from `./drizzle`, and exposes a `cleanDb()` helper; no external Postgres needed.
- **Seams**: feature/query boundaries driving real queries against PGlite, and Route Handler boundaries on the request-to-database path (external HTTP services — Stripe, Supabase — are not mocked in unit tests; Playwright (`tests/e2e`) covers browser flows).
- **Current coverage** (see `tests/`): `entitlements/hasAccess.test.ts` (full truth table: purchase-only, subscription-only, trialing, both simultaneously, canceled-with-both, past_due, refunded), `features/public-catalog.test.ts`, `features/creator-dashboard.test.ts`, `features/curriculum-studio.test.ts`, `features/lessons.test.ts`, `features/callback-url.test.ts` (open-redirect sanitizer), plus a smoke test. The `proxy.ts` gate itself is verified at build time and via browser flows, not unit-tested.
- **Priority order for upcoming phases**: Stripe webhook handler tests → video signed-url handler tests → order-status handler tests.
- See `docs/PRD.md` for the full entitlement test matrix required before any Stripe integration work begins.

---

## 10. Deployment & Ops

- **Platform**: Vercel
- **Cron**: TBD — likely needed for subscription state reconciliation (catching missed webhooks) once volume justifies it
- **CI/CD**: TBD

---

## 11. Glossary

| Term                   | Definition                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entitlement            | A row in `entitlements` granting access; `course_id = null` means all-access, otherwise                                                                                    |
| course-scoped          |
| All-access entitlement | Subscription-sourced entitlement with `course_id = null`, covers every published course including future ones                                                              |
| Signed playback URL    | Time-limited (60s), signed Supabase Storage URL for video GET, issued only after `hasAccess()` passes                                                                      |
| Webhook fulfillment    | The pattern where Stripe webhook events — not the success redirect or client state — are the authoritative write path for `purchases`, `subscriptions`, and `entitlements` |
| Trialing               | Stripe subscription status during the 7-day free trial; treated as access-granting, same as `active`                                                                       |

---

**Last updated:** 2026-09-16
