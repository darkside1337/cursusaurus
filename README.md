# Cursusaurus

A course platform where learners either buy individual courses or subscribe to an All-Access Pass, and creators build and publish courses. Portfolio project built with Next.js, Postgres (Drizzle), Better Auth, Stripe and Supabase Storage.

![Cursusaurus catalog](public/demo/screenshots/01-catalog-marketplace.png)

**What it does**

- **Two ways to pay:** a one-time purchase per course (lifetime access), or an All-Access Pass ($15/mo, 7-day free trial) that also covers courses published after subscribing.
- **One source of truth for access:** a single `entitlements` table decides who can watch what. Payment history is never consulted.
- **Webhook handling designed for retries:** each Stripe webhook writes payment state and entitlements in one Postgres transaction, and duplicate deliveries are ignored.
- **Gated video:** lessons play through short-lived (60-second) signed URLs from a private Supabase Storage bucket, issued only after an access check.
- **Tested:** Vitest feature tests on an in-memory Postgres (PGlite) and Playwright end-to-end tests. See [Testing](#testing).

**Try it:** no hosted demo is available. The quickest way to try it is to [run it locally](#run-it-locally) with seeded data.

---

## Run it locally

### Prerequisites

- Node.js 20 or newer (`@types/node` is v20+; Next.js 16 requires Node 20.9+)
- pnpm 12.3.4 (see the `packageManager` field in `package.json`; activate with `corepack enable && corepack prepare pnpm@12.3.4 --activate`)
- A Postgres database (the example connection string below uses Neon)
- A Stripe account in test mode, plus the Stripe CLI
- A Supabase project with a **private** Storage bucket named `course-videos`
- Google and/or GitHub OAuth credentials — both are optional. The app starts with neither configured (`config/env.ts` marks them optional and `lib/auth.ts` only registers a provider when its client ID + secret are set); each sign-in button only works once its provider is configured. Register these callback URLs with each enabled provider: `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/github` (Better Auth defaults — no custom base path is set in `lib/auth.ts`).

### 1. Clone and install

```
git clone https://github.com/darkside1337/cursusaurus.git
cd cursusaurus
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-32-byte-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth providers (all optional — configure what you want to offer)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe (test mode)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Optional: use a pre-created Stripe Price for the All-Access Pass.
# When unset, checkout builds the $15/mo + 7-day-trial price inline.
STRIPE_ALL_ACCESS_PRICE_ID="price_..."

# Supabase Storage (private course-videos bucket)
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

Environment variables are validated at startup in `config/env.ts`.

The $15/mo price and 7-day trial are hardcoded in `features/subscriptions/pricing.ts` (`ALL_ACCESS_PRICE_CENTS = 1500`, `ALL_ACCESS_TRIAL_DAYS = 7`). `features/subscriptions/checkout.ts` uses `STRIPE_ALL_ACCESS_PRICE_ID` when set, otherwise it creates the subscription price inline via `price_data` — so no manual Stripe dashboard product/price setup is needed. First-time subscribers get the trial; `hasUsedTrial` customers check out without one.

### 3. Migrate and seed the database

```
pnpm drizzle-kit migrate
pnpm seed
```

`pnpm seed` creates fixture users, courses, lessons and entitlements. `pnpm seed:clean` resets the data and seeds again.

### 4. Start the app

```
# Terminal 1
pnpm dev

# Terminal 2: forward Stripe webhooks (needed for checkout flows)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Log in to the Stripe CLI first. `stripe listen` prints a signing secret (`whsec_...`); use it as `STRIPE_WEBHOOK_SECRET`.

Open <http://localhost:3000> to browse the catalog.

### 5. Sign in as a seeded user

With the dev server running, `pnpm browse` opens a Chrome window already authenticated as a seed user. It defaults to Alice Learner (`seed-learner-01`) and accepts a role plus path: `pnpm browse creator` opens Bob Creator (`seed-creator-01`) in the studio.

Seeded users (`scripts/seed.ts`):

| Email | Role | Access fixture |
| --- | --- | --- |
| `learner@example.com` (Alice Learner) | Learner | Active All-Access sub **plus** a completed purchase of Intro to TypeScript; has in-progress lesson progress |
| `daniel.vance@example.com` | Learner | Subscription canceled but still in-period (`cancelAtPeriodEnd`, access still valid) |
| `chloe.bennett@example.com` | Learner | Expired subscription (entitlement revoked, no access) |
| `liam.patel@example.com` | Learner | Refunded TypeScript purchase (entitlement revoked, progress kept) |
| `sophia.ramos@example.com` | Learner | No purchases or subscriptions (unentitled baseline) |
| `creator@example.com` (Bob Creator) | Creator | Owns Intro to TypeScript and Documentary Cinematography |
| `elena.rostova@cursusaurus.dev` | Creator | Owns Editorial Typography, Engineering Monograph, Product Storytelling |
| `marcus.thorne@cursusaurus.dev` | Creator | Owns Next.js Architecture, B2B Pricing, and the unpublished Distributed Consensus draft |

If the email in `SEED_ADMIN_EMAIL` (defaults to `medini.ali.2000@gmail.com`) already exists in the database, seeding also grants it an active All-Access Pass.

---

## Screens

Screenshots show seeded fixture data.

### Catalog and course detail

Searchable catalog with category filters, and a course page that shows both pricing paths side by side: buy the course, or take the All-Access Pass.

| ![Catalog course grid](public/demo/screenshots/01b-catalog-grid.png)<br>**Catalog grid:** published courses with category badges, prices and All-Access markers. | ![Course detail with dual pricing](public/demo/screenshots/02-course-detail-pricing.png)<br>**Course detail:** one-time price next to the All-Access Pass card ($15/mo after a 7-day trial). |
| --- | --- |

### Classroom

Lesson player gated by `hasAccess()`. Progress is recorded automatically at 90% playback. Locked lessons point to the ways to unlock them instead of showing a disabled state.

| ![Classroom video player](public/demo/screenshots/03-classroom-player.png)<br>**Classroom:** player, progress bar and a curriculum list with completion checkmarks. | ![Locked lesson overlay](public/demo/screenshots/04-classroom-locked-preview.png)<br>**Locked lesson:** overlay showing "Included in All-Access". Free-preview lessons remain playable. |
| --- | --- |

### Library and billing

| ![Learner library](public/demo/screenshots/05-learner-library.png)<br>**Library:** the learner's courses with progress and All-Access / Purchased / Locked badges. | ![Billing page](public/demo/screenshots/08-billing-portal.png)<br>**Billing:** subscription status (active, trialing, past due), a link to the Stripe Customer Portal, and purchase records. |
| --- | --- |

### Creator studio

Creators sequence lessons, mark free previews, upload lesson video and manage publication state.

| ![Creator curriculum builder](public/demo/screenshots/06b-creator-curriculum.png)<br>**Curriculum studio:** lesson order, free-preview toggles and video upload status. | ![Creator dashboard](public/demo/screenshots/07-creator-dashboard.png)<br>**Dashboard:** the creator's courses with publication badges and lesson counts. |
| --- | --- |

### Sign-in and mobile

![Login screen](public/demo/screenshots/11-login-screen.png)

**Sign in:** Google and GitHub OAuth. Callback URLs are validated against open redirects.

![Mobile catalog](public/demo/screenshots/09-mobile-catalog.png) ![Mobile course detail](public/demo/screenshots/10-mobile-course-detail.png)

**Mobile:** single-column catalog and course detail, scrolling filter pills, stacked pricing cards.

---

## Architecture

Guiding rule: **routes compose features; features contain business logic.**

```
cursusaurus/
├── app/                    # Routing shell (layouts and page composition)
│   ├── (marketplace)/      # Public catalog + course detail
│   ├── (auth)/login/       # Google + GitHub OAuth sign-in
│   ├── dashboard/courses/  # Creator studio
│   ├── learn/[courseSlug]/[lessonSlug]/ # Classroom playback
│   ├── library/            # Learner workspace
│   ├── billing/            # Subscription status + Customer Portal link
│   ├── checkout/success/   # Order polling page
│   └── api/                # Route Handlers: auth, webhooks/stripe,
│                           # order-status/[sessionId], video/signed-url
├── features/               # Domain boundaries (queries, actions, validation)
│   ├── courses/            # CRUD, slugs, publish state, readiness
│   ├── purchases/          # One-time checkout, refund tombstones, queries
│   ├── subscriptions/      # Subscription checkout, pricing, portal, queries
│   ├── entitlements/       # hasAccess(), grant/revoke writers
│   ├── stripe/             # Dispatcher, fulfillment context, dead-letter handling
│   ├── video/              # Signed URLs, Supabase uploads, asset management
│   └── progress/           # Lesson progress upserts, completion logic
├── components/             # Presentation components
│   └── ui/                 # shadcn/ui primitives
├── lib/                    # Infrastructure (db/, stripe.ts, auth.ts, storage.ts)
├── config/env.ts           # Environment variable validation
└── proxy.ts                # Optimistic cookie-presence auth gate (not the security boundary)
```

Conventions:

1. `app/` composes feature calls; database queries, Stripe API calls and price logic belong in `features/` or `lib/`.
2. `features/` holds each domain's queries, Server Actions, Zod schemas and fulfillment writers.
3. `components/ui/` primitives receive data through props and are not meant to import from `features/` or `app/`.
4. Forms, checkout creation and portal sessions are Server Actions. Webhooks, polling and signed URLs are Route Handlers. `proxy.ts` is only an early gate; authoritative session checks run in layouts, actions and handlers.

### Invariants

**1. Entitlements are the only access authority.**
`hasAccess(userId, courseId)` reads only from `entitlements`, never from `purchases` or `subscriptions`. `course_id = null` means all-access (from a subscription); a concrete `course_id` means a single course (from a purchase). Code: `features/entitlements/`.

**2. Webhook fulfillment is transactional and idempotent.**
Each Stripe webhook writes payment state and entitlements in one Postgres transaction. A unique constraint on `processed_stripe_events.event_id` turns duplicate deliveries into no-ops. A central dispatcher dead-letters malformed events instead of failing on them repeatedly. Code: `features/stripe/`, `app/api/webhooks/stripe`.

**3. Subscription status maps directly to access.**
`trialing` and `active` grant the all-access entitlement. `past_due`, `canceled` and `unpaid` revoke it, with no grace period. Cancelling or lapsing revokes only subscription-sourced rows, so a standalone purchase of the same course is left alone. Out-of-order events are rejected by comparing whole-second epochs (`last_event_epoch`), and completed purchases are immutable. Code: `features/subscriptions/`.

**4. Refunds revoke access but keep progress.**
A refund writes a `refund_tombstone` (keyed by `stripe_payment_intent_id`) for idempotency and revokes the purchase-sourced entitlement. It does not delete `lesson_progress`, so a repurchase resumes where the learner left off. Code: `features/purchases/`.

**5. Missed webhooks have a fallback.**
`/checkout/success` polls `GET /api/order-status/[sessionId]`, which is owner-verified and returns 404 on mismatch. If the webhook is delayed or missed, a single reconciliation attempt, claimed atomically via `reconcile_attempts`, recovers the session; it is designed not to grant twice. Code: `app/checkout/success/`, `app/api/order-status/`.

**6. Video URLs are issued only after an access check.**
Signed playback URLs are created server-side after `hasAccess()` passes: 60-second GET URLs from a private Supabase Storage bucket. The 50 MB per-lesson cap is enforced in app code (`features/video/types.ts`, `features/video/upload.ts`, mirrored in `scripts/seed.ts`) — mirror it on the bucket policy if you set explicit bucket limits. Free-preview lessons bypass the entitlement check entirely and need no login (`features/video/signed-url.ts`). Code: `features/video/`, `app/api/video/signed-url`.

---

## Tech stack

| Layer | Technology | Used for |
| --- | --- | --- |
| Framework | Next.js (App Router) | Server Components, Server Actions, proxy auth gate |
| UI | React | Server/client composition |
| Database | Postgres (Neon in the example config) | All domain state |
| ORM | Drizzle ORM | Typed SQL, single schema source, generated migrations |
| Auth | Better Auth | Signed session cookies, Google + GitHub OAuth, test cookie minting |
| Payments | Stripe | Hosted Checkout (one-time and subscription with trial), Customer Portal, signature-verified webhooks |
| Storage | Supabase Storage | Private `course-videos` bucket, signed playback URLs |
| Styling | Tailwind CSS v4 | Design tokens and shadcn mapping |
| Components | shadcn/ui and Base UI | Accessible primitives restyled to the design system |
| Testing | Vitest (PGlite) and Playwright | In-memory DB feature tests, browser E2E against a real DB |

### Design

The visual system is an editorial one: serif display type (Signifier), sans body text (Sohne), hairline borders and minimal shadows. Color carries meaning: blush peach marks access (All-Access badges, locked-content overlay, featured pricing tier), while progress and completion use ink black so the two never overlap. Tokens and component specs are in `docs/DESIGN.md`.

---

## Testing

Feature tests run against an in-memory PGlite database using the real Drizzle migrations, so they need no external Postgres. E2E tests run against the running app with a real database.

```
# Unit and feature tests
pnpm test

# End-to-end browser tests
pnpm test:e2e

# Type-check, lint, UI audit (no raw button/input outside shadcn primitives)
pnpm exec tsc --noEmit
pnpm lint
pnpm audit:ui
```

E2E prerequisites on a fresh clone: a real `DATABASE_URL` with migrations applied plus seeded fixture data (`pnpm seed`, unless a suite seeds its own), system Chrome (Playwright runs with `channel: "chrome"`, override via `PLAYWRIGHT_CHROME_PATH`), and Stripe/Supabase env vars (the config defaults `STRIPE_WEBHOOK_SECRET` to a local test value outside CI). The Playwright `webServer` builds and starts the app itself (`pnpm build && pnpm start`, reusing an already-running server locally).

Coverage areas:

- **Entitlements:** purchase only, subscription only, trialing, both at once, canceled with both, past due, refunded; duplicate grants; revocation isolation.
- **Payments:** checkout validation, price integrity, trial-abuse prevention, refund tombstones, epoch-guarded subscription transitions, Customer Portal scoping, delayed / duplicate / out-of-order webhooks, reconciliation under concurrency.
- **Content:** signed-URL issuance gated by `hasAccess()`, 60-second expiry, preview bypass, unpublished-course restriction, upload size limit, auto-completion at 90% playback, idempotent manual completion toggle.
- **E2E flows:** auth and creator authorization, course create / edit / publish, catalog search, readiness checks, one-time purchase, trial, cancel and failed-renewal lifecycles, video upload and playback, progress and library consistency.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` / `pnpm start` | Production build / production server |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest suite (PGlite) |
| `pnpm test:e2e` | Playwright end-to-end tests (real DB) |
| `pnpm audit:ui` | Check for raw button/input usage outside shadcn primitives |
| `pnpm seed` / `pnpm seed:clean` | Seed fixture data (`seed:clean` resets first) |
| `pnpm browse` | Open an authenticated Chrome window as a seed user |
| `pnpm screenshots` | Regenerate `public/demo/screenshots/` from the running app (run `pnpm seed` first) |

---

## Scope and known limitations

- No hosted demo. The project is documented for local development only.
- Setup uses Stripe test-mode keys. Live-mode Stripe and production deployment are not documented here.
- Running every flow requires accounts with a Postgres provider, Stripe, Supabase and at least one OAuth provider.
- Sign-in is via Google or GitHub OAuth.
- Subscription failure has no grace period: `past_due`, `canceled` and `unpaid` revoke all-access.
- Missed-webhook recovery is a single reconciliation attempt per session.
- Lesson video uploads have a 50 MB per-lesson cap, enforced in app code.
- Screenshots use seeded fixture data.

---

## Documentation

| Document | Contents |
| --- | --- |
| `PRODUCT.md` | Product positioning, principles and audience |
| `docs/PRD.md` | Requirements, data model, invariants, resolved decisions |
| `docs/ARCHITECTURE.md` | Structure, system diagram, request lifecycles, security |
| `docs/DESIGN.md` | Visual tokens, typography, component specs, responsive rules |
| `docs/ROADMAP.md` | Phased task breakdown and progress |
| `public/demo/screenshots/README.md` | Screenshot catalog and regeneration guide |

---

© 2026 Cursusaurus. All rights reserved.
