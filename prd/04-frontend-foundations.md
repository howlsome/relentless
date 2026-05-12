# Stage 4 — Frontend Foundations

**Load with:** `00-shared-context.md` and `02-data-layer.md` (for the data shapes the UI will consume).
**Goal:** Build the cross-cutting frontend infrastructure that every page will use — routing, theming, responsive layout, accessibility primitives, and the parse colour system.

**Build:**
- `src/routes/+layout.svelte` — global layout with nav, theme toggle, season selector
- Theme toggle component (light/dark/auto with localStorage persistence)
- Mobile-first CSS base (PicoCSS + custom layer for parse colours and breakpoints)
- `src/lib/styles/parse-colours.css` with all 7 tiers in both light and dark modes
- `src/lib/utils/parse-colours.ts` — `getParseColour()`, `getBadgeTextColour()` utilities
- `src/lib/components/RoleIcon.svelte` and `TeamDesignationBadge.svelte` — small shared primitives
- Routing scaffold for `/`, `/raider/[uuid]`, `/season/[season_id]`, `/changelog` (pages can render placeholder content)

**Don't build yet:**
- Page content beyond placeholders (Stage 5)
- Boss parse cards, charts, gamification UI (Stage 5)
- Tests (Stage 6 — although `parse-colours.test.ts` is small enough to include here as a sanity check)

**Acceptance for this stage:**
- Site builds with `npm run build` and renders without errors
- Theme toggle switches `data-theme` on `<html>` and persists to localStorage
- All four routes render placeholder content (no 404s)
- All 7 parse colour CSS variables resolve correctly in both light and dark modes
- A `getParseColour(74)` call returns `"var(--parse-blue)"`
- The base layout is fully usable on a 390px-wide phone viewport

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



## Parse colour specification

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

