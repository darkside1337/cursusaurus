# Cursusaurus — Roadmap

Ordered by backend risk and complete user flows. The entitlement core comes first; course creation and discovery precede payments; and the course detail page is built once, with both pricing options fully functional.

See `docs/PRD.md` for product requirements and pricing decisions, `docs/ARCHITECTURE.md` for system design and invariants, `docs/DESIGN.md` for UI specifications, and `AGENTS.md` for workflow rules.

---

## Phase 0 — Foundation

**Goal:** Establish the application, infrastructure, design system, and development workflow.

- [x] PRD written (`docs/PRD.md`) — flows, non-goals, pricing/refund/trial decisions resolved
- [x] Architecture doc written (`docs/ARCHITECTURE.md`) — entitlement model, invariants, request lifecycles
- [x] Design system written (`docs/DESIGN.md`) — tokens, components, imagery/layout guidance
- [x] `AGENTS.md` written — UI/styling workflow, package manager, documentation links
- [x] Design tokens ported into `globals.css` — `@theme inline` token block plus the required `:root` shadcn semantic mapping (see `docs/DESIGN.md` Quick Start)
- [x] Repository scaffolded: Next.js App Router, Drizzle + Neon, Better-Auth, Supabase Storage client, Stripe SDK
- [x] Linting, type-checking, and test runner (Vitest) configured
- [x] `db/schema.ts` defined with all tables from `ARCHITECTURE.md` §1; no migrations yet
- [x] Google Stitch project created for Cursusaurus; Project ID added to `AGENTS.md`
- [x] Initial shadcn primitives installed: `button`, `card`, `badge`, `input`, `progress`
- [x] Primitives restyled per `DESIGN.md` (pill radius, ink-black/peach, `font-sohne`)
- [x] `/login` sign-in page — Google + GitHub OAuth buttons only, built per Stitch reference
- [x] Server-side authentication and authorization helpers established
- [x] Environment validation implemented for required services and secrets
- [x] Documentation reconciled with the live codebase (2026-09-16) — README, PRD milestones, ARCHITECTURE requirements/structure, DESIGN token/font reality, ROADMAP status notes; verified with `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`

**Gate:** Application runs locally, authentication works, and linting, type-checking, and tests are operational.

---

## Phase 1 — Entitlement Core (Milestone 0)

**Goal:** Implement and verify access control before introducing Stripe or feature UI.

- [x] `entitlements` table + Drizzle migration (`user_id`, nullable `course_id`, `source`, `granted_at`, `revoked_at`)
- [x] `courses`, `purchases`, and `subscriptions` tables + migrations (schema only, no writers yet)
- [x] `hasAccess(userId, courseId)` implemented — reads only from `entitlements`, per invariant #1
- [x] Define entitlement uniqueness and source identity to prevent duplicate grants
- [x] Define how individual purchase grants and all-access subscription grants coexist
- [x] Seed script: fixture users, courses, and entitlements for local development
- [x] Full `hasAccess()` test matrix (Vitest):
  - Purchase-only access
  - Subscription-only access (`active`)
  - Subscription access (`trialing`)
  - Purchase and subscription simultaneously
  - Canceled subscription with a separate purchase entitlement
  - `past_due`
  - Refunded purchase
- [x] Test duplicate grants and overlapping entitlement sources
- [x] Define and test safe entitlement revocation without deleting unrelated grants

**Gate:** All entitlement tests pass before any Stripe integration begins.

---

## Phase 2 — Course Creation & Catalog (Milestone 1)

**Goal:** Make real courses buildable, publishable, and discoverable before introducing checkout.

### Creator dashboard

- [x] `/dashboard/courses` — full creator course list, card grid using learner-style Course Cards, built per Stitch reference
- [x] `/dashboard/courses/new` — create-course form, built per Stitch reference
- [x] `/dashboard/courses/[id]` — complete edit-course page with lesson management, built per Stitch reference
- [x] Course create/edit Server Actions with validation and authorization
- [x] Course metadata management: title, description, slug, thumbnail, and other fields defined in the PRD
- [x] Lesson management: create, edit, delete, and reorder lessons, including titles, descriptions, and lesson metadata
- [x] Price constrained to the admin-set range ($19–$199 per PRD §8)
- [x] Publish/unpublish functionality with appropriate validation
- [x] Courses can be published before video uploads exist
- [x] Draft courses remain accessible to authorized creators but are excluded from public discovery
- [x] Course changes and publication state persist to the database
- [x] Published course and lesson edits take effect immediately, including for existing purchasers
- [x] Stable course and lesson IDs preserve references and progress when slugs or display metadata change
- [x] Define behavior for deleting lessons that have existing learner progress
- [x] Shadcn Sonner feedback layer — `@shadcn/sonner` + root `<Toaster />` replace inline success/error banners across curriculum studio, create-course, and login

### Public catalog

- [x] Catalog page — full browse experience, built per Stitch reference
- [x] Course Card component wired to real catalog queries
- [x] Search and filters implemented against published courses
- [x] Responsive Course Card grid
- [x] Clicking a Course Card navigates to the corresponding course detail route
- [x] Empty, loading, and error states implemented
- [x] Unpublished courses excluded from public catalog queries and public course access
- [x] Published courses without uploaded videos remain discoverable

### Course readiness decision

- [x] Define whether published courses without uploaded videos can be purchased
- [x] Define the minimum content-readiness requirements for purchase eligibility
- [x] Ensure catalog and course detail data expose publication and readiness state separately

**Video uploads remain out of scope for this phase.** Lessons can be created and managed as metadata records. Actual video upload and playback are introduced in Phase 4.

**Gate:** A creator can create and publish a course with lessons, and a learner can discover it through the real catalog and navigate to its detail route. Course publication and purchase eligibility are distinct, explicitly defined states.

---

## Phase 3 — Payments (One-Time + All-Access) (Milestone 2)

**Goal:** Deliver the complete course purchasing experience in one phase, with both pricing options fully functional.

This phase combines one-time purchases and subscriptions. The course detail page is implemented exactly once, with both pricing cards rendered together and connected to real Stripe Checkout sessions.

### Course detail page

- [ ] Course detail page (`/[slug]`) — complete implementation per Stitch reference
- [ ] Course information, ordered lesson list, preview/gated-content states, and course readiness state
- [ ] Both pricing cards rendered together in the same pricing panel:
  - "Buy this course" — one-time purchase
  - "All-Access" — subscription with a 7-day trial
- [ ] Pricing cards use the correct price and featured-tier treatment per `DESIGN.md`
- [ ] Both CTAs connected to real Stripe Checkout session creation
- [ ] Pricing and access state derived from authoritative server-side data
- [ ] Purchase CTA respects the course purchase-eligibility rules defined in Phase 2
- [ ] No placeholder, non-functional, or duplicate pricing-card implementation

### One-time purchase flow

- [ ] Stripe Checkout session creation (one-time mode) — Server Action
- [ ] Validate authenticated user, published course, purchase eligibility, and server-side price
- [ ] Stable mapping between Stripe customer identity and authenticated user
- [ ] `checkout.session.completed` webhook handler → writes `purchases` and course-scoped `entitlements` in one transaction
- [ ] Refund webhook handler → revokes purchase-sourced entitlements only; leaves `lesson_progress` untouched
- [ ] Webhook idempotency: unique constraint on `stripe_event_id`
- [ ] `/checkout/success` polling page (`GET /api/order-status/[sessionId]`) — built per Stitch reference
- [ ] Define order-status states and distinguish payment completion from entitlement availability

### Subscription flow

- [ ] Stripe Checkout session creation (subscription mode, 7-day trial) — Server Action
- [ ] `customer.subscription.created` webhook (status `trialing`) → writes `subscriptions` and all-access entitlement (`course_id = null`)
- [ ] `customer.subscription.updated` webhook → `trialing`/`active` keep entitlement live; `past_due` revokes immediately, with no grace period per PRD §8
- [ ] `customer.subscription.deleted` webhook → revokes all-access entitlement; purchase-sourced entitlements remain untouched
- [ ] Define handling for duplicate subscriptions and overlapping subscription events
- [ ] Stripe Customer Portal session for self-service cancellation/upgrade
- [ ] `/billing` page — built per Stitch reference
- [ ] Customer Portal access restricted to the authenticated user's Stripe customer

### Recovery and reconciliation

- [ ] Handle abandoned, expired, and canceled Checkout sessions without granting access
- [ ] Handle payment success followed by delayed webhook processing
- [ ] Handle webhook transaction failures and retries safely
- [ ] Define handling for out-of-order subscription events
- [ ] Implement a reconciliation mechanism for missed or unprocessed Stripe events
- [ ] Ensure repeated Checkout attempts cannot create duplicate purchase records or entitlement grants

### Verification

- [ ] Test catalog → course detail → one-time Checkout → success → entitlement → access
- [ ] Test catalog → course detail → All-Access Checkout → trial entitlement → access
- [ ] Test refund → purchase entitlement revoked, progress intact
- [ ] Test subscription lifecycle: trial → active → `past_due` → canceled
- [ ] Test overlap: subscribe + purchase one course outright + cancel subscription → that course remains accessible, other courses do not
- [ ] Test webhook idempotency and transaction behavior for both payment types
- [ ] Test unauthorized Checkout session creation and invalid client-supplied prices
- [ ] Test checkout success polling, including pending and failed states
- [ ] Test delayed, duplicate, and out-of-order webhook delivery
- [ ] Test reconciliation and recovery after a simulated processing failure

**Gate:** Both pricing options work end-to-end through the public catalog and course detail page. Payment and entitlement state remain consistent under retries, failures, and overlapping access sources.

**Risk note:** This phase is larger and riskier than the original split. One-time purchase and subscription webhook logic are introduced together. Mitigate this with isolated handlers, shared entitlement invariants, explicit transaction boundaries, and separate test matrices for each payment type.

**Status note (2026-09-16):** Infrastructure already landed from earlier phases — the `processed_stripe_events` table with a unique `event_id` constraint (migration 0000) exists, and `features/subscriptions/handlers.ts` (created/updated/deleted with transactional idempotency) plus `features/purchases/checkout.ts` are **implemented but unwired**: no `/api/webhooks/stripe` route, Checkout Server Action, or pricing CTA calls them yet. The course detail page (`app/(marketplace)/[slug]/page.tsx`) is a near-complete scaffold with gated lesson rows and both pricing cards, but its CTAs target `/checkout` and `/pricing` routes that are **not yet built**. Checkboxes below stay unchecked until the routes, Server Actions, and tests exist.

---

## Phase 4 — Video Delivery & Progress (Milestone 3)

**Goal:** Deliver protected video playback and persistent learning progress.

### Video delivery

- [ ] `lesson_progress` table + migration
- [ ] Video upload flow into Supabase Storage (private bucket), integrated into creator lesson management
- [ ] Upload validation, authorization, and storage metadata persistence
- [ ] Define the relationship between lesson IDs and uploaded video assets
- [ ] `getSignedPlaybackUrl(userId, courseId, lessonId)` — verifies access to the specific lesson through `hasAccess()`, returns 403 if false, otherwise mints a 60-second signed URL
- [ ] `GET /api/video/signed-url` route handler
- [ ] `/learn/[courseSlug]/[lessonSlug]` page — Video Player Shell component, gated by the signed-URL endpoint, built per Stitch reference
- [ ] Preview lesson access rules implemented independently from paid lesson access
- [ ] Handle published lessons whose videos have not yet been uploaded

### Progress tracking

- [ ] Define lesson completion and playback milestone semantics
- [ ] Server Action to update `lesson_progress` on playback milestones
- [ ] Progress updates are validated and idempotent
- [ ] Progress Bar component wired to real progress data (ink-black fill, never peach, per `DESIGN.md`)
- [ ] Progress data persisted and loaded for the authenticated learner
- [ ] Define how course-level progress is calculated from lesson-level progress

### Verification

- [ ] Test signed URL issuance only after `hasAccess()` passes
- [ ] Test signed URL expiry after 60 seconds
- [ ] Test unauthorized users cannot upload or access lesson videos
- [ ] Test preview access and unpublished-course restrictions
- [ ] Test progress updates, persistence, and retrieval
- [ ] Test that a refund or subscription cancellation revokes access without deleting learning progress
- [ ] Test that published-course edits preserve progress for unchanged lesson IDs

**Status note (2026-09-16):** The `lesson_progress` table and its migrations already exist (migration 0000 + 0002 adds `lesson_id`), and `features/video/signed-url.ts` implements `getSignedPlaybackUrl({ userId, courseId, lessonSlug })` (storage path `<courseId>/<lessonSlug>.mp4`, 60s default) with the `hasAccess()` guard — but nothing calls it yet. The `/learn/[courseSlug]/[lessonSlug]` player, `GET /api/video/signed-url` route, upload flow, and progress Server Action wiring are not started; checkboxes below stay unchecked until those land.

**Gate:** Authorized learners can play protected course videos and resume their progress. Unauthorized learners cannot obtain signed playback URLs.

---

## Phase 5 — Polish & Billing Ops (Milestone 4)

**Goal:** Complete the supporting learner experience and operational billing behavior.

- [ ] Access Badge component — All-Access / Purchased / Locked states wired to real entitlement data
- [ ] `/library` page — owned/subscribed courses with progress, no pricing chrome, built per Stitch reference
- [ ] Library queries distinguish active access from historical purchases and revoked access
- [ ] Email receipts (Stripe-driven)
- [ ] Dunning handling for failed renewal charges, beyond the immediate `past_due` revoke
- [ ] Full `components/ui/` restyle audit — confirm no default shadcn styles remain unaddressed

### Verification

- [ ] Test library contents for purchase-only, subscription-only, overlapping, and revoked access
- [ ] Test access badges against authoritative entitlement data
- [ ] Test email receipt delivery and failure handling
- [ ] Test failed-renewal handling and recovery behavior
- [ ] Test library behavior after refunds, cancellations, and course edits

**Gate:** The learner library, access indicators, and billing-support flows reflect the same authoritative entitlement state.

---

## Phase 6 — QA & Deploy (Milestone 5)

**Goal:** Verify the complete product and prepare it for production.

### QA

- [ ] Manual QA pass across all flows:
  - Authentication and creator authorization
  - Course creation, editing, lesson management, and publishing
  - Catalog search, filters, and course navigation
  - Course readiness and purchase eligibility
  - One-time purchase and refund
  - Subscription trial, activation, cancellation, and failed renewal
  - Video upload and playback
  - Learning progress and library
- [ ] Webhook retry/duplicate-delivery test — confirm idempotency holds under load
- [ ] Authorization and input-validation audit across Server Actions and route handlers
- [ ] Production build, linting, type-checking, and automated tests pass
- [ ] Final review of `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/DESIGN.md` for drift against what was actually built

### Deployment

- [ ] Vercel deployment configured
- [ ] Environment variables configured for Stripe, Neon, Supabase, and Better-Auth
- [ ] Production database migrations applied and verified
- [ ] Stripe production webhook endpoint configured and verified
- [ ] Configure CI/CD
- [ ] Configure production reconciliation cron for missed webhooks
- [ ] Document operational recovery procedures for failed webhook processing
- [ ] Production smoke test covering catalog → course detail → Checkout → entitlement → protected access

**Gate:** The complete user journey works in production, payment and access state remain consistent, and the deployment has documented operational procedures.