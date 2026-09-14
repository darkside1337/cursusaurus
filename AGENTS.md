Cursusaurus is a course platform where learners buy individual courses outright (one-time Stripe payment) or subscribe to an All-Access Pass (recurring) that unlocks every course, including future ones. A single entitlement model backs both payment modes — see docs/ARCHITECTURE.md.

Package manager: pnpm

For phased task breakdown and current progress, see docs/ROADMAP.md
For visual design system, typography scales, and UI tokens, see docs/DESIGN.md
For project structure, system diagram, request lifecycles, and security, see docs/ARCHITECTURE.md
For schema, invariants, entitlement model, and testing approach, see docs/PRD.md

## Roadmap Maintenance

- After completing a task that corresponds to a checkbox in `ROADMAP.md`, check it off (`- [ ]` → `- [x]`) in the same turn — don't batch updates for later.
- Only check a box when the work is actually done and verified (tests passing, diff applied), not when merely started or planned.
- If a completed task isn't represented by an existing checkbox, add one in the right phase rather than leaving it untracked.
- Never uncheck a box without the user's explicit instruction — if a completed item later breaks, raise it in conversation rather than silently reverting roadmap state.
- **Commit Workflow:** When a milestone or logical chunk of work is complete and verified, suggest a conventional commit command with a proposed message and the list of files to stage, then wait for user instruction.

## UI & Styling Workflow

- **Google Stitch First:** Before building ANY UI, you MUST use `stitch_*` tools to find the target screen in Project ID `projects/12955454536127255680`. `webfetch` its HTML and use that exact DOM/layout as your strict reference.
- **Component Strategy:** We use Shadcn UI as the accessible primitive foundation for all interactive elements.
- **Execution Order:** When tasked with building UI, you must FIRST add the raw Shadcn component via CLI (`pnpm dlx shadcn@latest add <component>`) into `components/ui/`.
- **Refinement:** SECOND, you must immediately modify the generated Shadcn component file to strip out its default Tailwind styles and replace them with the explicit editorial utility classes, custom radii (`rounded-buttons`, `rounded-cards`, `rounded-images`, `rounded-inputs`), and spacing defined in `docs/DESIGN.md`. Do not leave default Shadcn visual styles intact.
- **Access-state color discipline:** Blush Peach (`--color-blush-peach`) is reserved for access-state signaling only (All-Access badges, locked-content overlays, the featured pricing tier) per `docs/DESIGN.md`. Do not use it as a decorative accent elsewhere.

## Planning Workflow

- **Plan Visibility:** Whenever an Implementation Plan is created (e.g. during a `/plan` execution) in the agent's brain directory, you MUST duplicate it into the `.plans/` directory in the project root so it's easily accessible in the workspace.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
