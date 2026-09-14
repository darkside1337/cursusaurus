# Cursusaurus — Style Reference

> serif editorial on warm paper — course catalog and player

**Theme:** light

Cursusaurus renders a course catalog as editorial, not e-commerce: serif headlines sit over a near-monochrome canvas while a single warm peach accent marks anything tied to access — locked content, pricing emphasis, "included in All-Access" badges. The page reads like a course prospectus, not a checkout flow. Components stay quiet and weightless — shadows are barely-there, borders are hairline, and color is rationed to functional emphasis. Video and course-cover imagery carry the visual weight; UI chrome recedes.

_Adapted from the Steep design system (peach/ink palette, type scale, spacing) — components, imagery, and layout below are written for Cursusaurus specifically, not carried over from the source._

<https://styles.refero.design/style/75fdb89f-ca64-41b3-af36-7a78bd09448e> (reference)

## Tokens — Colors

| Name         | Value     | Token                  | Role                                                                                                                                                |
| ------------ | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ink Black    | `#17191c` | `--color-ink-black`    | Primary text, filled button background, nav logo — the only dark surface in the system                                                              |
| Paper White  | `#ffffff` | `--color-paper-white`  | Page canvas, button text, elevated card surfaces                                                                                                    |
| Mist Gray    | `#f2f2f3` | `--color-mist-gray`    | Card surfaces, secondary backgrounds, input fills                                                                                                   |
| Fog White    | `#fafafb` | `--color-fog-white`    | Secondary page background for alternating sections, hover surfaces                                                                                  |
| Slate Gray   | `#777b86` | `--color-slate-gray`   | Link color, muted helper text, footer copy                                                                                                          |
| Ash Gray     | `#979799` | `--color-ash-gray`     | Tertiary labels, category tags (course subjects — Design, Marketing, Code)                                                                          |
| Smoke Gray   | `#a3a6af` | `--color-smoke-gray`   | Placeholder text, disabled labels                                                                                                                   |
| Blush Peach  | `#fbe1d1` | `--color-blush-peach`  | Access-state accent — "Included in All-Access" badge, locked-content overlay wash, pricing-card highlight. The only chromatic surface in the system |
| Sienna Brown | `#5d2a1a` | `--color-sienna-brown` | Text/stroke on peach surfaces — used specifically for access-related labels ("All-Access", "Included")                                              |

## Tokens — Typography

### Signifier — Display and headline serif · `--font-signifier`

- **Substitute:** GT Sectra, Tiempos Headline, Source Serif 4, or ui-serif/Georgia
- **Weights:** 400 only
- **Sizes:** 44px, 64px, 90px
- **Line height:** 1.30
- **Letter spacing:** -2.25px at 90px, -0.96px at 64px, -0.66px at 44px
- **Role:** Course catalog hero, course title on detail pages. Weight stays at 400 at every scale — the serif carries authority through form, not weight

### Sohne — Body, UI, and navigation sans · `--font-sohne`

- **Substitute:** Inter, or ui-sans-serif/system-ui stack
- **Weights:** 400, 430, 450, 480, 500
- **Sizes:** 14px, 15px, 16px, 17px, 18px, 20px, 22px, 26px
- **Line height:** 1.00–1.50
- **Role:** Body copy, course descriptions, lesson lists, nav, pricing copy, video player labels — the workhorse covering everything from 14px metadata to 26px subheads

### Type Scale

| Role       | Size | Line Height | Letter Spacing | Token               |
| ---------- | ---- | ----------- | -------------- | ------------------- |
| caption    | 15px | 1.5         | —              | `--text-caption`    |
| body       | 17px | 1.35        | —              | `--text-body`       |
| body-lg    | 20px | 1.35        | —              | `--text-body-lg`    |
| subheading | 22px | 1.5         | —              | `--text-subheading` |
| heading-sm | 26px | 1.18        | -0.23px        | `--text-heading-sm` |
| heading    | 44px | 1.3         | -0.66px        | `--text-heading`    |
| heading-lg | 64px | 1.3         | -0.96px        | `--text-heading-lg` |
| display    | 90px | 1.3         | -2.25px        | `--text-display`    |

## Tokens — Spacing & Shapes

**Base unit:** 4px · **Density:** comfortable

### Border Radius

| Element                   | Value  |
| ------------------------- | ------ |
| cards                     | 24px   |
| images / video thumbnails | 12px   |
| inputs                    | 16px   |
| buttons                   | 9999px |
| smallCards                | 16px   |
| elevatedCards             | 20px   |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80px
- **Card padding:** 20px
- **Element gap:** 8px

### Shadows

| Name     | Value                                                                                             | Token               |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| subtle   | `0 0 0 1px rgba(0,0,0,0.05), 0 4px 24px rgba(0,0,0,0.08)`                                         | `--shadow-subtle`   |
| subtle-2 | `0 0 0 1px rgba(0,0,0,0.05), 0 8px 40px rgba(0,0,0,0.1)`                                          | `--shadow-subtle-2` |
| subtle-3 | `0 0 0 1px rgba(4,23,43,0.05), 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | `--shadow-subtle-3` |

## Components

_Built as shadcn/ui primitives, restyled to these tokens per the UI component rules in `CLAUDE.md` — install the primitive, then compose/restyle in a wrapper component._

### Course Card

**Role:** Catalog grid item (browse page, search results)

Background #ffffff, border-radius 24px, no shadow at rest, hairline #ececec border. Contains: video thumbnail (12px radius, 16:9), course title (Sohne 20px weight 500, #17191c), creator name (Sohne 14px, #777b86), price or access-state footer. On hover: `--shadow-subtle`. If included in All-Access, a small peach pill badge ("All-Access") sits top-left over the thumbnail corner.

### Pricing Tier Card

**Role:** Pricing page — one-time vs. All-Access comparison

Background #ffffff, border-radius 24px, hairline border. Two cards side by side: "Buy this course" (one-time) and "All-Access" (subscription). The All-Access card gets the peach treatment — background #fbe1d1, text #5d2a1a — as the one editorial accent per pricing page, marking it as the recommended/featured option without a garish "Best Value" ribbon.

### Locked Content Overlay

**Role:** Preview-gated lesson in a course outline or video player

Semi-transparent peach wash (`#fbe1d1` at reduced opacity) over the thumbnail/lesson row, with a small lock icon and "Included in All-Access" or "Purchase to unlock" label in Sienna Brown (#5d2a1a), Sohne 14px weight 450. Never uses gray/disabled styling for locked content — peach signals "available via a path," not "unavailable."

### Video Player Shell

**Role:** Lesson playback surface

Full-bleed within a 20px-radius elevated container (`--shadow-subtle-3`), no border. Player chrome (progress bar, controls) in Ink Black on a dark scrim over the video — the only place the system departs from the light canvas, intentionally, since video needs a dark control surface regardless of page theme.

### Progress Bar (Course/Lesson)

**Role:** Learner progress indicator, library and course-detail pages

Track: Mist Gray (#f2f2f3), 4px height, 9999px radius. Fill: Ink Black (#17191c) — not peach, since peach is reserved for access-state, not completion-state, to avoid the two meanings colliding visually.

### Access Badge

**Role:** Compact status marker on cards and lesson rows

Pill shape, 9999px radius, 14px Sohne weight 450. Three states: "All-Access" (peach bg, sienna text), "Purchased" (mist gray bg, ink text), "Locked" (transparent, ash gray text with lock icon) — deliberately not red/green traffic-light coding.

### Pill Button — Filled / Ghost

**Role:** Primary/secondary actions (Buy course, Subscribe, Watch preview)

Filled: #17191c background, white text, 9999px radius. Ghost: transparent, #17191c border and text. Same pairing pattern as the source system — filled primary paired with a ghost secondary on the same row (e.g., "Buy — $49" filled beside "Watch free preview" ghost).

### Nav Link / Top Bar

**Role:** Site navigation (Browse, Pricing, My Library, Dashboard)

Transparent top bar, no shadow, no border. Logo left, nav center, auth/CTA right (Sign in + filled pill "Get All-Access" when logged out; avatar + "My Library" when logged in).

## Do's and Don'ts

### Do

- Use Signifier weight 400 at 44/64/90px for course titles and hero copy only — never for body or UI text
- Reserve peach exclusively for **access-state signaling** (All-Access badges, locked overlays, the featured pricing tier) — this is a narrower rule than the source system, specific to Cursusaurus's dual-payment model
- Use Ink Black (not peach) for progress/completion indicators, to keep "you have access" and "you've finished this" visually distinct
- Keep card radius at 24px, buttons fully pill-shaped, consistent across catalog, pricing, and library views

### Don't

- Don't use red/green traffic-light coloring for access states (locked/unlocked/purchased) — peach/ink/gray carries that meaning instead
- Don't apply the peach wash to more than one pricing tier at once — it must stay a single, rare emphasis signal, not decoration
- Don't introduce a second accent color for subscription vs. one-time purchase — both payment modes share the same peach vocabulary, since the underlying entitlement is unified (see `ARCHITECTURE.md` §6)
- Don't use bold/semibold in Signifier — stays weight 400 across all sizes

## Imagery

Imagery is course-first: every course has a 16:9 cover thumbnail, real content (not stock photography or illustration) — a frame from the course video, or a creator-supplied cover image. Catalog grids show thumbnails at consistent 12px radius with no filters or overlays except the access-state peach wash on locked items. The video player itself, not a marketing screenshot, is the hero visual on course detail pages — a large 20px-radius player shell above the fold, with the serif course title beside or below it rather than overlapping. No abstract graphics, no gradients, no illustrated hero art — the product (courses, learners' own progress) is the imagery.

## Layout

Page model is max-width 1200px centered. Catalog page: hero search/heading in Signifier at 64px, followed by a filterable grid of Course Cards (3-column desktop, 24px gaps, no shadow at rest). Course detail page: two-column layout — video player + lesson outline on the left (or top on mobile), sticky pricing/access card on the right showing both purchase paths (one-time price, All-Access CTA) using the Pricing Tier Card component. Library page: a simple grid of owned/subscribed Course Cards with progress bars, no pricing chrome. Sections alternate Paper White and Fog White backgrounds for quiet rhythm, consistent with the source system's restraint — no strong section dividers, no colored bands beyond the occasional peach card.

## Quick Start

### Tailwind v4 (`@theme` — single source, goes directly in `globals.css`)

This is the only block to port into `globals.css`. Do not also create a separate `:root` block with these tokens — that duplication is how tokens drift out of sync. See mapping notes below the block for why each section is shaped the way it is.

```css
@theme {
  /* Colors */
  --color-ink-black: #17191c;
  --color-paper-white: #ffffff;
  --color-mist-gray: #f2f2f3;
  --color-fog-white: #fafafb;
  --color-slate-gray: #777b86;
  --color-ash-gray: #979799;
  --color-smoke-gray: #a3a6af;
  --color-blush-peach: #fbe1d1;
  --color-sienna-brown: #5d2a1a;

  /* Fonts */
  --font-signifier: "Signifier", ui-serif, Georgia, serif;
  --font-sohne: "Sohne", Inter, ui-sans-serif, system-ui, sans-serif;

  /* Type scale — font-size with bound line-height + letter-spacing via v4 sub-tokens,
     so e.g. `text-heading` alone applies all three, no manual leading-[]/tracking-[] needed */
  --text-caption: 15px;
  --text-caption--line-height: 1.5;

  --text-body: 17px;
  --text-body--line-height: 1.35;

  --text-body-lg: 20px;
  --text-body-lg--line-height: 1.35;

  --text-subheading: 22px;
  --text-subheading--line-height: 1.5;

  --text-heading-sm: 26px;
  --text-heading-sm--line-height: 1.18;
  --text-heading-sm--letter-spacing: -0.23px;

  --text-heading: 44px;
  --text-heading--line-height: 1.3;
  --text-heading--letter-spacing: -0.66px;

  --text-heading-lg: 64px;
  --text-heading-lg--line-height: 1.3;
  --text-heading-lg--letter-spacing: -0.96px;

  --text-display: 90px;
  --text-display--line-height: 1.3;
  --text-display--letter-spacing: -2.25px;

  /* Layout — named container width only; section-gap/card-padding/element-gap are
     NOT redefined here, they map onto Tailwind's native spacing scale (see notes below) */
  --container-page: 1200px;

  /* Border Radius — the only custom tokens components/ui/ should ever reference */
  --radius-cards: 24px;
  --radius-images: 12px;
  --radius-inputs: 16px;
  --radius-buttons: 9999px;
  --radius-smallcards: 16px;
  --radius-elevatedcards: 20px;

  /* Shadows — kept as their own named scale, not remapped onto sm/md/lg,
     so component specs above (e.g. Video Player Shell → shadow-subtle-3) stay traceable */
  --shadow-subtle:
    0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 24px rgba(0, 0, 0, 0.08);
  --shadow-subtle-2:
    0 0 0 1px rgba(0, 0, 0, 0.05), 0 8px 40px rgba(0, 0, 0, 0.1);
  --shadow-subtle-3:
    0 0 0 1px rgba(4, 23, 43, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
}
```

### Mapping notes (why this differs from a literal token dump)

- **`--container-page` → `max-w-page`.** Tailwind v4 only generates a width utility from the `--container-*` namespace, not an arbitrary `--page-max-width` name.
- **Section gap (80px), card padding (20px), element gap (8px) are intentionally NOT custom tokens.** They were chosen to land exactly on Tailwind's native 4px-multiplier scale — use `gap-20`, `p-5`, `gap-2` directly. Do not add `--spacing-*` overrides to `@theme`: redefining `--spacing-4`/`--spacing-8`/etc. hijacks Tailwind's own multiplier scale (`p-4`, `h-8`, etc.), which breaks shadcn's own component sizing (e.g. default button height `h-8` would silently become 8px instead of 32px).
- **Type scale sizes use Tailwind v4's sub-token syntax** (`--text-heading--line-height`, `--text-heading--letter-spacing`) so line-height and tracking travel with the font-size utility automatically.
- **Radii, colors, fonts, and shadows are the only custom-named tokens** components should reference directly (`rounded-cards`, `bg-blush-peach`, `font-signifier`, `shadow-subtle-3`). Everything else — spacing, gaps, padding — uses Tailwind's stock utilities.
