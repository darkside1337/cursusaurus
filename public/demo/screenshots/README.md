# Cursusaurus — Visual Showcase & Screenshots

High-resolution visual assets for GitHub documentation, README showcase banners, and release notes.

All images are captured at high DPI (`deviceScaleFactor: 2` for Desktop, `deviceScaleFactor: 3` for Mobile) directly from the running application with authentic seeded data, real local typography (`Signifier` serif display and `Sohne` sans-serif UI), and live entitlement access states.

---

## Screenshot Catalog

| Filename | Resolution | Perspective / Role | Description |
| :--- | :---: | :---: | :--- |
| **`01-catalog-marketplace.png`** | 2880 × 1800 | Visitor / Learner | Editorial course catalog with Signifier headline, category filters, and "All-Access" hero banner |
| **`01b-catalog-grid.png`** | 2880 × 1800 | Visitor / Learner | Responsive course card grid with cover art, category badges, prices ($49, $79, $99), and All-Access pills |
| **`02-course-detail-pricing.png`** | 2880 × 1800 | Prospective Learner | Course prospectus with dual-pricing cards ("Buy outright" vs. "All-Access Pass" with 7-day trial) |
| **`03-classroom-player.png`** | 2880 × 1800 | Enrolled Learner | Distraction-free classroom with Supabase video player, progress bar, and lesson syllabus |
| **`04-classroom-locked-preview.png`** | 2880 × 1800 | Visitor / Non-Enrolled | Locked content overlay in Blush Peach signaling access paths with zero disabled styling |
| **`05-learner-library.png`** | 2880 × 1800 | Authenticated Learner | Clean personal workspace with course progress bars, `<AccessBadge>` tags, and no ads |
| **`06-creator-studio.png`** | 2880 × 1800 | Course Creator | Creator prospectus editor: metadata, subject category selector, price controls, and publication toggle |
| **`06b-creator-curriculum.png`** | 2880 × 1800 | Course Creator | Curriculum studio: sequenced lessons, free preview toggles, and video upload status |
| **`07-creator-dashboard.png`** | 2880 × 1800 | Course Creator | Studio course management hub with publication badges, lesson metrics, and studio navigation |
| **`08-billing-portal.png`** | 2880 × 1800 | Active Subscriber | All-Access Pass subscription details, Stripe Customer Portal link, and invoice ledger |
| **`09-mobile-catalog.png`** | 1170 × 2532 | Mobile Visitor | Handheld catalog layout: touch-friendly cards, collapsed nav, and responsive typography |
| **`10-mobile-course-detail.png`** | 1170 × 2532 | Mobile Visitor | Mobile course prospectus with stacked dual-pricing cards |
| **`11-login-screen.png`** | 2880 × 1800 | Guest / Auth | Clean editorial authentication modal with Google and GitHub OAuth buttons on warm paper |

---

## GitHub README Integration Snippet

You can copy-paste the markdown below directly into your repository `README.md`:

```markdown
## 📸 Showcase & Main Attractions

### Editorial Course Catalog
> A quiet space for deliberate learning. Classical book typography translated to digital surfaces.

<img src="public/demo/screenshots/01-catalog-marketplace.png" alt="Editorial Course Catalog" width="100%" />

<details>
<summary><b>🔍 View More Showcase Screens (Classroom, Dual Pricing, Creator Studio, Mobile)</b></summary>

<br />

#### Course Catalog Grid
*Browse published masterclasses across Code, Design, Architecture, and Business.*
<img src="public/demo/screenshots/01b-catalog-grid.png" alt="Catalog Course Grid" width="100%" />

#### Course Prospectus & Dual-Pricing Model
*Buy individual courses outright ($49) or subscribe to an All-Access Pass ($15/mo with 7-day trial).*
<img src="public/demo/screenshots/02-course-detail-pricing.png" alt="Course Detail & Dual Pricing" width="100%" />

#### Distraction-Free Video Classroom
*Dedicated player environment with Supabase Storage streaming, persistent progress tracking, and syllabus navigation.*
<img src="public/demo/screenshots/03-classroom-player.png" alt="Distraction-Free Video Classroom" width="100%" />

#### Gated Content & Access Signaling
*Blush Peach overlay signaling unlocked paths rather than dead-end disabled states.*
<img src="public/demo/screenshots/04-classroom-locked-preview.png" alt="Locked Content Overlay" width="100%" />

#### Learner Library & Personal Workspace
*Quiet dashboard displaying active course progress and verified access entitlements.*
<img src="public/demo/screenshots/05-learner-library.png" alt="Learner Library" width="100%" />

#### Creator Studio & Curriculum Builder
*End-to-end course authoring: lesson sequencing, video asset management, and pricing controls.*
<img src="public/demo/screenshots/06b-creator-curriculum.png" alt="Creator Curriculum Builder" width="100%" />

#### Creator Course Management Hub
*High-level creator ledger with enrolled student counts, publication status, and royalties.*
<img src="public/demo/screenshots/07-creator-dashboard.png" alt="Creator Management Hub" width="100%" />

#### Billing & Subscription Portal
*Self-service Stripe billing portal access and perpetual ownership records.*
<img src="public/demo/screenshots/08-billing-portal.png" alt="Billing Portal" width="100%" />

#### Mobile Responsive Experience
*Mobile-first design ensuring full fidelity across hand-held viewports.*
<p align="center">
  <img src="public/demo/screenshots/09-mobile-catalog.png" alt="Mobile Catalog" width="45%" />
  &nbsp;&nbsp;
  <img src="public/demo/screenshots/10-mobile-course-detail.png" alt="Mobile Course Detail" width="45%" />
</p>

</details>
```

---

## Regenerating Screenshots

Whenever pages are redesigned or new features are introduced, regenerate the entire screenshot suite with a single command:

```bash
# 1. Ensure seed fixtures are populated
pnpm seed

# 2. Run automated screenshot pipeline
pnpm screenshots
```
