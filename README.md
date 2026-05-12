# Undaunted: Relentless — Staged PRD

This is the build-ready PRD split into six stages plus a shared context file. Load files in pairs: always include `00-shared-context.md`, then the stage you are currently on.

---

## Build order

| # | Stage | File | Loads with | Purpose |
|---|---|---|---|---|
| 0 | Shared context | `00-shared-context.md` | — | Always loaded. Overview, goals, tech stack, glossary, full acceptance criteria. |
| 1 | Project scaffold | `01-scaffold.md` | 00 | SvelteKit project, GitHub Actions workflows, basic routing. |
| 2 | Data layer | `02-data-layer.md` | 00 | All JSON schemas, TypeScript types, validation, edge cases. |
| 3 | Fetch script | `03-fetch-script.md` | 00, 02 | WCL + Raider.io fetch, batching, Resilience, changelog generation. |
| 4 | Frontend foundations | `04-frontend-foundations.md` | 00, 02 | Routing, theming, mobile-first, accessibility, parse colours. |
| 5 | Frontend pages | `05-frontend-pages.md` | 00, 02, 04 | Dashboard, raider detail, changelog page, gamification components. |
| 6 | Tests & CI | `06-tests-and-ci.md` | 00, plus relevant earlier stages | Vitest unit/component, Playwright e2e, axe-core, CI integration. |

---

## How to hand this to Claude Code

For each stage, start a new conversation (or clear context) and run something like:

> Read `00-shared-context.md` and `02-data-layer.md`. Then build everything in the Stage 2 deliverables list. Stop and ask before deviating from the spec. Run `npm run test:unit` before declaring the stage complete.

After each stage:
1. Verify the stage's acceptance criteria are met
2. Run the smoke tests for that stage
3. Commit
4. Move to the next stage

The full unsplit PRD is still available at `../undaunted-tracker-prd.md` if cross-referencing is needed.

The README at `../README.md` is the officer-facing documentation — Claude Code can refer to it for semantics around how officers will use the system in practice, but it is not a build spec.
