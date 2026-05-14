# Undaunted: Relentless — Guild Dashboard

A static dashboard for the World of Warcraft guild **Undaunted: Relentless** on EU-Draenor. It tracks Mythic+ and raid performance for the active roster and is rebuilt automatically twice a day from live data.

---

## Contents

- [What the dashboard shows](#what-the-dashboard-shows)
- [How data gets updated](#how-data-gets-updated)
- [Tech stack](#tech-stack)
- [Local development](#local-development)
- [Running the fetch script manually](#running-the-fetch-script-manually)
- [Backfilling historical data](#backfilling-historical-data)
- [Managing the roster](#managing-the-roster)
- [Blocking pug detection](#blocking-pug-detection)
- [Secrets and environment variables](#secrets-and-environment-variables)
- [Deploying](#deploying)
- [Tests](#tests)
- [Project structure](#project-structure)

---

## What the dashboard shows

### Dashboard (home page)

- Raid tier progression: boss pip row, progress bar, and current difficulty status
- Roster composition: roles, classes, and specs at a glance
- M+ on-track count for the current reset

### Raid parses table

- One row per raider, one column per boss
- Cells are colour-coded using WarcraftLogs parse colours (grey through orange/pink)
- Each cell links to the relevant WarcraftLogs report
- Boss names are abbreviated to fit the table

### Mythic+ table

- RIO score badge per raider
- Key level colours match Raider.io cutoffs
- Tracks the record week (highest total key count) for the season

### Per-raider pages

- Raid boss parse cards with bar charts and links to WoWAnalyzer
- M+ streak and weekly compliance history
- Lockout callout if the raider has a progression-blocking pug kill

### Changelog

- Full team event log: joins, leaves, rerolls, spec changes, pug flags, exemptions

---

## How data gets updated

A GitHub Actions cron job runs at **05:00 UTC** and **17:00 UTC** every day. It:

1. Fetches M+ scores and weekly key runs from [Raider.io](https://raider.io)
2. Fetches raid parses and boss kill data from [WarcraftLogs](https://www.warcraftlogs.com)
3. Writes updated JSON files under `data/`
4. Commits the snapshot to `main`
5. Triggers a new deployment via the deploy workflow

The site is fully static. There is no server or database. All data lives in JSON files in the repository.

---

## Tech stack

| Tool | Purpose |
|---|---|
| SvelteKit + adapter-static | Static site framework |
| Svelte 5 runes | Reactive component model |
| PicoCSS | Base styles |
| TypeScript | Type safety throughout |
| Biome | Linting and formatting for JS/TS/JSON |
| Prettier + prettier-plugin-svelte | Formatting for `.svelte` files |
| Vitest | Unit and component tests |
| Playwright | End-to-end tests |
| pnpm | Package manager |

---

## Local development

### Prerequisites

- Node.js LTS
- pnpm (`npm install -g pnpm`)
- A `.env` file at the project root (see [Secrets and environment variables](#secrets-and-environment-variables))

### Steps

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the dev server:

   ```bash
   pnpm dev
   ```

3. Open `http://localhost:5173` in your browser.

The dev server reads data from the JSON files already committed in `data/`. It does not fetch live data on its own.

---

## Running the fetch script manually

Use this to pull fresh data outside the scheduled cron, for example after editing the roster.

1. Make sure your `.env` file contains valid credentials (see [Secrets and environment variables](#secrets-and-environment-variables)).

2. Run:

   ```bash
   pnpm fetch
   ```

The script writes updated files to `data/`. Commit the changes and push to `main` to trigger a deployment.

---

## Backfilling historical data

Use the backfill script when you need parse data for past weeks — for example when adding a new raider mid-tier or when historical records are missing.

The backfill script uses WarcraftLogs `encounterRankings(timeframe: Historical)` to retrieve week-specific parses with exact report codes.

Run:

```bash
pnpm backfill
```

Commit the resulting changes to `data/` and push to trigger a deployment.

---

## Officer tasks

All officer tasks are done by editing `data/roster.json` directly and pushing to `main`. There is no UI — this is intentional so only officers with repository access can make changes.

After any edit to `roster.json`, run the fetch script to apply changes and trigger a deployment:

```bash
pnpm fetch
git add data/
git commit -m "chore: roster update"
git push
```

---

### Adding a raider

1. Generate a new UUID for the raider:

   ```bash
   node scripts/generate-uuid.mjs
   ```

2. Add a new block to the `players` array in `data/roster.json`, filling in `raider_id`, `display_name`, `status: "active"`, `team_designation`, their character name, realm, class, spec, and role.

3. Add a `joined` event to `membership_history`:

   ```json
   { "event": "joined", "date": "YYYY-MM-DD", "note": "Reason for joining" }
   ```

4. Add an entry to `role_history` with `from` set to today and `to: null`.

5. Run `pnpm fetch`, commit, and push.

---

### Removing a raider

Do not delete the player block. This preserves their historical parse data and changelog entries.

1. Set `status` to `"inactive"` on their player block.
2. Set `to` on their current `role_history` entry to today's date.
3. Add a `left` event to `membership_history`:

   ```json
   { "event": "left", "date": "YYYY-MM-DD", "note": "Reason for leaving" }
   ```

4. Run `pnpm fetch`, commit, and push.

---

### Changing a raider's main spec

1. Update `spec` on their active character.
2. Add a new entry to `role_history` with the new spec, `from` set to today, and `to: null`. Set `to` on the previous entry to today's date.
3. The changelog will pick up the spec change automatically on the next fetch.
4. Run `pnpm fetch`, commit, and push.

---

### Raider rerolls to a new character

1. Set `active: false` on the old character in their `characters` array.
2. Add the new character to the `characters` array with `active: true`.
3. Add a new entry to `role_history` for the new character with `from` set to today and `to: null`. Set `to` on the previous entry to today's date.
4. Run `pnpm fetch`, commit, and push. The changelog will log the reroll automatically.

---

### Moving a raider between main and alt team

1. Change `team_designation` on their player block to `"main"` or `"alt"`.
2. Add a `team_changed` entry to `membership_history`:

   ```json
   { "event": "team_changed", "date": "YYYY-MM-DD", "note": "Moving to alt team" }
   ```

3. Run `pnpm fetch`, commit, and push.

---

### Granting a pug exemption

If a raider has a progression-blocking pug kill but had a valid reason to miss the raid, officers can grant a retrospective exemption. This removes the warning from their raider page and marks the changelog entry as exempt.

1. Add an `exemptions` array to their player block in `roster.json`:

   ```json
   "exemptions": [
     {
       "week": "YYYY-WW",
       "granted_by": "OfficerName",
       "granted_at": "YYYY-MM-DDTHH:MM:SSZ",
       "reason": "Could not attend — personal commitment"
     }
   ]
   ```

   Replace `YYYY-WW` with the ISO week number (for example `2026-21`). Add additional objects to the array if the raider needs exemptions for multiple weeks.

2. Run `pnpm fetch`, commit, and push. The blocking warning will no longer appear on their page.

---

### Adjusting the raid schedule

The raid schedule controls when kills are considered in-raid vs blocking pugs. To change raid nights, start times, or timezone, edit the `raid_schedule` block in `roster.json`:

```json
"raid_schedule": {
  "timezone": "Europe/Paris",
  "sessions": [
    { "day": "monday", "start": "20:30", "end": "23:30", "grace_minutes": 30 },
    { "day": "wednesday", "start": "20:30", "end": "23:30", "grace_minutes": 30 }
  ],
  "safe_pug_windows": [
    { "day": "tuesday", "start": "00:00", "end": "23:59" },
    { "day": "wednesday", "start": "00:00", "end": "05:59" }
  ]
}
```

`grace_minutes` extends the window on either side of the session. `safe_pug_windows` are periods when pugging a progression boss is allowed without a warning.

---

### Adjusting M+ requirements

To change how many keys or what key level counts toward the weekly requirement, edit these fields in `roster.json`:

```json
"mplus_weekly_minimum": 4,
"mplus_minimum_key_level": 10
```

---

### Validating roster.json

Run the validation script to check for common errors before committing:

```bash
node scripts/validate-roster.mjs
```

---

## Blocking pug detection

A kill is flagged as a **blocking pug** if all of the following are true:

- The boss difficulty is `mythic`
- The kill happened outside all configured raid sessions (including grace windows)
- The kill did not fall within a `safe_pug_windows` entry
- The raider does not have an active exemption for that ISO week

Blocking pug kills appear as a warning on the raider's detail page and are logged in the changelog. They disappear automatically after the weekly reset.

Exempt kills show as a blue informational note on the raider page and are logged in the changelog separately. They do not appear as warnings.

Parse data from blocking or exempt pug kills is excluded from the boss cards, progress charts, and the raid parses table — only kills done with Relentless count.

---

## Secrets and environment variables

### Required secrets

| Secret | Where to set it | What it is |
|---|---|---|
| `WCL_CLIENT_ID` | GitHub Actions secrets + local `.env` | WarcraftLogs OAuth client ID |
| `WCL_CLIENT_SECRET` | GitHub Actions secrets + local `.env` | WarcraftLogs OAuth client secret |
| `GH_PAT` | GitHub Actions secrets only | Personal access token used by the fetch workflow to commit data and trigger the deploy workflow |

### Getting WarcraftLogs API credentials

1. Go to [https://www.warcraftlogs.com/api/clients](https://www.warcraftlogs.com/api/clients).
2. Create a new client. The redirect URI can be anything for a server-side client.
3. Copy the client ID and secret.

### Local .env file

Create `.env` at the project root:

```
WCL_CLIENT_ID=your_client_id_here
WCL_CLIENT_SECRET=your_client_secret_here
```

Do not commit this file. It is listed in `.gitignore`.

### GH_PAT permissions

The personal access token needs:

- `repo` scope (to push commits and trigger workflow dispatches)

---

## Deploying

The project is deployed to **Cloudflare Pages**. The `deploy.yml` GitHub Actions workflow builds and tests the site; Cloudflare Pages watches the `main` branch and deploys automatically on every push.

### Cloudflare Pages setup

In the Cloudflare Pages dashboard, set:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `build` |
| Root directory | `/` |

No environment variables are needed in Cloudflare Pages — all secrets are used only at fetch time in GitHub Actions.

Security headers (`X-Frame-Options`, CSP, etc.) are applied via `static/_headers`, which Cloudflare Pages reads automatically.

### Automatic deployment

Every push to `main` triggers the CI pipeline (`deploy.yml`), which:

1. Lints and type-checks the code
2. Runs unit and component tests
3. Builds the static site (`pnpm build` → `build/` directory)
4. Runs Playwright e2e tests against the built site

After CI passes, Cloudflare Pages picks up the push and deploys the built output. The fetch cron commits new data to `main` twice a day, which in turn triggers a fresh deploy — the live site reflects up-to-date data automatically.

### Manual deployment

To deploy without waiting for the cron, push any change to `main` or trigger the fetch workflow manually via Actions → Fetch Data → Run workflow.

### Build output

The build command is `pnpm build`. Output goes to `build/`. All routes are prerendered at build time from the JSON data files — the result is a folder of static HTML, CSS, and JS with no runtime server.

---

## Tests

### Unit and component tests

Run with Vitest:

```bash
pnpm test:unit
```

Watch mode:

```bash
pnpm test:unit:watch
```

### End-to-end tests

Run with Playwright against the built site:

```bash
pnpm build
pnpm test:e2e
```

### All tests

```bash
pnpm test
```

### Linting and type checking

```bash
pnpm lint
pnpm check:types
```

Fix auto-fixable lint issues:

```bash
pnpm lint:fix
```

---

## Project structure

```
relentless/
├── data/
│   ├── roster.json          # Raider list, characters, raid schedule, M+ config
│   ├── changelog.json       # Team event log
│   └── seasons/             # Fetched data snapshots, one directory per zone/season
│       ├── index.json       # Season and zone metadata
│       └── <season-id>/     # Weekly snapshots, compliance, parse data
├── scripts/
│   ├── fetch.ts             # Daily data fetch (run by cron and manually)
│   ├── backfill.ts          # Historical data fetch for past weeks
│   ├── generate-uuid.mjs    # Generates a UUID for new raider entries
│   └── validate-roster.mjs  # Validates roster.json structure
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Pure utility functions (fetch helpers, parsers, etc.)
│   │   └── styles/          # Global CSS and colour tokens
│   └── routes/
│       ├── +page.svelte         # Dashboard (home)
│       ├── +layout.svelte       # Site shell
│       ├── raider/[uuid]/       # Per-raider detail page
│       ├── season/[id]/         # Season summary page
│       └── changelog/           # Team event log page
├── e2e/                     # Playwright end-to-end tests
├── .github/workflows/
│   ├── fetch-data.yml       # Cron: fetch data, commit, trigger deploy
│   └── deploy.yml           # Build, test — Cloudflare Pages deploys on push
├── svelte.config.js         # SvelteKit config (static adapter, prerender entries)
├── biome.json               # Biome lint and format config
└── data/roster.json         # Edit this to manage the roster
```

---

## Common tasks at a glance

| Task | Command or action |
|---|---|
| Start local dev server | `pnpm dev` |
| Pull fresh data locally | `pnpm fetch` |
| Backfill historical data | `pnpm backfill` |
| Run all tests | `pnpm test` |
| Lint and format | `pnpm lint:fix` |
| Add a raider | Edit `data/roster.json`, run `pnpm fetch`, commit and push |
| Trigger a manual deploy | Push to `main` or use Actions → Run workflow |
