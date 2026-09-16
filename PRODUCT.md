# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Learners**: Individuals seeking focused knowledge through standalone courses or broad mastery through an All-Access subscription. They browse catalogs, purchase courses or subscribe, watch video lessons, and track progress.
- **Creators / Internal Admins**: Internal team members who author, upload, price ($19–$199 range), and publish or unpublish course content.

## Product Purpose

Cursusaurus enables learners to access online courses either via one-time purchase or through a recurring All-Access subscription. It replaces fractured, contradictory payment-gating systems with a unified, authoritative entitlement engine that guarantees unequivocal access truth.

## Positioning

A single entitlement architecture where "do I have access to this course?" always resolves from an independent `entitlements` table—never by querying payment history tables directly. One-time purchases, subscriptions, refunds, cancellations, and overlapping ownership coexist without race conditions or access ambiguity.

## Operating Context

- **Framework**: Next.js App Router (React 19, TypeScript strict mode)
- **Database & ORM**: Neon Serverless Postgres with Drizzle ORM
- **Authentication**: Better-Auth session cookies and social auth
- **Payments**: Stripe Checkout Sessions (one-time and subscription modes) and authoritative webhooks
- **Storage**: Private Supabase Storage bucket delivering 60-second signed playback URLs
- **Testing**: Vitest with in-memory PGlite database fixtures

## Capabilities and Constraints

- **Dual Payment Models**: Standalone one-time course purchase (lifetime access) and All-Access monthly/annual subscription (7-day free trial).
- **Entitlement Isolation**: `entitlements` table is the sole source of truth for access decisions (`hasAccess`). `purchases` and `subscriptions` record payment history only.
- **Refund Invariants**: Refunds revoke course-scoped entitlements immediately but preserve `lesson_progress`.
- **Subscription Invariants**: `trialing` and `active` grant all-access (`course_id = null`); `past_due`, `canceled`, and `unpaid` revoke immediately. Lapsing subscriptions do not revoke standalone purchases.
- **V1 Non-goals**: No multi-creator marketplace, no coupons/discount codes, no drip scheduling, no certificate issuance.
- **Course Pricing**: Creator-set between $19 and $199.

## Brand Commitments

- **Aesthetic**: Serif editorial on warm paper—reads like an academic prospectus, not an e-commerce checkout.
- **Typography**: Display/headlines in Signifier (serif, weight 400); body and UI in Sohne / Inter sans-serif.
- **Access Discipline**: Blush Peach (`--color-blush-peach` / `#fbe1d1`) is strictly reserved for access signaling (All-Access badges, locked preview wash, featured tier); never decorative. Ink Black (`#17191c`) is used for progress and primary actions.
- **Geometry**: Pill buttons (`rounded-full`), 24px card radius (`rounded-cards`), hairline borders, weightless subtle shadows.

## Evidence on Hand

- `docs/PRD.md`: Full product specification, invariants, and resolved pricing/refund decisions.
- `docs/ARCHITECTURE.md`: Technical system diagrams, request lifecycles, and data flows.
- `docs/DESIGN.md`: Visual tokens, typography scale, responsive breakpoints, and component styling rules.
- `docs/ROADMAP.md`: Milestones tracking implementation status.

## Product Principles

1. **Entitlements are the sole access authority**: Payment records are history; only `entitlements` decides access.
2. **Access-state visual clarity**: Peach means access; ink means completion. Never conflate access with progress.
3. **Editorial restraint over marketing noise**: Weightless surfaces, hairline borders, and calm typography let course content lead.
4. **Mobile-first progressive enhancement**: Unprefixed mobile baseline first, then layered responsive modifiers.
