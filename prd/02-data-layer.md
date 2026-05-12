# Stage 2 — Data Layer

**Load with:** `00-shared-context.md`
**Goal:** Define every data file schema and write seed/example versions so the fetch script (Stage 3) and frontend (Stages 3–4) have something to read from disk.

**Build:**
- TypeScript types/interfaces for every data file in `src/lib/types/`
- A populated `data/roster.json` with realistic example data
- Empty (but valid) skeleton versions of `raider-history.json`, `changelog.json`, `data/seasons/index.json`
- Schema validation functions in `src/lib/utils/roster.ts` (Zod or hand-written)
- A `scripts/generate-uuid.mjs` helper that officers can run with `node scripts/generate-uuid.mjs`

**Don't build yet:**
- The actual cron fetch logic (Stage 3)
- Any UI rendering (Stage 4)
- Tests (Stage 5)

**Acceptance for this stage:**
- All TypeScript types compile cleanly
- A test fixture roster.json validates against the schema
- The schema rejects invalid class/spec combinations (e.g. Holy Mage)

---

## 7. Data Model

### 7.1 `data/roster.json` (manually maintained)

```json
{
  "app_name": "Undaunted: Relentless",
  "realm": "EU-Draenor",
  "region": "eu",
  "mplus_weekly_minimum": 4,
  "mplus_minimum_key_level": 10,
  "tracking_start_date": "2025-10-01",
  "mplus_seasons": [
    {
      "season_id": "midnight-s1",
      "label": "Midnight Season 1",
      "start_date": "2026-03-24",
      "end_date": null,
      "dungeon_count": 8,
      "dungeons": [
        "Windrunner Spire", "Maisara Caverns", "Magisters' Terrace",
        "Nexus-Point Xenas", "Algeth'ar Academy", "Seat of the Triumvirate",
        "Skyreach", "Pit of Saron"
      ]
    }
  ],
  "raid_difficulties": ["heroic", "mythic"],
  "wcl_expansion_id": 11,
  "players": [
    {
      "raider_id": "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a",
      "display_name": "Playername",
      "status": "active",
      "tracking_start_date": "2025-11-15",
      "team_designation": "main",
      "membership_history": [
        {
          "event": "joined",
          "date": "2025-10-01",
          "note": "Founding member"
        },
        {
          "event": "team_changed",
          "date": "2026-03-17",
          "from": "alt",
          "to": "main",
          "reason": "Consistently strong performance throughout Season 1 — promoted to main team for Midnight Season 1 progression"
        }
      ],
      "characters": [
        {
          "name": "Charactername",
          "realm": "Draenor",
          "class": "DeathKnight",
          "spec": "Unholy",
          "role": "dps",
          "active": true
        },
        {
          "name": "Altname",
          "realm": "Draenor",
          "class": "Mage",
          "spec": "Fire",
          "role": "dps",
          "active": false
        }
      ],
      "role_history": [
        {
          "role": "healer",
          "class": "Priest",
          "spec": "Holy",
          "character": "Oldcharname",
          "from": "2025-10-01",
          "to": "2025-11-14"
        },
        {
          "role": "dps",
          "class": "DeathKnight",
          "spec": "Unholy",
          "character": "Charactername",
          "from": "2025-11-15",
          "to": null
        }
      ]
    }
  ]
}
```

Officers edit this file directly in the repo to add or remove players. The `mplus_weekly_minimum` and `mplus_minimum_key_level` fields are the configurable thresholds.

**`team_designation`:** Required. Either `"main"` or `"alt"`. Indicates whether this player has selected Undaunted: Relentless as their primary raid team or as an alt raid team. This is set by an officer and can be changed per season — it does not auto-update. The value is displayed prominently on the raider detail page and as a small badge in roster tables.

**`membership_history`:** An append-only log of every time a raider joins, leaves, or changes team. Officers append entries manually. The cron never writes to this field. Each entry has:
- `event`: `"joined"`, `"left"`, or `"team_changed"`
- `date`: ISO date string (`YYYY-MM-DD`)
- `reason`: **required** for `"team_changed"` events — a free-text string explaining why the raider moved teams (e.g. "Moving to main team after consistent performance in S1", "Stepping back to alt team due to schedule changes"). Required so there is always a record of why the move happened.
- `note`: optional free-text for `"joined"` and `"left"` events (e.g. "Taking a break for exams", "Returned after Season 1 hiatus")

The `status` field (`"active"` / `"inactive"`) continues to control whether the cron polls for data. `membership_history` is the human-readable record of *why* status changed and *when*. They are updated together — when an officer sets `"status": "inactive"`, they also append a `"left"` event to `membership_history`.

A `"team_changed"` event must always be paired with a `team_designation` change on the same raider entry. The cron validates this pairing and logs a warning if `team_designation` has changed without a corresponding `team_changed` event, or vice versa.

**`raider_id`:** A stable, unique identifier for the *person*, not the character. A UUID v4 string generated once when the raider is first added to `roster.json`, using `crypto.randomUUID()` (available in Node 19+ and all modern browsers). This never changes even if the player rerolls, renames, or realm-transfers. It is the join key across all data files. Officers can generate one by running `node -e "console.log(crypto.randomUUID())"` in any terminal, or the project README should document this helper. Never reuse or hand-craft a UUID.

**`display_name`:** The officer-assigned label for the person (e.g. their Discord name or preferred name). Shown as the primary name in the UI; character names appear as subtitles.

**`characters`:** An array of all characters this person has played as part of the team.

**Only characters with `"active": true` are polled by the cron.** A character with `"active": false` is never queried against WarcraftLogs or Raider.io, regardless of how recently it was played. This applies in all cases — rerolls, spec changes that result in a character swap, realm transfers, and renames. The rule is unconditional: `active: false` means no polling, full stop.

When a raider rerolls or changes main character, the officer:
1. Sets `"active": false` on the old character — polling stops immediately on the next cron run.
2. Adds a new character entry with `"active": true` — polling begins on the next cron run.

The old character's history is preserved and still viewable on the site. It is never deleted.

Multiple characters can be `"active": true` simultaneously only when a raider is genuinely splitting raid attendance between two toons in the same week. This is rare — do not use it as a workaround for forgetting to deactivate an old character.

**`role_history`:** An append-only log of every role/class/spec/character combination the raider has played, with ISO date ranges. `"to": null` means the current assignment. Officers append a new entry when a raider changes role, class, spec, or main character — they never edit existing entries. The cron uses the entry with `"to": null` as the active assignment.

**`tracking_start_date` (top-level):** An ISO 8601 date string (`YYYY-MM-DD`). All data collection and display is silently ignored for any week whose EU reset started *before* this date. This is the date the Undaunted team was formed inside the Draenor guild — logs from Relentless raids before this date are not relevant and must not be included. Officers set this once and leave it.

**`tracking_start_date` (per-player, optional):** Overrides the top-level date for a single player. Use when a raider joined mid-season. If omitted, the player inherits the top-level date. If set, the player's history and M+ compliance tracking begin from that date instead.

The `class` field must match one of the 13 Midnight class identifiers exactly (see class/spec reference below). The `spec` field must match one of the valid specialisations for that class. Both are required — the cron will log a warning for any player missing either field.

The `role` field accepts `"tank"`, `"healer"`, or `"dps"`. It is displayed as a coloured role icon next to the player's name throughout the UI (using the standard WoW role iconography — shield for tank, cross for healer, sword for DPS) and used to group/filter the roster. It is required — the cron will log a warning for any player missing a role.

#### Midnight class and spec reference (Patch 12.0 — Season 1)

The following table is the canonical list of valid `class` and `spec` values. Class identifiers are PascalCase with no spaces. Spec identifiers match the in-game spelling.

| Class | Specs | Roles available |
|---|---|---|
| `DeathKnight` | Blood, Frost, Unholy | Tank (Blood), DPS (Frost, Unholy) |
| `DemonHunter` | Havoc, Vengeance, Devourer *(new in Midnight)* | DPS (Havoc, Devourer), Tank (Vengeance) |
| `Druid` | Balance, Feral, Guardian, Restoration | DPS (Balance, Feral), Tank (Guardian), Healer (Restoration) |
| `Evoker` | Devastation, Preservation, Augmentation | DPS (Devastation, Augmentation), Healer (Preservation) |
| `Hunter` | Beast Mastery, Marksmanship, Survival | DPS (all) |
| `Mage` | Arcane, Fire, Frost | DPS (all) |
| `Monk` | Brewmaster, Mistweaver, Windwalker | Tank (Brewmaster), Healer (Mistweaver), DPS (Windwalker) |
| `Paladin` | Holy, Protection, Retribution | Healer (Holy), Tank (Protection), DPS (Retribution) |
| `Priest` | Discipline, Holy, Shadow | Healer (Discipline, Holy), DPS (Shadow) |
| `Rogue` | Assassination, Outlaw, Subtlety | DPS (all) |
| `Shaman` | Elemental, Enhancement, Restoration | DPS (Elemental, Enhancement), Healer (Restoration) |
| `Warlock` | Affliction, Demonology, Destruction | DPS (all) |
| `Warrior` | Arms, Fury, Protection | DPS (Arms, Fury), Tank (Protection) |

The cron script validates `class` + `spec` + `role` for internal consistency (e.g. a player listed as `class: "Paladin", spec: "Holy", role: "dps"` will trigger a warning since Holy is a healer spec). The player is still fetched — this is a warning, not a hard error.

Class and spec are passed directly to WarcraftLogs in the `zoneRankings` query to ensure parses are compared against the correct spec bracket. If `spec` changes mid-season (e.g. a raider rerolls), the officer updates `roster.json`. Historical parses from the previous spec remain in history files with the old spec recorded against them — they are not retroactively altered.

The `status` field accepts two values:

| Value | Meaning |
|---|---|
| `"active"` | Player is polled by the cron job and shown in all dashboard views |
| `"inactive"` | Player is skipped entirely by the cron job — no API calls are made for them. They appear greyed out in the roster list with an "Inactive" badge but are not deleted, preserving their history |

To mark a player inactive, an officer sets `"status": "inactive"` in `roster.json` and pushes. The next cron run will skip them. Their existing history entries remain intact and are still viewable on their detail page. The `status` field defaults to `"active"` if omitted, for backwards compatibility.

### 7.2 `data/seasons/{season_id}/weeks/YYYY-WW.json` (written by cron, never edited)

One file per ISO week (e.g. `2026-20.json`), stored under `data/seasons/{season_id}/weeks/`. Weeks whose EU reset start is before the player's effective `tracking_start_date` are never written for that player — the cron script skips them silently.

There are two shapes of weekly file depending on the season type:

**For an M+ season** (e.g. `data/seasons/midnight-s1/weeks/2026-20.json`) — contains per-raider Mythic+ activity for that week:

```json
{
  "season_id": "midnight-s1",
  "week": "2026-20",
  "fetched_at": "2026-05-18T06:01:34Z",
  "raiders": [
    {
      "raider_id": "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a",
      "display_name": "Playername",
      "team_designation": "main",
      "active_character": "Charactername",
      "realm": "Draenor",
      "class": "DeathKnight",
      "spec": "Unholy",
      "role": "dps",
      "rio_score": 3241,
      "mplus_runs_this_week": [
        { "dungeon": "Maisara Caverns", "level": 12, "timed": true, "completed_at": "2026-05-16T21:14:00Z" }
      ],
      "mplus_weekly_count_at_or_above_minimum": 3,
      "mplus_total_dungeons_this_week": 6,
      "mplus_highest_key_this_week": 13,
      "mplus_requirement_met": false,
      "resilience_level": 13,
      "resilience_progress": {
        "Windrunner Spire": 15,
        "Maisara Caverns": 14,
        "Magisters' Terrace": 13,
        "Nexus-Point Xenas": 13,
        "Algeth'ar Academy": 16,
        "Seat of the Triumvirate": 13,
        "Skyreach": 12,
        "Pit of Saron": 14
      }
    }
  ]
}
```

**For a raid tier** (e.g. `data/seasons/raid-46/weeks/2026-20.json`) — contains per-raider parse data for that week, with both Heroic and Mythic difficulties stored together per boss:

```json
{
  "season_id": "raid-46",
  "week": "2026-20",
  "fetched_at": "2026-05-18T06:01:34Z",
  "raid_tier": {
    "wcl_zone_id": 46,
    "name": "The Voidspire",
    "bosses": [
      { "id": 2902, "name": "Solanar the Dawnbreaker" }
    ]
  },
  "raiders": [
    {
      "raider_id": "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a",
      "display_name": "Playername",
      "team_designation": "main",
      "active_character": "Charactername",
      "realm": "Draenor",
      "class": "DeathKnight",
      "spec": "Unholy",
      "role": "dps",
      "raid_parses": [
        {
          "boss_id": 2902,
          "boss_name": "Solanar the Dawnbreaker",
          "difficulties": {
            "heroic": {
              "kill": true,
              "parse_percentile": 88,
              "spec": "Unholy",
              "dps": 1540000
            },
            "mythic": {
              "kill": true,
              "parse_percentile": 74,
              "spec": "Unholy",
              "dps": 1284500
            }
          }
        }
      ]
    }
  ]
}
```

If a boss was not killed this week at a given difficulty, the entry for that difficulty is `{ "kill": false, "parse_percentile": null, "spec": null, "dps": null }`. If a boss was not killed at any difficulty, all entries under `difficulties` are present but `null`.

A raider error (e.g. `wcl_rate_limited`, `wcl_not_found`, `rio_not_found`) is stored on the raider entry as `"error": "<error_code>"` and the corresponding data fields are omitted or set to `null`.

### 7.3 `data/compliance.json` (written by cron, never edited)

A compact longitudinal record of each active player's M+ weekly compliance, appended to on every cron run. This is the source of truth for the "compliance history" chart on the raider detail page.

```json
{
  "last_updated": "2026-05-18T06:01:34Z",
  "raiders": {
    "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a": {
      "current_streak": 3,
      "longest_streak": 7,
      "total_weeks_met": 10,
      "total_weeks_tracked": 12,
      "record_dungeons_week": { "count": 14, "week": "2026-17" },
      "record_highest_key": { "level": 18, "week": "2026-15" },
      "resilience_level": 13,
      "resilience_history": [
        { "level": 10, "achieved_week": "2026-10" },
        { "level": 11, "achieved_week": "2026-12" },
        { "level": 13, "achieved_week": "2026-18" }
      ],
      "weeks": [
        {
          "week": "2026-19",
          "reset_start": "2026-05-07T07:00:00Z",
          "count": 5,
          "total_dungeons": 8,
          "highest_key_level": 15,
          "met": true
        },
        {
          "week": "2026-20",
          "reset_start": "2026-05-14T07:00:00Z",
          "count": 3,
          "total_dungeons": 3,
          "highest_key_level": 11,
          "met": false
        }
      ]
    }
  }
}
```

Rules:
- Only weeks at or after the player's effective `tracking_start_date` are written.
- Each cron run **upserts** the current week's entry (overwrites if the week already exists, appends if new). Previous weeks are never modified.
- If a player's data errors this run (`wcl_rate_limited`, `rio_not_found`, etc.), no entry is written for that week — the week is simply absent, not marked as failed.
- `current_streak`, `longest_streak`, `total_weeks_met`, `total_weeks_tracked`, and `record_dungeons_week` are recomputed and written by the cron on every run from the full `weeks` array. They are denormalised for fast UI reads — do not rely on them being correct if the file is hand-edited.
- `total_dungeons` per week is the raw count of **all** Mythic+ runs completed that reset regardless of key level — not just the ≥10 qualifying ones. This allows tracking total activity volume independently of the compliance requirement.
- `highest_key_level` per week is the single highest key level completed (timed or untimed) in that reset. Sourced from `mythic_plus_weekly_highest_level_runs` in the Raider.io response.
- `record_dungeons_week` stores the single week with the highest `total_dungeons`. If multiple weeks tie, the most recent is stored.
- `record_highest_key` stores the single week with the highest `highest_key_level` ever completed. If multiple weeks tie, the most recent is stored.
- `resilience_level` is the player's current Resilience achievement level for this M+ season — the highest key level at which all season dungeons have been timed. `null` if not yet achieved at any level. Stored under the season's `compliance.json`, so each season has its own independent Resilience progression.
- `resilience_history` is an append-only log of each time the Resilience level increased within this season, with the ISO week it was first achieved. This is never rewritten — only appended when the level goes up.
- Weeks with missing data (cron error) are excluded from streak computation — they neither break nor extend a streak.

### 7.4 `data/raider-history.json` (written by cron, never edited by officers)

A permanent record of every character and role assignment each raider has had, updated on every cron run from `roster.json`. Used to power the "raider history" timeline on the detail page.

```json
{
  "last_updated": "2026-05-18T06:01:34Z",
  "raiders": {
    "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a": {
      "display_name": "Playername",
      "team_designation": "main",
      "membership_history": [
        { "event": "joined", "date": "2025-10-01", "note": "Founding member" },
        {
          "event": "team_changed",
          "date": "2026-03-17",
          "from": "alt",
          "to": "main",
          "reason": "Consistently strong performance throughout Season 1 — promoted to main team for Midnight Season 1 progression"
        }
      ],
      "characters": [
        {
          "name": "Charactername",
          "realm": "Draenor",
          "class": "DeathKnight",
          "spec": "Unholy",
          "role": "dps",
          "active": true,
          "first_seen": "2025-11-15"
        },
        {
          "name": "Oldcharname",
          "realm": "Draenor",
          "class": "Priest",
          "spec": "Holy",
          "role": "healer",
          "active": false,
          "first_seen": "2025-10-01",
          "last_seen": "2025-11-14"
        }
      ],
      "role_history": [
        {
          "role": "healer",
          "class": "Priest",
          "spec": "Holy",
          "character": "Oldcharname",
          "from": "2025-10-01",
          "to": "2025-11-14"
        },
        {
          "role": "dps",
          "class": "DeathKnight",
          "spec": "Unholy",
          "character": "Charactername",
          "from": "2025-11-15",
          "to": null
        }
      ]
    }
  }
}
```

The cron syncs this file from `roster.json` on every run — it is a denormalised read-optimised copy of the roster's identity data, not an independent source of truth. History entries in `roster.json` are the canonical record; this file derives from them.

### 7.5 `data/changelog.json` (written by cron, never edited by officers)

A chronological log of every change to the team composition — who joined, who left, who changed designation, who rerolled, and who changed role. Written by the cron on every run by diffing the current `roster.json` against the previous snapshot. Officers do not edit this file directly; they update `roster.json` and the cron derives the changelog entry automatically.

```json
{
  "last_updated": "2026-05-18T06:01:34Z",
  "entries": [
    {
      "id": "a1b2c3d4-...",
      "timestamp": "2026-05-18T06:01:34Z",
      "week": "2026-20",
      "team": "main",
      "event": "joined",
      "raider_id": "a3f1c2d4-7e89-4b0a-bc34-1f2e3d4c5b6a",
      "display_name": "Playername",
      "character": "Charactername",
      "class": "DeathKnight",
      "spec": "Unholy",
      "role": "dps",
      "note": "Returning after Season 1 break"
    },
    {
      "id": "b2c3d4e5-...",
      "timestamp": "2026-04-01T06:01:34Z",
      "week": "2026-14",
      "team": "alt",
      "event": "left",
      "raider_id": "b4c2d1e3-...",
      "display_name": "Otherperson",
      "character": "Altchar",
      "class": "Mage",
      "spec": "Fire",
      "role": "dps",
      "note": ""
    },
    {
      "id": "c3d4e5f6-...",
      "timestamp": "2026-03-17T06:01:34Z",
      "week": "2026-11",
      "team": "main",
      "event": "team_changed",
      "raider_id": "c5d3e2f1-...",
      "display_name": "Thirdperson",
      "character": "Mainchar",
      "from": "alt",
      "to": "main",
      "reason": "Consistently strong performance throughout Season 1 — promoted to main team for Midnight Season 1 progression"
    },
    {
      "id": "d4e5f6g7-...",
      "timestamp": "2026-03-01T06:01:34Z",
      "week": "2026-09",
      "team": "main",
      "event": "rerolled",
      "raider_id": "d6e4f3g2-...",
      "display_name": "Fourthperson",
      "from_character": "Oldchar",
      "from_class": "Priest",
      "from_spec": "Holy",
      "to_character": "Newchar",
      "to_class": "Monk",
      "to_spec": "Mistweaver",
      "role": "healer",
      "note": ""
    },
    {
      "id": "e5f6g7h8-...",
      "timestamp": "2026-02-14T06:01:34Z",
      "week": "2026-07",
      "team": "main",
      "event": "role_changed",
      "raider_id": "e7f5g4h3-...",
      "display_name": "Fifthperson",
      "character": "Samechar",
      "from_spec": "Protection",
      "from_role": "tank",
      "to_spec": "Retribution",
      "to_role": "dps",
      "note": "Swapped to ret for progression"
    }
  ]
}
```

**Event types:**

| `event` | Trigger | Key fields |
|---|---|---|
| `joined` | `status` changed to `"active"` or new raider added | `team`, `character`, `class`, `spec`, `role`, `note` |
| `left` | `status` changed to `"inactive"` | `team`, `character`, `class`, `spec`, `role`, `note` |
| `team_changed` | `team_designation` changed — raider moves between Main and Alt | `from`, `to`, `reason` (required — must not be blank) |
| `rerolled` | Active character swapped (old `active: false`, new `active: true`) | `from_character`, `from_class`, `from_spec`, `to_character`, `to_class`, `to_spec`, `role` |
| `role_changed` | `spec` or `role` changed on the active character | `from_spec`, `from_role`, `to_spec`, `to_role`, `note` |
| `spec_changed` | `spec` changed but `role` stays the same | `from_spec`, `to_spec`, `note` |

**How the cron generates entries:**
1. Load the previous `roster.json` state from `changelog.json`'s last-written roster hash (stored as `"roster_hash"` at the top level of `changelog.json`).
2. Diff the current `roster.json` against it, field by field, per raider.
3. For each detected change, append a new entry with a UUID v4 `id` (via `crypto.randomUUID()`), the current ISO timestamp, and the relevant fields.
4. Entries are **append-only** — never modified or deleted after being written.
5. Officers add a `reason` (for `team_changed` events) or `note` (for `joined`/`left` events) to `membership_history` in `roster.json`; the cron copies the relevant field into the changelog entry.
6. If a `team_changed` event in `membership_history` has a blank or missing `reason`, the cron logs a warning: `"team_changed event for [display_name] on [date] is missing a reason — please add one to membership_history"`. The entry is still written, but `reason` is recorded as `"(no reason given)"` so the gap is visible on the changelog page.

**`team` field resolution:** derived from the raider's `team_designation` at the time of the event. A `team_changed` entry records both `from` and `to` designations and uses the *new* designation as `team`.

**Validation:** the cron checks that every `team_changed` event in `membership_history` is paired with a matching change in `team_designation`. If `team_designation` changed since the last cron run but no `team_changed` event exists in `membership_history`, the cron logs a warning: `"team_designation changed for [display_name] without a corresponding team_changed event in membership_history"`. Officers should add the missing event manually.

### 7.6 `data/seasons/{season_id}/snapshot.json`

Identical structure to a weekly file but always represents the most recent fetch for that season. The UI loads this for the "current" view. Each season has its own snapshot — the UI resolves the active season from `roster.json` to know which folder to read.

The active season IDs are also written to a small index file `data/seasons/index.json` at build time, so the SvelteKit static site does not need to parse `roster.json` at runtime:

```json
{
  "active_mplus_season": "midnight-s1",
  "active_raid_zones": ["raid-46"],
  "all_mplus_seasons": [
    { "season_id": "midnight-s1", "label": "Midnight Season 1", "start_date": "2026-03-24", "end_date": null }
  ],
  "all_raid_zones": [
    { "season_id": "raid-46", "label": "The Voidspire", "wcl_zone_id": 46, "start_date": "2026-03-17", "end_date": null }
  ]
}
```

This index is written by the cron on every run and read by SvelteKit via `import.meta.glob` or a static fetch.

---

## 16. Configuration

All officer-configurable values live in `data/roster.json`, not hardcoded in source:

| Field | Default | Meaning |
|---|---|---|
| `mplus_weekly_minimum` | 4 | Keys per week required |
| `mplus_minimum_key_level` | 10 | Minimum key level to count |
| `tracking_start_date` | (set by officer) | ISO date; data before this date is ignored globally |
| `seasons[]` | (managed by officer) | Array of M+ season and raid tier definitions — see season management below |

#### Season management

**M+ seasons** are managed manually in `mplus_seasons[]` in `roster.json` — the dungeon pool is not queryable from any API, so officers must define it when a new season launches. No code changes required, just a new array entry and a push.

**Raid tiers are fully automatic.** The cron detects all active raid zones for the configured expansion (`wcl_expansion_id`) directly from WarcraftLogs on every run. When a new tier releases mid-patch, the cron picks it up automatically — no officer action needed. Each detected zone becomes its own season folder, keyed by the WCL zone ID.

**Raid difficulties** are controlled by `raid_difficulties` in `roster.json`. Currently `["heroic", "mythic"]`. Officers can add or remove difficulties here without a code change (e.g. if the team starts running Normal or skips Heroic entirely in a future tier).

**To start a new M+ season** (officer action required):
1. Set `end_date` on the current `mplus_seasons` entry.
2. Append a new entry with the new `season_id`, `start_date`, `dungeon_count`, and `dungeons` list.
3. Push. The next cron run switches automatically.

**To start a new raid tier** (no officer action required):
The cron queries WarcraftLogs `worldData { expansion(id: $expansionId) { zones { id name difficulties { id name } encounters { id name } } } }` on every run. It compares the returned zones against the existing `data/seasons/raid-*/` folders. Any zone not yet represented gets a new folder created automatically, and tracking begins from the current week.

**Active season resolution:**
- M+: the `mplus_seasons` entry with `end_date: null`.
- Raid: all WCL zones for the expansion that have at least one kill in a public log this week (queried via a lightweight probe). If a new zone has zero kills yet, it is registered but not fetched until kills appear.

**Season IDs:**
- M+: kebab-case string from `season_id` field (e.g. `"midnight-s1"`).
- Raid: `"raid-{wcl_zone_id}"` (e.g. `"raid-46"`). Using the numeric zone ID as the key means no officer input is needed and there is no collision risk.

To change the threshold, an officer edits `roster.json` and pushes — the next deploy picks it up.

---

## 18. Edge Cases and Error States

| Scenario | Handling |
|---|---|
| Player not found on WCL (no logs) | Show "—" across all boss cells; tooltip "No WarcraftLogs data found" |
| Player not found on Raider.io | Show "—" for RIO and key count; status badge shows "No data" in grey |
| Boss not killed this week | Parse cell shows "—" (dash); excluded from trend line on detail chart |
| WCL API rate limit hit mid-run | Script catches 429, waits 60s, retries once; if it fails again, writes partial data and exits with code 1 (Action fails, sends notification) |
| First week of a new tier (no history) | Charts render with a single point; no crash |
| Player on a different realm (alt) | `realm` field in roster.json per player; fetch script uses per-player realm |
| Data exists before `tracking_start_date` | WCL/Raider.io may return historical data; fetch script discards any entry whose reset week predates the player's effective start date before writing |
| Player's per-player start date is before the global start date | Per-player date is used as-is; no enforcement that it must be ≥ global date — officer's responsibility |
| `tracking_start_date` not set in `roster.json` | Fetch script logs a warning and defaults to the current ISO week, preventing runaway historical ingestion |
| Character name with special chars (e.g. accented EU names) | URL-encode name in Raider.io requests; WCL GraphQL accepts UTF-8 string directly |
| Player has invalid `class`/`spec` combination in `roster.json` | Cron logs a warning and fetches without `specName` filter, falling back to overall parse bracket |
| Player switches spec mid-season | Officer updates the active character entry in `roster.json` and appends a new `role_history` entry with the new spec and today's date; historical parses retain the spec that was logged |
| Player rerolls to a different class | Officer sets the old character to `"active": false` (polling stops immediately) and adds a new character entry with `"active": true` (polling begins next run); appends a new `role_history` entry; old character's parse and compliance history is preserved under `raider_id` and remains viewable on the detail page |
| Character set to `"active": false` | That character is excluded from all WarcraftLogs and Raider.io API calls unconditionally — no exceptions. The fetch script enforces this before batching. |
| `"active"` field missing from a character entry | Treated as `false` — the character is not polled. The cron logs a warning prompting the officer to add the field explicitly. |
| Player realm-transfers | Old character entry gains `"active": false` and `"last_seen"` date; new character added with same `raider_id`; all history continues unbroken |
| Player leaves team mid-season | Officer sets `"status": "inactive"` and appends `{ "event": "left", "date": "...", "note": "..." }` to `membership_history`; cron stops polling; historical data preserved |
| Player rejoins after leaving | Officer sets `"status": "active"` and appends `{ "event": "joined", "date": "..." }` to `membership_history`; cron resumes polling from that week; gap weeks are absent from compliance history (not marked as failures) |
| Raider moves from Alt to Main (or vice versa) | Officer updates `team_designation` in `roster.json` AND appends a `team_changed` event to `membership_history` with a non-empty `reason`; cron writes a `team_changed` entry to `changelog.json` and updates `designation_history`; old season designation is preserved |
| `team_changed` event missing a reason | Cron logs a warning and writes `"(no reason given)"` to the changelog; event is not suppressed — the gap is visible |
| `team_designation` changed without a `team_changed` event | Cron logs a warning; officers should add the missing event retrospectively |
| Raider is both Main and Alt simultaneously | Not supported — `team_designation` is a single value. If a raider plays both a main and an alt character, both characters live under the same `raider_id` with the designation reflecting their primary commitment to this team |
| Player renames character | Same as realm-transfer — old entry archived, new entry added; `raider_id` links the history |
| Two active characters in one week | Both are fetched; parses from each are stored against the relevant character name; compliance (M+ runs) sums across both characters for that week |
| Devourer Demon Hunter spec (new in Midnight) | Treated as a standard DPS spec; class colour is standard DH purple; WCL `specName: "Devourer"` is passed in queries |
| GitHub Pages URL path (subfolder) | Set `base` path in `svelte.config.js` to match the repo name |

---

