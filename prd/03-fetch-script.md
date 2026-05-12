# Stage 3 — Data Fetch Script

**Load with:** `00-shared-context.md` and `02-data-layer.md` (for the data schemas the script will write).
**Goal:** Implement `scripts/fetch.mjs` so that running it (locally or via the GitHub Actions cron) fetches fresh data from WarcraftLogs and Raider.io and writes it to disk.

**Build:**
- `scripts/fetch.mjs` — entry point
- `src/lib/utils/wcl.mjs` — WarcraftLogs GraphQL helpers (auth, batched queries)
- `src/lib/utils/rio.mjs` — Raider.io REST helpers
- `src/lib/utils/resilience.mjs` — Resilience level computation
- `src/lib/utils/raider-identity.mjs` — raider_id resolution, role/team change detection
- Changelog generation logic (diffing roster.json against previous state)
- Wire up `.github/workflows/fetch-data.yml` to actually call the script

**Don't build yet:**
- Any UI (Stages 3 frontend onwards)
- Tests beyond a manual end-to-end run against a single test character

**Acceptance for this stage:**
- Running `node scripts/fetch.mjs` with real WCL credentials produces valid output in `data/seasons/*/`
- An inactive character is never queried (verified by inspecting network requests)
- A 429 response triggers retry logic
- Changelog entries are generated correctly when roster.json changes between runs
- Resilience level is computed correctly from `mythic_plus_best_runs`

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
5. Compute each player's Resilience level from `mythic_plus_best_runs` (see section 10.5).
6. Merge WCL + Raider.io results per player and write the JSON output files.

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
- `mythic_plus_best_runs` → the all-time best timed run per dungeon for the current season. Used to compute the Resilience achievement level (see section 10.5).

### 10.4 Resilience achievement computation

The **Resilience** achievement represents completing all 8 dungeons in the current M+ season timed at a given key level. It levels up: Resilience 12 means all 8 timed at +12, Resilience 15 means all 8 timed at +15, and so on.

The fetch script computes this from `mythic_plus_best_runs` returned by the Raider.io character profile endpoint. This array contains the best timed run per dungeon for the current season.

**Algorithm:**

```javascript
function computeResilienceLevel(bestRuns, seasonDungeonCount = 8) {
  // bestRuns: array of { dungeon: string, mythic_level: number, timed: boolean }
  // Only count timed completions
  const timed = bestRuns.filter(r => r.timed);

  // Find the highest key level at which ALL dungeons have been timed
  // Start from the highest level in the set, work downward
  const levels = [...new Set(timed.map(r => r.mythic_level))].sort((a, b) => b - a);

  for (const level of levels) {
    const dungeonsTimedAtOrAbove = new Set(
      timed.filter(r => r.mythic_level >= level).map(r => r.dungeon)
    ).size;
    if (dungeonsTimedAtOrAbove >= seasonDungeonCount) {
      return level; // This is their Resilience level
    }
  }
  return null; // No Resilience level achieved yet
}
```

The result is stored as `resilience_level` (integer or `null`) in both `snapshot.json` and `compliance.json`. The season dungeon count (8 for Midnight Season 1) is sourced from `roster.json` as `mplus_season_dungeon_count` sourced from the active season entry in `roster.json` `seasons[]` — so it updates automatically when officers add a new season.

**Progress toward the next level:** Also computed and stored as `resilience_progress` — an object mapping each dungeon name to the highest timed key level completed in that dungeon. This powers the "progress to next Resilience level" UI on the raider detail page.

```json
"resilience_level": 13,
"resilience_progress": {
  "Operation: Floodgate": 15,
  "Cinderbrew Meadery": 14,
  "Darkflame Cleft": 13,
  "The Rookery": 13,
  "Priory of the Sacred Flame": 16,
  "The MOTHERLODE!!": 13,
  "Operation: Mechagon - Workshop": 12,
  "Ara-Kara, City of Echoes": 14
}
```

In this example the Resilience level is 13 because all 8 dungeons are timed at +13, but Pit of Saron has only been timed at +12 — blocking the jump to Resilience 14.

### 10.5 Error handling

- If WCL returns an error for a character (e.g. no logs, name not found), log a warning and write `"error": "wcl_not_found"` for that player. Do not abort the whole run.
- If Raider.io 404s for a character, write `"error": "rio_not_found"`.
- The UI must handle missing/error entries gracefully (show "—" in place of missing values).

---

## 17. Environment Variables / Secrets

| Variable | Where | Purpose |
|---|---|---|
| `WCL_CLIENT_ID` | GitHub Actions secret | WarcraftLogs OAuth client ID |
| `WCL_CLIENT_SECRET` | GitHub Actions secret | WarcraftLogs OAuth client secret |
| `GH_PAT` | GitHub Actions secret | PAT for committing data and triggering deploy |

The SvelteKit frontend reads no environment variables — all data is in static JSON files.

---

