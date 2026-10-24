# WoWAudit API

WoWAudit exposes a REST API (Swagger 2.0) for each guild team. The interactive
Swagger UI for Undaunted: Relentless lives at:

```
https://wowaudit.com/eu/draenor/undaunted/relentless
```

(Requires a WoWAudit login to view — navigate to the team, then open Settings →
API.)

## Authentication

All requests require a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is stored in `.env` as `WOW_AUDIT_API_KEY` and must never be
committed to the repository. `.env` is already listed in `.gitignore`.

In scripts, load it via:

```ts
const apiKey = process.env.WOW_AUDIT_API_KEY;
if (!apiKey) throw new Error('WOW_AUDIT_API_KEY is not set');

const res = await fetch('https://wowaudit.com/v1/team', {
  headers: { Authorization: `Bearer ${apiKey}` },
});
```

The key is scoped to the **Undaunted: Relentless** team (id `34773`, region EU,
realm Draenor). Only team admins can generate or rotate it — do so from the
Settings → API page on wowaudit.com.

## Base URL

```
https://wowaudit.com/v1
```

All endpoints are relative to this base.

---

## Rate Limits

The API enforces rate limiting. A `429` response means the limit has been hit.
Back off for **60 seconds** before retrying — the WoWAudit source logs
"API limit reached. Waiting one minute before trying again."

---

## Data Freshness

The `last_refreshed` object on `GET /v1/team` shows when each data source was
last synced:

| Key | Source |
|-----|--------|
| `blizzard` | Blizzard's game API (armory, items) |
| `percentiles` | Parse percentile data |
| `mythic_plus` | Raider.io M+ data |

Raid signup data (attendance, selections) updates within minutes of a raid
ending. M+ and armory data may lag by up to a few hours.

---

## Endpoints

### `GET /v1/team`

Returns team metadata and the configured raid schedule.

**Response**
```json
{
  "name": "Relentless",
  "id": 34773,
  "guild_name": "Undaunted",
  "url": "https://wowaudit.com/eu/draenor/undaunted/relentless",
  "last_refreshed": {
    "blizzard": "2026-06-01T09:41:08.000+00:00",
    "percentiles": "2026-05-31T20:23:36.000+00:00",
    "mythic_plus": "2026-06-01T08:10:43.000+00:00"
  },
  "raid_days": [
    {
      "week_day": "Monday",
      "start_time": "20:30",
      "end_time": "22:30",
      "current_instance": "March on Quel'Danas",
      "difficulty": "Mythic",
      "active_from": "2021-02-01"
    },
    {
      "week_day": "Wednesday",
      "start_time": "20:30",
      "end_time": "22:30",
      "current_instance": "March on Quel'Danas",
      "difficulty": "Mythic",
      "active_from": "2021-02-01"
    }
  ],
  "wishlist_updated_at": 1780290000
}
```

**Field notes**
- `wishlist_updated_at` — Unix timestamp of the last Droptimizer wishlist upload.
- `raid_days` lists all scheduled raid slots; `active_from` indicates when that
  slot configuration came into effect.

---

### `GET /v1/period`

Returns the current WoW period number and active season. Use this to get the
`keystone_season_id` required by `GET /v1/loot_history/{id}` and the `period`
used by `GET /v1/historical_data`.

**Response**
```json
{
  "current_period": 1065,
  "current_season": {
    "id": 9,
    "name": "Midnight (Season 1)",
    "start_date": "2026-03-17",
    "end_date": null,
    "kind": "live",
    "expansion": "Midnight",
    "keystone_season_id": 17,
    "pvp_season_id": 41,
    "first_period_id": 1055,
    "instance_ids": [73, 74, 75]
  }
}
```

**Field notes**
- `current_period` — Blizzard's weekly period ID. Increments every Tuesday (US)
  / Wednesday (EU) reset.
- `keystone_season_id` — Pass this as the `{id}` path parameter to
  `GET /v1/loot_history/{id}`.
- `instance_ids` — Blizzard instance IDs for the current season's raid zones.
- `end_date` is `null` while the season is active.

---

### `GET /v1/raids`

Returns the team's raid schedule. By default returns only **upcoming** raids.
Pass `include_past=true` to include completed raids.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include_past` | boolean | Include raids with `status: "Locked"` (past raids). Defaults to `false`. |

**Response**
```json
{
  "raids": [
    {
      "id": 2638454,
      "date": "2026-06-01",
      "start_time": "20:30",
      "end_time": "22:30",
      "instance": "The Voidspire",
      "instances": ["The Voidspire", "The Dreamrift", "March on Quel'Danas"],
      "season_id": 9,
      "optional": false,
      "difficulty": "Mythic",
      "status": "Locked",
      "present_size": 13,
      "total_size": 16
    }
  ]
}
```

**`status` values**

| Value | Meaning |
|-------|---------|
| `"Locked"` | Past raid — attendance is final |
| `"Planned"` | Future raid — signups may still change |

**Field notes**
- `present_size` / `total_size` — Only meaningful for `"Locked"` raids.
- `instances` — All raid zones active on that night (the team may clear
  multiple instances in one session).
- `optional: true` raids are excluded from attendance statistics on wowaudit.com.

**Write operations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/raids` | Create a raid |
| `PUT` | `/v1/raids/{id}` | Update a raid |
| `DELETE` | `/v1/raids/{id}` | Delete a raid |

---

### `GET /v1/raids/{id}`

Returns full detail for a single raid, including per-character signups.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | WoWAudit raid ID (from `GET /v1/raids`) |

**Response**
```json
{
  "id": 2638454,
  "date": "2026-06-01",
  "start_time": "20:30",
  "end_time": "22:30",
  "instance": "The Voidspire",
  "instances": ["The Voidspire", "The Dreamrift", "March on Quel'Danas"],
  "season_id": 9,
  "optional": false,
  "difficulty": "Mythic",
  "status": "Locked",
  "present_size": 13,
  "total_size": 16,
  "notes": null,
  "selections_image": "https://data.wowaudit.com/selections/2638454/....png",
  "signups": [
    {
      "character": {
        "id": 5073976,
        "name": "Eyeballshurt",
        "realm": "Draenor",
        "class": "Demon Hunter",
        "role": "Melee",
        "guest": false
      },
      "status": "Present",
      "comment": null,
      "selected": true,
      "class": "Demon Hunter",
      "role": "Melee"
    }
  ]
}
```

**Signup `status` values**

| Value | Meaning |
|-------|---------|
| `"Present"` | Character attended the raid |
| `"Absent"` | Character signed up but did not attend |
| `"Tentative"` | Character marked tentative; may or may not have been present |

**Field notes**
- `selected: true` — The character was in the active raid roster for that night
  (as opposed to bench/standby). A character can be `"Absent"` but still
  `selected: false` if they never signed up.
- `guest: true` on the nested `character` object means this was a one-off invite,
  not a permanent roster member. Guests also appear in `GET /v1/guests`.
- `selections_image` — URL to a screenshot of the roster comp generated by
  WoWAudit. `null` for future raids.
- `comment` — Optional note the raider left when signing up.

---

### `GET /v1/attendance`

Returns **aggregated** attendance statistics per character across a date range.
Supports filtering to a specific instance or encounter.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | `YYYY-MM-DD` | Include only raids on or after this date |
| `end_date` | `YYYY-MM-DD` | Include only raids on or before this date. Defaults to today |
| `instance` | string | Scope to raids in the named instance (e.g. `"The Voidspire"`) |
| `encounter` | string | Scope to a specific boss name or encounter ID. Requires `instance` to be set |

**Example — current season only**
```
GET /v1/attendance?start_date=2026-03-17
```

**Response**
```json
{
  "start_date": "2026-03-17",
  "end_date": "2026-06-01",
  "characters": [
    {
      "id": 5068324,
      "name": "Hxwl",
      "class": "Shaman",
      "role": "Ranged",
      "attended_amount_of_raids": 4,
      "total_amount_of_raids": 4,
      "attended_percentage": 100.0,
      "selected_amount_of_encounters": 4,
      "total_amount_of_encounters": 4,
      "selected_percentage": 100.0
    }
  ]
}
```

**Field notes**
- `attended_amount_of_raids` — Count of raids where the character's status was
  `"Present"`.
- `total_amount_of_raids` — Count of raids the character was a signup for.
  Characters with zero signups in the period may not appear in the list at all.
- `attended_percentage` — `attended / total * 100`. Note: can be `null` when
  filtering by encounter if the instance filter also returns no data.
- `selected_amount_of_encounters` — Boss encounters where the character was
  in the active roster (`selected: true` in the raid signup).
- `selected_percentage` — Encounter selection rate; independent of raw attendance.
  A character who attends every raid but is frequently benched will have a high
  `attended_percentage` but a lower `selected_percentage`.

---

### `GET /v1/characters`

Returns all non-guest characters currently tracked by the team.

**Response** (array)
```json
[
  {
    "id": 5087796,
    "name": "Qrysocorax",
    "realm": "Argent Dawn",
    "class": "Druid",
    "role": "Ranged",
    "rank": "Main",
    "status": "tracking",
    "note": null,
    "blizzard_id": 166312522,
    "tracking_since": "2026-05-17T18:39:21.000Z"
  }
]
```

**`rank` values** — Custom ranks configured in WoWAudit team settings. Common
values observed in this team:

| Value | Meaning |
|-------|---------|
| `"Main"` | Primary raider |
| `"Alt"` | Alternate character |
| `"Alt (Main FL)"` | Alt flagged as main for the friend list |

**`status` values**

| Value | Meaning |
|-------|---------|
| `"tracking"` | Active — included in snapshots and statistics |
| `"not_tracking"` | Inactive / benched — excluded from snapshots |

**Field notes**
- `blizzard_id` — Blizzard's internal character ID. Stable across realm
  transfers and name changes.
- `tracking_since` — When the character was added to WoWAudit tracking.

**Write operations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/characters` | Add a character to tracking |
| `PUT` | `/v1/characters/{id}` | Update a character (rank, note, status, etc.) |
| `DELETE` | `/v1/characters/{id}` | Remove a character from tracking |

---

### `GET /v1/guests`

Returns one-off guest characters who were invited to specific raids but are not
on the permanent roster.

**Response** (array)
```json
[
  {
    "id": 5099020,
    "name": "Apocalypseki",
    "realm": "Draenor",
    "class": "Death Knight",
    "role": "Melee",
    "blizzard_id": 163276403,
    "tracking_since": "2026-05-25T21:33:43.000Z"
  }
]
```

**Field notes**
- Guests appear in raid `signups` with `"guest": true`.
- Guests are not included in `GET /v1/characters`.

**Write operations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/guests` | Add a guest character |
| `DELETE` | `/v1/guests/{id}` | Remove a guest |

---

### `GET /v1/historical_data`

Returns M+ dungeon activity per character for the **current** period. Use
`GET /v1/period` to get the current period number.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | integer | Specific period to query. Defaults to the current period |

**Response**
```json
{
  "period": 1065,
  "characters": [
    {
      "id": 5087798,
      "name": "Thômâtschô",
      "realm": "Antonidas",
      "data": {
        "dungeons_done": [
          { "level": 17, "dungeon": 557 },
          { "level": 15, "dungeon": 558 }
        ],
        "world_quests_done": 11,
        "regular_mythic_dungeons_done": 3,
        "vault_options": {
          "raids": { "option_1": 246, "option_2": null, "option_3": null },
          "mythic_plus": { "option_1": 246, "option_2": null, "option_3": null },
          "pvp": { "option_1": null, "option_2": null, "option_3": null }
        }
      }
    }
  ]
}
```

**Field notes**
- `dungeon` — Blizzard's dungeon instance ID (not a name).
- `vault_options` — Item level of each available Great Vault choice. `null`
  means that slot hasn't been unlocked yet (requires 1 / 4 / 8 M+ runs for
  `mythic_plus` slots).
- `regular_mythic_dungeons_done` — Non-keystone mythic clears.

---

### `GET /v1/historical_data/{id}`

Returns the full M+ history for a **single character** across all tracked
periods (oldest to newest).

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | WoWAudit character ID (from `GET /v1/characters`) |

**Response**
```json
{
  "character": { "id": 5087798, "name": "Thômâtschô", "realm": "Antonidas" },
  "history": [
    {
      "dungeons_done": [
        { "level": 14, "dungeon": 161 },
        { "level": 16, "dungeon": 556 }
      ],
      "world_quests_done": 7,
      "regular_mythic_dungeons_done": 2,
      "vault_options": {
        "raids": { "option_1": 226, "option_2": null, "option_3": null },
        "mythic_plus": { "option_1": 226, "option_2": null, "option_3": null },
        "pvp": { "option_1": null, "option_2": null, "option_3": null }
      }
    }
  ]
}
```

**Field notes**
- `history` is an array ordered oldest-first, one entry per tracked period.
- The number of entries depends on how long the character has been tracked.

---

### `GET /v1/loot_history/{id}`

Returns the complete loot distribution history for a season for **all**
characters on the team.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | Keystone season ID — retrieve from `current_season.keystone_season_id` in `GET /v1/period`. For Midnight Season 1 this is `17` |

**Response**
```json
{
  "history_items": [
    {
      "id": 2,
      "rclootcouncil_id": "1715197229-1",
      "item_id": 207149,
      "name": "Phlegethic Girdle",
      "icon": "inv_plate_raiddeathknightemerald_d_01_belt",
      "slot": "Waist",
      "quality": "epic",
      "character_id": 2,
      "awarded_by_character_id": 1,
      "awarded_by_name": "Sheday-Stormrage",
      "awarded_at": "2024-10-01T19:52:58.006Z",
      "difficulty": "mythic",
      "discarded": false,
      "response_type": {
        "id": 3,
        "name": "Main",
        "rgba": "rgba(0, 255, 0, 1)",
        "excluded": false,
        "propagated_to": {
          "id": 1,
          "name": "Major",
          "rgba": "rgba(0, 255, 0, 1)",
          "excluded": false
        }
      },
      "bonus_ids": ["6652", "10533", "7981"],
      "old_items": [
        { "item_id": 207139, "bonus_ids": ["6652", "10533", "7981"] }
      ],
      "same_response_amount": 3,
      "note": "bis",
      "wish_data": [
        { "value": 2902, "spec_name": "Holy", "spec_icon": "spell_holy_holybolt" }
      ],
      "wish_value": 2902
    }
  ]
}
```

**Field notes**
- `character_id` — WoWAudit character ID of the recipient.
- `response_type` — The loot council response category (e.g. "Main Spec", "Off
  Spec"). Configured per-team in WoWAudit.
- `propagated_to` — If the response maps to a higher-level category (e.g.
  "Main" → "Major"), this shows that parent. `null` if no mapping is set.
- `old_items` — What the character had equipped in that slot before the upgrade.
  Useful for computing item level delta.
- `bonus_ids` — Blizzard bonus IDs on the awarded item (determines ilvl, socket,
  tertiary stat, etc.).
- `wish_data` — Per-spec Droptimizer value for this item; `wish_value` is the
  highest value across all specs.
- `discarded: true` — Item was later marked as disenchanted / returned.
- `same_response_amount` — How many other raiders submitted the same response
  type in that loot session (context for how contested the item was).

---

### `GET /v1/wishlists`

Returns the Droptimizer loot wishlist for **all** tracked characters. Each
character can have multiple wishlists (one per Droptimizer fight style /
configuration). Each wishlist breaks down by instance, difficulty, and boss
encounter.

**Response structure**
```json
{
  "characters": [
    {
      "id": 5087798,
      "name": "Thômâtschô",
      "realm": "Antonidas",
      "wishlists": [
        {
          "name": "Single target",
          "fight_style": "Patchwerk",
          "allow_sockets": true,
          "weight": 1,
          "instances": [
            {
              "id": 73,
              "name": "The Voidspire",
              "difficulties": [
                {
                  "difficulty": "mythic",
                  "wishlist": {
                    "updated_at": { "Arms": null, "Fury": null, "Protection": null },
                    "report_uploaded_at": { "Arms": null, "Fury": null, "Protection": null },
                    "encounters": [
                      {
                        "name": "Imperator Averzian",
                        "encounter_percentage": 0,
                        "encounter_absolute": 0,
                        "items": []
                      }
                    ],
                    "total_percentage": 0,
                    "total_absolute": 0
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Field notes**
- `updated_at` and `report_uploaded_at` are keyed by spec name (e.g. `"Arms"`,
  `"Holy"`). A `null` value means no Droptimizer report has been uploaded for
  that spec.
- `encounter_percentage` — Droptimizer upgrade value as a percentage of the
  character's current performance.
- `encounter_absolute` — Absolute DPS/HPS gain from this encounter's best item.
- `items` — Array of specific item upgrades for that boss; empty if no report
  uploaded.
- `weight` — Relative priority of this wishlist when multiple configs exist.

**Write operations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/wishlists` | Upload a Droptimizer report (replaces existing data for that character + spec) |
| `DELETE` | `/v1/wishlists/{id}` | Delete all wishlist data for a character |

---

### `GET /v1/wishlists/{id}`

Same structure as `GET /v1/wishlists` but for a single character.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | WoWAudit character ID (from `GET /v1/characters`) |

---

### `GET /v1/applications`

Returns all recruitment applications submitted to the team (summary view,
without questions/alts).

**Response**
```json
{
  "applications": [
    {
      "id": 192531,
      "applied_at": "2026-05-18T16:10:27.000Z",
      "status": "accepted",
      "role": "damage",
      "age": 28,
      "country": "Germany",
      "battletag": "Gartoon#21568",
      "discord_id": "gartoon",
      "main_character": {
        "name": "Gaymeron",
        "realm": "Draenor",
        "region": "EU",
        "class": "Druid",
        "race": "Night Elf",
        "faction": "Alliance",
        "level": 90
      }
    }
  ]
}
```

**`status` values** — Controlled by officers in WoWAudit's recruitment section.

| Value | Meaning |
|-------|---------|
| `"submitted"` | Awaiting review |
| `"accepted"` | Applicant invited to the team |
| `"declined"` | Application rejected |
| `"withdrawn"` | Applicant withdrew |

**`role` values**: `"damage"`, `"healing"`, `"tank"`.

---

### `GET /v1/applications/{id}`

Returns full application detail including interview questions/answers and all
listed alt characters.

**Response** (extends the summary with additional fields)
```json
{
  "id": 192531,
  "applied_at": "2026-05-18T16:10:27.000Z",
  "status": "accepted",
  "role": "damage",
  "age": 28,
  "country": "Germany",
  "battletag": "Gartoon#21568",
  "discord_id": "gartoon",
  "main_character": { "name": "Gaymeron", "realm": "Draenor", "region": "EU",
    "class": "Druid", "race": "Night Elf", "faction": "Alliance", "level": 90 },
  "alts": [
    { "name": "Gaari", "realm": "Draenor", "region": "EU",
      "class": "Warlock", "race": "Nightborne", "faction": "Horde", "level": 64 }
  ],
  "questions": [
    {
      "question": "What is your raid experience?",
      "answer": "4/9M"
    },
    {
      "question": "Upload a screenshot.",
      "files": [
        {
          "original_filename": "screenshot.png",
          "url": "https://data.wowaudit.com/recruitment/images/screenshot.png"
        }
      ]
    }
  ]
}
```

**Field notes**
- `questions` entries have either an `answer` (text) or `files` (uploaded
  screenshots/attachments), depending on the question type configured by officers.
- `alts` — All alternate characters the applicant listed. Not tracked by
  WoWAudit unless manually added via `POST /v1/characters`.

**Write operations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/v1/applications/{id}` | Update application status (accept/decline) |
| `DELETE` | `/v1/applications/{id}` | Delete an application |

---

## Integration Notes

### Matching WoWAudit characters to roster.json players

WoWAudit characters are identified by their WoWAudit `id` and `blizzard_id`.
Our `roster.json` uses character `name` + `realm`. When linking the two:

1. Match on `name` + `realm` (case-insensitive). Most characters are on Draenor.
2. If a character has transferred realms, `blizzard_id` is the stable key —
   consider caching the `blizzard_id` → `raider_id` mapping after the first
   successful fetch.

### Fetching all past raids in a season

By default `GET /v1/raids` returns only upcoming raids. To fetch attendance for
past raids you must pass `include_past=true`:

```
GET /v1/raids?include_past=true
```

Then call `GET /v1/raids/{id}` for each `"Locked"` raid to get per-character
signup data.

### Attendance vs. parse data

WoWAudit tracks **who showed up** (via calendar signups and the in-game raid
roster API). Warcraft Logs tracks **who got a kill** (via combat log uploads).
A raider can appear as `"Present"` in WoWAudit but have no WCL parse if:
- Their combat log wasn't uploaded.
- They attended but the boss wasn't killed that night.

For lockout-warning purposes, WCL data is authoritative. For attendance
compliance, WoWAudit data is authoritative.
