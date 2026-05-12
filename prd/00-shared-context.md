# Undaunted: Relentless — Shared Context

This file is loaded alongside any stage file. It contains the cross-cutting context every stage needs: overview, goals, non-goals, users, tech stack, full acceptance criteria, and a glossary of terms.

**Version:** 1.0
**Expansion:** World of Warcraft: Midnight
**Current season:** Midnight Season 1 (started 17 March 2026)
**Realm:** EU-Draenor
**Team:** Undaunted: Relentless (a sub-team within the Undaunted guild)

---

## How to use the staged PRD

The PRD is split into six stage files plus this shared context. Build in stage order. At each stage, load:

- `00-shared-context.md` (this file) — always
- `0N-{stage-name}.md` — the current stage
- The README at `/README.md` — for officer-facing semantics

| Stage | File | Build order |
|---|---|---|
| 0 | `01-scaffold.md` | Project scaffold, CI/CD |
| 1 | `02-data-layer.md` | All data file schemas |
| 2 | `03-fetch-script.md` | Data fetch, APIs, rate limits |
| 3 | `04-frontend-foundations.md` | Routing, mobile-first, themes, accessibility, parse colours |
| 4 | `05-frontend-pages.md` | Pages, components, gamification |
| 5 | `06-tests-and-ci.md` | Test specifications |

Stop and run tests after each stage. Do not proceed to the next stage until the current one passes its acceptance criteria.

---

## 1. Overview

A static web dashboard for tracking the raid and Mythic+ performance of players in the **Undaunted: Relentless** team on **EU-Draenor**. Officers manually manage a roster and the app pulls data from WarcraftLogs and Raider.io once per day via a GitHub Actions cron job, commits the results as JSON to the repository, and the SvelteKit static site reads those JSON files at build/load time. No backend, no auth, no database.

---

## 2. Goals

- Give Undaunted officers a single place to see raid parse progression and M+ activity without switching between WarcraftLogs and Raider.io.
- Show week-over-week parse % improvement per raider per boss.
- Flag raiders who have not completed at least 4 × Mythic 10+ keys in the current reset week.
- Display each raider's current Raider.io overall score.
- Remain fully WCAG 2.1 AA accessible.
- Be mobile-first: all views must be fully usable on a phone screen before scaling up to desktop.

---

## 3. Non-Goals

- No login or authentication — the URL is the access control.
- No real-time data — daily refresh is sufficient.
- No support for other guilds or teams (this is hardcoded to Undaunted / EU-Draenor).
- No Battle.net OAuth or character linking.
- No mobile app.

---

## 4. Users

**Primary:** Undaunted officers checking performance between raid nights.  
**Secondary:** Raiders viewing their own stats.

Both user types read only — there is no in-app write capability beyond the officer-managed roster config file.

---

## 5. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | SvelteKit (latest, `@sveltejs/kit`) | `adapter-static` for GitHub Pages output |
| Styling | PicoCSS (latest) | Semantic HTML-first; minimal class usage; built-in light/dark mode via `data-theme` |
| Charts | Svelte-native with SVG | No external charting lib; drawn with reactive Svelte components |
| Data fetch / cron | Node.js script run by GitHub Actions | Runs daily at 06:00 UTC |
| Data storage | JSON files committed to `data/` in the repo | Cron script writes, commits, and pushes |
| Hosting | GitHub Pages | Deployed from `gh-pages` branch via Actions |
| APIs | WarcraftLogs GraphQL API v2, Raider.io REST API v1 | Both public / require API key for WCL |

---

## 17. Environment Variables / Secrets

| Variable | Where | Purpose |
|---|---|---|
| `WCL_CLIENT_ID` | GitHub Actions secret | WarcraftLogs OAuth client ID |
| `WCL_CLIENT_SECRET` | GitHub Actions secret | WarcraftLogs OAuth client secret |
| `GH_PAT` | GitHub Actions secret | PAT for committing data and triggering deploy |

The SvelteKit frontend reads no environment variables — all data is in static JSON files.

---

## 21. Acceptance Criteria

- [ ] Daily cron runs, fetches all players, commits JSON, and triggers a deploy without manual intervention.
- [ ] Dashboard loads and shows M+ status table and raid parse overview table within 2 seconds on a standard connection.
- [ ] Raiders below the weekly M+ threshold are visually highlighted in red; those meeting it are highlighted in green.
- [ ] Parse cells show "—" (not 0) when a boss was not killed.
- [ ] Raider detail page shows a per-boss line chart across all tracked weeks with gaps for weeks without a kill.
- [ ] Site passes automated WCAG 2.1 AA scan (e.g. axe-core / Lighthouse accessibility audit score 100).
- [ ] Site builds and deploys cleanly from a fresh `git clone` with only `npm ci` + `npm run build`.
- [ ] Adding a player to `roster.json` and pushing is sufficient to include them in the next cron run and deploy.
- [ ] On a 390px-wide phone viewport, the M+ status table renders as cards with no horizontal scroll and no text truncation.
- [ ] On a 390px-wide phone viewport, the raid parse table is horizontally scrollable with the raider name column remaining sticky.
- [ ] On a 390px-wide phone viewport, the raider detail summary bar (RIO score, key count, status badge) is fully visible above the fold without scrolling.
- [ ] All interactive tap targets are at least 44×44px on touch screens.
- [ ] Data for weeks before a player's effective `tracking_start_date` is never written to history or compliance files.
- [ ] A raider detail page shows no compliance rows for weeks before their start date.
- [ ] A raider with 3+ consecutive weeks meeting the M+ requirement shows a correct streak count.
- [ ] A week where the cron errored for a player shows "—" in the compliance table, not a red cross.
- [ ] Setting a player to `"status": "inactive"` in `roster.json` causes the cron to skip all API calls for that player on the next run.
- [ ] Setting a character entry to `"active": false` causes the cron to exclude that character from all WarcraftLogs and Raider.io calls on the next run — even if the parent raider is `"status": "active"`.
- [ ] A character entry with no `"active"` field is treated as inactive — not polled and a warning is logged.
- [ ] A raider with no active characters is skipped entirely and a warning is logged.
- [ ] Inactive players appear in a separate "Inactive" section on the dashboard with a grey badge and no M+ compliance flag.
- [ ] Inactive players' historical data remains accessible on their detail page.
- [ ] Lighthouse mobile performance score is 90 or above.
- [ ] All Vitest unit and component tests pass with zero failures.
- [ ] All Playwright e2e tests pass against the built static site.
- [ ] `axe-core` reports zero WCAG 2.1 AA violations on the dashboard and raider detail routes.
- [ ] All 7 parse badge colour combinations pass WCAG AA (4.5:1) contrast — verified by automated test.
- [ ] All 7 chart line colour CSS variables pass WCAG 1.4.11 non-text contrast (3:1) in both light and dark mode — verified by automated test.
- [ ] Raider detail page shows a streak hero block with current streak, longest streak, and lifetime completion rate.
- [ ] A raider with ≥ 3 consecutive weeks met displays the flame emoji on the streak hero.
- [ ] A raider who missed the most recent week sees the missed-week callout banner.
- [ ] Each boss on the raider detail page is rendered as a card with a parse badge, trend arrow, personal best, improvement delta, and sparkline.
- [ ] A personal best set in the current week is highlighted in gold.
- [ ] At least one milestone banner appears on the detail page when the trigger condition is met.
- [ ] Role icons appear next to raider names throughout the UI with correct aria-labels.
- [ ] The dashboard roster table can be filtered by role (tank / healer / dps).
- [ ] Each raider's spec is shown as a subtitle beneath their name in all table and card views.
- [ ] The dashboard can be filtered by class via a dropdown.
- [ ] An invalid class/spec combination in `roster.json` logs a warning but does not abort the cron run.
- [ ] Each raider is identified by `raider_id`; renaming or rerolling a character does not break historical data.
- [ ] The raider detail page shows a role/character history timeline with correct date ranges.
- [ ] A character switch is marked on boss parse charts with a dashed vertical line and tooltip.
- [ ] Historical parse data from a retired character remains visible in a collapsed section on the raider detail page.
- [ ] The active character's parse section is expanded on page load; inactive sections are collapsed.
- [ ] Inactive character section headers show character name, date range, and best parse summary without needing to expand.
- [ ] Historical parse cards in inactive sections do not show trend arrows.
- [ ] A raider with only one character shows no inactive sections and no history timeline.
- [ ] When a raider has two active characters simultaneously, M+ compliance sums runs across both.
- [ ] Adding a new character entry and setting the old to `"active": false` in `roster.json` triggers the cron to poll the new character from the next run.
- [ ] WCL queries pass `specName` from `roster.json` so parses are compared within the correct spec bracket.
- [ ] A spec mismatch between the log and `roster.json` shows a ⚠️ indicator on the parse card with a tooltip.
- [ ] Rows with any orange (95+) parse display a gold left-border accent on the dashboard.
- [ ] The M+ status dashboard table shows total dungeons and week-on-week delta columns.
- [ ] The dungeon volume panel on a raider detail page shows this week, last week, and record.
- [ ] A week-on-week increase shows a green ▲ delta; a decrease shows a red ▼ delta.
- [ ] The record dungeon week is highlighted in gold.
- [ ] A new personal dungeon record triggers a milestone banner on the detail page.
- [ ] The dungeon volume panel shows a highest key row with this week, last week delta, and all-time record.
- [ ] Highest key levels are displayed in "+N" WoW keystone notation throughout the UI.
- [ ] A new personal highest key record triggers a milestone banner on the detail page.
- [ ] The compliance history table includes a highest key column for every tracked week.
- [ ] The Resilience panel on the raider detail page shows the correct current level or "Not yet achieved".
- [ ] The progress table correctly identifies bottleneck dungeons and highlights them in amber.
- [ ] A Resilience level increase triggers a milestone banner on the detail page.
- [ ] `resilience_history` is appended to (never overwritten) when the level increases.
- [ ] The Resilience column on the dashboard M+ table shows the correct level badge or —.
- [ ] `computeResilienceLevel` correctly handles a season with a non-8 dungeon count via the active season's `mplus_season_dungeon_count`.
- [ ] The team designation badge (Main / Alt) is the most visually prominent element below the display name on the raider detail page.
- [ ] The designation filter on the dashboard M+ table and raid parse heatmap correctly isolates Main or Alt raiders.
- [ ] `designation_history` in `raider-history.json` preserves a per-season record of each raider's designation, updated by the cron on the first run of each season.
- [ ] When a raider leaves and rejoins, the compliance history gap weeks are shown as "—" (not failures) and the membership timeline shows both the departure and return events.
- [ ] Officers can change `team_designation` in `roster.json` and the next cron run writes a new `designation_history` entry without overwriting previous seasons.
- [ ] A `team_changed` event without a `reason` triggers a cron warning and records `"(no reason given)"` in the changelog — the event is never silently suppressed.
- [ ] Changing `team_designation` without a corresponding `team_changed` event in `membership_history` triggers a cron warning.
- [ ] The `reason` for a team change is visible on both the changelog page and the raider history timeline.
- [ ] The cron automatically generates changelog entries by diffing `roster.json` against the previous state — no manual changelog editing required.
- [ ] The `/changelog` page renders all entries grouped by ISO week, newest first.
- [ ] The Team, Event type, and Date range filters on the changelog page work independently and in combination.
- [ ] Each changelog entry links to the relevant raider's detail page.
- [ ] Changelog entries are append-only — existing entries are never modified or deleted by the cron.
- [ ] An entry with a `note` displays the note in muted italics; entries without notes display cleanly with no blank space.
- [ ] Adding a new M+ season entry to `roster.json` causes the cron to switch to it on the next run without code changes.
- [ ] A new raid zone appearing in WarcraftLogs for the configured expansion is auto-detected and a new `raid-{id}/` folder is created without officer action.
- [ ] Multiple active raid zones are all fetched and shown in the dashboard with a zone selector.
- [ ] The dashboard season selector shows all M+ seasons and raid zones from `data/seasons/index.json`.
- [ ] The difficulty toggle on the dashboard and raider detail page persists the selected difficulty to `localStorage`.
- [ ] Both Heroic and Mythic parses are fetched and stored per boss per raider.
- [ ] The cross-difficulty summary line on boss parse cards shows both difficulties simultaneously.
- [ ] The difficulty toggle defaults to the highest difficulty with at least one kill across the team.
- [ ] Selecting a past season on the dashboard shows historical data from that season's folder.
- [ ] Each M+ season's Resilience data is independent — a new season starts fresh.
- [ ] On first visit, the site matches the OS colour scheme (light or dark) with no flash.
- [ ] The theme toggle in the nav switches the site between light and dark instantly with no reload.
- [ ] The chosen theme persists across page navigation and browser refresh via `localStorage`.
- [ ] All parse percentile colours and SVG chart elements meet 4.5:1 contrast in both light and dark themes.

---

## Glossary

These terms are used throughout the PRD without redefinition. Refer back here if any term is unfamiliar.

| Term | Definition |
|---|---|
| **Raider** | A person on the team — identified by a UUID (`raider_id`). Not the same as a character. |
| **Character** | A WoW toon belonging to a raider. One raider can have multiple characters over time. |
| **Active character** | A character with `"active": true` in `roster.json`. Only active characters are polled by the cron. |
| **Active raider** | A raider with `"status": "active"`. Inactive raiders are not polled at all. |
| **Team designation** | Whether the raider has Undaunted: Relentless as their main team (`"main"`) or alt team (`"alt"`). |
| **Tracking start date** | The ISO date from which data is collected for a raider — anything before this is ignored. |
| **ISO week** | The standard `YYYY-WW` week notation. EU reset starts Wednesday 07:00 UTC. |
| **Parse percentile** | A 0–100 score representing how a player's damage/healing compares to others in the same spec/bracket. |
| **Parse bracket** | WCL groups parses into 7 colour tiers: Gray, Green, Blue, Purple, Orange, Pink (Legendary), Tan (Artifact). |
| **Resilience** | A WoW M+ achievement — completing all 8 season dungeons timed at a given key level sets the keystone floor at that level. |
| **WCL** | WarcraftLogs. Source of raid parse data via GraphQL API v2. |
| **Raider.io** | Source of M+ score and weekly run data via REST API. |
| **Cron** | The GitHub Actions workflow that runs daily at 06:00 UTC to fetch fresh data. |
| **Snapshot** | The most recent fetch result for a season, stored as `data/seasons/{id}/snapshot.json`. |
| **Compliance** | Whether a raider has met the weekly M+ requirement (4 × +10 keys). |
| **Streak** | Consecutive weeks a raider has met the compliance requirement. |
| **Membership history** | Append-only log of when a raider joined, left, or changed teams. |
| **Changelog** | Auto-generated log of all team composition changes (joins, leaves, rerolls, role/spec/team changes). |
