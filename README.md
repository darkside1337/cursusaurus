# C U R S U S A U R U S

<p align="center">
  <strong>Dual-Model Course Platform — Buy Once or Subscribe to All-Access</strong><br>
  <em>Serif editorial on warm paper. One entitlement table answers "do I have access?" — never payment history.</em>
</p>

<p align="center">
  <a href="#4-architectural--security-invariants"><img src="https://img.shields.io/badge/Next.js-16.3%20(App%20Router)-black?style=flat-square&logo=next.js" alt="Next.js 16" /></a>
  <a href="#4-architectural--security-invariants"><img src="https://img.shields.io/badge/React-19.2-black?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="#5-tech-stack"><img src="https://img.shields.io/badge/Neon-Serverless%20Postgres-00E599?style=flat-square&logo=postgresql&logoColor=black" alt="Neon Postgres" /></a>
  <a href="#5-tech-stack"><img src="https://img.shields.io/badge/Drizzle-ORM%200.45-C5F74F?style=flat-square&logo=drizzle" alt="Drizzle ORM" /></a>
  <a href="#5-tech-stack"><img src="https://img.shields.io/badge/Better%20Auth-1.7-black?style=flat-square" alt="Better Auth" /></a>
  <a href="#5-tech-stack"><img src="https://img.shields.io/badge/Stripe-Checkout%20%26%20Webhooks-635BFF?style=flat-square&logo=stripe&logoColor=white" alt="Stripe" /></a>
  <a href="#5-tech-stack"><img src="https://img.shields.io/badge/Supabase-Signed%20Video%20URLs-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase Storage" /></a>
  <a href="#6-test-suite--quality-assurance"><img src="https://img.shields.io/badge/Playwright-29%20E2E%20Passing-45ba4b?style=flat-square&logo=playwright&logoColor=white" alt="Playwright E2E" /></a>
  <a href="#6-test-suite--quality-assurance"><img src="https://img.shields.io/badge/Vitest-221%20Tests%20Passing-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest Tests" /></a>
</p>

---

<p align="center">
  <img src="public/demo/screenshots/01-catalog-marketplace.png" alt="Cursusaurus Editorial Catalog Hero" width="100%" />
</p>

---

## 1. Overview & Editorial Philosophy

**Cursusaurus** is a course platform where learners either buy individual courses outright (one-time Stripe payment, lifetime access) or subscribe to an **All-Access Pass** (recurring, $15/mo with a 7-day free trial) that unlocks every course — including ones published after subscribing.

Rather than resembling a generic e-commerce checkout, the experience is conceived as an academic prospectus. Every surface echoes the editorial system in `docs/DESIGN.md`:

- **Strict Editorial Restraint**: Weightless surfaces, hairline borders (`1px #ececec`), barely-there shadows. No gradients, no marketing noise — course content leads.
- **Book Typography**: Display headlines in Signifier serif (weight 400 only, 44/64/90px); body and UI in Sohne sans (400–700). Whole-dollar prices omit decimals (`$49`, `$15/mo`) via `lib/format-price.ts`.
- **Access-State Color Discipline**: Blush Peach (`#fbe1d1` + Sienna `#5d2a1a` text) signals access *only* — All-Access badges, locked-content wash, the featured pricing tier. Progress and completion are Ink Black (`#17191c`), never peach, so the two meanings never collide.

---

## 2. Feature Flows & Media

### Flow 1 — Catalog Discovery & Dual-Pricing Course Detail
> Searchable editorial catalog, category filter pills, and the course prospectus with both pricing paths rendered side by side — "Buy outright" vs. "All-Access Pass" — with overlap states for owned/subscribed learners.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/01b-catalog-grid.png" alt="Catalog Course Grid" width="100%" />
      <p align="center"><sub><strong>Catalog Grid:</strong> Published masterclasses across Code, Design, and Business with category badges, prices, and All-Access pills.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/02-course-detail-pricing.png" alt="Course Detail Dual Pricing" width="100%" />
      <p align="center"><sub><strong>Course Prospectus:</strong> Introduction to TypeScript ($49 one-time) beside the peach All-Access Pass card ($15/mo after 7-day trial).</sub></p>
    </td>
  </tr>
</table>

---

### Flow 2 — Classroom Playback & Locked-Content Signaling
> Distraction-free lesson player gated by `hasAccess()`, 60-second signed Supabase URLs, sticky progress at 90% playback — and locked lessons that signal *available paths* in peach rather than dead-end disabled gray.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/03-classroom-player.png" alt="Video Classroom Player" width="100%" />
      <p align="center"><sub><strong>Classroom:</strong> Elevated 20px-radius player shell, ink-black progress bar (50% 2/4), curriculum syllabus with completion checkmarks.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/04-classroom-locked-preview.png" alt="Locked Content Overlay" width="100%" />
      <p align="center"><sub><strong>Locked Preview:</strong> Blush Peach overlay wash with "Included in All-Access" signaling — free previews still playable.</sub></p>
    </td>
  </tr>
</table>

---

### Flow 3 — Learner Library & Billing Portal
> Personal workspace with zero pricing chrome — progress bars and `<AccessBadge>` states derived from live entitlements — plus self-service subscription management through the Stripe Customer Portal with a perpetual-ownership ledger.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/05-learner-library.png" alt="Learner Library" width="100%" />
      <p align="center"><sub><strong>Library:</strong> Owned/subscribed courses with progress, All-Access / Purchased / Locked badges — historical purchases distinguished from revoked access.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/08-billing-portal.png" alt="Billing Portal" width="100%" />
      <p align="center"><sub><strong>Billing:</strong> Subscription lifecycle card (active / trialing / past-due), Customer Portal CTA, and perpetual purchase records.</sub></p>
    </td>
  </tr>
</table>

---

### Flow 4 — Creator Studio & Mobile-First Reading
> Curriculum studio for sequencing lessons, preview toggles, and video asset uploads; management hub with publication badges — all collapsing mobile-first (1 → 2 → 3 columns) with stacked pricing cards on handsets.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/06b-creator-curriculum.png" alt="Creator Curriculum Builder" width="100%" />
      <p align="center"><sub><strong>Curriculum Studio:</strong> Sequenced lessons, free-preview toggles, and Supabase video upload status per lesson.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="public/demo/screenshots/07-creator-dashboard.png" alt="Creator Dashboard" width="100%" />
      <p align="center"><sub><strong>Management Hub:</strong> Course ledger with publication badges, lesson metrics, and studio navigation.</sub></p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="public/demo/screenshots/11-login-screen.png" alt="Login Screen" width="100%" />
</p>
<p align="center"><sub><strong>Sign In:</strong> Editorial auth card with Google + GitHub OAuth on warm paper, open-redirect-safe callback URLs.</sub></p>

<p align="center">
  <img src="public/demo/screenshots/09-mobile-catalog.png" alt="Mobile Catalog" width="45%" />
  &nbsp;&nbsp;
  <img src="public/demo/screenshots/10-mobile-course-detail.png" alt="Mobile Course Detail" width="45%" />
</p>
<p align="center"><sub><strong>Mobile:</strong> Single-column catalog and course detail with horizontally scrolling filter pills and stacked (non-sticky) pricing cards.</sub></p>

---

## 3. The Golden Architectural Rule

> **Routes compose features; features contain business logic.**

```
cursusaurus/
├── app/                    # Routing shell (thin layouts & page composition only)
│   ├── (marketplace)/      # Public catalog + course detail ([slug], enrollment-panel)
│   ├── (auth)/login/       # Google + GitHub OAuth sign-in
│   ├── dashboard/courses/  # Creator studio (new, [id], actions.ts, curriculum-studio)
│   ├── learn/[courseSlug]/[lessonSlug]/ # Classroom playback (player-view)
│   ├── library/            # Learner workspace (no pricing chrome)
│   ├── billing/            # Subscription status + Customer Portal link
│   ├── checkout/success/   # Order polling page (order-status-view)
│   └── api/                # Route Handlers only: auth, webhooks/stripe,
│                           # order-status/[sessionId], video/signed-url
├── features/               # Isolated domain boundaries (queries, actions, validation)
│   ├── courses/            # CRUD, slugs, publish state, readiness
│   ├── purchases/          # One-time checkout, refund tombstones, queries
│   ├── subscriptions/      # Subscription checkout, pricing, portal, queries
│   ├── entitlements/       # hasAccess(), grant/revoke writers
│   ├── stripe/             # Dispatcher, fulfillment context, poison dead-letter
│   ├── video/              # Signed URLs, Supabase uploads, asset management
│   └── progress/           # Lesson progress upserts, completion logic
├── components/             # Presentation (course-card, classroom/, progress-bar,
│   └── ui/                 # shadcn/ui primitives — domain-agnostic, token-styled)
├── lib/                    # Infrastructure (db/, stripe.ts, auth.ts, storage.ts)
├── config/env.ts           # T3 env validation (server + client vars)
└── proxy.ts                # Optimistic cookie-presence auth gate (not the boundary)
```

1. **`app/` stays thin**: Renders layouts and composes feature calls. Zero direct database queries, Stripe API calls, or price math in route files.
2. **`features/` encapsulates domain models**: Queries, Server Actions, Zod schemas, and fulfillment writers live inside their bounded context.
3. **`components/ui/` is presentation-only**: Reusable primitives receive all data via props and never import from `features/` or `app/`.
4. **`app/api/` + Server Actions split**: Forms, checkout creation, and portal sessions are Server Actions; webhooks, polling, and signed URLs are Route Handlers. `proxy.ts` is an eager optimistic gate — authoritative session checks run downstream in layouts, actions, and handlers.

---

## 4. Architectural & Security Invariants

### 1. Entitlements Are the Sole Access Authority
`hasAccess(userId, courseId)` reads **only** from `entitlements` — never from `purchases` or `subscriptions`. `course_id = null` means all-access (subscription-sourced); a concrete `course_id` means course-scoped (purchase-sourced).

### 2. Transactional Webhook Fulfillment
Each Stripe webhook writes payment state **and** entitlements in a single Postgres transaction, guarded by a unique constraint on `processed_stripe_events.event_id` — duplicate deliveries become no-ops. Central dispatcher dead-letters malformed events to stop retry storms.

### 3. Subscription Lifecycle Without Ambiguity
`trialing` and `active` grant the all-access entitlement; `past_due`, `canceled`, and `unpaid` revoke it immediately (no grace period). Canceling or lapsing a subscription revokes **only** subscription-sourced rows — a standalone purchase for the same course is never touched. Out-of-order deliveries are rejected via whole-second epoch comparison (`last_event_epoch`); completed purchases are immutable.

### 4. Refunds Revoke Access, Preserve Learning
A refund writes a `refund_tombstone` (keyed by `stripe_payment_intent_id`) for idempotency, revokes the purchase-sourced entitlement, and **never** deletes `lesson_progress` — re-purchase resumes where the learner left off.

### 5. Reconciliation Seam for Missed Webhooks
`/checkout/success` polls `GET /api/order-status/[sessionId]` (strict owner-verified, 404 on mismatch). If the webhook is delayed or missed, a single-shot reconciliation claimed atomically via `reconcile_attempts` recovers the session without double-granting.

### 6. Gated Video Delivery
Signed playback URLs are minted server-side **only after** `hasAccess()` passes — 60-second Supabase Storage GETs from a private bucket, 50 MB per-lesson cap enforced client-side, server-side, and at the bucket. Free-preview lessons bypass auth independently of paid access.

---

## 5. Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | React Server Components, Server Actions, proxy auth gate |
| **Frontend Runtime** | React 19 | Server/client composition, native transitions, action state hooks |
| **Database** | Neon Postgres | Managed serverless Postgres for all domain state |
| **ORM** | Drizzle ORM | Type-safe SQL, single-schema source of truth, generated migrations |
| **Authentication** | Better Auth | Signed session cookies, Google + GitHub OAuth, test cookie minting |
| **Payments** | Stripe | Hosted Checkout (one-time + subscription w/ 7-day trial), Customer Portal, signature-verified webhooks |
| **Storage** | Supabase Storage | Private `course-videos` bucket, short-lived signed playback URLs |
| **Styling** | Tailwind CSS v4 | `@theme inline` editorial tokens + required `:root` shadcn mapping |
| **Component Primitives** | shadcn/ui & Base UI | Accessible primitives restyled to Signifier/Sohne, peach/ink tokens |
| **Testing** | Vitest (PGlite) & Playwright | In-memory DB feature tests + real-DB browser E2E |

---

## 6. Test Suite & Quality Assurance

Isolated tests run against an in-memory PGlite database (real Drizzle migrations, `cleanDb()` helper) — no external Postgres needed. E2E runs against the live app with a real database.

```bash
# Unit + feature tests (221 passing across 32 files)
pnpm test

# End-to-end browser flows (29 passing across 9 suites)
pnpm test:e2e

# Type-check, lint, UI audit (zero raw button/input leaks)
pnpm exec tsc --noEmit
pnpm lint
pnpm audit:ui
```

- **Entitlement matrix**: purchase-only, subscription-only, `trialing`, both simultaneously, canceled-with-both, `past_due`, refunded — plus duplicate-grant and safe-revocation isolation.
- **Payments**: checkout validation, price integrity, trial-abuse prevention, refund tombstones, epoch-guarded subscription transitions, Customer Portal scoping, delayed/duplicate/out-of-order webhook delivery, single-shot reconciliation under concurrency.
- **Content**: signed-URL issuance gated by `hasAccess()`, 60s expiry, preview bypass, unpublished-course restriction, 50 MB upload enforcement, sticky 90%-playback auto-completion, manual toggle idempotency.
- **E2E critical paths**: auth + creator authorization, course create/edit/publish, catalog search, readiness eligibility, one-time + trial + cancel + failed-renewal lifecycles, video upload/playback, progress + library consistency.

---

## 7. Getting Started

### Prerequisites
- Node.js 20+
- pnpm 12.3.4 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Neon Postgres account (or local PostgreSQL)
- Stripe developer account & Stripe CLI
- Supabase project (Storage)

### 1. Clone & Install
```bash
git clone https://github.com/darkside1337/cursusaurus.git
cd cursusaurus
pnpm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Database (Neon Serverless Postgres)
DATABASE_URL="postgresql://neondb_owner:password@ep-xxx-pooler.region.neon.tech/neondb?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-32-byte-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth Providers
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe Payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Supabase Storage (private course-videos bucket)
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### 3. Database Migration & Seed
```bash
# Push schema migrations
pnpm drizzle-kit migrate

# Seed fixture users, courses, lessons, and entitlements
pnpm seed
```

### 4. Run Development Server
```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Stripe webhook event forwarding (for checkout testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Open [http://localhost:3000](http://localhost:3000) to browse the catalog.

To regenerate the screenshots in §2 after a redesign:
```bash
pnpm seed && pnpm screenshots
```

---

## 8. Available Scripts

| Script | Purpose |
| :--- | :--- |
| `pnpm dev` | Starts the Next.js 16 development server with hot-reloading |
| `pnpm build` | Compiles the production application bundle |
| `pnpm start` | Boots the optimized production server |
| `pnpm lint` | Runs ESLint rules across all routes and features |
| `pnpm test` | Executes the Vitest suite (221 tests, PGlite in-memory DB) |
| `pnpm test:e2e` | Runs Playwright end-to-end flows (29 tests, real DB) |
| `pnpm audit:ui` | Verifies no raw button/input leaks outside shadcn primitives |
| `pnpm seed` / `pnpm seed:clean` | Populates (or resets + populates) fixture users, courses, entitlements |
| `pnpm browse` | Opens an authenticated Chrome window as a seed user for visual checks |
| `pnpm screenshots` | Regenerates the `public/demo/screenshots/` suite from the running app |

---

## Documentation

| Document | Purpose |
| --- | --- |
| `PRODUCT.md` | Product positioning, principles, and audience |
| `docs/PRD.md` | Requirements, data model, invariants, resolved decisions |
| `docs/ARCHITECTURE.md` | Project structure, system diagram, request lifecycles, security |
| `docs/DESIGN.md` | Visual tokens, typography scale, component specs, responsive rules |
| `docs/ROADMAP.md` | Phased task breakdown and current progress |
| `public/demo/screenshots/README.md` | Screenshot catalog and regeneration guide |

---

<p align="center">
  <sub>Designed & Built as an Editorial Prospectus. © 2026 Cursusaurus. All rights reserved.</sub>
</p>
