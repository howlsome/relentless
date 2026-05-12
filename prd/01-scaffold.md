# Stage 1 — Project Scaffold & CI/CD

**Load with:** `00-shared-context.md`
**Goal:** Bootstrap the SvelteKit project, repository structure, and GitHub Actions workflows so subsequent stages have a working foundation.

**Don't build yet:**
- Data fetch logic (Stage 2)
- Frontend components beyond basic routing scaffolding (Stages 3–4)
- Tests beyond a smoke test that the build succeeds (Stage 5)

**Deliverables for this stage:**
- `package.json` with all dependencies pinned
- SvelteKit project with `adapter-static`
- PicoCSS imported in the base layout
- Empty placeholder routes
- `.github/workflows/fetch-data.yml` (skeleton — no fetch logic yet)
- `.github/workflows/deploy.yml`
- `data/roster.json` with a single example player so the build doesn't fail on missing data
- `data/seasons/index.json` with placeholder content
- Smoke test: `npm run build` succeeds

---

## 6. Repository Structure

```
/
├── .github/
│   └── workflows/
│       ├── fetch-data.yml        # Cron: runs fetch script daily
│       └── deploy.yml            # Deploys SvelteKit static build to gh-pages
├── scripts/
│   └── fetch.mjs                 # Node.js data-fetching script
├── data/
│   ├── roster.json                        # Source of truth: manually edited
│   ├── raider-history.json                # Character/role history (written by cron)
│   ├── changelog.json                     # Team composition changelog (written by cron)
│   └── seasons/
│       ├── index.json                     # Active season IDs + all known seasons (written by cron)
│       ├── midnight-s1/                   # M+ season — keyed by mplus_seasons[].season_id
│       │   ├── snapshot.json              # Latest M+ fetch for this season
│       │   ├── compliance.json            # Weekly M+ compliance history
│       │   └── weeks/
│       │       └── YYYY-WW.json           # One file per ISO week
│       └── raid-46/                       # Raid tier — keyed by "raid-{wcl_zone_id}" (auto-created)
│           ├── meta.json                  # Zone name, boss list, difficulties (written by cron)
│           ├── snapshot.json              # Latest raid parse fetch for this zone
│           └── weeks/
│               └── YYYY-WW.json          # One file per ISO week
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── RosterTable.svelte
│   │   │   ├── BossParseChart.svelte
│   │   │   ├── MplusStatus.svelte
│   │   │   └── RioScoreBadge.svelte
│   │   └── utils/
│   │       ├── wcl.mjs           # WCL GraphQL helpers
│   │       └── rio.mjs           # Raider.io REST helpers
│   └── routes/
│       ├── +layout.svelte        # Global nav + PicoCSS import
│       ├── +page.svelte          # Dashboard home
│       ├── changelog/
│       │   └── +page.svelte      # Team changelog
│       ├── season/[season_id]/
│       │   └── +page.svelte      # Season archive
│       └── raider/[uuid]/
│           └── +page.svelte      # Per-raider detail page
├── static/
├── roster.json -> data/roster.json  (symlink or copy)
├── svelte.config.js
├── vite.config.js
└── package.json
```

---

## 8. GitHub Actions Workflows

### 8.1 `fetch-data.yml` — Daily cron

```
Schedule: cron '0 6 * * *'
Also: workflow_dispatch (manual trigger)
```

**Steps:**

1. Checkout repo with `persist-credentials: true`.
2. Set up Node.js (LTS).
3. `npm ci` in `scripts/`.
4. Run `node scripts/fetch.mjs`.
5. The script writes `data/seasons/{season_id}/snapshot.json` and `data/seasons/{season_id}/weeks/YYYY-WW.json` for each active season.
6. Git commit `data/` with message `chore: data snapshot YYYY-MM-DD`.
7. Push to `main`.
8. Trigger the deploy workflow.

**Secrets required:**

| Secret name | Value |
|---|---|
| `WCL_CLIENT_ID` | WarcraftLogs API v2 client ID |
| `WCL_CLIENT_SECRET` | WarcraftLogs API v2 client secret |
| `GH_PAT` | Personal access token with `repo` scope (for push + trigger) |

Raider.io public endpoints do not require an API key.

### 8.2 `deploy.yml` — Build and deploy

Triggered on push to `main` (or by fetch workflow).

1. Checkout.
2. `npm ci`.
3. `npm run build` (`adapter-static`).
4. Deploy `build/` to `gh-pages` branch using `peaceiris/actions-gh-pages`.

---

## 15. Routing and Static Generation

SvelteKit `adapter-static` with `prerender = true` on all routes. Prerender entries cover all raider UUIDs and all season IDs:

```javascript
// svelte.config.js
prerender: {
  entries: [
    '*',
    '/changelog',
    ...raiderIds.map(id => `/raider/${id}`),
    ...seasonIds.map(id => `/season/${id}`),
  ]
}
```

`raiderIds` and `seasonIds` are read from `data/seasons/index.json` at build time.

**Route structure:**

| Route | Purpose |
|---|---|
| `/` | Dashboard — current season |
| `/raider/[uuid]` | Raider detail — current season by default, season selector available |
| `/season/[season_id]` | Season archive — historical dashboard view for a past season |
| `/changelog` | Full team changelog — filterable by team, event type, and date range |

The build must produce a fully static site with no server-side rendering at request time.

---

