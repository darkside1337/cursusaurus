# Cursusaurus — Product Requirements Document

**Status:** Active specification
**Last updated:** 2026-09-18

---

## 1. Problem & Vision

Learners want flexibility in how they pay for online courses: some want to buy exactly what they need, others want unlimited access for a flat recurring fee. Existing platforms often force one model. Cursusaurus supports both from day one, sharing a single access-control layer underneath.

**Vision statement:** A course platform where "do I have access to this course?" always has one clear, correct answer — regardless of whether the learner paid once or subscribes monthly.

---

## 2. Target users

- **Learners** — browse, purchase or subscribe, watch courses, track progress.
- **Creators/Admins** — upload and price courses, publish/unpublish, view basic sales data.

_(v1 assumption: a single internal admin/creator role, not a multi-instructor marketplace — see Non-goals.)_

---

## 3. Core user flows

1. **Browse & preview** — anyone (logged out or in) can browse the catalog and preview a course (trailer/first lesson).
2. **Buy a single course** — one-time Stripe payment → permanent access to that course.
3. **Subscribe to All-Access** — recurring Stripe subscription → access to all published courses, including ones published after subscribing.
4. **Watch content** — video playback gated by access check; progress is tracked per user/course.
5. **Cancel subscription** — loses access to sub-only courses at period end; retains access to any individually purchased courses.
6. **Creator/admin course management** — upload, price, publish/unpublish a course.

---

## 4. Non-goals (v1)

- Multi-instructor marketplace (multiple creators selling independently, revenue share)
- Coupons / discount codes
- Team or org seats (bulk licenses)
- Native mobile app
- Drip-scheduled content release
- Course certificates / completion credentials

---

## 5. The hard part, stated explicitly

A single `hasAccess(user, course)` check must be true for two structurally different reasons — a permanent purchase grant, or an active subscription — and must correctly handle: refunds, failed renewals, subscription cancellation, and a user who has **both** a standalone purchase and a subscription for overlapping courses.

**Architecture principle:** `Purchase` and `Subscription` records are payment history. A separate `Entitlement` table is the single source of truth for access, written to by webhook handlers only. All access checks read from `Entitlement` exclusively.

---

## 6. Data model (high-level)

Schema lives in `lib/db/schema.ts` (source of truth; migrations in `drizzle/`). High-level shape:

```
User          — Better-Auth managed (id, name, email, image, ...). No stripe_customer_id column;
                Stripe customer identity is stored on the subscription/purchase records
Course        — id, title, slug (unique), description, category, thumbnail_url, price_cents,
                is_published, creator_id, created_at, updated_at
Lesson        — id, course_id (FK, cascade), title, slug (unique per course), description,
                order_index, duration_seconds, is_preview, timestamps
Purchase      — id, user_id, course_id, price_paid_cents, stripe_payment_intent_id (unique),
                stripe_session_id (unique), status, purchased_at
Subscription  — id, user_id, stripe_subscription_id (unique), stripe_customer_id, stripe_session_id,
                status, current_period_end, cancel_at_period_end, trial_ends_at, last_event_epoch,
                timestamps (partial unique index on user_id for active/trialing)
Entitlement   — id, user_id, course_id (nullable = all-access), source, granted_at, revoked_at
LessonProgress— id, user_id, course_id, lesson_id, lesson_slug, completed, last_position_seconds, updated_at
ProcessedStripeEvent — id, event_id (unique — webhook idempotency), event_type, processed_at
RefundTombstone      — stripe_payment_intent_id (PK), refunded_at (refund idempotency)
ReconcileAttempt     — stripe_session_id (PK), user_id, status, error, attempted_at
```

---

## 7. Milestones

Numbering mirrors `docs/ROADMAP.md` phases (risk-ordered, and each phase's milestone inherits its gate from the roadmap).

| #   | Milestone (Phase)             | Key deliverable                                                                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------- |
| 0   | Entitlement core (Ph 1)       | `hasAccess()` + full test matrix, no UI/Stripe yet — **done**                           |
| 1   | Course creation & catalog     | Creator dashboard, lesson management, publish/readiness, public catalog — **done**       |
| 2   | Payments (One-Time + All-Access) | Stripe Checkout (both modes) + webhooks → Purchase/Subscription + Entitlement — **done** |
| 3   | Content delivery & progress   | Gated video playback, progress tracking                                                 |
| 4   | Polish & billing ops          | Email receipts, dunning (note: Stripe Customer Portal delivered early in Milestone 2)   |
| 5   | QA & deploy                   | Verification, deployment, reconciliation cron, production smoke test                    |

---

## 8. Key decisions (resolved)

| Decision                                 | Choice                                | Notes                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refund policy                            | Fixed window (e.g. 14-day money-back) | Refund event revokes the purchase-sourced `Entitlement`; exact window (14 vs 30 days) still to be finalized                                                                                                                                                |
| Failed subscription payment (`past_due`) | Revoke immediately                    | No grace period — sub-sourced entitlements are revoked as soon as Stripe reports `past_due`. Simpler logic, but means a single failed card charge cuts access instantly; revisit if churn/support load becomes an issue                                    |
| Video hosting                            | Supabase Storage, signed URLs         | Pairs with Supabase auth/DB if used elsewhere in the stack; no transcoding/adaptive bitrate in v1 — files served as-is behind short-lived signed URLs gated by `hasAccess()`. Swappable for Mux/Cloudflare Stream later without touching entitlement logic |
| Per-course pricing range                 | $19–$199, creator-set within range    | Enforced server-side in course create/edit Server Action; revisit ceiling if premium/bundle courses are added                                                                              |
| All-Access subscription price            | $15.00/month                          | Configured in `features/subscriptions/pricing.ts` ($15/mo recurring with 7-day trial)                                                                                                                                      |
| Trial period                             | 7-day free trial on All-Access        | Subscription starts in `trialing` status; `hasAccess()` treats `trialing` as access-granting, same as `active`                                                                             |
| Refund + progress data                   | Access revoked, progress retained     | `lesson_progress` rows are never deleted on refund — learner can re-purchase and resume                                                                                                    |
| Publication vs. purchase eligibility     | Distinct states                       | Publication and purchase eligibility are separate booleans. A course can be **published** with zero lessons (discoverable, marked "coming soon"); it becomes **purchase-eligible** only once published **and** it has ≥ 1 lesson (enforced in `calculateCourseReadiness`) |
| Course categories                        | Fixed taxonomy                        | Courses carry a `category` (default `Design`). Catalog ships with: All / Design / Code / Marketing / Writing / Business / Photography                                                                  |

## 9. Open questions

- ~~Exact refund window: 14 days or 30 days?~~ → **TBD** (still open — not yet enforced in code)
- ~~All-Access subscription price point?~~ → **Resolved**: $15.00/month with 7-day free trial (see §8)
- ~~Per-course pricing range/model (fixed vs. creator-set)?~~ → **Resolved**: $19–$199, creator-set (see §8)
- ~~Does a refund on a one-time purchase claw back any progress data, or just access?~~ → **Resolved**: access only; progress retained (see §8)
- ~~Trial period for All-Access subscription — yes/no, and length?~~ → **Resolved**: 7-day free trial (see §8)

---

## 10. Success metrics

_(TBD — revisit once pricing and launch goals are set)_
