# Stage 6 — Tests & CI Integration

**Load with:** `00-shared-context.md` plus whichever earlier stage files cover the code under test (typically `02-data-layer.md`, `03-fetch-script.md`, `04-frontend-foundations.md`, `05-frontend-pages.md`).
**Goal:** Achieve full test coverage as specified in section 19, wire it all into the GitHub Actions deploy workflow so failing tests block deploys.

**Build:**
- All Vitest unit tests listed in section 19.2
- All component tests listed in section 19.3 (using `@testing-library/svelte`)
- All Playwright e2e tests listed in section 19.4 (using fixture data, not live APIs)
- Test fixtures: a complete set of valid `data/` files for e2e tests to read
- `axe-core` accessibility audit integrated into Playwright suite
- CI integration as specified in section 19.5 — tests must run and pass before deploy

**Don't build:**
- Any production code (should already exist from earlier stages)
- Manual QA scripts — automated tests cover everything

**Acceptance for this stage:**
- `npm run test:unit` passes with zero failures
- `npx playwright test` passes with zero failures against `npm run preview`
- `axe-core` reports zero WCAG 2.1 AA violations on dashboard and raider detail
- A deliberately broken commit (e.g. removing a required field from a component) makes the deploy workflow fail
- Test coverage hits all the cases enumerated in section 19

---

## 19. Tests

Testing is split across three layers: unit tests for pure logic, component tests for UI behaviour, and end-to-end tests for critical user journeys. The project uses **Vitest** (unit + component) and **Playwright** (e2e) — both integrate natively with SvelteKit.

### 19.1 Setup

```
src/
  lib/
    utils/
      parse-colours.test.ts     # Unit tests
      wcl.test.ts
      rio.test.ts
      roster.test.ts
    components/
      BossParseChart.test.ts    # Component tests
      MplusStatus.test.ts
      RosterTable.test.ts
scripts/
  fetch.test.mjs                # Fetch script unit tests
e2e/
  dashboard.spec.ts             # Playwright e2e
  raider-detail.spec.ts
  theme.spec.ts
  accessibility.spec.ts
```

### 19.2 Unit tests (`vitest`)

**`parse-colours.test.ts`**
- `getParseColour(0)` → `"var(--parse-gray)"`
- `getParseColour(24)` → `"var(--parse-gray)"`
- `getParseColour(25)` → `"var(--parse-green)"`
- `getParseColour(49)` → `"var(--parse-green)"`
- `getParseColour(50)` → `"var(--parse-blue)"`
- `getParseColour(74)` → `"var(--parse-blue)"`
- `getParseColour(75)` → `"var(--parse-purple)"`
- `getParseColour(94)` → `"var(--parse-purple)"`
- `getParseColour(95)` → `"var(--parse-orange)"`
- `getParseColour(98)` → `"var(--parse-orange)"`
- `getParseColour(99)` → `"var(--parse-pink)"`
- `getParseColour(100)` → `"var(--parse-tan)"`
- `getParseColour(null)` → `null` (no kill)
- `getBadgeTextColour("#0070ff")` → `"#000000"` (black passes AA)
- `getBadgeTextColour("#a335ee")` → `"#ffffff"` (white passes AA)
- All 7 original WCL hex codes are exported as named constants and match the official values

**`roster.test.ts`**
- `getActivePlayers(roster)` returns only players with `status === "active"` or no status field
- `getActivePlayers(roster)` excludes players with `status === "inactive"`
- Empty roster returns `[]`
- Missing `status` field defaults to active
- `getEffectiveStartDate(player, roster)` returns player-level date when set
- `getEffectiveStartDate(player, roster)` falls back to top-level date when player has none
- `getEffectiveStartDate(player, roster)` returns current week when neither is set (and logs a warning)
- `isWeekTracked(isoWeek, player, roster)` returns `false` for weeks before the effective start date
- `isWeekTracked(isoWeek, player, roster)` returns `true` for weeks on or after the effective start date
- `validateClassSpec(class, spec)` returns `true` for all 39 valid Midnight class/spec combinations
- `validateClassSpec` returns `false` for an invalid combination (e.g. `"Paladin"`, `"Unholy"`)
- `validateClassSpec` returns `false` for an unknown class
- `validateClassSpec` returns `false` for an unknown spec on a valid class
- `validateRoleForSpec(class, spec, role)` returns `true` when role matches the spec's valid roles
- `validateRoleForSpec` returns `false` when role is inconsistent (e.g. Holy Paladin listed as dps)
- All 13 class identifiers and their spec lists are exported as a constant for use in validation and UI

**`raider-identity.test.ts`**
- `getActiveCharacters(raider)` returns all characters with `"active": true`
- `getActiveCharacters` returns multiple characters when more than one is active
- `getCurrentRole(raider)` returns the `role_history` entry with `"to": null`
- `getCurrentRole` returns `null` when no active role entry exists
- `getRoleAtDate(raider, date)` returns the correct `role_history` entry for a given ISO date
- `getRoleAtDate` returns `null` for dates before the raider's first `role_history` entry
- `getCharacterAtDate(raider, date)` returns the correct character name active during that week
- `buildRoleSummary(raider)` returns a sorted array of all role history entries oldest-first
- Two raiders with the same `display_name` but different `raider_id` (UUID) are treated as distinct
- `mergeComplianceAcrossCharacters(weekRuns)` correctly sums M+ runs from multiple active characters in one week
- `getMembershipStatus(raider)` returns `"active"` when last membership event is `"joined"`
- `getMembershipStatus(raider)` returns `"inactive"` when last membership event is `"left"`
- `getMembershipStatus(raider)` returns `"active"` when raider has rejoined after leaving
- `buildMergedTimeline(raider)` returns all membership, role, and designation events sorted by date
- `buildMergedTimeline` returns an empty array for a raider with no events beyond initial join
- `getDesignationForSeason(raider, seasonId)` returns correct designation from `designation_history`
- `getDesignationForSeason` returns current `team_designation` when no history entry exists for that season

**`team-change-validation.test.ts`**
- `validateTeamChange(event)` returns an error when `reason` is missing on a `team_changed` event
- `validateTeamChange(event)` returns an error when `reason` is an empty string
- `validateTeamChange(event)` returns an error when `reason` is whitespace only
- `validateTeamChange(event)` returns valid when `reason` is a non-empty string
- `validateTeamChange(event)` returns valid for `joined` and `left` events regardless of `reason`
- `checkDesignationParity(roster, previousRoster)` returns a warning when `team_designation` changed but no `team_changed` event exists
- `checkDesignationParity` returns no warning when both `team_designation` and a `team_changed` event are present
- `checkDesignationParity` returns no warning when neither changed

**`wcl.test.ts`** (uses mocked fetch)
- `buildBatchQuery(players, zoneId, difficulties)` produces a valid GraphQL string with correct aliases
- `buildBatchQuery` with 10 players and 2 difficulties produces 20 aliases (`p0_heroic`, `p0_mythic`, … `p9_heroic`, `p9_mythic`)
- `buildBatchQuery` with 10 players and 1 difficulty produces 10 aliases
- `buildBatchQuery` with 0 players returns an empty query body (no crash)
- `parseBatchResponse(response, players, difficulties)` correctly maps alias `p0_heroic` back to player at index 0 difficulty `heroic`
- `parseBatchResponse` handles `null` character data (player not found) without throwing
- Auto-detected zone IDs are correctly formatted as `"raid-{id}"` folder names
- `isCurrentWeekKill(timestamp, resetDay)` returns `true` for timestamps within the current EU reset window
- `isCurrentWeekKill` returns `false` for timestamps from the previous reset

**`rio.test.ts`** (uses mocked fetch)
- `countWeeklyRuns(runs, minLevel)` returns correct count of runs at or above `minLevel`
- `countWeeklyRuns` with empty array returns `0`
- `countWeeklyRuns` with all runs below `minLevel` returns `0`
- `countAllRuns(runs)` returns total count of all runs regardless of level
- `countAllRuns` with empty array returns `0`
- `getHighestKeyLevel(runs)` returns the maximum `mythic_level` across all runs
- `getHighestKeyLevel` with empty array returns `null`
- `getWeekOnWeekDelta(currentWeek, previousWeek, field)` returns correct signed integer delta for both `total_dungeons` and `highest_key_level`
- `getWeekOnWeekDelta` returns `null` when previous week entry is absent

**`resilience.test.ts`**
- `computeResilienceLevel(bestRuns, 8)` returns `null` when fewer than 8 dungeons have timed runs
- `computeResilienceLevel` returns `null` when all 8 dungeons are timed but none overlap at a single level
- `computeResilienceLevel` returns `12` when all 8 dungeons have a timed run at ≥ +12
- `computeResilienceLevel` returns `14` when all 8 dungeons have a timed run at ≥ +14 (even if some are higher)
- `computeResilienceLevel` returns the correct level when only 7 of 8 dungeons are timed at the candidate level
- `computeResilienceLevel` ignores untimed runs (`timed: false`)
- `getResilienceProgress(bestRuns, targetLevel)` returns a map of dungeon → best timed level
- `getResilienceProgress` marks dungeons meeting `targetLevel` as ready and those below as the delta short
- `getResilienceProgress` correctly identifies the bottleneck dungeon(s)
- `computeResilienceLevel` with `seasonDungeonCount = 6` returns correct result for a 6-dungeon season (future-proofing)

**`fetch.test.mjs`** (scripts layer)
- Active players are batched into chunks of 10
- A roster of 23 players produces 3 batches (10, 10, 3)
- Inactive players (raider `status: "inactive"`) are excluded before batching
- Characters with `"active": false` are excluded from all API calls before batching
- Characters with no `"active"` field are treated as inactive and excluded
- A raider with zero active characters produces a warning log and is skipped entirely
- A batch query contains no alias for any character with `"active": false`
- WCL data for weeks before a player's effective `tracking_start_date` is discarded and not written to history
- A player with a per-player `tracking_start_date` earlier than the global date uses their own date
- A player with a per-player `tracking_start_date` later than the global date uses their own date
- A roster with no `tracking_start_date` at all defaults to the current week and does not throw
- On a 429 response, the script retries after 15 seconds (mock timer)
- After two consecutive 429s, the player is written with `"error": "wcl_rate_limited"`
- `X-RateLimit-Remaining < 50` triggers a pause before the next batch

### 19.3 Component tests (`vitest` + `@testing-library/svelte`)

**`BossParseChart.test.ts`**
- Renders an SVG element
- Renders the correct number of data points for a given history array
- Weeks with `kill: false` produce no plotted point (gap in line)
- Chart `<title>` and `<desc>` elements are present and non-empty (accessibility)
- `aria-label` on `<svg>` contains the boss name and raider name
- With zero history entries, renders without crashing

**`MplusStatus.test.ts`**
- Renders "On track" badge when `count >= threshold`
- Renders "Below target" badge when `count < threshold`
- "Below target" badge has a red colour indicator (checks for CSS class or `data-status="below"`)
- "On track" badge has a green colour indicator
- Renders "No data" badge when count is `null`
- Renders "Not yet tracked" grey pill when current week is before the player's effective start date

**`ComplianceHistory.test.ts`**
- Renders one row per tracked week in the compliance table
- Weeks before `tracking_start_date` are not rendered
- Weeks where data is absent (errored run) render "—" not a red cross
- `met: true` rows display a green tick
- `met: false` rows display the count alongside the red cross (e.g. "3/4")
- Streak banner shows correct count of consecutive most-recent `met: true` weeks
- Streak banner shows "Streak broken" when the most recent week has `met: false`
- Streak banner shows "No data yet" when `weeks` array is empty
- Missed week callout banner is visible when most recent week is `met: false`
- Missed week callout is absent when most recent week is `met: true`

**`StreakHero.test.ts`**
- Renders flame emoji when `current_streak >= 3`
- Renders seedling emoji when `current_streak === 1`
- Renders skull emoji when streak just broke (current week `met: false` after a streak)
- Displays `longest_streak` correctly
- Displays lifetime completion percentage correctly (`total_weeks_met / total_weeks_tracked`)
- Renders "pending" indicator when current week data is not yet available

**`DungeonVolume.test.ts`**
- Renders current week total dungeon count
- Renders last week total dungeon count
- Shows green ▲ delta pill when this week > last week (total dungeons)
- Shows red ▼ delta pill when this week < last week (total dungeons)
- Shows grey — when counts are equal
- Shows "—" when no previous week entry exists
- Renders record dungeon count and week label
- Highlights record in gold styling
- Does not render delta pill when previous week data is absent
- Renders current week highest key level in WoW "+N" notation
- Renders last week highest key level with delta pill
- Shows green ▲ when this week's highest key > last week's
- Shows red ▼ when this week's highest key < last week's
- Renders record highest key level and week label in gold
- Shows "—" for highest key when current week data is absent

**`BossParseCard.test.ts`**
- Renders boss name
- Renders parse badge with correct WCL colour for selected difficulty
- Renders cross-difficulty summary line (H: N%  M: N%) beneath boss name
- Cross-difficulty summary shows `—` when no kill exists for a difficulty
- Renders ▲ trend arrow when current parse > previous parse (selected difficulty)
- Renders ▼ trend arrow when current parse < previous parse (selected difficulty)
- Renders — when only one data point exists
- Renders personal best text with correct week label (per difficulty)
- Highlights PB in gold when it was set this week
- Renders improvement delta correctly (current minus first parse, per difficulty)
- Renders sparkline SVG element scoped to selected difficulty
- Sparkline has no point for weeks with no kill on the selected difficulty
- Renders flavour tooltip text matching the parse tier
- Renders "No kills yet" badge when difficulty has no kills at all
- In historical mode: trend arrow is not rendered
- In historical mode: card has reduced-opacity / muted styling
- In historical mode: card is labelled "Historical"

**`DifficultyToggle.test.ts`**
- Renders "Heroic" and "Mythic" tabs when both are configured
- Defaults to the highest difficulty with at least one kill across any raider
- Defaults to Heroic when no Mythic kills exist
- Persists selected difficulty to `localStorage` on change
- Reads persisted difficulty from `localStorage` on mount
- Falls back to default when `localStorage` value is invalid
- Emits a `change` event with the selected difficulty string on click
- A single configured difficulty renders no toggle (just a static label)

**`CharacterParseSection.test.ts`** (the collapsible wrapper)
- Active character section renders with `open` attribute (expanded on load)
- Active character section header shows character name, class, spec, role, and active-since date
- Inactive character section renders without `open` attribute (collapsed on load)
- Inactive character section header shows character name, class, date range, and best parse summary
- Inactive character section header is a full-width tap target (≥ 44px height)
- Multiple inactive sections are sorted newest-first
- Expanding an inactive section reveals historical parse cards
- A raider with only one character shows no inactive sections
- `<details>` and `<summary>` elements are used (not JS-driven toggles)

**`RaiderTimeline.test.ts`**
- Renders one entry per merged timeline event (membership + role + designation combined)
- Membership "joined" events render with 🚪 icon
- Membership "left" events render with 💤 icon
- Membership "rejoined" events (joined after a prior left) render with 🔄 icon
- Character reroll events render with 🎮 icon
- Team change events render with correct ⚔️ or 🔄 icon
- Team change events show the `reason` in muted italics
- Team change events with `"(no reason given)"` show the placeholder in muted italics
- A raider with only a single join event and no other changes renders no timeline section
- A raider with 2+ events renders a `<details>`/`<summary>` toggle labelled "View team history (N events)"
- Events are sorted oldest-first
- Optional `note` text on membership events is rendered beneath the event line
- Boss parse charts render a dashed vertical line at the week of each character switch
- The dashed line tooltip contains the old and new character/spec names

**`TeamDesignationBadge.test.ts`**
- Renders gold "⚔️ Main" badge for `team_designation: "main"`
- Renders blue "🔄 Alt" badge for `team_designation: "alt"`
- Badge has correct `aria-label` ("Main raid team" or "Alt raid team")
- Badge is visually prominent — font-size and padding meet minimum tap target size (44px)

**`ResiliencePanel.test.ts`**
- Renders gold badge with level number when `resilience_level` is set
- Renders grey "Not yet achieved" badge when `resilience_level` is `null`
- Renders a row per dungeon in the progress table
- Dungeons meeting the next target level show ✅
- Dungeons below the next target level show ❌ with the correct deficit
- Bottleneck dungeons (furthest below target) are highlighted in amber
- Achievement history timeline renders one entry per `resilience_history` item
- Timeline renders correctly with a single history entry (no "→" separator)
- Timeline renders vertically stacked on a 390px-wide viewport
- Panel renders without crashing when `resilience_history` is an empty array

**`Changelog.test.ts`** (unit — cron diff logic)
- Diffing identical roster snapshots produces zero changelog entries
- Adding a new raider produces a `joined` entry with correct fields
- Setting `status: "inactive"` on a raider produces a `left` entry
- Changing `team_designation` with a `team_changed` membership event produces a `team_changed` changelog entry with correct `from`, `to`, and `reason`
- A `team_changed` event with a blank `reason` produces a changelog entry with `"(no reason given)"` and triggers a cron warning
- Changing `team_designation` without a `team_changed` membership event produces a cron warning but no changelog entry for the team change
- Swapping active character produces a `rerolled` entry with correct from/to character and class/spec
- Changing `spec` with same `role` produces a `spec_changed` entry
- Changing `spec` with different `role` produces a `role_changed` entry
- Each generated entry has a unique UUID `id`
- Each generated entry has the correct ISO timestamp
- `note` from `membership_history` is copied into the changelog entry
- Multiple changes in one cron run produce multiple independent entries
- Entries are appended — existing entries are never modified

**`ChangelogEntry.test.ts`** (component)
- Renders correct icon and text for each event type
- `joined` entry shows green icon and "Joined the Main/Alt team"
- `left` entry shows red icon and "Left the Main/Alt team"
- `team_changed` entry shows "Moved from Alt → Main team"
- `team_changed` entry shows the `reason` in muted italics beneath the description
- `team_changed` entry with `"(no reason given)"` shows that placeholder in muted italics
- `rerolled` entry shows old and new character/class/spec
- `role_changed` entry shows old and new spec and role
- A `note` renders in muted italics beneath the description
- No note field renders nothing beneath the description
- Raider display name is a link to `/raider/[uuid]`
- Team designation badge is shown on every entry

**`ChangelogFilter.test.ts`** (component)
- Default filter state is All / All / All time
- Selecting "Main" team filter hides Alt team entries
- Selecting "Left" event type hides all non-left entries
- Selecting a season date range hides entries outside that season
- Combining two filters applies both (AND logic)
- Active filters show a count badge
- Resetting filters returns to the default state
- Empty result after filtering shows the empty state message

**`MilestoneBanner.test.ts`**
- Shows "First kill" banner when only one parse exists for a boss
- Shows "Personal best" banner when current parse exceeds all previous
- Shows "First purple" banner when parse ≥ 75 for the first time
- Shows "First orange" banner when parse ≥ 95 for the first time
- Shows "Three weeks of improvement" banner when last 3 parses are strictly ascending
- Does not show "Three weeks of improvement" with fewer than 4 data points
- Multiple milestones are all rendered, not just the first
- No banner rendered when no milestone is triggered
- Shows dungeon record banner when current `total_dungeons` exceeds `record_dungeons_week.count`
- Does not show dungeon record banner when `total_dungeons` equals but does not exceed the record
- Shows key level record banner when `highest_key_level` this week exceeds `record_highest_key.level`
- Does not show key level record banner when level equals but does not exceed the record
- Shows "big week" banner when dungeon count increased by ≥ 3 vs prior week
- Shows "quieter week" banner when dungeon count dropped by ≥ 3 vs prior week
- Does not show volume banners for a delta < 3

**`RoleIcon.test.ts`**
- Renders shield icon for `role="tank"`
- Renders first-aid icon for `role="healer"`
- Renders sword icon for `role="dps"`
- Each icon has a correct `aria-label` ("Tank", "Healer", "DPS")
- Each icon has `role="img"`
- Unknown role renders nothing without crashing

**`RosterTable.test.ts`**
- Active players render in the main table
- Inactive players render in a separate section with an "Inactive" badge
- Inactive players do not show an M+ compliance flag
- Clicking a column header re-sorts the table
- All `<th>` elements have `scope` attribute
- Each raider row shows class colour on the name
- Each raider row shows spec as subtitle text (e.g. "Death Knight — Unholy")
- Role filter buttons correctly hide/show rows by role
- Class dropdown filter correctly shows only players of the selected class

### 19.4 End-to-end tests (`playwright`)

Tests run against the built static site served locally (`npm run preview`). A fixture of JSON files in `data/` is used so tests are deterministic and do not hit real APIs.

**`dashboard.spec.ts`**
- Page loads and the M+ status table is visible
- A player with `mplus_weekly_count_at_or_above_minimum < 4` has a red status indicator
- A player with `mplus_weekly_count_at_or_above_minimum >= 4` has a green status indicator
- The raid parse table is visible and contains boss column headers
- A cell with `kill: false` shows "—" not "0"
- The inactive players section is present and contains only inactive players
- Sorting the M+ table by "RIO Score" reorders the rows

**`raider-detail.spec.ts`**
- Navigating to `/raider/[uuid]` renders the identity header
- Identity header contains the display name, active character name, class/spec, RIO score, and status badge
- At least one boss parse card is rendered for the active character
- A week with no kill shows a gap in the sparkline (no point plotted)
- The active character section is expanded on page load (`open` attribute present)
- Inactive character sections are collapsed on page load (`open` attribute absent)
- Expanding an inactive character section reveals historical parse cards
- Historical parse cards do not show trend arrows
- Inactive section headers show the character name and date range without expanding
- A raider with only one character shows no inactive character sections
- The M+ compliance history section is present
- The compliance table contains no rows for weeks before the player's `tracking_start_date`
- A week with `met: true` shows a green indicator
- A week with `met: false` shows a red indicator and the count (e.g. "3/4")
- A week with missing data shows "—" not a red cross
- The streak banner is present and displays a number or "Streak broken"
- The dungeon volume panel is present showing this week, last week, and record stats
- The vs-last-week delta shows ▲ when this week's total dungeons exceed last week's
- The record stat is highlighted in gold
- The Resilience panel is present on the raider detail page
- A raider with `resilience_level: 13` displays "Resilience 13" in gold
- A raider with `resilience_level: null` displays "Not yet achieved" in grey
- The progress table shows the correct ✅ / ❌ status per dungeon
- The bottleneck dungeon row is highlighted in amber
- The raider history timeline is hidden for a raider with no notable events
- The raider history timeline is present and toggleable for a raider with 2+ events
- A "⚔️ Main" badge is visible below the display name for a main-designated raider
- A "🔄 Alt" badge is visible below the display name for an alt-designated raider
- An inactive raider's header shows "Inactive — left [date]" membership status
- A raider who has rejoined shows "Rejoined [date]" in the membership status pill
- The dashboard M+ table shows designation micro-badges (M / A) on each raider row
- The designation filter on the dashboard correctly shows only Main or only Alt raiders
- The designation filter on the raid parse section works independently of the difficulty toggle

**`changelog.spec.ts`**
- `/changelog` renders without error and shows at least one entry (using fixture data)
- Entries are grouped by ISO week, newest first
- Filtering by "Main" hides all Alt team entries
- Filtering by "Joined" shows only joined events
- Filtering by a season date range hides entries from other seasons
- Clicking a raider name in a changelog entry navigates to their detail page
- A "joined" entry shows a green icon; a "left" entry shows a red icon
- An entry with a note displays the note in italics
- An entry without a note displays no note element
- The empty state message appears when filters produce zero results

**`theme.spec.ts`**
- On first load with no `localStorage`, `html[data-theme]` matches the OS preference (mocked via Playwright's `colorScheme` emulation)
- Clicking the theme toggle changes `html[data-theme]`
- After toggling, reloading the page preserves the chosen theme (reads `localStorage`)
- The toggle button's `aria-label` updates to reflect the current state

**`accessibility.spec.ts`**
- Runs `axe-core` via `@axe-core/playwright` on the dashboard route — zero violations at WCAG 2.1 AA level
- Runs `axe-core` on a raider detail route — zero violations
- All parse badges pass colour contrast check (verified by axe)
- All chart SVG elements have accessible names

### 19.5 CI integration

Tests run in the `deploy.yml` workflow **before** the build step:

```yaml
- name: Run unit and component tests
  run: npm run test:unit   # vitest run

- name: Build
  run: npm run build

- name: Run e2e tests
  run: npx playwright test  # against npm run preview

- name: Deploy
  if: success()
  # ... peaceiris/actions-gh-pages
```

A failed test blocks the deploy. The fetch cron workflow does **not** run tests — it is a data job, not a code change.

---

