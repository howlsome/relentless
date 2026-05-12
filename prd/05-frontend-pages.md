# Stage 5 — Frontend Pages & Components

**Load with:** `00-shared-context.md`, `02-data-layer.md`, and `04-frontend-foundations.md`.
**Goal:** Build the full page experiences — dashboard, raider detail, season archive, changelog — and all gamification components (streak hero, dungeon volume panel, boss parse cards, sparklines, milestone banners, Resilience panel, raider timeline, character section collapsibles).

**Build:**
- `src/routes/+page.svelte` — dashboard (summary stats, M+ status table + chart, raid parse heatmap + table, inactive section)
- `src/routes/raider/[uuid]/+page.svelte` — raider detail (identity header, M+ gamification panel, raid performance with collapsible character sections, raider timeline, Resilience panel, this week's runs)
- `src/routes/season/[season_id]/+page.svelte` — season archive (same as dashboard but for a historical season)
- `src/routes/changelog/+page.svelte` — full team changelog with filters
- All components listed in the repo structure: `RosterTable`, `BossParseCard`, `CharacterParseSection`, `MplusStatus`, `ComplianceHistory`, `StreakHero`, `DungeonVolume`, `ParseSparkline`, `MilestoneBanner`, `ResiliencePanel`, `RaiderTimeline`, `ChangelogEntry`, `ChangelogFilter`, `MembershipStatus`, `RioScoreBadge`

**Don't build yet:**
- Comprehensive tests (Stage 6 — though use of test-driven development is encouraged here)
- Any new data fetching — UI consumes static JSON from disk only

**Acceptance for this stage:**
- Every route renders the correct content for fixture data
- All gamification works: streaks, milestones, records, sparklines
- Difficulty toggle (Heroic/Mythic) and designation filter (Main/Alt) work independently
- Collapsible character sections behave correctly (active expanded, inactive collapsed)
- Mobile layout works on 390px viewport for every route
- Changelog filters apply correctly in combination

---

## 11. Frontend — Pages and Components

### 11.1 Dashboard (`/`) — guild-wide overview

The dashboard is the first thing officers see. It answers two questions at a glance: **who is keeping up with M+**, and **how is the team parsing in raid**. Everything is summary-level — no individual raider deep-dives here. Clicking any raider's name navigates to their detail page.

**Page layout (top to bottom):**

1. Header bar: app name ("Undaunted: Relentless"), season selector, last updated timestamp, theme toggle.
2. Summary stat row (4 cards).
3. M+ weekly status section.
4. Raid parse overview section.
5. Inactive players section (collapsed by default).

---

#### Season selector

A compact segmented control in the header bar allowing officers to switch between:
- **Current season** (default — always the active M+ season and active raid tier).
- **Past seasons** (one option per historical season entry in `data/seasons/index.json`).

Selecting a past season loads data from `data/seasons/{season_id}/` instead of the active folders. All dashboard sections (M+ status, raid parses) update to reflect the selected season's data. A banner below the header reads "Viewing: [Season Label] — [start date] to [end date]" when a past season is selected, so it is always clear the view is historical.

The season selector is also present on the raider detail page — it scopes the compliance table, parse cards, sparklines, and Resilience panel to the selected season.

#### Summary stat row

Four glanceable stat cards across the top of the page (stacks to 2×2 on mobile):

| Card | Value | Notes |
|---|---|---|
| Raiders on track | N / total active | Green if all on track, amber if any below |
| Team avg parse | Average parse % across all bosses this week | Coloured by parse bracket |
| Highest key this week | Best key level across the entire team | With raider name subtitle |
| Top Resilience | Highest Resilience level on the team | With raider name subtitle |

---

#### M+ weekly status section

**Section heading:** "Mythic+ — Week [N]" with the reset date.

**Chart — team M+ activity (bar chart, SVG):**

A grouped bar chart with one bar cluster per raider showing:
- Keys ≥ 10 this week (solid bar, coloured green/red against the target line).
- Total dungeons this week (lighter tinted bar behind).

A horizontal dashed line marks the requirement threshold (4). Bars below the line are red; at or above are green. Raider names on the X-axis are abbreviated display names. On mobile this chart is horizontally scrollable.

**Table — per-raider M+ status:**

One row per active raider. Columns:

| Column | Source | Notes |
|---|---|---|
| Raider | roster.json | `display_name` + role icon; active character as subtitle; `⚔️ M` or `🔄 A` designation micro-badge |
| Class / Spec | roster.json | Class colour chip + spec label |
| RIO Score | snapshot.json | Numeric |
| Keys ≥ 10 | snapshot.json | Qualifying count |
| Total runs | snapshot.json | All runs any level |
| Highest key | snapshot.json | `+N` notation |
| vs last week | compliance.json | ▲ / ▼ / — delta on total runs |
| Resilience | snapshot.json | `🛡️ N` or `—` |
| Status | Derived | Green "On track" / Red "Below target" / Grey "Not yet tracked" |

Rows sorted by RIO score descending by default. Column headers clickable to re-sort. Role toggle, class dropdown, and **Main / Alt / All designation filter** above the table. Officers will frequently want to view only Main raiders or only Alt raiders in isolation.

A raider whose current week falls before their `tracking_start_date` shows a grey "Not yet tracked" pill instead of a status badge.

---

#### Raid parse overview section

**Section heading:** "Raid Parses — [Tier name]" with current difficulty (Mythic).

**Filters:** designation filter (Main / Alt / All) and difficulty toggle ("Heroic | Mythic") above the raid section. These filters are independent — an officer can view only Main raiders on Mythic, for example.

**Difficulty toggle:** "Heroic | Mythic" tab bar above the raid section. Same toggle state logic as the raider detail page — persisted in `localStorage`, defaults to highest difficulty any raider has a kill on. Switching difficulty re-renders the heatmap and table for that difficulty. A new raid tier with zero mythic kills defaults to Heroic.

**Chart — team parse heatmap (SVG):**

A grid where rows = raiders and columns = bosses, scoped to the selected difficulty. Each cell is filled with the WCL parse colour for that raider's most recent parse on that boss (`—` cells are grey). No numbers in cells — colour only, with the numeric parse in a tooltip on hover/tap.

On mobile the heatmap scrolls horizontally; the raider name column is sticky.

**Table — boss parse summary:**

Below the heatmap, a table with the same rows/columns showing numeric parse badges for the selected difficulty. Each cell: coloured badge with parse number, or `—`.

Extra columns appended after boss columns:

| Column | Value |
|---|---|
| Best parse this week | Highest single parse across all bosses (selected difficulty) |
| Avg parse | Mean across all killed bosses (selected difficulty) |
| Trend | ▲ / ▼ / — vs last week's avg |

Rows with any orange (95+) parse get a gold left-border accent.

**Multi-tier support:** if multiple raid zones are active (WCL returned 2+ zones), a zone selector appears above the difficulty toggle — e.g. "The Voidspire | March on Quel'Danas". Each zone has its own heatmap and table. On mobile these stack vertically as collapsible sections, newest zone first.

Below each row: "View raider →" link.

---

#### Inactive players section

Collapsed by default ("Show N inactive raiders" toggle). When expanded, shows a simple list of inactive raiders with their last-known RIO score and the date they were last polled. No compliance or parse detail — just the name, character, class/spec, and last-active date.

---

#### Changelog link in the nav

A "Changelog" link in the top nav bar (between the dashboard and any other nav items) provides quick access to the team changelog from anywhere in the app.

---

### 11.2 Raider detail page (`/raider/[raider-id]`)

This page is entirely about one person. All data shown is scoped to that raider across all their characters and the full history since their `tracking_start_date`. The URL uses `raider_id` (e.g. `/raider/a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a`) rather than character name, so rerolls never break bookmarks.

**Page layout (top to bottom):**

1. Back link: "← Back to dashboard".
2. Raider identity header.
3. M+ gamification panel.
4. Raid performance section.
5. Raider history timeline.
6. Resilience achievement panel.
7. This week's run list.

---

**A. Raider identity header**

Displays:
- `display_name` (large, prominent).
- **Team designation badge** — immediately below the display name, large and impossible to miss:
  - `⚔️ Main` — gold/amber badge for `"main"` designation.
  - `🔄 Alt` — blue/steel badge for `"alt"` designation.
  This is the most prominent non-name element on the page. Officers need to see at a glance whether they're looking at someone's main or alt character.
- Active character name + realm as subtitle (e.g. "Charactername — EU Draenor").
- Class icon (coloured) + class name + spec + role icon in a single line.
- Current RIO score badge.
- Current week M+ status badge (On track / Below target / Not yet tracked).
- Resilience level badge.
- **Membership status** — a small pill below the badges: "Active member since [date]" in green, or "Inactive — left [date]" in grey if `status: "inactive"`. If the raider has rejoined, shows "Rejoined [date]" with a subtle history icon that expands the membership log on click.

On mobile all elements stack vertically. This header is visible above the fold on a 390px phone viewport without scrolling.

---

**B. M+ gamification panel**

*(Full spec unchanged — streak hero, missed week callout, dungeon volume panel, weekly compliance table with keys ≥ 10 / total dungeons / highest key / vs prev week / status columns.)*

---

**C. Raid performance section**

All raid data is grouped by character — the active character's data is shown expanded at the top; retired characters are collapsed below. This means if a raider has rerolled twice, the page shows three collapsible sections: one open, two folded.

**Active character section (expanded by default):**

Labelled with the character name, class icon, spec, and role icon in the section header — e.g. `[DK icon] Charactername — Unholy Death Knight — DPS`. The header also shows the date this character became active ("Active since 15 Nov 2025").

Contains the full per-boss parse cards for this character. Each card shows **both difficulties** when applicable, controlled by a difficulty toggle tab at the top of the raid section (not per-card). The toggle state is persisted in `localStorage` so the raider's preferred view is remembered.

**Difficulty toggle:** "Heroic | Mythic" tab bar. Defaults to the highest difficulty the raider has any kill on. If a raider has no Mythic kills at all, Mythic tab is still shown but cards display "No kills yet" instead of a parse badge. This makes it clear mythic is being tracked even before progression begins.

Each card shows (for the selected difficulty):
- Boss name + current week parse badge (WCL colour chip + number). If no kill this week but has a kill in a previous week, shows the most recent kill's parse in a muted style with "Last: Week N" label.
- Spec used in the most recent log (muted subtitle). ⚠️ indicator if it differs from `roster.json`.
- Trend arrow (▲ / ▼ / —) vs last week on the same difficulty.
- Personal best callout for this difficulty (highlighted gold if set this week).
- Improvement delta since first tracked kill on this character on this difficulty.
- 8-week SVG sparkline for this difficulty only (gaps for missed kills, gaps where this difficulty wasn't tracked yet).
- Flavour tooltip on the badge.

**Cross-difficulty summary line** beneath the boss name (always visible regardless of toggle): a compact two-badge row showing both difficulties at once — e.g. `H: 88%  M: 74%`. Uses smaller badges. Shows `—` for any difficulty with no kill. This lets officers see both difficulties at a glance without toggling.

**Inactive character section(s) (collapsed by default):**

One collapsible section per retired character, sorted newest-to-oldest. Each section header shows:
- Character name, class icon, spec — greyed out to signal inactivity.
- Date range the character was played (e.g. "1 Oct 2025 → 14 Nov 2025").
- A summary of their best parse across all bosses during their active period (e.g. "Best: 94 Purple").

When expanded, the section shows the same per-boss parse card layout as the active character, but the cards are visually muted (reduced opacity or a grey tint) and labelled "Historical". No trend arrows — trend is only meaningful for the active character. Sparklines show only the weeks this character was active.

**Parse milestone banners:**

Shown at the top of this section when triggered by the active character's data only (first kill, new PB, first purple+, first orange+, three weeks of improvement). Milestones from retired characters are not re-surfaced. Multiple banners stack.

**Section collapse behaviour:**

- The `<details>`/`<summary>` HTML elements are used for collapsible sections — native, accessible, no JS required for open/close.
- The active character section has `open` attribute set so it is expanded on page load.
- Inactive character sections have no `open` attribute — collapsed on load.
- On mobile each collapsed section header is a full-width tap target (min 44px height).
- The collapsed header for an inactive character is enough to identify it at a glance without expanding — character name, class, date range, and best parse summary are all visible in the header line.

---

**D. Raider history timeline**

A combined chronological log of membership events, character changes, and role changes — all merged into a single timeline, sorted oldest-first. Positioned below the raid performance section.

Each entry is one of three types, visually distinguished by icon:

| Type | Icon | Example |
|---|---|---|
| Membership | 🚪 | "Joined Relentless — 1 Oct 2025 — Founding member" |
| Membership | 💤 | "Left team — 3 Jan 2026 — Taking a break" |
| Membership | 🔄 | "Rejoined — 14 Mar 2026" |
| Character change | 🎮 | "Rerolled: Holy Priest → Unholy DK — 15 Nov 2025" |
| Team change | ⚔️ / 🔄 | "Moved from Alt → Main — 17 Mar 2026" with reason shown in muted italics |

Rules:
- Membership events come from `membership_history[]`.
- Character/role events come from `role_history[]`.
- Designation changes are inferred from season-to-season snapshots of `team_designation` (see season designation tracking below).
- All events are merged by date and rendered as a single list.
- If the raider has only joined once, never left, never rerolled, and never changed designation — the timeline section is hidden entirely (not collapsed, fully absent).
- If 2+ events exist, the timeline is behind a `<details>`/`<summary>` toggle: "View team history ([N] events)".

**Season designation tracking:** `team_designation` is stored per season in `raider-history.json` so changes across seasons are preserved:

```json
"designation_history": [
  { "season_id": "midnight-s1", "designation": "alt",  "set_date": "2026-03-17", "reason": null },
  { "season_id": "midnight-s2", "designation": "main", "set_date": "2026-11-01", "reason": "Strong performance in S1 — moved to main for S2" }
]
```

The `reason` in `designation_history` is copied from the corresponding `team_changed` event in `membership_history`. If no matching event exists, `reason` is `null`.

Officers update `team_designation` in `roster.json` when a season starts and append a `team_changed` event to `membership_history` with a reason. The cron writes the current value + season + reason into `designation_history` on the first run of each season (upsert by `season_id`).

---

**E. Resilience achievement panel**

*(Full spec unchanged — level badge, per-dungeon progress table with bottleneck highlighting, achievement history timeline.)*

---

**F. This week's run list**

A simple table of runs completed in the current reset: dungeon name, key level, timed (✅/❌), completion time.

**C. M+ gamification panel:**

The centrepiece of the raider detail page. Designed to be motivating and immediately readable at a glance.

**Streak hero block** — large, prominent, at the top of the panel:

```
🔥 5-week streak      Best: 7 weeks      Met 10 of 12 weeks (83%)
```

- Current streak shown in large bold text with a flame emoji if ≥ 3 weeks, a skull emoji if the streak just broke this week, a seedling if on week 1 of a new streak.
- Longest streak shown as a secondary stat.
- Lifetime completion rate shown as a percentage (total weeks met / total weeks tracked).
- If the current week's data is not yet available (mid-week, before cron runs), show last week's streak with a "pending" indicator.

**Missed week callout** — shown only when the most recent completed week has `met: false`:

A distinct red/warning banner: *"⚠️ Requirement missed last week — [count] keys completed, [required] needed."* This is shown above the streak block so it's impossible to miss on mobile.

**Dungeon volume panel** — sits alongside or below the streak hero block:

Two rows of stat cards.

**Row 1 — Dungeon volume:**

| Stat | Value | Notes |
|---|---|---|
| This week | `total_dungeons` current week | e.g. "8 dungeons" |
| Last week | `total_dungeons` previous week | With delta badge: "+3" in green or "−2" in red vs this week |
| 🏆 Record | `record_dungeons_week.count` — "14 (Week 17)" | Gold highlight |

**Row 2 — Highest key:**

| Stat | Value | Notes |
|---|---|---|
| This week | `highest_key_level` current week | e.g. "+15" using WoW's keystone notation |
| Last week | `highest_key_level` previous week | With delta badge: "+2" in green or "−1" in red vs this week |
| 🏆 Record | `record_highest_key.level` — "+18 (Week 15)" | Gold highlight |

The week-on-week delta for both rows is shown as a coloured pill: green ▲ if higher, red ▼ if lower, grey if unchanged. "—" when no previous week entry exists.

If either record is broken by new data, a milestone banner fires (see milestones below).

**Weekly compliance history** — scrollable table, newest week first:

| Week | Keys ≥ 10 | Total dungeons | Highest key | vs prev week | Status |
|---|---|---|---|---|---|
| Week 20 — 14 May | 5 | 8 | +15 | ▲ +3 | ✅ |
| Week 19 — 7 May | 3 | 5 | +11 | ▼ −2 | ❌ Missed (3/4) |
| Week 18 — 30 Apr | 4 | 7 | +13 | — | ✅ |

- **Keys ≥ 10** column shows the qualifying count used for compliance.
- **Total dungeons** column shows all runs regardless of level — this is the volume number.
- **Highest key** column shows the highest key level completed that week, displayed as "+N" (WoW keystone notation).
- **vs prev week** column shows the delta in total dungeons vs the prior row (▲ / ▼ / —).
- Missed weeks show the count alongside the red cross (e.g. "3/4") so officers can see how close they were.
- Weeks with missing data show "—" across all columns.

**D. Raider history timeline:**

A chronological timeline showing every character and role change since the raider joined Undaunted. Rendered as a vertical timeline on mobile, horizontal on desktop.

Each entry shows:
- **Character name** (linked to their WarcraftLogs profile) and realm
- **Class icon** (using the WoW class icon colour) + class name + spec
- **Role icon** (tank/healer/dps)
- **Date range** — "1 Oct 2025 → 14 Nov 2025" or "15 Nov 2025 → present"

Example render:

```
● 1 Oct 2025 → 14 Nov 2025
  [Priest icon] Oldcharname — Holy Priest — Healer

● 15 Nov 2025 → present
  [DK icon] Charactername — Unholy Death Knight — DPS
```

If the raider has only ever played one character, this section is collapsed by default (shown as a "View history" toggle) to avoid clutter for the common case.

Historical parse data on this raider's detail page is **character-aware** — the boss parse charts show data from whichever character was active during each week. A vertical dashed line is drawn on each chart at the week the character changed, with a tooltip: "Switched from Oldcharname (Holy Priest) to Charactername (Unholy DK)".

**E. Resilience achievement panel:**

A dedicated section on the raider detail page showing Resilience progress. Placed prominently — this is a meaningful achievement that officers care about.

**Current level badge:**

If the player has a Resilience level: a large coloured badge reading `🛡️ Resilience 13` in gold. If not yet achieved: `🛡️ Resilience — Not yet achieved` in grey.

**Progress to next level** — a dungeon-by-dungeon breakdown table:

| Dungeon | Best timed | Next level needed | Status |
|---|---|---|---|
| Cinderbrew Meadery | +14 | +14 | ✅ Ready |
| Darkflame Cleft | +13 | +14 | ❌ Need +1 |
| Operation: Mechagon - Workshop | +12 | +14 | ❌ Need +2 |
| … | … | … | … |

- "Next level needed" is `resilience_level + 1` (or 10 if no level achieved yet).
- Dungeons already meeting the next level show ✅. Dungeons that are the bottleneck show ❌ with how many levels short they are.
- The bottleneck dungeon(s) — those furthest below the target — are highlighted in amber so the raider knows exactly where to focus.

**Achievement history** — a compact timeline from `resilience_history`:

```
Resilience 10 — Week 10 (7 Jan)  →  Resilience 11 — Week 12 (21 Jan)  →  Resilience 13 — Week 18 (4 Mar)
```

Rendered as a horizontal timeline on desktop, stacked vertically on mobile.

**E. This week's run list:**

A simple table of runs completed in the current reset: dungeon name, key level, timed (✅/❌), completion time.

### 11.3 Changelog page (`/changelog`)

A chronological record of every change to the Undaunted: Relentless team composition. Officers use this to review the history of the team and track when people joined, left, swapped roles, or rerolled.

**Page layout:**

1. Page heading: "Team Changelog".
2. Filter bar.
3. Grouped changelog entries.

---

**Filter bar:**

Three filters, displayed as compact controls above the log:

| Filter | Options | Default |
|---|---|---|
| Team | All / Main / Alt | All |
| Event type | All / Joined / Left / Designation / Rerolled / Role changed | All |
| Date range | Season picker (all seasons listed from `index.json`) + "All time" | All time |

Filters are applied client-side (all data is in the static JSON). Changing any filter re-renders the list instantly. Active filters show a count badge so officers know the log is filtered.

---

**Grouped changelog entries:**

Entries are grouped by **ISO week**, newest week first. Each group has a week heading (e.g. "Week 20 — 14 May 2026") and lists all events that occurred in that week.

Each entry renders as a single row:

```
[Event icon]  [Display name]  [Character — Class/Spec]  [⚔️ Main / 🔄 Alt]  [Event description]  [Date]
```

**Event rendering by type:**

| Event | Icon | Description text |
|---|---|---|
| `joined` | 🟢 | "Joined the [Main/Alt] team" |
| `left` | 🔴 | "Left the [Main/Alt] team" |
| `team_changed` | 🔄 | "Moved from [Alt/Main] → [Main/Alt] team" followed by the `reason` in muted italics on the next line |
| `rerolled` | 🎮 | "Rerolled: [Old char] ([Old class/spec]) → [New char] ([New class/spec])" |
| `role_changed` | ⚔️ | "Role change: [Old spec/role] → [New spec/role]" |
| `spec_changed` | 📖 | "Spec change: [Old spec] → [New spec]" |

If a `note` is present on the entry, it is shown in muted italics beneath the description: *"Returning after Season 1 break"*.

Clicking a raider's name in any changelog entry navigates to their detail page.

**Empty state:** if the changelog has no entries matching the current filters, show "No changes found for the selected filters." — never show a blank page.

**Mobile layout:** each entry stacks vertically — icon + event description on one line, character/class on the second, note (if any) on the third. Week group headings remain sticky while scrolling through that group.

---

### 11.4 Parse colour specification

Official WarcraftLogs hex codes are used exactly. Two rendering contexts require different treatment for WCAG compliance.

#### Parse badges (coloured chip with a number inside)

The WCL colour is the **chip background**. The text inside is black or white — whichever clears WCAG AA (4.5:1). This approach works identically on light and dark page backgrounds with no CSS variable split needed.

| Range | Label | Chip bg | Text | Contrast |
|---|---|---|---|---|
| 100 | Artifact | `#e5cc80` | black | 13.3:1 ✅ |
| 99 | Legendary | `#e268a8` | black | 6.8:1 ✅ |
| 95–98 | Epic | `#ff8000` | black | 8.3:1 ✅ |
| 75–94 | Rare | `#a335ee` | white | 4.9:1 ✅ |
| 50–74 | Uncommon | `#0070ff` | black | 4.8:1 ✅ |
| 25–49 | Common | `#1eff00` | black | 15.4:1 ✅ |
| 0–24 | Gray | `#666666` | white | 5.7:1 ✅ |

All values pass WCAG 1.4.3 AA for normal text.

#### Chart line colours (SVG strokes — WCAG 1.4.11 non-text contrast, 3:1 minimum)

SVG line strokes carry no text, so the lower non-text contrast threshold (3:1) applies. The original WCL colours pass on a dark background but three fail on a light background. Those three get a darkened hue-matched variant for light mode only. All other tiers use the original WCL colour unchanged in both modes.

```css
/* In src/lib/styles/parse-colours.css */
/* Applied as: [data-theme="light"] { ... }  [data-theme="dark"] { ... } */

[data-theme="light"] {
  --parse-gray:     #666666;   /* 5.7:1 ✅ unchanged */
  --parse-green:    #14ac00;   /* 3.0:1 ✅ darkened from #1eff00 */
  --parse-blue:     #0070ff;   /* 4.4:1 ✅ unchanged */
  --parse-purple:   #a335ee;   /* 4.9:1 ✅ unchanged */
  --parse-orange:   #e87500;   /* 3.0:1 ✅ darkened from #ff8000 */
  --parse-pink:     #e268a8;   /* 3.1:1 ✅ unchanged */
  --parse-tan:      #a5935d;   /* 3.0:1 ✅ darkened from #e5cc80 */
}

[data-theme="dark"] {
  --parse-gray:     #666666;   /* 3.1:1 ✅ unchanged */
  --parse-green:    #1eff00;   /* 13.1:1 ✅ original WCL */
  --parse-blue:     #0070ff;   /* 4.1:1 ✅ original WCL */
  --parse-purple:   #a335ee;   /* 3.7:1 ✅ original WCL */
  --parse-orange:   #ff8000;   /* 7.1:1 ✅ original WCL */
  --parse-pink:     #e268a8;   /* 5.8:1 ✅ original WCL */
  --parse-tan:      #e5cc80;   /* 11.4:1 ✅ original WCL */
}
```

Chart lines reference `stroke: var(--parse-{tier})`. Since `data-theme` is set on `<html>`, this resolves automatically whenever the theme toggles — no JS required.

A utility function `getParseColour(percentile: number): string` is exported from `src/lib/utils/parse-colours.ts` and returns the CSS variable name (e.g. `"var(--parse-purple)"`) for a given parse value. This is used by both the badge renderer and the chart component.

### 11.5 Parse gamification

Parses are not just numbers — they are achievements. The UI reinforces this at every level.

#### Parse tier labels and flavour

Each tier has a short label (used in badges) and a one-line flavour string (shown in tooltips and on the raider detail page):

| Range | Label | Flavour text |
|---|---|---|
| 100 | Artifact | "World-class. The absolute peak." |
| 99 | Legendary | "Top 1% worldwide. Exceptional." |
| 95–98 | Epic | "Elite performance. Outstanding." |
| 75–94 | Rare | "High performer. Well above average." |
| 50–74 | Uncommon | "Above average. Solid work." |
| 25–49 | Common | "Below average. Room to grow." |
| 0–24 | Gray | "Needs attention." |

#### Boss parse card (raider detail page)

Each boss is rendered as a card, not just a row in a table. The card contains:

- **Boss name** and the current week's parse badge (coloured chip), with the spec used shown in small muted text beneath (e.g. "Unholy"). If the spec in the log differs from `roster.json`, a ⚠️ indicator is shown with a tooltip explaining the mismatch.
- **Trend arrow** next to the badge: ▲ green if this week is higher than last week, ▼ red if lower, — grey if unchanged or only one data point.
- **Personal best** call-out: "PB: 94 — Week 18" in small text below the badge. Highlighted in gold if the PB was set this week.
- **Improvement delta**: "+12 since first kill" shown in muted text — the difference between the first tracked parse and the current one.
- **Sparkline** — a compact 8-week inline SVG sparkline showing the parse trend at a glance. No axes, just the shape of the line. Gaps for missed weeks.
- **Flavour tooltip**: hovering (or long-pressing on mobile) over the badge shows the tier flavour text.

#### Parse milestones (shown as toasts/banners on the detail page)

Computed at render time from history. If any of the following are true for the current week's data, a milestone banner is shown at the top of the raider's detail page:

| Milestone | Trigger | Banner text |
|---|---|---|
| First kill | First non-null parse on this boss | "🗡️ First kill recorded on [boss]!" |
| Personal best | Parse > all previous parses for this boss | "🏆 New personal best on [boss]!" |
| First purple+ | Parse ≥ 75 for the first time on this boss | "💜 First Rare parse on [boss]!" |
| First orange+ | Parse ≥ 95 for the first time on this boss | "🔥 First Epic parse on [boss]!" |
| Consistent improvement | Parse higher than previous 3 consecutive weeks | "📈 Three weeks of improvement on [boss]!" |
| Dungeon record | `total_dungeons` this week > previous `record_dungeons_week.count` | "🏅 New personal dungeon record — [n] this week!" |
| Key level record | `highest_key_level` this week > previous `record_highest_key.level` | "🗝️ New highest key — +[n] this week!" |
| Dungeon volume up | `total_dungeons` this week > last week by ≥ 3 | "⬆️ Big week — [n] dungeons, up [delta] from last week!" |
| Dungeon volume down | `total_dungeons` this week < last week by ≥ 3 | "⬇️ Quieter week — [n] dungeons, down [delta] from last week." |
| Resilience level up | `resilience_level` increased since last snapshot | "🛡️ Resilience [N] achieved! All 8 dungeons timed at +[N]!" |

Multiple milestones are stacked. Milestones are purely computed from the JSON data — nothing is stored. They reflect the state of the most recent cron snapshot.

#### Role icon display

Each raider's name throughout the UI is prefixed with a small role icon:

| Role | Icon | Colour |
|---|---|---|
| `tank` | Shield (Tabler `ti-shield`) | Blue `#0070dd` |
| `healer` | Cross (Tabler `ti-first-aid-kit`) | Green `#4aff2f` |
| `dps` | Crossed swords (Tabler `ti-sword`) | Red `#c41e3a` |

Role icons use `aria-label="Tank"` / `"Healer"` / `"DPS"` and `role="img"`. The dashboard M+ table and roster view can be filtered by role using a toggle button group above the table, and further filtered by class using a class dropdown. Spec is shown as a subtitle under the character name in all table and card views.

The Devourer Demon Hunter spec uses the standard DPS (sword) role icon. Its spec colour follows Demon Hunter class colour (`#a330c9`).

#### Dashboard parse overview — glanceable gamification

The raid parse overview table on the dashboard gains two extra columns:

| Column | Content |
|---|---|
| Best parse (this tier) | The single highest parse this raider has recorded across all tracked bosses this week — shown as a coloured badge |
| Trend | ▲ / ▼ / — based on whether their average parse across all bosses is higher or lower than last week |

Rows with any orange (95+) parse this week get a subtle gold left-border accent to make top performers immediately visible at a glance.

---

