# Cursusaurus — Product Requirements Document

**Status:** Draft v0.1
**Owner:** [you]
**Last updated:** 2026-09-14

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

```
User          — id, email, stripe_customer_id
Course        — id, title, price_cents, is_published, creator_id
Purchase      — id, user_id, course_id, stripe_payment_intent_id, status, purchased_at
Subscription  — id, user_id, stripe_subscription_id, status, current_period_end
Entitlement   — id, user_id, course_id (nullable = all-access), source, granted_at, revoked_at
```

---

## 7. Milestones

| #   | Milestone                   | Key deliverable                                                                         |
| --- | --------------------------- | --------------------------------------------------------------------------------------- |
| 0   | Entitlement core            | `hasAccess()` + full test matrix, no UI/Stripe yet                                      |
| 1   | One-time purchase flow      | Stripe Checkout (one-time) + webhook → Purchase + Entitlement                           |
| 2   | Subscription flow           | Stripe Checkout (subscription) + webhook → Subscription + Entitlement, overlap handling |
| 3   | Content delivery + progress | Gated video playback, progress tracking                                                 |
| 4   | Admin/creator tools         | Upload, price, publish/unpublish                                                        |
| 5   | Polish                      | Stripe Customer Portal, email receipts, dunning                                         |

---

## 8. Key decisions (resolved)

| Decision                                 | Choice                                | Notes                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refund policy                            | Fixed window (e.g. 14-day money-back) | Refund event revokes the purchase-sourced `Entitlement`; exact window (14 vs 30 days) still to be finalized                                                                                                                                                |
| Failed subscription payment (`past_due`) | Revoke immediately                    | No grace period — sub-sourced entitlements are revoked as soon as Stripe reports `past_due`. Simpler logic, but means a single failed card charge cuts access instantly; revisit if churn/support load becomes an issue                                    |
| Video hosting                            | Supabase Storage, signed URLs         | Pairs with Supabase auth/DB if used elsewhere in the stack; no transcoding/adaptive bitrate in v1 — files served as-is behind short-lived signed URLs gated by `hasAccess()`. Swappable for Mux/Cloudflare Stream later without touching entitlement logic |

## 9. Open questions

- Exact refund window: 14 days or 30 days?
- All-Access subscription price point?
- Per-course pricing range/model (fixed vs. creator-set)?
- Does a refund on a one-time purchase claw back any progress data, or just access?
- Trial period for All-Access subscription — yes/no, and length?

---

## 10. Success metrics

_(TBD — revisit once pricing and launch goals are set)_
