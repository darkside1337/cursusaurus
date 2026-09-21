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
│   │   └── [slug]/
│   │       ├── page.tsx             # Course detail (gated lessons + pricing panel)
│   │       └── enrollment-panel.tsx # Client: dual pricing CTAs, overlap state, Checkout triggers
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
│   │   ├── auth/[...all]/route.ts   # Better-Auth endpoint (built)
│   │   ├── webhooks/stripe/route.ts # Stripe signature validation + event dispatch (built)
│   │   ├── order-status/[sessionId]/route.ts # Order polling + single-shot reconciliation (built)
│   │   └── video/
│   │       └── signed-url/route.ts  # Video signed-URL issuance, access-gated (built)
│   ├── library/                    # Learner's owned/subscribed courses (auth-gated)   [Phase 5]
│   ├── learn/[courseSlug]/[lessonSlug]/ # Classroom video playback & progress, access-gated [built]
│   │   ├── page.tsx
│   │   └── player-view.tsx
│   ├── billing/                    # Subscription status, Customer Portal link        [built]
│   │   ├── page.tsx
│   │   └── billing-content.tsx
│   ├── checkout/success/           # Order polling page                               [built]
│   │   ├── page.tsx
│   │   └── order-status-view.tsx
│   ├── fonts.ts                    # next/font/local — Signifier + Sohne
│   └── globals.css                 # @theme inline tokens + :root shadcn mapping
├── features/                       # Domain logic — one folder per bounded context
│   ├── courses/                    # Course CRUD, slug generation, publish state, readiness
│   ├── stripe/                     # Stripe dispatcher, fulfillment context, event poisoning dead-letter
│   ├── purchases/                  # One-time checkout, webhook fulfillment, refund tombstones, queries
│   ├── subscriptions/              # Subscription checkout, webhook fulfillment, pricing, queries, portal
│   ├── entitlements/               # hasAccess(), entitlement grant/revoke writers
│   ├── video/                      # Signed URLs, Supabase Storage uploads, video asset management
│   └── progress/                   # Lesson progress queries, mutations, Server Actions, completion logic
├── components/                     # Presentation components (compose shadcn/ui primitives)
│   ├── classroom/                  # Classroom navigation & header components
│   │   └── classroom-header.tsx
│   ├── course-card.tsx             # Catalog/creator course card with access badges
│   ├── course-filter-grid.tsx      # Creator dashboard card grid + search/tabs
│   ├── marketplace-nav.tsx         # Public site navigation (mobile hamburger)
│   ├── dashboard-nav.tsx           # Dashboard navigation
│   ├── progress-bar.tsx            # Persistent learner progress bar (ink-black fill)
│   ├── video-player-shell.tsx      # Elevated video player container with custom controls
│   └── ui/                         # shadcn/ui primitives (installed, restyled, not hand-edited)
├── lib/                            # Infrastructure clients
│   ├── db/                         # Drizzle database client & schemas
│   │   ├── db.ts                   # Drizzle + Postgres client instance
│   │   ├── schema.ts               # Drizzle schema (single source of truth; re-exports auth tables)
│   │   └── auth-schema.ts          # Better-Auth managed tables (user, session, account, ...)
│   ├── format-price.ts             # Editorial price formatting ($49 vs $19.99)
│   ├── storage.ts                  # Supabase Storage client (video only)
│   ├── stripe.ts                   # Stripe SDK instance
│   ├── auth.ts                     # Better-Auth instance + getServerSession()
│   ├── auth-client.ts              # Better-Auth browser client
│   ├── callback-url.ts             # Open-redirect-safe callbackUrl sanitizer
│   └── utils.ts                    # cn() helper
├── config/
│   └── env.ts                      # T3 env validation (server + client vars)
├── drizzle/                        # Drizzle Kit generated SQL migrations
├── scripts/
│   ├── browse.ts                   # Headless Playwright script for automated visual checks
│   └── seed.ts                     # Fixture users, courses, lessons, entitlements
├── tests/                          # Unit + feature tests (Vitest + PGlite — see §9)
│   ├── helpers/
│   │   ├── db.ts                   # PGlite in-memory DB + migrator + cleanDb()
│   │   └── fixtures.ts             # Shared fixtures (users, courses, entitlements)
│   ├── components/                 # Component unit tests
│   ├── entitlements/               # Access matrix & revocation safety tests
│   ├── features/                   # Domain & API integration tests
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
- Server Actions are used for authenticated user-initiated form mutations (course create/edit), checkout session creation, and customer portal initialization. All external API surface (webhooks, polling, signed URLs) is Route Handlers.
- `proxy.ts` is an eager, cookie-presence auth gate for authenticated areas (`/dashboard`, `/billing`, and `/learn` today; `/library` in Phase 5). It is **optimistic only** — it never runs DB queries and is not the security boundary. Authoritative session checks live in layouts, Server Actions, and Route Handlers (see §8); `/api/auth/**` (OAuth callback), the marketplace, and `/login` pass through untouched.

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

- **Route Handlers** (`app/api/`): Better-Auth endpoint, Stripe webhook dispatch (`webhooks/stripe`), order status polling & single-shot reconciliation (`order-status/[sessionId]`), video signed-URL issuance (`video/signed-url`) (all built).
- **Server Actions**: Course create/edit, lesson CRUD and reordering, publish status, creator video upload URL and asset registration (`features/courses`, `app/dashboard/courses/[id]/actions.ts`); checkout session creation (`createCourseCheckoutSessionAction`, `createSubscriptionCheckoutSessionAction`), customer portal (`manageSubscriptionAction`); lesson progress tracking and manual completion toggles (`recordLessonPlaybackAction`, `toggleLessonCompletionAction`).
- **Components** (`components/`): Built on shadcn/ui primitives for accessibility, restyled per `docs/DESIGN.md` tokens.
- **Deployment**: Vercel

### Neon Postgres (via Drizzle ORM)

Single source of truth for all domain state. Schema in `lib/db/schema.ts`. Migrations via Drizzle Kit.

Tables: `courses`, `lessons`, `purchases`, `subscriptions`, `entitlements`, `lesson_progress`, `processed_stripe_events`, `refund_tombstones`, `reconcile_attempts` — plus Better-Auth managed tables.

### Supabase Storage

Object storage for video files only — not used for DB or auth in this project. Accessed via the Supabase JS client. Files are served exclusively through short-lived signed URLs issued after a server-side `hasAccess()` check; the storage bucket itself is private.

---

## 4. Data Stores

### Neon Postgres

- All domain state: courses, lessons, purchases, subscriptions, entitlements, lesson progress, refund tombstones, reconcile attempts
- Better-Auth session/account tables
- `processed_stripe_events` — webhook idempotency (unique event ID per Stripe delivery)
- `purchases` and `subscriptions` are payment-state records; **`entitlements` is the only table read for access decisions** (see §6)

### Supabase Storage

- Binary video files only
- Private bucket — no public URLs; every read goes through a signed URL minted per-request
- Max upload size: 50 MB per lesson file (Supabase free-tier cap) — enforced client-side (instant pre-check), server-side on asset registration (object stat), and absolutely at the bucket layer

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
2. **`purchases` and `subscriptions` are payment history/state, written only by Stripe webhook handlers and the atomic reconciliation seam.** Application code never mutates their status fields directly.
3. **`entitlements.course_id = null` means all-access (subscription-sourced).** A row with a specific `course_id` means purchase-sourced (or a course-scoped grant).
4. **Canceling or lapsing a subscription revokes only subscription-sourced entitlements.** A purchase-sourced entitlement for the same course is never touched by a subscription webhook.
5. **`trialing` and `active` subscription status both grant the entitlement; `past_due`, `canceled`, and `unpaid` revoke it immediately** (no grace period — see PRD §8).
6. **A refund revokes the purchase-sourced entitlement only.** `lesson_progress` rows are never deleted on refund.
7. **Webhook handlers are idempotent** — each handler inserts into `processed_stripe_events` (unique constraint on `event_id`) within the same transaction; duplicate deliveries become no-ops.
8. **`purchases`/`subscriptions` + `entitlements` are written in a single Postgres transaction** in the relevant webhook handler.
9. **Video signed URLs are only issued server-side, after `hasAccess()` returns true.** No client ever receives a storage path or long-lived URL.
10. **Reconciliation Seam:** On-demand single-shot reconciliation (`/api/order-status/[sessionId]`) triggers only when webhook delivery is delayed or missed during checkout polling, claimed atomically via `reconcile_attempts`.
11. **Refund Tombstones:** Webhook refund processing writes to `refund_tombstones` to guarantee refund idempotency, revoke course-scoped access, and preserve `lesson_progress`.
12. **Purchase Completion Immutability:** Completed purchase records (`status = 'completed'`) cannot be overwritten or downgraded by subsequent checkout sessions or duplicate events.
13. **Whole-Second Epoch Ordering:** Subscription webhooks evaluate `event.created` against `subscriptions.last_event_epoch` to reject out-of-order deliveries.

---

## 7. Request Lifecycles

> Status legend: **BUILT** = fully implemented and wired; **SCAFFOLDED** = domain function exists, not yet exposed via a route/Server Action; **PLANNED** = work not started.
>
> All core payment, subscription, video delivery, and classroom learning lifecycles are built and active.

### One-time purchase — BUILT

1. Learner clicks "Buy course" → Server Action creates Stripe Checkout Session (one-time mode) → redirect to Stripe
2. Learner completes payment → Stripe redirects to `/checkout/success?session_id=...`
3. Success page polls `GET /api/order-status/[sessionId]` every 1–2s
4. Stripe delivers `checkout.session.completed` webhook → handler writes `purchases` + course-scoped `entitlements` row in one transaction
5. Next poll returns `completed` → success page shows confirmation, links to `/learn/...`

### Subscription signup (with trial) — BUILT

1. Learner clicks "Start All-Access" → Server Action creates Stripe Checkout Session (subscription mode, 7-day trial) → redirect to Stripe
2. Stripe delivers `customer.subscription.created` (status `trialing`) → handler writes `subscriptions` row + all-access `entitlements` row (`course_id = null`)
3. On trial end, Stripe attempts first charge: `customer.subscription.updated` (status → `active`) keeps entitlement live; failed charge → status `past_due` → handler revokes the all-access entitlement immediately

### Video playback — BUILT

1. Learner navigates to `/learn/[courseSlug]/[lessonSlug]`
2. Server validates authentication, access (`hasAccess(userId, courseId)`), and lesson preview status (`lesson.isPreview` permits unauthenticated free preview playback)
3. Player requests `GET /api/video/signed-url?courseId=...&lessonId=...`
4. Route calls `getSignedPlaybackUrl({ userId, courseId, lessonId })` which enforces access authorization and mints a 60-second signed Supabase Storage GET URL from the private `course-videos` bucket
5. Video player (`VideoPlayerShell`) mounts the signed stream or renders editorial no-video fallback card if no asset exists

### Video upload (Creator) — BUILT

1. Creator accesses Curriculum Studio (`/dashboard/courses/[id]`) and initiates video upload for a lesson
2. Server Action calls `getLessonVideoUploadUrl` validating creator course ownership and generates a signed upload URL into the private `course-videos` bucket at storage key `${courseId}/${lessonId}.${ext}`
3. Client performs pre-flight file size check (≤ 50 MB) and uploads binary directly to Supabase Storage
4. On upload completion, Server Action `saveLessonVideoAssetAction` verifies the uploaded asset and stores `lessons.video_key`

### Progress tracking & completion — BUILT

1. As learner watches video, `VideoPlayerShell` triggers `recordLessonPlaybackAction` on playback progress milestones and on video completion (`ended = true`)
2. Server Action atomically upserts `lesson_progress` row (`user_id`, `course_id`, `lesson_id`, `last_position_seconds`, `completed`)
3. Completion automatically latches when playback reaches ≥ 90% of duration (sticky — remains completed even if rewatched), or when toggled manually via `toggleLessonCompletionAction`
4. Course outline syllabus and progress bar immediately update completion checkmarks and denominator percentages

### Subscription cancellation — BUILT

1. Learner cancels via Stripe Customer Portal
2. Stripe delivers `customer.subscription.updated` with `cancel_at_period_end = true` — entitlement remains active (no change)
3. At period end, Stripe delivers `customer.subscription.deleted` → handler revokes all-access `entitlements`
4. Any course with a separate purchase-sourced entitlement remains accessible — untouched by this webhook

---

## 8. Security

| Concern             | Approach                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Auth                | Better-Auth session cookies; eager cookie-presence `proxy.ts` redirect for authenticated areas (optimistic — full session validation runs per page/action) |
| Payment             | Stripe-hosted Checkout, webhook signature verification (`constructEvent`)     |
| Poison Webhooks     | Central dispatcher dead-letters malformed events to `processed_stripe_events` to prevent retry storms |
| Order Status Isolation | Strict user ownership verification matching session metadata against auth cookie (404 on mismatch) |
| Video access        | `hasAccess()` check on every signed-URL request — no cached client-side state |
| Signed URL lifetime | 60-second presigned Supabase Storage GET URLs                                 |
| Webhook idempotency | Unique constraint on `processed_stripe_events.event_id`                      |
| Callback URLs       | `getSafeCallbackUrl()` enforces relative path format, rejecting protocol-relative (`//`, `/\\`), CRLF injection, and pseudo-protocols (`javascript:`, `data:`) |

### Server Action Security Boundary

All mutating Server Actions are hardened using a defense-in-depth pipeline:

1. **Authentication Boundary (`safeAction`):** Enforces active user session via `getServerSession()` before invoking the action handler.
2. **Action-Boundary Validation:** Zod schemas parse and validate all incoming payloads (e.g. `httpsUrlSchema` enforcing native HTTPS protocol for thumbnails, `recordPlaybackSchema` rejecting `NaN`, `Infinity`, negative, or fractional playback positions before any DB branches).
3. **Explicit Domain Authorization:** Resource-specific ownership checks (e.g., `assertCreatorAuthorized(courseId)`) are kept explicit inside action handlers, never masked inside generic abstractions.
4. **Error Normalization & Sanitization:** Intentional domain errors throw `ActionError` to surface safe client messages. Unexpected database, ORM, third-party API, or runtime errors are logged server-side via `logActionError` (with safe identifiers only) and replaced with a generic message (`"An unexpected error occurred. Please try again."`), preventing table, column, SQL, or stack-trace leakage.

### CSRF Posture

Server Actions in Next.js 16 execute exclusively via `POST` requests dispatched with internal action identifiers and framework-level Origin/Host header validation. Programmatic Server Actions invoked via client functions rely on these framework-verified protections; callback URLs are sanitized server-side.

### Checkout Rate Limiting Policy (M3)

Request-level checkout rate limiting is intentionally **deferred** from this phase until there is a demonstrated operational requirement. Domain business invariants (such as Invariant #11 enforcing a single active subscription per user, Invariant #12 enforcing a single completed purchase per course, and P3-1 trial abuse checks) govern domain state and prevent duplicate enrollments, but are distinct from request-level rate limiting.

---

## 9. Testing

- **Framework**: Vitest, confirmed. Unit + feature tests run against an **in-memory PGlite** database (`@electric-sql/pglite`) — `tests/helpers/db.ts` instantiates PGlite, applies the real Drizzle migrations from `./drizzle`, and exposes a `cleanDb()` helper; no external Postgres needed.
- **Seams**: feature/query boundaries driving real queries against PGlite, and Route Handler boundaries on the request-to-database path (external HTTP services — Stripe, Supabase — are mocked via clean testing seams; Playwright (`tests/e2e`) covers browser flows).
- **Test coverage** (see `tests/`): Vitest feature and unit suites covering:
  - `entitlements/` — full truth table matrix (purchase-only, subscription-only, trialing, both simultaneously, canceled-with-both, past_due, refunded), duplicate grants, and safe revocation isolation
  - `features/purchases-checkout` & `features/subscriptions-checkout` — validation, price integrity, customer mapping, trial abuse prevention, customer portal sessions, cancel-url security
  - `features/stripe-webhooks` — transactional fulfillment, refund tombstones, immediate past_due revoke, cancellation isolation, whole-second epoch progression
  - `features/order-status-api` & `features/payment-reconciliation` — DB-first lookup, user isolation, single-shot reconciliation seams under concurrent/delayed webhook delivery
  - `features/video` & `app/api/video/signed-url` — 60-second signed URL issuance with `hasAccess()` gate, free preview unauthenticated bypass, 50MB direct creator Supabase Storage uploads
  - `features/progress` — atomic upsert progress tracking, sticky auto-completion at 90% playback, manual toggle idempotency, course completion ratios
  - `features/courses` & UI — public catalog search/filters, creator dashboard, curriculum studio, price parsing, course card precedence, and smoke tests
- **Priority order for upcoming phases**: Phase 5 (Learner Library `/library`, Access Badge standalone component, email receipts, failed-renewal dunning).

---

## 10. Deployment & Ops

- **Platform**: Vercel
- **Cron**: TBD — likely needed for subscription state reconciliation (catching missed webhooks) once volume justifies it
- **CI/CD**: TBD

---

## 11. Glossary

| Term                   | Definition                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entitlement            | A row in `entitlements` granting access; `course_id = null` means all-access, otherwise course-scoped                                                                     |
| All-access entitlement | Subscription-sourced entitlement with `course_id = null`, covers every published course including future ones                                                              |
| Signed playback URL    | Time-limited (60s), signed Supabase Storage URL for video GET, issued only after `hasAccess()` passes                                                                      |
| Webhook fulfillment    | The pattern where Stripe webhook events — not the success redirect or client state — are the authoritative write path for `purchases`, `subscriptions`, and `entitlements` |
| Trialing               | Stripe subscription status during the 7-day free trial; treated as access-granting, same as `active`                                                                       |
| Refund tombstone       | A row in `refund_tombstones` (keyed by `stripe_payment_intent_id`) to prevent duplicate webhook processing and guarantee idempotency                                       |
| Reconcile attempt      | A row in `reconcile_attempts` providing single-shot atomic mutual exclusion for on-demand checkout session recovery                                                         |

---

**Last updated:** 2026-09-19
