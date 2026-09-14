# Cursusaurus — Architecture Overview

This document provides agents with a rapid, authoritative understanding of the Cursusaurus codebase. Update it as the system evolves.

---

## 1. Project Structure

```
Cursusaurus/
├── app/                            # Next.js App Router root
│   ├── (marketplace)/              # Public route group — browse & course pages
│   │   ├── page.tsx                 # Course catalog
│   │   └── [slug]/page.tsx          # Course detail (preview if no access)
│   ├── (auth)/                     # Auth route group — login, register
│   ├── dashboard/                  # Creator/admin dashboard (auth-gated)
│   │   └── courses/
│   │       ├── page.tsx             # Course list
│   │       ├── new/page.tsx         # Create course
│   │       └── [id]/page.tsx        # Edit course / publish
│   ├── library/                    # Learner's purchased/subscribed courses (auth-gated)
│   │   └── page.tsx
│   ├── learn/
│   │   └── [courseSlug]/[lessonSlug]/page.tsx   # Video playback, access-gated
│   ├── billing/
│   │   └── page.tsx                 # Subscription status, Stripe Customer Portal link
│   ├── checkout/
│   │   └── success/page.tsx         # Order polling page ("Finalizing...")
│   └── api/                        # Route Handlers only — all external API surface
│       ├── webhooks/stripe/route.ts
│       ├── order-status/[sessionId]/route.ts
│       ├── video/signed-url/route.ts
│       └── progress/route.ts
├── features/                       # Domain logic — one folder per bounded context
│   ├── courses/                    # Course CRUD, slug generation, publish state
│   ├── purchases/                  # One-time Checkout session creation
│   ├── subscriptions/              # Subscription Checkout, Customer Portal session
│   ├── entitlements/               # hasAccess(), entitlement grant/revoke writers
│   ├── video/                      # Signed playback URL generation (Supabase Storage)
│   └── progress/                   # Lesson progress queries/mutations
├── components/                     # Presentation-only, domain-unaware primitives
│   └── ui/                         # shadcn/ui primitives (installed, not hand-edited)
├── lib/                            # Infrastructure clients
│   ├── db.ts                       # Drizzle + Neon client
│   ├── storage.ts                  # Supabase Storage client (video only)
│   ├── stripe.ts                   # Stripe SDK instance
│   └── auth.ts                     # Better-Auth instance
├── db/
│   ├── schema.ts                   # Drizzle schema (single source of truth)
│   └── migrations/                 # Drizzle Kit generated SQL migrations
├── tests/                          # Route Handler + unit tests (Vitest — see §9)
│   ├── helpers/                    # Shared fixtures, DB seeding, auth helpers
│   ├── webhooks/stripe.test.ts
│   ├── entitlements/hasAccess.test.ts
│   ├── video/signed-url.test.ts
│   └── order-status/[sessionId].test.ts
└── docs/
    ├── PRD.md                      # Product spec, schema, invariants, testing decisions
    └── ARCHITECTURE.md             # This document
```

**Boundaries:**

- `app/` stays thin — renders layouts, composes feature calls. No business logic.
- `features/` encapsulates all domain queries, actions, and validation. No routing awareness.
- `components/` receives all data via props. Never imports from `features/`.
- `components/ui/` holds shadcn/ui primitives as installed — compose around them in feature-specific components, don't edit generated files unless fixing a genuine primitive bug.
- `app/api/` Route Handlers verify auth, call into `features/`, return HTTP responses. No inline business logic.
- Server Actions are used only for authenticated user-initiated form mutations (course create/edit, progress updates). All external API surface (webhooks, polling, signed URLs) is Route Handlers.

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

- **Route Handlers** (`app/api/`): Stripe webhook, video signed-URL issuance, order status polling, progress sync.
- **Server Actions**: Course create/edit, lesson progress updates.
- **Components** (`components/`): Built on shadcn/ui primitives for accessibility, restyled per `docs/DESIGN.md` tokens.
- **Deployment**: Vercel

### Neon Postgres (via Drizzle ORM)

Single source of truth for all domain state. Schema in `db/schema.ts`. Migrations via Drizzle Kit.

Tables: `courses`, `purchases`, `subscriptions`, `entitlements`, `lesson_progress` — plus Better-Auth managed tables.

### Supabase Storage

Object storage for video files only — not used for DB or auth in this project. Accessed via the Supabase JS client. Files are served exclusively through short-lived signed URLs issued after a server-side `hasAccess()` check; the storage bucket itself is private.

---

## 4. Data Stores

### Neon Postgres

- All domain state: courses, purchases, subscriptions, entitlements, lesson progress
- Better-Auth session/account tables
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
7. **Webhook handlers are idempotent** — unique constraint on `stripe_event_id` makes duplicate deliveries no-ops.
8. **`purchases`/`subscriptions` + `entitlements` are written in a single Postgres transaction** in the relevant webhook handler.
9. **Video signed URLs are only issued server-side, after `hasAccess()` returns true.** No client ever receives a storage path or long-lived URL.

---

## 7. Request Lifecycles

### One-time purchase

1. Learner clicks "Buy course" → Server Action creates Stripe Checkout Session (one-time mode) → redirect to Stripe
2. Learner completes payment → Stripe redirects to `/checkout/success?session_id=...`
3. Success page polls `GET /api/order-status/[sessionId]` every 1–2s
4. Stripe delivers `checkout.session.completed` webhook → handler writes `purchases` + course-scoped `entitlements` row in one transaction
5. Next poll returns `completed` → success page shows confirmation, links to `/learn/...`

### Subscription signup (with trial)

1. Learner clicks "Start All-Access" → Server Action creates Stripe Checkout Session (subscription mode, 7-day trial) → redirect to Stripe
2. Stripe delivers `customer.subscription.created` (status `trialing`) → handler writes `subscriptions` row + all-access `entitlements` row (`course_id = null`)
3. On trial end, Stripe attempts first charge: `customer.subscription.updated` (status → `active`) keeps entitlement live; failed charge → status `past_due` → handler revokes the all-access entitlement immediately

### Video playback

1. `GET /api/video/signed-url?courseId=...&lessonId=...`
2. Verify session (Better-Auth) → run `hasAccess(userId, courseId)` against `entitlements`
3. If true: mint a 60-second signed Supabase Storage URL, return it
4. If false: 403

### Subscription cancellation

1. Learner cancels via Stripe Customer Portal
2. Stripe delivers `customer.subscription.deleted` (or `updated` with `cancel_at_period_end`) → handler revokes all-access `entitlements` at the appropriate point
3. Any course with a separate purchase-sourced entitlement remains accessible — untouched by this webhook

---

## 8. Security

| Concern             | Approach                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Auth                | Better-Auth session cookies                                                   |
| Payment             | Stripe-hosted Checkout, webhook signature verification                        |
| Video access        | `hasAccess()` check on every signed-URL request — no cached client-side state |
| Signed URL lifetime | 60-second presigned Supabase Storage GET URLs                                 |
| Webhook idempotency | Unique constraint on `stripe_event_id`                                        |

---

## 9. Testing

- **Framework**: Vitest (tentative — confirm before Milestone 0 scaffolding)
- **Seams**: Route Handler boundaries — full request-to-database path, no internal mocking
- **Priority order**: `hasAccess()` unit tests (full truth table: purchase-only, subscription-only, trialing, both simultaneously, canceled-with-both, past_due, refunded) → Stripe webhook handler → video signed-url handler → order-status handler
- See `docs/PRD.md` for the full entitlement test matrix required before any Stripe integration work begins

---

## 10. Deployment & Ops

- **Platform**: Vercel
- **Cron**: TBD — likely needed for subscription state reconciliation (catching missed webhooks) once volume justifies it
- **CI/CD**: TBD

---

## 11. Glossary

| Term                   | Definition                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entitlement            | A row in `entitlements` granting access; `course_id = null` means all-access, otherwise course-scoped                                                                      |
| All-access entitlement | Subscription-sourced entitlement with `course_id = null`, covers every published course including future ones                                                              |
| Signed playback URL    | Time-limited (60s), signed Supabase Storage URL for video GET, issued only after `hasAccess()` passes                                                                      |
| Webhook fulfillment    | The pattern where Stripe webhook events — not the success redirect or client state — are the authoritative write path for `purchases`, `subscriptions`, and `entitlements` |
| Trialing               | Stripe subscription status during the 7-day free trial; treated as access-granting, same as `active`                                                                       |

---

**Last updated:** 2026-09-14
