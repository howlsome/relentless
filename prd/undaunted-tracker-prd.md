# PRD — Undaunted: Relentless Performance Tracker

**Version:** 1.0  
**Date:** 2026-05-12  
**Status:** Ready for build  
**Expansion:** World of Warcraft: Midnight  
**Current season:** Midnight Season 1 (started 17 March 2026)  

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
      "mplus_requirement_met": false
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

## 9. WarcraftLogs API Rate Limit Analysis

### The limit

WarcraftLogs API v2 operates on a **point budget system**: free API client accounts are allocated **3,600 points per hour**. Patreon subscribers can raise this to **36,000 points per hour**. The hourly budget resets on a rolling window.

There is also an undocumented **burst / concurrency limit** that causes 429 errors even when the hourly budget has not been exhausted. Community reports indicate rapid-fire sequential requests (dozens in seconds) trigger this secondary limit. The safe approach is to space requests out rather than fire them all at once.

### Point cost per request

WarcraftLogs does not publish an explicit per-query point cost in their documentation. Based on community reports and observed behaviour, a single `characterData { character { zoneRankings } }` query (the kind used to fetch one player's boss parses) costs approximately **3–6 points**. A conservative estimate of **6 points per character query** is used below for planning purposes.

### Raider.io

Raider.io's public REST API has **no documented rate limit** for the endpoints used (`/characters/profile`). In practice it is generous for low-volume automated use. No point budget concerns apply here.

### How many active raiders can be fetched within the free limit?

| Scenario | Per-player WCL queries | Est. points each | Total WCL points | Free budget (3,600 pts/hr) | Fits in one run? |
|---|---|---|---|---|---|
| 10 active raiders | 10 | 6 | 60 | ✅ Yes | Yes — trivially |
| 20 active raiders | 20 | 6 | 120 | ✅ Yes | Yes |
| 40 active raiders | 40 | 6 | 240 | ✅ Yes | Yes |
| 100 active raiders | 100 | 6 | 600 | ✅ Yes | Yes |
| 600 active raiders | 600 | 6 | 3,600 | ⚠️ At limit | Borderline |

**For a typical guild team of 10–30 active raiders the free tier is entirely sufficient.** The hourly budget is not the concern — the burst limit is.

### Recommended fetch strategy (batched)

WarcraftLogs GraphQL supports **multi-character aliased queries** — multiple character lookups can be sent in a single HTTP request by aliasing each one. The fetch script uses this to send players in batches of 10 per request, then waits for the full batch to resolve before sending the next one.

**How a batched query looks:**

```graphql
{
  p0: characterData { character(name: "Raider1", serverSlug: "draenor", serverRegion: "eu") { zoneRankings(zoneID: $zoneId, difficulty: 5) { rankings { ... } } } }
  p1: characterData { character(name: "Raider2", serverSlug: "draenor", serverRegion: "eu") { zoneRankings(zoneID: $zoneId, difficulty: 5) { rankings { ... } } } }
  ...
  p9: characterData { character(name: "Raider10", serverSlug: "draenor", serverRegion: "eu") { zoneRankings(zoneID: $zoneId, difficulty: 5) { rankings { ... } } } }
}
```

WCL returns all 10 results under their respective alias keys (`p0`, `p1`, … `p9`) in a single response. This counts as **one request** against the burst limiter regardless of how many characters are in the batch.

**Fetch algorithm:**

1. Filter `roster.json` to only raiders with `"status": "active"`.
   Within each active raider, filter their `characters[]` to only entries where `"active": true`. **Do not include any character where `active` is `false` or absent in any API call.** This filter runs before any batch is constructed — inactive characters must never appear in a GraphQL alias.
1a. For each active raider, resolve their **active character(s)**: entries in `characters[]` where `"active": true`.

**Characters with `"active": false` are unconditionally excluded from all API calls.** The fetch script must not query WarcraftLogs or Raider.io for any character where `active` is `false` or where the `active` field is absent (treat missing as `false`). This is enforced before any batching logic runs — inactive characters never enter the batch query.

If multiple characters are `"active": true`, all are fetched and merged — WCL parses and Raider.io data are collected per character and associated with the raider's `raider_id`.

If a raider has no characters with `"active": true`, log a warning (`"Raider [display_name] has no active characters — skipping"`) and skip that raider entirely for this run.
1b. For each active raider, compute their **effective tracking start date**: their own `tracking_start_date` if set, otherwise the top-level `tracking_start_date`. Determine the ISO week of that date. Any WCL or Raider.io data from resets *before* that week is discarded after fetching — it is never written to history files.
2. Split the active player list into chunks of 10.
3. For each chunk:
   a. Build and send the aliased batch GraphQL query.
   b. Parse the response, mapping each alias back to its player.
   c. Wait **2 seconds** before sending the next batch (courteous pacing; not strictly required but avoids any burst edge cases).
4. After all WCL batches complete, run Raider.io requests. Raider.io has no meaningful rate limit for this volume, but still pace them at **5 concurrent requests max** using `Promise.allSettled` in groups.
5. Merge WCL + Raider.io results per player and write the JSON output files.

**Retry logic:**
- If a batch returns a 429, wait **15 seconds** and retry the entire batch once.
- If it 429s again, log a warning per player in that batch (`"error": "wcl_rate_limited"`) and continue to the next batch — do not abort the run.
- Monitor `X-RateLimit-Remaining` in response headers; if it drops below 50 points, pause until `X-RateLimit-Reset`.

**WCL OAuth token:** obtain once at run start and reuse for all batches. Tokens are valid for 24 hours. Cache the token and expiry in a run-scoped variable — do not re-request it per batch.

### Batch size rationale

| Batch size | HTTP requests for 20 raiders | HTTP requests for 30 raiders | Risk |
|---|---|---|---|
| 1 (sequential) | 20 | 30 | Higher burst exposure |
| **10 (recommended)** | **2** | **3** | **Low — well within limits** |
| 20 | 1 | 2 | Approaches WCL alias depth limits |

A batch of 10 is the sweet spot: few enough HTTP requests to stay clear of the burst limiter, small enough that a single failed batch only affects 10 players rather than the whole roster.

### If the roster grows beyond ~50 active players

The batched approach scales cleanly — 50 players = 5 batches = 5 HTTP requests, still trivially within the free tier. Consider subscribing to WarcraftLogs Patreon (10× point increase to 36,000/hr) only if point budget warnings start appearing in cron logs. At no realistic team size should the budget be exhausted; only the burst limiter warrants care.

---

## 10. Data Fetch Script (`scripts/fetch.mjs`)

### 10.1 Step 1 — Determine current raid tier

Query WarcraftLogs GraphQL for the active World of Warcraft raid zone:

```graphql
{
  worldData {
    zone(id: null) {
      # Use the most recently active zone for the expansion
    }
  }
}
```

Specifically: query `worldData { expansions }`, find Midnight (id=10), get its zones, pick the highest-id active zone. Cache zone + boss list in the weekly JSON.

### 10.2 Step 2 — Per-player WarcraftLogs data

For each player in `roster.json`, query:

```graphql
{
  characterData {
    character(name: "Charactername", serverSlug: "draenor", serverRegion: "eu") {
      zoneRankings(zoneID: $zoneId, difficulty: 5) {
        rankings {
          encounter { id name }
          rankPercent
          bestAmount
          kills { total }
        }
      }
    }
  }
}
```

- `difficulty: 5` = Mythic. If the character has no mythic kills for a boss, `rankPercent` will be null → store `kill: false, parse_percentile: null`.
- `specName` is passed from the player's `spec` field in `roster.json` so parses are compared against the correct spec bracket (e.g. Unholy DK parses are not compared against Blood DK).
- Use the **best parse for the current week** (filter by `startTime` within the current reset window: EU resets Wednesday 07:00 UTC).
- The reset week runs Wednesday 07:00 UTC → following Wednesday 06:59 UTC.
- The `spec` field returned in rankings is stored in the parse entry — this captures the spec actually used in the log, which may differ from `roster.json` if the player switched mid-week.

### 10.3 Step 3 — Per-player Raider.io data

```
GET https://raider.io/api/v1/characters/profile
  ?region=eu
  &realm=draenor
  &name=Charactername
  &fields=mythic_plus_scores_by_season:current,mythic_plus_weekly_highest_level_runs
```

Extract:
- `mythic_plus_scores_by_season[0].scores.all` → current overall RIO score.
- `mythic_plus_weekly_highest_level_runs` → array of runs completed in the current weekly reset. Count those with `mythic_level >= roster.mplus_minimum_key_level`.

### 10.4 Error handling

- If WCL returns an error for a character (e.g. no logs, name not found), log a warning and write `"error": "wcl_not_found"` for that player. Do not abort the whole run.
- If Raider.io 404s for a character, write `"error": "rio_not_found"`.
- The UI must handle missing/error entries gracefully (show "—" in place of missing values).

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

#### Summary stat row

Four glanceable stat cards across the top of the page (stacks to 2×2 on mobile):

| Card | Value | Notes |
|---|---|---|
| Raiders on track | N / total active | Green if all on track, amber if any below |
| Team avg parse | Average parse % across all bosses this week | Coloured by parse bracket |
| Highest key this week | Best key level across the entire team | With raider name subtitle |

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

**Current level badge:**

**Progress to next level** — a dungeon-by-dungeon breakdown table:

| Dungeon | Best timed | Next level needed | Status |
|---|---|---|---|
| Cinderbrew Meadery | +14 | +14 | ✅ Ready |
| Darkflame Cleft | +13 | +14 | ❌ Need +1 |
| Operation: Mechagon - Workshop | +12 | +14 | ❌ Need +2 |
| … | … | … | … |

- Dungeons already meeting the next level show ✅. Dungeons that are the bottleneck show ❌ with how many levels short they are.
- The bottleneck dungeon(s) — those furthest below the target — are highlighted in amber so the raider knows exactly where to focus.

```
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
| Dungeon volume up | `total_dungeons` this week > last week by ≥ 3 | "⬆️ Big week — [n] dungeons, up [delta] from last week!" |
| Dungeon volume down | `total_dungeons` this week < last week by ≥ 3 | "⬇️ Quieter week — [n] dungeons, down [delta] from last week." |

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

## 12. Mobile-First Design

The app is designed for mobile viewports first, then progressively enhanced for tablet and desktop. Officers should be able to glance at the dashboard on a phone during or between raid nights.

### Breakpoints

| Name | Min width | Target device |
|---|---|---|
| Base (mobile) | 0px | Phone (360–430px wide) |
| Tablet | 640px | iPad / large phone landscape |
| Desktop | 1024px | Laptop / monitor |

### Mobile layout rules

- All CSS must be written mobile-first: base styles target small screens; `min-width` media queries add complexity upward.
- PicoCSS's fluid container is used throughout — no fixed-width wrappers on mobile.
- **M+ status table (dashboard):** On mobile, the table collapses to a card-per-raider layout (CSS `display: grid` or stacked `<dl>` inside each row). The full table layout is restored at the tablet breakpoint.
- **Raid parse overview table:** On mobile this table is horizontally scrollable (`overflow-x: auto` on a wrapper element) — it will have many boss columns and cannot collapse without losing meaning. A sticky first column (raider name) is preserved while scrolling.
- **Boss parse charts (detail page):** SVG charts are responsive — `viewBox` is fixed, `width: 100%` with no explicit height, so they scale to the container. Axis labels use a minimum 12px font size (never smaller on any viewport).
- **Navigation:** A single top nav bar. On mobile the nav collapses to a hamburger or a simple full-width stacked list — PicoCSS's `<nav>` component handles this.
- **Touch targets:** All interactive elements (sort buttons, links, badges) must be at least 44×44px tap target size per WCAG 2.5.5.
- **Viewport meta tag:** `<meta name="viewport" content="width=device-width, initial-scale=1">` must be present in `app.html`.
- **Font sizes:** Base body font size 16px minimum. No text below 14px anywhere. Parse percentile values in table cells should be large enough to read at a glance (minimum 16px, bold).

### What "glanceable" means for each view

- **Dashboard M+ table:** An officer should be able to see who is red (below target) without scrolling or zooming on a standard phone.
- **Dashboard parse table:** Horizontal scroll is acceptable; the raider name column stays sticky so context is never lost.
- **Raider detail:** Summary bar (RIO score, key count, status) is visible above the fold on a phone without scrolling.

---

## 13. Light / Dark Mode

PicoCSS ships with full light and dark colour schemes out of the box. The app must support both and let the user toggle between them.

### Implementation

- Set `data-theme="auto"` on the `<html>` element as the default. This makes PicoCSS follow the OS-level `prefers-color-scheme` preference automatically on first load.
- A toggle button (sun / moon icon) in the top nav bar lets the user override the OS preference. Clicking it switches `data-theme` between `"light"` and `"dark"` on the `<html>` element.
- The chosen preference is persisted to `localStorage` under the key `"theme"` so it survives page refreshes and navigation between routes.
- On mount, `+layout.svelte` reads `localStorage` and applies the stored value (or falls back to `"auto"` if nothing is stored).

### Parse colour brackets in dark mode

The parse percentile colours (gold, pink, orange, purple, blue, green, grey) must maintain WCAG 4.5:1 contrast ratio against both PicoCSS's light and dark background tokens. Define them as CSS custom properties scoped under both `[data-theme="light"]` and `[data-theme="dark"]` selectors (or a single set that works on both if contrast allows).

### Chart colours in dark mode

SVG chart lines and axis labels must use CSS custom properties tied to PicoCSS's colour tokens (`--pico-color`, `--pico-muted-color`, `--pico-primary`) so they automatically adapt when `data-theme` changes. Never hardcode `#hex` colours directly in SVG attributes for themed elements — use `currentColor` or CSS variables.

### Acceptance notes

- On first visit with no stored preference, the site matches the OS colour scheme.
- Toggling theme updates the page instantly with no flash or reload.
- The toggle button label / aria-label updates to reflect the current state (e.g. `aria-label="Switch to light mode"` when dark is active).
- No separate stylesheet or build-time flag is needed — PicoCSS handles the colour swap entirely via the `data-theme` attribute.

---

## 14. Accessibility Requirements (WCAG 2.1 AA)

- All interactive elements (table sort buttons, nav links) must have visible focus indicators.
- Colour alone must never be the only indicator of meaning — parse badges show both colour and text label; the M+ status badge shows both colour and text.
- All SVG charts must have a `<title>` and `<desc>` element, and an `aria-label` on the `<svg>` element summarising the data (e.g. "Vexie parse history for Charactername — 5 weeks of data, latest 74%").
- Data tables must use `<th scope="col">` and `<th scope="row">` correctly.
- PicoCSS provides a good baseline; do not override its focus styles.
- The site must be fully navigable by keyboard.
- Text contrast ratios must meet 4.5:1 for normal text, 3:1 for large text.
- No content that flashes more than 3 times per second.

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
    ...seasonIds.map(id => `/season/${id}`)
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

## 17. Environment Variables / Secrets

| Variable | Where | Purpose |
|---|---|---|
| `WCL_CLIENT_ID` | GitHub Actions secret | WarcraftLogs OAuth client ID |
| `WCL_CLIENT_SECRET` | GitHub Actions secret | WarcraftLogs OAuth client secret |
| `GH_PAT` | GitHub Actions secret | PAT for committing data and triggering deploy |

The SvelteKit frontend reads no environment variables — all data is in static JSON files.

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

## 20. Out of Scope (Future Consideration)

- Push notifications or Discord webhooks when someone falls below the M+ threshold.
- Normal raid difficulty parse tracking (currently Heroic and Mythic are tracked — Normal can be added by appending it to `raid_difficulties` in roster.json without code changes).
- Historic tier comparisons (only current expansion tier is tracked).
- Attendance tracking (who was in the raid log).
- Officer write UI (roster is edited via Git directly for now).

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
- [ ] The progress table correctly identifies bottleneck dungeons and highlights them in amber.
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
- [ ] On first visit, the site matches the OS colour scheme (light or dark) with no flash.
- [ ] The theme toggle in the nav switches the site between light and dark instantly with no reload.
- [ ] The chosen theme persists across page navigation and browser refresh via `localStorage`.
- [ ] All parse percentile colours and SVG chart elements meet 4.5:1 contrast in both light and dark themes.
