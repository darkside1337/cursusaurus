Cursusaurus is a course platform where learners buy individual courses outright (one-time Stripe payment) or subscribe to an All-Access Pass (recurring) that unlocks every course, including future ones. A single entitlement model backs both payment modes — see docs/ARCHITECTURE.md.

Package manager: pnpm

For phased task breakdown and current progress, see docs/ROADMAP.md
For visual design system, typography scales, and UI tokens, see docs/DESIGN.md
For project structure, system diagram, request lifecycles, and security, see docs/ARCHITECTURE.md
For schema, invariants, entitlement model, and testing approach, see docs/PRD.md
For product positioning, principles, and audience definition, see PRODUCT.md

Tests: `pnpm test` (Vitest) runs against an in-memory PGlite database — no external Postgres needed.

Build & Environment: `config/env.ts` validates `STRIPE_WEBHOOK_SECRET` at runtime in production, but permits build commands (`pnpm build`) to proceed without active webhook secrets.

## Roadmap Maintenance

- After completing a task that corresponds to a checkbox in `ROADMAP.md`, check it off (`- [ ]` → `- [x]`) in the same turn — don't batch updates for later.
- Only check a box when the work is actually done and verified (tests passing, diff applied), not when merely started or planned.
- If a completed task isn't represented by an existing checkbox, add one in the right phase rather than leaving it untracked.
- Never uncheck a box without the user's explicit instruction — if a completed item later breaks, raise it in conversation rather than silently reverting roadmap state.
- **Commit Workflow:** When a milestone or logical chunk of work is complete and verified, suggest a conventional commit command with a proposed message and the list of files to stage, then wait for user instruction.

## UI & Styling Workflow

- **Mobile-first:** Design and build every screen mobile-first. Start with the
  unprefixed (mobile) Tailwind classes as the base styles, then layer in `md:`
  (tablet) and `lg:` (desktop) variants for progressive enhancement — never the
  reverse (do not design desktop-first and retrofit smaller breakpoints with
  overrides). See `docs/DESIGN.md` for per-breakpoint layout specs (grid column
  counts, sidebar collapse behavior, nav treatment) for each page.
- **Full-Spectrum Shadcn Component Architecture:** Cursusaurus utilizes the **entire Shadcn UI component library**. Never write custom HTML or makeshift CSS for any pattern covered by Shadcn (modals, dropdowns, tabs, accordions, avatars, separators, skeletons, toasts, tooltips, dialogs, drawers, etc.).
- **Google Stitch as Visual Reference (NEVER Raw HTML):** Before building ANY UI, you MUST use `stitch_*` tools to find the target screen in Project ID `projects/12955454536127255680` and examine its HTML. However, **NEVER copy Stitch's raw HTML tags verbatim**. Stitch outputs un-abstracted `<button>`, `<div>`, and `<input>` tags. You must translate Stitch's visual hierarchy into our project's Shadcn primitives.
- **On-Demand Component Acquisition:** Whenever a screen needs a component not yet in `components/ui/`, install it (`pnpm dlx shadcn@latest add <component>`), restyle it to match `docs/DESIGN.md` editorial tokens (custom radii, ink/paper/mist/slate palette), then compose it in the feature.
- **Access-state color discipline:** Blush Peach (`--color-blush-peach`) is reserved for access-state signaling only (All-Access badges, locked-content overlays, the featured pricing tier) per `docs/DESIGN.md`. Do not use it as a decorative accent elsewhere.
- **Pre-Completion UI Audit:** Before marking any UI task complete or creating a commit, run `git diff` on modified pages and inspect for native `<button>`, `<input>`, or un-abstracted container tags outside `components/ui/`. If any exist where a Shadcn primitive applies, refactor them immediately.

## Planning Workflow

- **Plan Visibility:** Whenever an Implementation Plan is created (e.g. during a `/plan` execution) in the agent's brain directory, you MUST duplicate it into the `.plans/` directory in the project root so it's easily accessible in the workspace.
- **Component Fidelity in Plans:** Code blocks in `.plans/*.md` must explicitly use Shadcn primitives (`<Button>`, `<Card>`, `<Input>`, `<Badge>`, etc.), NEVER raw HTML tags. If an existing or resumed plan contains raw HTML tags, the executing agent is required to upgrade them to Shadcn primitives rather than copying them blindly.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
