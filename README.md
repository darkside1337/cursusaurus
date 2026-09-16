# Cursusaurus

A course platform where learners either buy individual courses outright (one-time Stripe payment) or subscribe to an All-Access Pass (recurring) that unlocks every course, including future ones. A single authoritative `entitlements` table backs both payment modes, so "do I have access to this course?" always has one clear, correct answer.

## Highlights

- **Dual payment models** — one-time course purchase (lifetime access) and All-Access subscription (7-day free trial), rendered side by side and fully functional.
- **Entitlement-first access control** — `purchases` and `subscriptions` are payment history only; access decisions read exclusively from `entitlements`.
- **Creator dashboard** — build, edit, reorder, and publish courses with lessons before any video upload.
- **Editorial design** — serif editorial on warm paper, Signifier + Sohne typography, weightless surfaces with a single peach access-state accent.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Data:** Drizzle ORM on Neon Postgres; isolated tests run on in-memory PGlite
- **Auth:** Better-Auth (session cookies, Google + GitHub OAuth)
- **Payments:** Stripe Checkout (one-time + subscription), webhook-driven entitlement writes
- **Media:** Supabase Storage private bucket with 60-second signed playback URLs
- **Styling:** Tailwind CSS v4, shadcn/ui, custom design tokens

## Development

```bash
pnpm install        # install dependencies
pnpm seed           # seed fixture users, courses, and entitlements
pnpm dev            # start the dev server
```

Testing and validation:

```bash
pnpm test                       # Vitest (unit/feature tests, PGlite in-memory DB)
pnpm exec tsc --noEmit          # type check
pnpm lint                       # lint
pnpm test:e2e                   # Playwright end-to-end tests
```

## Documentation

| Document | Purpose |
| --- | --- |
| `PRODUCT.md` | Product positioning, principles, and audience |
| `docs/PRD.md` | Product requirements, data model, invariants, resolved decisions |
| `docs/ARCHITECTURE.md` | Project structure, system diagram, request lifecycles, security |
| `docs/DESIGN.md` | Visual tokens, typography scale, component specs, responsive rules |
| `docs/ROADMAP.md` | Phased task breakdown and current progress |
| `AGENTS.md` | Agent workflow rules (roadmap, UI/styling, planning) |
