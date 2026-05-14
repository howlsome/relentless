# Stage 7 — Second Pass: Tooling, Architecture, and Lockout Detection

**Load with:** `00-shared-context.md`
**Goal:** Apply the four agreed refinements to the existing implementation on a new branch (`refactor/second-pass`). This is a refactor, not a from-scratch rebuild — preserve the first-pass logic where it doesn't conflict.

**Stages 0–6 are assumed already complete.** This file describes the *deltas* from the first-pass implementation.

---

## 1. Goals of this pass

1. Replace Prettier + ESLint with Biome for JS/TS/JSON formatting and linting.
2. Convert all source files to TypeScript, including `scripts/fetch.mjs` → `scripts/fetch.ts`.
3. Refactor components from props-driven (attributable) to slot/snippet-driven (composable).
4. Make every page render meaningful content without JavaScript, with controls degrading gracefully.
6. **Add raid lockout detection with exemptions** — classify every Mythic kill as `in_raid`, `safe_pug` (positive signal), `exempt_pug` (officer-granted exemption), or `blocking_pug` (serious — locks the raider out of upcoming team raids and is grounds for officer intervention). Add a `progression_block_log` so officers can record accountability conversations.

---

## 2. Tooling — Biome and tabs

### 2.1 Install Biome

Remove `prettier` and `eslint` and any related plugins from `package.json`. Install Biome:

```bash
npm uninstall prettier eslint @sveltejs/eslint-config eslint-plugin-svelte
npm install --save-dev @biomejs/biome prettier-plugin-svelte prettier
```

Yes — Prettier stays installed but only for `.svelte` files via `prettier-plugin-svelte`. Biome's Svelte support is still maturing and Prettier's plugin handles template syntax better today.

### 2.2 `biome.json`

Create at the repo root:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": ["build/", ".svelte-kit/", "node_modules/", "data/seasons/*/weeks/"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 1,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "noNonNullAssertion": "warn"
      },
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "json": {
    "formatter": {
      "indentStyle": "space",
      "indentWidth": 2
    }
  },
  "overrides": [
    {
      "include": ["**/*.yml", "**/*.yaml"],
      "formatter": {
        "indentStyle": "space",
        "indentWidth": 2
      }
    }
  ]
}
```

### 2.3 `.prettierrc` for Svelte files only

```json
{
  "plugins": ["prettier-plugin-svelte"],
  "useTabs": true,
  "tabWidth": 1,
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "overrides": [
    {
      "files": "*.svelte",
      "options": { "parser": "svelte" }
    }
  ]
}
```

### 2.4 `.prettierignore`

```
**/*.js
**/*.ts
**/*.json
**/*.md
**/*.yml
**/*.yaml
build/
.svelte-kit/
node_modules/
```

Prettier only ever sees `.svelte` files. Biome handles everything else.

### 2.5 `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,ts,svelte,mjs,cjs}]
indent_style = tab
indent_size = 1

[*.{json,yml,yaml,md}]
indent_style = space
indent_size = 2
```

### 2.6 `package.json` scripts

```json
{
  "scripts": {
    "format": "biome format --write . && prettier --write '**/*.svelte'",
    "lint": "biome check . && prettier --check '**/*.svelte'",
    "lint:fix": "biome check --write . && prettier --write '**/*.svelte'",
    "check:types": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  }
}
```

### 2.7 CI integration

Add a lint step to `.github/workflows/deploy.yml` before the build:

```yaml
- name: Lint
  run: npm run lint

- name: Type check
  run: npm run check:types
```

A failed lint or type check blocks the deploy.

---

## 3. TypeScript migration

### 3.1 Source files

All `.js` and `.mjs` files in `src/` and `scripts/` become `.ts`. The most important one:

**`scripts/fetch.mjs` → `scripts/fetch.ts`**

Run it via `tsx` in CI:

```bash
npm install --save-dev tsx
```

Update `.github/workflows/fetch-data.yml`:

```yaml
- name: Run fetch
  run: npx tsx scripts/fetch.ts
```

`tsx` runs TypeScript directly without a compile step. It is faster and simpler than `ts-node` for this use case.

### 3.2 Type definitions

Create `src/lib/types/` with one file per data shape:

- `roster.ts` — `Roster`, `Raider`, `Character`, `RoleHistoryEntry`, `MembershipHistoryEntry`
- `season.ts` — `MPlusSeason`, `RaidZone`, `SeasonIndex`
- `snapshot.ts` — `WeeklySnapshot`, `RaiderSnapshot`, `BossParse`, `DifficultyParse`
- `compliance.ts` — `ComplianceFile`, `RaiderCompliance`, `WeekCompliance`
- `changelog.ts` — `ChangelogFile`, `ChangelogEntry`, `EventType`
- `wcl.ts` — WarcraftLogs API response shapes (`ZoneRankingsResponse`, `CharacterRankings`)
- `rio.ts` — Raider.io API response shapes (`CharacterProfile`, `WeeklyRun`, `BestRun`)

Each shape is exported as both a TypeScript `interface` and a Zod schema (for runtime validation in the fetch script):

```ts
import { z } from 'zod';

export const RoleEnum = z.enum(['tank', 'healer', 'dps']);
export type Role = z.infer<typeof RoleEnum>;

export const CharacterSchema = z.object({
	name: z.string().min(1),
	realm: z.string().min(1),
	class: z.string(),
	spec: z.string(),
	role: RoleEnum,
	active: z.boolean(),
	last_seen: z.string().date().optional()
});
export type Character = z.infer<typeof CharacterSchema>;
```

### 3.3 Tests in TypeScript

All test files become `.test.ts`. Vitest needs no extra config — it handles TypeScript natively when the project has a `tsconfig.json`.

Playwright tests also become `.spec.ts`. Update `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	use: { baseURL: 'http://localhost:4173' },
	webServer: {
		command: 'npm run preview',
		port: 4173
	}
});
```

### 3.4 The fetch script's discovery types

Raider.io does not publish formal types for its API. The PRD specified the fields needed (`mythic_plus_weekly_highest_level_runs`, `mythic_plus_best_runs`, `mythic_plus_scores_by_season`), but the exact response shape needs to be confirmed by running the API once and inspecting the result.

The recommended approach:

1. Run a one-off script against a known character: `tsx scripts/probe-rio.ts Charactername Draenor`
2. Capture the response as a JSON fixture in `src/lib/types/__fixtures__/rio-response.json`
3. Define `RioCharacterProfileResponse` based on the captured shape
4. Use this fixture in the unit tests so `rio.test.ts` is realistic without making network calls

---

## 4. Composable components (Svelte 5 snippets)

### 4.1 Confirm Svelte 5

Update `package.json`:

```json
"devDependencies": {
	"svelte": "^5.0.0",
	"@sveltejs/kit": "^2.0.0"
}
```

### 4.2 The pattern

Components decompose into named parts using Svelte 5 snippets. Each part is independently exportable and testable. Example with `BossParseCard`:

**`src/lib/components/BossParseCard/index.ts`:**

```ts
export { default as Root } from './Root.svelte';
export { default as Header } from './Header.svelte';
export { default as Badge } from './Badge.svelte';
export { default as Sparkline } from './Sparkline.svelte';
export { default as Trend } from './Trend.svelte';
export { default as PersonalBest } from './PersonalBest.svelte';
export { default as DifficultySummary } from './DifficultySummary.svelte';
```

**Usage on the raider detail page:**

```svelte
<script lang="ts">
	import * as BossParseCard from '$lib/components/BossParseCard';
	import type { BossParse } from '$lib/types/snapshot';

	let { parse, history }: { parse: BossParse; history: BossParse[] } = $props();
</script>

<BossParseCard.Root>
	<BossParseCard.Header boss={parse.boss_name} spec={parse.difficulties.mythic?.spec} />
	<BossParseCard.DifficultySummary difficulties={parse.difficulties} />
	<BossParseCard.Badge parse={parse.difficulties.mythic} />
	<BossParseCard.Trend current={parse.difficulties.mythic} previous={history.at(-2)} />
	<BossParseCard.PersonalBest history={history} difficulty="mythic" />
	<BossParseCard.Sparkline data={history} difficulty="mythic" />
</BossParseCard.Root>
```

**Historical (retired character) variant uses the same parts, omits the trend:**

```svelte
<BossParseCard.Root variant="historical">
	<BossParseCard.Header boss={parse.boss_name} spec={parse.difficulties.mythic?.spec} muted />
	<BossParseCard.Badge parse={parse.difficulties.mythic} />
	<BossParseCard.PersonalBest history={history} difficulty="mythic" />
	<BossParseCard.Sparkline data={history} difficulty="mythic" />
</BossParseCard.Root>
```

No `historical={true}` prop being passed through and ignored by half the children. Each part renders what it's given.

### 4.3 Components to refactor

Every multi-part component in the existing implementation. Highest-value ones to do first:

- **`BossParseCard`** → Root, Header, Badge, Sparkline, Trend, PersonalBest, DifficultySummary
- **`StreakHero`** → Root, StreakNumber, StreakEmoji, Stats, PendingIndicator
- **`DungeonVolume`** → Root, StatCard (used 3× for this week / last week / record)
- **`RaiderTimeline`** → Root, Entry (which itself takes a snippet for icon + content)
- **`ChangelogEntry`** → Root, Icon, Description, Note
- **`MplusStatus`** → Root, Badge, NotYetTrackedPill
- **`CharacterParseSection`** → Root, Header (with snippet for character info), Body

Simple components (`RoleIcon`, `TeamDesignationBadge`, `RioScoreBadge`) stay as-is — they have a single output and no internal parts.

### 4.4 Test strategy update

Tests now target individual parts, not whole compositions:

- `BossParseCard.Badge.test.ts` — every parse percentile renders the correct colour and label
- `BossParseCard.Sparkline.test.ts` — gaps render correctly for `kill: false`
- `BossParseCard.Trend.test.ts` — ▲/▼/— for various inputs
- `BossParseCard.PersonalBest.test.ts` — gold highlight when PB is current week

Integration tests on the full composition stay, but they only need to assert "all expected parts render" — the parts have their own coverage.

---

## 5. Progressive enhancement (pragmatic)

### 5.1 Commitment

Every page renders all its data in plain HTML at build time. Interactive controls work when JavaScript is available; when it is not, the page shows a sensible default view and degrades gracefully.

**What works without JavaScript:**

- All pages render with all data visible
- All raider names, parses, charts, sparklines, tables, headers
- Navigation between pages (`/`, `/raider/[uuid]`, `/season/[id]`, `/changelog`)
- The `<details>`/`<summary>` collapsible sections (native HTML)
- Light/dark mode via OS `prefers-color-scheme` (CSS-only)

**What requires JavaScript and degrades gracefully:**

| Feature | Default state without JS |
|---|---|
| Theme toggle button | Hidden — site uses OS preference only |
| Difficulty toggle (Heroic / Mythic) | Mythic shown by default, Heroic hidden in a `<details>` |
| Designation filter (Main / Alt / All) | All raiders shown |
| Class filter dropdown | All classes shown |
| Role filter toggle | All roles shown |
| Sortable column headers | Default sort applied (RIO score descending) |
| Changelog filters | All entries shown, newest first |

### 5.2 Implementation pattern

For each interactive control, render it with `<noscript>` fallback or use the `class="js-only"` pattern with CSS:

```svelte
<script lang="ts">
	import { browser } from '$app/environment';
</script>

{#if browser}
	<button class="theme-toggle" onclick={toggleTheme}>
		Toggle theme
	</button>
{/if}
```

Filters use a Svelte 5 state runebut also accept a URL query parameter so JS-less users can manually edit the URL if needed:

```ts
import { page } from '$app/state';

let teamFilter = $state(page.url.searchParams.get('team') ?? 'all');
```

When JS is off, the URL parameter still scopes server-rendered output (since these are prerendered routes, this means a few extra static pages with different default filters — see 5.3).

### 5.3 Filter URL parameters at build time

For the few cases where a JS-less filtered view is genuinely needed (e.g. linking directly to "show me only the Main team"), prerender a small number of canonical filter combinations:

| Route | Variants prerendered |
|---|---|
| `/` | `/`, `/?team=main`, `/?team=alt` |
| `/changelog` | `/changelog`, `/changelog?event=joined`, `/changelog?event=left`, `/changelog?event=team_changed` |
| `/raider/[uuid]` | Just the default — difficulty toggle uses client-side state only |

Three or four extra static pages per route. Not the combinatorial explosion of full filter coverage, but enough that the most common deep-links work.

### 5.4 New e2e test

Add `e2e/no-javascript.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('No JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('dashboard renders all raider data', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /undaunted/i })).toBeVisible();
		// Verify at least one raider row is present
		await expect(page.locator('tbody tr')).not.toHaveCount(0);
		// Verify parse data is visible
		await expect(page.locator('[data-parse-badge]').first()).toBeVisible();
	});

	test('raider detail renders all parse cards', async ({ page }) => {
		await page.goto('/raider/a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a');
		// Verify boss parse cards render
		await expect(page.locator('[data-boss-card]').first()).toBeVisible();
		// Verify charts render (SVG sparklines)
		await expect(page.locator('svg').first()).toBeVisible();
	});

	test('changelog renders all entries', async ({ page }) => {
		await page.goto('/changelog');
		await expect(page.locator('[data-changelog-entry]').first()).toBeVisible();
	});

	test('navigation works without JS', async ({ page }) => {
		await page.goto('/');
		const raiderLink = page.locator('a[href*="/raider/"]').first();
		await raiderLink.click();
		await expect(page).toHaveURL(/\/raider\//);
	});
});
```

---

### 6.1 Why

### 6.2 Files and code to delete

### 6.3 Fields to remove from data files

- `record_highest_key` stays (officers still want to see records)

### 6.4 Fetch script changes

### 6.5 Migration

**Recommended: Option A.** Cleaner and avoids confusion when reading old data files months from now.

### 6.6 Tests to remove

### 6.7 Acceptance criteria to remove

---

## 7. Lockout detection — flag raids outside Relentless nights

### 7.1 The problem

A Mythic boss kill saves the raider to that boss's lockout for the reset. If a raider kills a boss outside Relentless's scheduled raid time, they cannot help kill it on the next Relentless night — they are locked out.

This is a serious problem for raid planning. Officers need a clear, fast warning when it happens.

### 7.2 New roster.json field

Add to the top level of `roster.json`:

```json
{
	"raid_schedule": {
		"timezone": "Europe/Paris",
		"sessions": [
			{
				"day": "monday",
				"start": "20:30",
				"end": "23:30",
				"grace_minutes": 30
			},
			{
				"day": "wednesday",
				"start": "20:30",
				"end": "23:30",
				"grace_minutes": 30
			}
		],
		"safe_pug_windows": [
			{
				"day": "tuesday",
				"start": "00:00",
				"end": "23:59"
			},
			{
				"day": "wednesday",
				"start": "00:00",
				"end": "05:59"
			}
		]
	}
}
```

### About the timezone

Relentless uses **server time** for raid scheduling, which on EU realms is **CET/CEST** (Central European Time). This is **one hour ahead of London** (BST/GMT) — so 20:30 server = 19:30 in the UK. The IANA timezone string for this is `"Europe/Paris"`, which handles CET ↔ CEST transitions automatically and matches how WoW's EU servers display time in-game.

Using server time in the config matches what the raid leader sees in-game, avoiding error-prone mental conversion. All times in `sessions[]` and `safe_pug_windows[]` are interpreted in this timezone.

### About the schedule

Sessions run **20:30 to 23:30 server time** (19:30–22:30 BST for UK players) — three hours of scheduled raiding on Mondays and Wednesdays. The 30-minute `grace_minutes` covers two real-world cases:

1. The team is mid-pull as the session ends and continues to a kill — adding 30 minutes pushes the effective end to 24:00 server (midnight). This is the "progression extension" rule.
2. The team starts a few minutes early or late — the grace covers a 20:00 early start or a 23:50 late finish.

So the practical "in-raid" window each session day is **20:00–24:00 server time**.

### About the EU reset and safe-pug windows

EU realms reset at **04:00 UTC every Wednesday**, which is **06:00 server time** (05:00 BST). After the reset, all Mythic raid lockouts clear, so a kill that happened *before* the reset doesn't carry over.

`safe_pug_windows[]` defines time ranges outside raid hours where Mythic kills are explicitly safe — they do not lock the raider out of any upcoming team raid this week. Each entry is a `{ day, start, end }` triple, all in the configured timezone.

For Undaunted: Relentless, the safe-pug window covers:

- **All of Tuesday server time** (the natural pug day — Monday's raid is done, Wednesday morning's reset will clear any lockout before Wednesday evening's raid).
- **Wednesday 00:00–05:59 server** (the degenerate-hours window — these kills are after Monday's raid but still before the 06:00 reset, so the reset clears them before that evening's raid).

This naturally captures both the "Tuesday is safe to pug" rule and the "late Monday/early Wednesday-morning degenerates" rule without needing a Monday-late window. Anything that happens before midnight on Monday is either inside the session-plus-grace (in-raid) or outside everything (progression-blocking pug).

All other times outside session windows are flagged as progression-blocking pugs — kills before raid on Mon or Wed, anytime Wed after raid through Sun.

A window with `start: "00:00"` and `end: "23:59"` covers the full day. Multiple windows on the same day are supported. Windows cannot cross midnight — split them into two entries.

- `timezone`: IANA timezone string. The cron converts kill timestamps from UTC into this timezone before comparing.
- `sessions[]`: each entry defines a recurring weekly raid window.
- `day`: lowercase weekday name. Always lowercase, always English.
- `start` / `end`: 24-hour `HH:MM` strings in the configured timezone.
- `grace_minutes`: extra time on either side of the session window to account for early starts and late finishes. A 30-minute grace means a session of 20:00–23:30 is treated as 19:30–24:00 for lockout-detection purposes.

If `raid_schedule` is missing or has an empty `sessions` array, lockout detection is disabled — the cron logs a warning once and does not flag anything.

### 7.3 When detection runs

Lockout detection runs **as part of the daily cron fetch** — there is no separate workflow or schedule. After the fetch script has collected raid parse data for a raider, it performs the lockout check inline as the final step before writing the snapshot file. This means:

- The check runs once per day, in lockstep with the rest of the data fetch.
- New lockout warnings appear on the dashboard the morning after they happen (a Tuesday-afternoon Mythic kill shows up in Wednesday morning's snapshot, in time for officers to plan around it before that night's raid).
- No separate API calls are needed — the kill timestamps come from the same WCL responses the script is already fetching.
- The check adds negligible runtime — it is a pure date/time comparison against the in-memory schedule, no I/O.

If the cron is triggered manually mid-day (via **Actions → Fetch data → Run workflow**), the lockout check runs again with the latest kill data — useful for spot-checking before a raid night.

### 7.4 Detection logic

In `scripts/fetch.ts`, after collecting raid parse data for a raider:

For every Mythic kill recorded this reset week:

1. Get the kill's `startTime` (UTC) from the WCL response.
2. Convert it to the configured `raid_schedule.timezone`.
3. Classify the kill into one of four categories using **first-match wins** order:
   - **`in_raid`** — the kill falls inside a `sessions[]` window expanded by `grace_minutes`. Check this first.
   - **`safe_pug`** — the kill is outside every session window, but falls inside one of the `safe_pug_windows[]` entries (matched by day + time range). Check this second.
   - **`exempt_pug`** — the kill would have been a `blocking_pug`, but the raider has an active `exemption` for that ISO week covering one or more raid nights this week. Check this third.
   - **`blocking_pug`** — fallback when none of the above match. This kill locks the raider out of an upcoming Relentless raid and directly damages team progression. This is the most serious category and signals behaviour officers should address with the raider — repeat offences can result in removal from the team.

**The four categories are mutually exclusive.** A Mythic kill is exactly one of `in_raid`, `safe_pug`, `exempt_pug`, or `blocking_pug`.

Stage 7 covers Mythic only. The Heroic / Normal classification (which uses softer mechanics because Heroic locks per boss, not per raid ID) is built on top of this in **Stage 8 — Heroic Lockout Advisory & Multi-Spec Tracking**.

**Why four categories instead of three:** Real-life conflicts happen and raiders sometimes need to skip a week. When an officer grants permission in advance, the kill that follows is not the raider's fault. Lumping it in with `blocking_pug` would unfairly penalise raiders who communicated responsibly; lumping it in with `safe_pug` would lose the context that the raider had to be exempted. `exempt_pug` is a separate category so officers can see at a glance whether a kill outside raid hours was excused or not.

**Exemption matching rules:**
- The exemption's `week` field must exactly match the ISO week of the kill.
- The exemption's `raid_nights_excused[]` array must contain *at least one* of the raid nights that fall in that ISO week. The exemption does not need to cover every raid night — if a raider is excused from Monday but attends Wednesday, a Tuesday-night pug is still `exempt_pug` (they had legitimate cause to be playing outside team time that week).
- If multiple exemption entries exist for the same week, the most recent (by `granted_at`) is authoritative — earlier ones are treated as superseded.

**Time window matching for `safe_pug_windows`:** a kill is in the window if its local time is `>= start` AND `<= end` on the matching day. No grace is applied to safe-pug windows — officers set the exact boundary themselves. A Monday 23:15 window starts precisely at 23:15:00 local time.

### 7.5 Data model changes

Add to each kill entry in the weekly snapshot file:

```json
{
	"boss_id": 2902,
	"boss_name": "Solanar the Dawnbreaker",
	"difficulties": {
		"mythic": {
			"kill": true,
			"parse_percentile": 74,
			"spec": "Unholy",
			"dps": 1284500,
			"kill_time": "2026-05-16T21:14:00Z",
			"kill_category": "in_raid",
			"detected_session": "monday 20:30-23:30 server"
		}
	}
}
```

- `kill_time`: ISO timestamp of the kill, copied from WCL.
- `kill_category`: one of `"in_raid"`, `"safe_pug"`, `"exempt_pug"`, or `"blocking_pug"`. Determined by the detection logic above. Heroic and Normal kills use a separate classifier (Stage 8) and have their own category values.
- `detected_session`: the matching session description (e.g. `"monday 19:30-23:00"`) if `kill_category` is `"in_raid"`; otherwise `null`.

For Heroic and Normal difficulty kills, only `kill_time` is recorded — `kill_category` and `detected_session` are omitted entirely since lockout detection does not apply.

### 7.6 Per-raider summary fields

Add two top-level arrays to each raider entry in `snapshot.json`:

```json
"lockout_warnings": [
	{
		"boss_id": 2902,
		"boss_name": "Solanar the Dawnbreaker",
		"difficulty": "mythic",
		"kill_time": "2026-05-14T14:22:00Z",
		"detected_local_time": "Thursday 16:22 server (15:22 BST)",
		"reason": "Outside all configured raid sessions and not in a safe-pug window — this kill locks the raider out of an upcoming Relentless raid"
	}
],
"safe_pug_kills": [
	{
		"boss_id": 2903,
		"boss_name": "Veluna the Skyrender",
		"difficulty": "mythic",
		"kill_time": "2026-05-12T21:14:00Z",
		"detected_local_time": "Tuesday 23:14 server (22:14 BST)"
	}
]
```

- **`lockout_warnings`** lists `blocking_pug` kills only. Empty when none — this is the "officers must act" array.
- **`safe_pug_kills`** lists `safe_pug` kills only. Empty when none — this is the "raider chose to progress on their own time" array, shown as positive engagement.

Officers see both immediately at the top of the raider's detail page.

### 7.7 UI — dashboard banners

Two banners are surfaced on the dashboard, with very different visual weight.

#### Progression-blocking warning banner

When at least one raider has a `blocking_pug` kill this week, show a prominent red banner at the top of the dashboard. The tone is deliberately serious — this category covers behaviour that directly damages team progression and can be grounds for removal from the team:

```
🚨 2 raiders have killed Mythic bosses outside team raid times in a way that blocks Relentless progression this week. Officers should review immediately.
```

The banner is a button. Tapping it expands a list:

```
🚨 Progression-blocking pugs this week:

• Playername — Solanar the Dawnbreaker (Mythic) — killed Thu 16:22 server / 15:22 BST (locks raider out of next Mon/Wed raid)
• Otherperson — Veluna the Skyrender (Mythic) — killed Sat 22:00 server / 21:00 BST (locks raider out of next Mon raid)
```

Each entry links to that raider's detail page. The banner is dismissible by tapping a close button — the dismissal is stored in `sessionStorage` and clears when the tab is closed. Officers see the warning again the next time they visit until the next cron run clears it (or until they have a conversation with the raider in question).

#### Incentivised-to-progress banner (safe pugs)

When at least one raider has a `safe_pug` kill this week, show a positive green banner directly beneath the lockout banner (or at the top if there are no lockout warnings):

```
🌱 3 raiders have pugged Mythic on their own time this week — showing initiative without affecting team plans.
```

Tapping it expands a list:

```
🌱 Safe pugs this week:

• Playername — Veluna the Skyrender (Mythic) — Tuesday 23:14 server / 22:14 BST
• Anotherperson — Solanar the Dawnbreaker (Mythic) — Tuesday 21:45 server / 20:45 BST
```

This banner is **not dismissible** — it is meant to encourage and celebrate, not warn. It only disappears when the next cron run brings new data showing no safe pugs that week.

If a raider has both safe and progression-blocking pugs this week, they appear in both banners. The progression-blocking kill is the one that needs officer action; the safe kill is positive context.

The Heroic pug advisory banner is built in Stage 8 — see that stage for the soft heads-up that surfaces repeated loot-slot-depriving behaviour without escalating to a warning.

### 7.8 UI — raider detail page

The raider identity header can gain up to three status badges beneath the existing M+ status and team designation badges:

- **`🚨 Progression-blocking pug`** — red badge with serious framing, shown when `lockout_warnings` is non-empty. This badge signals behaviour officers should address directly with the raider.
- **`ℹ️ Exempt this week`** — neutral grey badge, shown when `exempt_pug_kills` is non-empty OR when the raider has an active exemption for the current ISO week (even with no pug kills). Includes the exemption reason in the badge tooltip.
- **`🌱 Progress pugging`** — green badge, shown when `safe_pug_kills` is non-empty.

All three can be shown simultaneously. If all are empty and there is no active exemption, no extra badges render.

#### Progression-blocking pug callout

If `lockout_warnings` is non-empty, show a red callout below the identity header, before the M+ gamification panel. The copy is direct about the consequences:

```
🚨 Progression-blocking pug this reset

This raider killed Mythic boss(es) outside team raid times without permission, locking them out of upcoming Relentless raid nights. This directly damages team progression and is a serious issue that officers should address with the raider:

• Solanar the Dawnbreaker — killed Thursday 16:22 server / 15:22 BST. Locked out of next Mon and Wed raids until reset.

Prior progression-blocking pugs in the last 4 weeks: 1.
Repeated progression-blocking pugs can result in removal from the raid team.

[Log officer review] [Add retrospective exemption]
```

- The "Prior progression-blocking pugs in the last 4 weeks" line is rendered from `prior_blocks_last_4_weeks` in the kill entry. If the count is 0, this line and the "Repeated..." sentence are hidden — the callout still appears but with softer framing.
- The escalation phrase ("Repeated progression-blocking pugs can result in removal") is shown only when `prior_blocks_last_4_weeks` ≥ 1.
- **`[Log officer review]`** is a link that copies a pre-filled JSON snippet to the clipboard, which officers paste into the `progression_block_log` array in `roster.json`. This avoids forcing officers to remember the schema by heart. The snippet pre-fills `week`, `boss`, and `kill_time_server` from the snapshot; officers fill in `officer_review`, `reviewed_by`, and `reviewed_at`.
- **`[Add retrospective exemption]`** is a similar link that copies a pre-filled `exemption` entry to the clipboard for cases where the officer realises after the fact that the raider had a legitimate conflict.

These are *help* features — they generate the JSON for officers to paste, not direct edits. The site is read-only — all writes still happen via Git.

#### Exempt pug callout

If `exempt_pug_kills` is non-empty, show a neutral grey callout below the progression-blocking one (or in its place if there are no blocking pugs):

```
ℹ️ Exempt pugs this reset

This raider has an active exemption granted by Officername (Family wedding — gave 2 weeks notice). The following Mythic kills happened during the exempt period:

• Helya the Twiceborn — killed Monday 21:00 server (excused from Mon raid)
```

The exemption reason and granter are shown verbatim from the `exemption` entry. Officers can verify at a glance that the exemption matches their records.

#### Safe-pug callout

If `safe_pug_kills` is non-empty, show a green callout below the lockout callout (or in its place if there are no lockout warnings):

```
🌱 Progress pugging this week

This raider pugged the following Mythic boss(es) in a safe window — they showed initiative without affecting team plans:

• Veluna the Skyrender — killed Tuesday 23:14 server / 22:14 BST
• Solanar the Dawnbreaker — killed Wednesday 03:42 server / 02:42 BST (degenerate hours, but clears at reset before that evening's raid)
```

#### Per-boss card indicators

Each boss row also gets a small icon on its parse card reflecting the most recent kill's category:

- `🚨` red — most recent Mythic kill was a `blocking_pug` (progression-blocking, unexcused)
- `ℹ️` neutral grey — most recent Mythic kill was an `exempt_pug` (excused by officer)
- `🌱` green — most recent Mythic kill was a `safe_pug` (in a safe-pug window)
- (no icon) — most recent kill was `in_raid` or no Mythic kill this week

Hover/tap-and-hold shows a tooltip with the kill's local time, category reasoning, and (for exempt kills) the exemption reason.

### 7.9 No false positive on Heroic

Lockout detection runs **only** for Mythic difficulty kills. Heroic and Normal raids are flexible lockouts (cross-realm groups, no shared save) and raiders can freely pug them without affecting the next Relentless night. The fetch script only sets `in_team_raid` and adds to `lockout_warnings` for kills where `difficulty === "mythic"`.

### 7.10 Edge cases

| Case | Handling |
|---|---|
| Kill exactly at session boundary | Grace minutes cover this — a 30-minute grace makes boundaries fuzzy enough |
| Raid ran late (e.g. 23:45) | Grace minutes cover this — set generously |
| CET → CEST or CEST → CET transition | IANA timezone (`Europe/Paris`) handles this automatically via `Intl.DateTimeFormat` or `date-fns-tz` |
| Multiple kills on the same boss in the same reset | Only the first kill counts toward lockout — subsequent attempts in the same week are normal |
| Make-up raid on an unscheduled day | Officer adds a one-off session entry to `raid_schedule.sessions` before the next cron run, then removes it afterwards. Alternatively, accept the false positive — the officer can dismiss the warning manually on the dashboard |
| Officer leaves `raid_schedule` field out entirely | Lockout detection is disabled, no flags ever raised, cron logs a warning once |
| Empty `sessions` array | Same as missing — feature disabled |
| Empty `safe_pug_windows` array | Valid — all out-of-session kills are `blocking_pug`. No "incentivised to progress" indicators are ever surfaced |
| `safe_pug_windows` field missing entirely | Treated as empty array — no safe pugs, all out-of-session kills are flagged progression-blocking |
| Overlap between a `safe_pug_windows` entry and a session on the same day | First-match wins (session is checked first). A Monday 21:00 kill is `in_raid` even if a Monday 19:30–23:59 safe-pug window also exists. A Monday 23:30 kill is `safe_pug` (outside the session-plus-grace window of 19:00–23:30, inside a 23:15–23:59 safe-pug window) |
| Safe-pug window crossing midnight | Not supported. Officers split into two entries (e.g. Monday 23:15–23:59 + Tuesday 00:00–06:00) |
| Multiple safe-pug windows on the same day | Supported — kill is `safe_pug` if it falls in any of them |
| Safe-pug window `start >= end` | Cron logs a warning and ignores that window (treats it as zero-length) |

### 7.11 Tests

New unit tests in `src/lib/utils/lockout.test.ts`:

**`classifyKill(killTime, schedule)` — the three-category classifier:**

All times below are server time (CET/CEST, `Europe/Paris`) unless marked otherwise.

Schedule fixture used throughout:
```
sessions:           Mon 20:30–23:30 (+30min grace), Wed 20:30–23:30 (+30min grace)
                    Effective in-raid window: Mon 20:00–24:00, Wed 20:00–24:00 server
safe_pug_windows:   Tue 00:00–23:59, Wed 00:00–05:59
```

`in_raid` cases:
- Mon 21:00 server kill → `in_raid` (mid-session)
- Wed 22:30 server kill → `in_raid` (mid-session)
- Mon 23:55 server kill → `in_raid` (progression extension — inside grace 23:30→24:00)
- Wed 23:59 server kill → `in_raid` (last minute of grace)
- Mon 20:05 server kill → `in_raid` (within 30-minute grace before 20:30 start)
- Mon 20:30 server kill → `in_raid` (exactly at session start)
- Mon 23:30 server kill → `in_raid` (exactly at session end, inside grace)
- Mon 23:59 server kill → `in_raid` (one minute before grace ends at 24:00)

`safe_pug` cases:
- Tue 00:00 server kill → `safe_pug` (first minute of Tuesday — Mon raid done, Wed reset clears)
- Tue 03:00 server kill → `safe_pug` (early morning Tuesday)
- Tue 12:00 server kill → `safe_pug` (mid-Tuesday)
- Tue 21:00 server kill → `safe_pug` (Tuesday evening)
- Tue 23:59 server kill → `safe_pug` (last minute of Tuesday)
- Wed 00:00 server kill → `safe_pug` (first minute of Wednesday — still before 06:00 reset)
- Wed 02:30 server kill → `safe_pug` (degenerate hours — Wed early morning, before reset)
- Wed 05:59 server kill → `safe_pug` (one minute before reset)

`blocking_pug` cases:
- Mon 15:00 server kill → `blocking_pug` (before session, before grace)
- Mon 19:59 server kill → `blocking_pug` (one minute before grace starts at 20:00)
- Wed 06:00 server kill → `blocking_pug` (exactly at reset — but this kill is AFTER the reset cleared old lockouts, so it now blocks Wed evening's raid)
- Wed 12:00 server kill → `blocking_pug` (Wed afternoon, before Wed raid — locks out that evening)
- Wed 19:59 server kill → `blocking_pug` (one minute before Wed grace starts)
- Thu 03:00 server kill → `blocking_pug` (Thu early morning — locks out next Mon raid)
- Thu 21:00 server kill → `blocking_pug` (no session, no safe-pug window)
- Fri 12:00 server kill → `blocking_pug`
- Sat 22:00 server kill → `blocking_pug`
- Sun 21:00 server kill → `blocking_pug`

**Crucial boundary check — the Wed 05:59 → 06:00 transition:**
- Wed 05:59 server is the last `safe_pug` minute (lockout will clear at reset)
- Wed 06:00 server is the first `blocking_pug` minute (reset cleared at this moment; any new kill locks the raider out of that evening's raid)
- The test must specifically assert this boundary, since it's the most subtle case in the spec

**Exemption tests:**
- Returns `"exempt_pug"` for a Mon 15:00 kill when an active exemption for that week excuses Monday
- Returns `"exempt_pug"` for any kill in the exempt week, regardless of which day, as long as `raid_nights_excused` contains at least one raid night in that week
- Returns `"blocking_pug"` for a kill in a week with no active exemption
- Returns `"blocking_pug"` for a kill in a week where exemption exists but `raid_nights_excused` is empty
- Returns `"blocking_pug"` for an exemption with an empty `reason` (warning logged)
- Most recent exemption (by `granted_at`) wins when multiple exist for the same week
- An exemption added retrospectively reclassifies the kill on the next snapshot rewrite

**Priority and edge tests:**
- First-match-wins: if `sessions[]` and `safe_pug_windows[]` ever overlap, sessions win and kill is `in_raid`. With the configured schedule no overlap exists (Mon session+grace ends at 23:00, safe-pug starts at 23:15), but the implementation must support it
- Heroic and Normal kills: classifier returns `null` if difficulty is not `"mythic"`
- CET/CEST transition: a kill at 21:00 CEST = 19:00 UTC is correctly classified by its local server time (21:00 server = mid-Monday-session)
- Daylight saving transition weekends: a Mon raid in the week of clock change still classifies correctly because IANA handles the transition
- Feature disabled: empty `sessions` array → returns `"in_raid"` for all kills (no warnings ever raised)
- Feature disabled: undefined `schedule` → returns `"in_raid"` for all kills
- Empty `safe_pug_windows`: all out-of-session kills classify as `blocking_pug`
- Grace minutes are applied to both start and end of session windows but NOT to safe-pug windows
- Two adjacent session windows on the same day: a kill between them outside both is `blocking_pug`
- Safe-pug window with `start >= end`: window is ignored (treated as zero-length), warning logged
- Multiple safe-pug windows on the same day: kill in any of them is `safe_pug`

**`getKillCategoryCounts(raider)` — summary helper:**

- Returns `{ in_raid: 0, safe_pug: 0, blocking_pug: 0 }` for a raider with no Mythic kills this week
- Correctly counts kills across multiple bosses
- Heroic kills are excluded from the totals

New component tests:

- `ProgressionBlockingBanner.test.ts` — shown only when at least one raider has `blocking_pug` kills, dismissible via `sessionStorage`, lists raiders with kill times
- `SafePugBanner.test.ts` — shown only when at least one raider has `safe_pug` kills, not dismissible, lists raiders with kill times
- `ExemptPugBanner.test.ts` — shown only when at least one raider has `exempt_pug` kills, not dismissible, lists exemption reasons and granters
- `ProgressionBlockingBadge.test.ts` (raider header) — red `🚨 Progression-blocking pug` shown only when `lockout_warnings` is non-empty
- `SafePugBadge.test.ts` (raider header) — green `🌱 Progress pugging` shown only when `safe_pug_kills` is non-empty
- Both badges render simultaneously when both arrays are non-empty
- `ProgressionBlockingCallout.test.ts` (raider detail) — lists each `blocking_pug` kill with local time; shows the "removal from team" reminder when `prior_blocks_last_4_weeks` ≥ 1; renders the [Log officer review] and [Add retrospective exemption] clipboard helpers
- `ExemptPugCallout.test.ts` (raider detail) — renders only when `exempt_pug_kills` is non-empty; shows the exemption reason and granter verbatim
- `ExemptBadge.test.ts` — shown when there is an active exemption for the current ISO week, even if no pug kills exist; tooltip contains the exemption reason
- `SafePugCallout.test.ts` (raider detail) — lists each `safe_pug` kill with local time
- Per-boss-card indicator renders `⚠️` for `blocking_pug`, `🌱` for `safe_pug`, nothing for `in_raid`

New e2e tests in `lockout.spec.ts`:

- Dashboard renders the progression-blocking banner when fixture data contains `blocking_pug` kills
- Dashboard renders the safe-pug banner when fixture data contains `safe_pug` kills
- Dashboard renders both banners when both kill types are present
- Dashboard renders neither banner when all kills are `in_raid`
- Raider detail page renders the appropriate callouts for each kill category
- Per-boss-card indicators match the kill category from fixture data
- The safe-pug banner is not dismissible (no close button rendered)
- The progression-blocking banner is dismissible and the dismissal persists across page navigation within the session
- The "removal from team" reminder text appears on a raider detail page when the raider has 2+ blocking pugs across the last 4 weeks

---

## 8. Acceptance criteria for this stage

- [ ] Biome formats all `.ts`, `.js`, `.json`, `.yml` files; Prettier formats only `.svelte` files
- [ ] `.editorconfig` correctly applies tabs to source and spaces to JSON/YAML
- [ ] All source files are TypeScript (`.ts`) — no remaining `.js` or `.mjs` outside config files
- [ ] All test files are TypeScript (`.test.ts` / `.spec.ts`)
- [ ] `scripts/fetch.ts` runs via `tsx` in CI without compile errors
- [ ] All complex components are split into composable parts via Svelte 5 snippets
- [ ] Every page renders meaningful content with JavaScript disabled (verified by `no-javascript.spec.ts`)
- [ ] Interactive controls (toggles, filters) are hidden or default-stated when JavaScript is disabled
- [ ] `raid_schedule` field exists in `roster.json` with `sessions[]` and `safe_pug_windows[]`
- [ ] Mythic kills are classified into exactly one of `in_raid`, `safe_pug`, or `blocking_pug` using first-match-wins order
- [ ] `blocking_pug` kills appear in `lockout_warnings`; `safe_pug` kills appear in `safe_pug_kills`; `in_raid` kills appear in neither array
- [ ] Heroic and Normal kills are never classified — only Mythic difficulty triggers lockout logic
- [ ] A Mon 23:55 server kill (progression extension at 22:55 BST) correctly classifies as `in_raid` via the 30-minute grace
- [ ] A Wed 05:59 server kill correctly classifies as `safe_pug` (clears at 06:00 reset)
- [ ] A Wed 06:00 server kill correctly classifies as `blocking_pug` (after reset, locks out Wed evening raid)
- [ ] All times in `roster.json` are interpreted in `Europe/Paris` (server time, CET/CEST) by default, not London time
- [ ] The EU reset at 06:00 server (04:00 UTC) is correctly used as the boundary between safe and progression-blocking pugs on Wednesday morning
- [ ] Dashboard progression-blocking banner (red, serious tone) appears when at least one raider has `blocking_pug` kills
- [ ] Dashboard safe-pug banner (green) appears when at least one raider has `safe_pug` kills
- [ ] The safe-pug banner is not dismissible — only the lockout warning banner is
- [ ] Raider detail page shows both the progression-blocking and safe-pug badges and callouts when both categories are present
- [ ] The "repeated progression-blocking pugs can result in removal" reminder appears on the raider detail callout when a raider has had more than one blocking pug across the last 4 weekly snapshots
- [ ] Per-boss-card indicators correctly show `🚨` for blocking, `🌱` for safe pug, or nothing for in-raid
- [ ] Grace minutes on session windows are correctly applied to both start and end
- [ ] Grace minutes are NOT applied to safe-pug windows (officers set the exact boundary)
- [ ] IANA timezone conversion handles BST/GMT transition without false positives
- [ ] Lockout detection is disabled (with a single warning log) when `raid_schedule` is missing or empty
- [ ] A safe-pug window with `start >= end` is ignored and logs a warning
- [ ] An active `exemption` for a week reclassifies that week's `blocking_pug` kills to `exempt_pug`
- [ ] Exemptions require a non-empty `reason`, `granted_by`, and `granted_at` — missing fields produce a cron warning
- [ ] The most recent exemption (by `granted_at`) wins when multiple exist for the same week
- [ ] Retrospectively added exemptions correctly reclassify kills in the next snapshot rewrite
- [ ] `progression_block_log` entries are append-only — the cron never modifies existing entries
- [ ] The `prior_blocks_last_4_weeks` count on each `lockout_warnings` entry is computed correctly from history
- [ ] The escalation phrase ("Repeated progression-blocking pugs can result in removal") appears only when `prior_blocks_last_4_weeks` ≥ 1
- [ ] Clipboard helpers for "Log officer review" and "Add retrospective exemption" generate correctly pre-filled JSON snippets
- [ ] All existing tests still pass after the refactor
- [ ] Lint and type check pass with zero errors
