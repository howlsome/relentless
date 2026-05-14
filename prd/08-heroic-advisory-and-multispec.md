# Stage 8 — Heroic Lockout Advisory & Multi-Spec Tracking

**Load with:** `00-shared-context.md` plus `07-second-pass-refactor.md` (this stage extends the lockout system introduced there).
**Goal:** Refine the lockout system to handle Heroic differently from Mythic, and add first-class support for raiders who play multiple specs.

**Stages 0–7 are assumed complete.** This file describes deltas from Stage 7.

---

## 1. The Heroic / Mythic distinction

### 1.1 What actually happens in-game

The current lockout detection treats Heroic and Mythic identically — but the in-game mechanics differ in important ways:

- **Mythic raids share a single lockout ID for the entire raid.** Once a raider kills any boss in a Mythic group, they are saved to that group's ID. They cannot join a different Mythic group for that raid that week. A Mythic kill outside Relentless raid hours therefore locks the raider out of joining the team's Mythic raid for the remainder of the reset.
- **Heroic raids have flexible lockouts.** A raider can join multiple Heroic groups in the same week. However, each player is individually locked out of *loot* from each boss they have killed that week. They can still join the team's Heroic raid and help kill the boss again — but they will not get loot from that boss.

This means a Heroic out-of-raid kill is not progression-blocking in the same way a Mythic one is. It is more of a courtesy issue: the raider used up a loot opportunity that the team could have given them in-raid.

### 1.2 What this means for the classifier

The classifier now produces a **severity** alongside the existing category, and the severity depends on both the difficulty and the team's progression state:

| Difficulty | Out-of-raid kill | Heroic still progression? | Severity |
|---|---|---|---|
| Mythic | Outside session, not exempt, not in safe-pug window | n/a | **`blocking`** — full progression-blocking pug (Stage 7 behaviour) |
| Heroic | Outside session, not exempt, not in safe-pug window | Yes (team has not yet downed all Heroic bosses) | **`advisory`** — soft warning, raider may have deprived a teammate of a loot slot |
| Heroic | Outside session, not exempt, not in safe-pug window | No (Heroic is on farm / set aside) | **`ignored`** — not surfaced anywhere, no warning, no log |
| Normal | Outside session | n/a | **`ignored`** — never tracked |

A Heroic kill where the team has not yet downed all Heroic bosses is an advisory because:
- The team is still actively going through Heroic each week and the raider's lockout means they'll skip that boss in next week's Heroic clear, potentially leaving a loot drop on the floor.
- It is annoying but not catastrophic. The team can complete Heroic without that raider.

A Heroic kill where the team has set Heroic aside (only running Mythic, or only running Heroic for alts / off-night) is ignored entirely — there is no team plan to disrupt.

### 1.3 Officer control — heroic progression status

Officers control whether Heroic is still considered progression via a per-raid-zone field in `roster.json`:

```json
"raid_difficulty_status": {
  "raid-46": {
    "heroic": "progression",
    "mythic": "progression"
  }
}
```

| Value | Meaning |
|---|---|
| `"progression"` | The team is actively progressing this difficulty. Out-of-raid kills surface as appropriate severity |
| `"farm"` | The team has fully cleared this difficulty and is running it casually. Heroic on farm → `advisory` kills become `ignored` |
| `"retired"` | The team has set this difficulty aside. Heroic retired → `advisory` kills become `ignored`. Useful when the team has moved entirely to Mythic |

Defaults if a zone is not listed:
- Mythic: `"progression"` (always check Mythic by default)
- Heroic: `"progression"` (always check Heroic by default until officers say otherwise)
- Normal: never tracked regardless

Officers can change these mid-tier without code changes. When Heroic moves from `"progression"` to `"farm"`, the next cron run silently reclassifies all `advisory` kills as `ignored` in the current snapshot.

### 1.4 Repeatable behaviour — the key signal

The Heroic advisory is most useful for spotting **repeatable behaviour**. One Heroic loot-slot miss is annoying. Five in a month is a pattern. The cron computes `prior_heroic_advisories_last_4_weeks` for each raider on each kill entry, the same way `prior_blocks_last_4_weeks` is computed for Mythic.

When `prior_heroic_advisories_last_4_weeks >= 3`, the advisory escalates — it appears in the raider's progression-blocking callout area (still amber not red, but visually grouped with the serious stuff) with copy that explicitly calls out the pattern:

> 🟡 Heroic pugging pattern — 4 occurrences in the last 4 weeks. The team has been deprived of a loot drop each time. Officers should discuss this with the raider.

Single-incident advisories remain in a lower-priority "this week" callout that officers can dismiss.

---

## 2. Multi-spec raiders

### 2.1 The problem

Some raiders run different specs in different raid compositions — for example, a Druid who plays Restoration on Heroic farm nights and Balance on Mythic progression nights, or a Paladin who tanks (Protection) on one boss and DPS (Retribution) on another.

The current data model assumes one `spec` and one `role` per character. This means:
- WCL parses are filtered to that one spec, hiding all parses on alternate specs
- The dashboard role filter shows the raider in only one role bucket
- The history timeline has no concept of "swapped to off-spec for this pull"

### 2.2 The new model — `specs[]` array per character

The `spec` field becomes a `specs[]` array on each character entry. Each entry within the array declares one spec the raider plays, with metadata:

```json
"characters": [
  {
    "name": "Charactername",
    "realm": "Draenor",
    "class": "Druid",
    "specs": [
      {
        "spec": "Balance",
        "role": "dps",
        "primary": true,
        "wcl_active": true
      },
      {
        "spec": "Restoration",
        "role": "healer",
        "primary": false,
        "wcl_active": true
      }
    ],
    "active": true
  }
]
```

| Field | Required | Meaning |
|---|---|---|
| `spec` | Yes | Spec name — must be a valid spec for the character's class |
| `role` | Yes | `"tank"`, `"healer"`, or `"dps"` — must match the spec |
| `primary` | Yes | `true` for the spec the raider plays most often. Exactly one entry per character must be `primary: true`. Used for dashboard display |
| `wcl_active` | Yes | When `true`, the cron fetches WCL parses filtered to this spec. When `false`, this spec is recorded in the roster but not fetched (useful when a raider declares they can flex without committing to actually playing it) |

Backwards compatibility: the cron accepts the old single-`spec`/`role` form on a character entry and migrates it on first sight. A character with `"spec": "Balance", "role": "dps"` is treated as if it had `"specs": [{"spec": "Balance", "role": "dps", "primary": true, "wcl_active": true}]`.

### 2.3 WCL fetch — query each spec separately

For each character with multiple `wcl_active: true` specs, the cron now makes one query per spec, per difficulty. The aliasing pattern extends naturally:

```graphql
{
  p0_heroic_balance: characterData { character(...) { zoneRankings(zoneID: $z, difficulty: 4, specName: "Balance") { rankings { ... } } } }
  p0_heroic_restoration: characterData { character(...) { zoneRankings(zoneID: $z, difficulty: 4, specName: "Restoration") { rankings { ... } } } }
  p0_mythic_balance: characterData { character(...) { zoneRankings(zoneID: $z, difficulty: 5, specName: "Balance") { rankings { ... } } } }
  p0_mythic_restoration: characterData { character(...) { zoneRankings(zoneID: $z, difficulty: 5, specName: "Restoration") { rankings { ... } } } }
  ...
}
```

A character with 2 specs and 2 difficulties uses 4 aliases per batch entry. Adjust batch size accordingly — a 10-player batch with one 2-spec raider uses 22 aliases instead of 20. WCL handles this fine, but for batches with multiple multi-spec raiders, drop batch size to 5 to stay well under the burst limit.

For each `(character, difficulty, spec)` triple the cron stores:

```json
"raid_parses": [
  {
    "boss_id": 2902,
    "boss_name": "Solanar the Dawnbreaker",
    "difficulties": {
      "heroic": {
        "Balance": { "kill": true, "parse_percentile": 88, "dps": 1540000 },
        "Restoration": { "kill": true, "parse_percentile": 72, "hps": 980000 }
      },
      "mythic": {
        "Balance": { "kill": true, "parse_percentile": 74, "dps": 1284500 }
      }
    }
  }
]
```

If a raider has only one active spec, the structure is the same but with a single entry under each difficulty. The UI doesn't need to special-case single-spec raiders.

### 2.4 UI — boss parse cards

Each boss parse card now shows **one row per active spec** the raider has logs for on that boss. Each row has its own parse badge, trend arrow, sparkline, and personal best — independent per spec.

The card header shows the boss name once. Then one mini-row per spec:

```
[Boss Name]                                       
 ├─ Balance (DPS)        🟣 88   ▲ +2   PB: 91 (W18)
 └─ Restoration (Healer) 🔵 72   ▼ -3   PB: 78 (W17)
```

If only one spec has parses, only that row is shown. Specs without parses on a given boss are hidden from that boss's card — but appear on other bosses where they do have parses.

A small primary-spec indicator (a gold star or just a "primary" tag) is shown beside the primary spec to distinguish it visually.

### 2.5 UI — dashboard

The roster table's "Class / Spec" column shows the **primary spec** by default with a small `+1` or `+2` indicator when the raider has additional active specs:

```
| Raider             | Class / Spec              |
| Charactername     | Druid — Balance (DPS) +1   |  ← +1 means one extra active spec
```

Hovering or tapping the indicator expands a tooltip listing the extra specs.

The role filter (Tank / Healer / DPS / All) treats a multi-spec raider as belonging to **every role they have an active spec for**. A raider playing Balance (DPS) and Restoration (Healer) appears in both the DPS and Healer filtered views — they are not hidden when filtering by either.

### 2.6 UI — raider detail page identity header

The header now shows all active specs as small pills beneath the character name, with the primary spec marked:

```
Charactername — EU Draenor
[Druid] 🌟 Balance (DPS)  ·  Restoration (Healer)
```

Tapping a spec pill filters the page to show only that spec's parses, role-relevant gamification, etc. The selection persists in `localStorage`. An "All specs" pill returns to the combined view.

### 2.7 Role history with spec context

The `role_history[]` array on each raider gains a `spec_change` event type alongside the existing entries, used when a raider adds, removes, or changes their primary spec without changing characters:

```json
{
  "event": "spec_added",
  "date": "2026-05-20",
  "character": "Charactername",
  "spec": "Restoration",
  "role": "healer",
  "primary": false,
  "reason": "Picked up Resto for Heroic farm coverage"
}
```

Event types:

| `event` | When |
|---|---|
| `spec_added` | A new spec entry is added to a character's `specs[]` array |
| `spec_removed` | A spec entry is removed (or `wcl_active` flipped to `false` permanently) |
| `primary_changed` | The `primary: true` spec changes within a character |

All require a `reason` field, same as `team_changed`. Cron logs a warning if missing.

### 2.8 Parse colours on multi-spec rows

Each spec row uses the same WCL parse colour system from Stage 4. No special treatment — a Balance Druid parse and a Restoration Druid parse on the same boss can both be purple, and both show purple independently.

### 2.9 Spec migration audit

The first cron run after Stage 8 deploys should:

1. Walk every character entry in `roster.json`.
2. For any character with old-style `spec` / `role` fields (not `specs[]`), migrate to the new structure with `primary: true, wcl_active: true`.
3. Append a one-time migration entry to `raider-history.json` per affected raider so the change is auditable.
4. Log a summary: `Migrated N characters to multi-spec schema`.

The migration is **idempotent** — running the cron again sees the new structure and skips.

---

## 3. Data model summary — what's new in Stage 8

### roster.json additions

- `raid_difficulty_status` (top-level) — controls whether Heroic / Mythic are still in progression
- `characters[].specs[]` array replaces single `spec`/`role` fields
- `role_history[]` accepts new event types: `spec_added`, `spec_removed`, `primary_changed`

### snapshot.json additions

- `raid_parses[].difficulties.{heroic,mythic}` becomes a map keyed by spec name (instead of a single object)
- Each kill entry includes `severity` field: `"blocking"`, `"advisory"`, or `"none"` (in_raid kills)
- New top-level array per raider: `heroic_advisories` (parallel to `lockout_warnings`)

### changelog.json additions

- New event types: `spec_added`, `spec_removed`, `primary_spec_changed`

---

## 4. Edge cases

| Case | Handling |
|---|---|
| Raider has 3+ active specs | Supported — `specs[]` array length is not capped. Dashboard tooltip lists all extras |
| Raider declares a spec but `wcl_active: false` | Not fetched from WCL; appears in the identity header pill list with a small "(not tracked)" annotation |
| `primary: true` on two or more specs | Cron logs a warning, picks the first occurrence as primary, ignores the others |
| `primary: true` on zero specs | Cron logs a warning and treats the first `specs[]` entry as primary |
| Heroic kill outside raid hours when `raid_difficulty_status.heroic` is `"farm"` | Classified `severity: "none"`, no warning surfaced, no entry in `heroic_advisories` |
| Heroic kill outside raid hours when `raid_difficulty_status.heroic` is `"progression"` | Classified `severity: "advisory"`, entry added to `heroic_advisories` |
| Mythic kill outside raid hours when `raid_difficulty_status.mythic` is `"farm"` | Officer's call — most teams should never set Mythic to farm, but if they do, advisory rules apply. The system supports this for completeness |
| Raider plays a spec on a kill that isn't declared in `roster.json` | Parse is still fetched (the unfiltered `specName: null` fallback runs once at end of batch) and stored under a synthetic `"_unknown"` spec key. Cron logs a warning prompting the officer to add the spec to the roster |
| Raid zone in `raid_difficulty_status` no longer exists (zone changed) | Cron silently ignores the obsolete entry; no warning |
| Officer flips Heroic from `"progression"` to `"farm"` mid-week | Next cron run reclassifies existing `heroic_advisories` to `severity: "none"` and removes them from `heroic_advisories` in the current snapshot. Historical weekly files keep the original classification |

---

## 5. Tests

### Unit tests — lockout severity

In `src/lib/utils/lockout.test.ts`, add tests for severity classification:

- `classifyKill` returns `severity: "blocking"` for a Thursday Mythic kill (Stage 7 behaviour preserved)
- `classifyKill` returns `severity: "advisory"` for a Thursday Heroic kill when `heroic` status is `"progression"`
- `classifyKill` returns `severity: "none"` for a Thursday Heroic kill when `heroic` status is `"farm"`
- `classifyKill` returns `severity: "none"` for a Thursday Heroic kill when `heroic` status is `"retired"`
- A Mythic kill always produces `severity: "blocking"` if it would otherwise be `blocking_pug`, regardless of `mythic` status
- A Normal kill always returns `severity: "none"` (never tracked)
- `severity: "none"` kills never appear in `lockout_warnings` or `heroic_advisories`
- Officer flipping Heroic from progression to farm causes existing advisories to drop from the snapshot on next cron run

### Unit tests — multi-spec

In `src/lib/utils/roster.test.ts`:

- `getActiveSpecs(character)` returns only specs with `wcl_active: true`
- `getPrimarySpec(character)` returns the entry with `primary: true`
- `getPrimarySpec` returns the first spec entry when none is marked primary (with warning logged)
- `getRolesPlayed(character)` returns the deduplicated set of roles across all active specs
- A Druid with Balance (DPS) and Restoration (healer) returns `{"dps", "healer"}` from `getRolesPlayed`
- `validateSpecsArray` rejects multiple `primary: true` entries
- `validateSpecsArray` rejects zero entries
- `validateSpecsArray` rejects an invalid class/spec combination

### Component tests

- `BossParseCard.test.ts` — renders one row per active spec when multiple are present
- `BossParseCard.test.ts` — renders only the spec row that has parses (hides spec rows with no kill on that boss)
- `RosterTable.test.ts` — shows `+N` indicator when raider has multiple active specs
- `RosterTable.test.ts` — multi-spec raider appears in all relevant role filter views
- `RaiderIdentityHeader.test.ts` — renders one spec pill per active spec
- `RaiderIdentityHeader.test.ts` — primary spec is marked with a star or indicator
- `RaiderIdentityHeader.test.ts` — tapping a spec pill filters the page to that spec
- `HeroicAdvisoryCallout.test.ts` — shown only when `heroic_advisories` is non-empty
- `HeroicAdvisoryCallout.test.ts` — escalates to repeatable-behaviour framing when `prior_heroic_advisories_last_4_weeks >= 3`

### e2e tests

- Toggling `heroic` status from `progression` to `farm` in roster.json (test fixture) causes Heroic advisories to disappear from the next dashboard render
- A multi-spec raider's detail page renders all active spec pills
- A multi-spec raider appears in both the DPS and Healer role-filtered dashboard views
- A spec pill click filters the boss parse cards to show only that spec's rows

---

## 6. Acceptance criteria for Stage 8

- [ ] `characters[].specs[]` array replaces single `spec`/`role` fields; old-style entries migrated silently on first run
- [ ] Each character has exactly one `primary: true` spec (cron warns and self-corrects otherwise)
- [ ] WCL fetch queries each `wcl_active: true` spec separately and stores parses keyed by spec
- [ ] Boss parse cards render one row per spec that has parses on that boss
- [ ] Dashboard roster table shows `+N` indicator for multi-spec raiders
- [ ] Multi-spec raiders appear in every relevant role filter on the dashboard
- [ ] Raider identity header renders a spec pill for every active spec, primary marked
- [ ] Spec pill click filters the detail page to that spec; selection persists in `localStorage`
- [ ] `raid_difficulty_status` controls whether Heroic / Mythic out-of-raid kills surface
- [ ] Heroic out-of-raid kill when status is `"progression"` produces `severity: "advisory"` and an entry in `heroic_advisories`
- [ ] Heroic out-of-raid kill when status is `"farm"` or `"retired"` produces `severity: "none"` and no entry
- [ ] Mythic out-of-raid kill always produces `severity: "blocking"` regardless of `raid_difficulty_status.mythic`
- [ ] `prior_heroic_advisories_last_4_weeks` is computed correctly and escalates the UI at >= 3
- [ ] `role_history[]` records `spec_added`, `spec_removed`, and `primary_changed` events with required `reason` fields
- [ ] Changelog renders the new spec-change event types correctly
- [ ] Schema migration runs idempotently — second cron run does no migration work
