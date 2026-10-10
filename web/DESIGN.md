---
name: Observatory
description: Solo ops night-watch desk — cream instrument boards by day, beacon amber by night.
colors:
  observatory-ink-teal: "#0f6b66"
  accent-soft: "#c8e6e2"
  beacon-amber: "#ff9a3c"
  beacon-amber-soft: "rgba(255, 154, 60, 0.14)"
  parchment: "#f4f1ea"
  parchment-elev: "#ece8de"
  panel: "#fffcf5"
  ink: "#15171c"
  ink-soft: "#2a2d36"
  muted: "#6c6a62"
  border: "#d9d4c5"
  ok: "#1f7a3a"
  warn: "#b85c00"
  bad: "#b1241f"
  night-bg: "#0b0d12"
  night-panel: "#12161f"
  night-ink: "#ece8de"
  night-muted: "#8a8676"
  night-border: "#1e232f"
  night-ok: "#6bd693"
  night-warn: "#ffb86b"
  night-bad: "#ff6b6b"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.18em"
  metric-xl:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  sm: "8px"
  lg: "14px"
  full: "50%"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.observatory-ink-teal}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  input:
    backgroundColor: "{colors.parchment-elev}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    typography: "{typography.body}"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-delta:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
    typography: "{typography.label}"
---

# Design System: Observatory

## Overview

**Creative North Star: "The Night Watch Desk"**

Observatory is a solo operator’s instrument desk: cream parchment under a faint grid by day, deep night panels with Beacon Amber signals after dark. The product voice is hybrid — Fraunces italics and literary constellation language earn their keep on auth and empty states; once inside the shell, ruthlessly scan-first density wins. Mono eyebrows, UTC stamps, and LED status dots keep the ops ritual honest.

Surfaces read as instrument faces: bordered panels, tabular metrics, status LEDs, hairline chrome. Accent color is a rare signal (teal by day, amber by night), not a wash. Depth is hybrid — rest state is border + soft ambient shadow; stronger lift appears on hover, focus, and modals.

**Key Characteristics:**
- Cream parchment + 22px dot grid (light); near-black instrument night (dark)
- Fraunces for display/widget titles; Inter for UI; JetBrains Mono for labels, stamps, metrics
- Observatory Ink-Teal (light) / Beacon Amber (dark) as scarce accent
- Instrument chrome: mono uppercase labels, LED status, panel widgets
- Hybrid elevation: `--shadow-sm` at rest, `--shadow-md` on hover/modal

## Colors

Dual-theme palette swapped via `data-theme` on the document root. Light is the default normative set; dark remaps surfaces and swaps the primary accent.

### Primary
- **Observatory Ink-Teal** (`#0f6b66`): Light-theme accent — links, selection, focus rings, primary hover, KPI rail, chart-1. Soft companion `#c8e6e2`.
- **Beacon Amber** (`#ff9a3c`): Dark-theme accent — same roles after nightfall. Soft companion `rgba(255, 154, 60, 0.14)`.

### Secondary
- **Status OK** (`#1f7a3a` light / `#6bd693` dark): Healthy LEDs, positive deltas, success summary.
- **Status Warn** (`#b85c00` light / `#ffb86b` dark): Caution states and amber chart series.
- **Status Bad** (`#b1241f` light / `#ff6b6b` dark): Failures, pulsing bad LED, destructive confirm.

### Neutral
- **Parchment** (`#f4f1ea`): App background (light).
- **Parchment Elevated** (`#ece8de`): Input wells, row items, elevated strips.
- **Panel** (`#fffcf5`): Widget/card face.
- **Ink** (`#15171c`): Primary text and solid primary buttons (light).
- **Ink Soft** (`#2a2d36`): Softer titles / secondary ink.
- **Muted** (`#6c6a62`): Eyebrows, captions, meta.
- **Border** (`#d9d4c5`): Hairlines; often `color-mix` to 70% opacity on panels.
- **Night** surfaces: bg `#0b0d12`, elev `#11141b`, panel `#12161f`, ink `#ece8de`, muted `#8a8676`, border `#1e232f`.

### Named Rules
**The Scarce Signal Rule.** Primary accent paints ≤ ~10% of any screen — focus, hover takeover, selection, and status highlights. Never flood backgrounds with accent.

**The Theme Swap Rule.** Light accent is teal; dark accent is amber. Do not keep teal accents in dark mode or amber accents in light mode.

## Typography

**Display Font:** Fraunces (ui-serif, Georgia)
**Body Font:** Inter (ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (ui-monospace, SF Mono, Menlo)

**Character:** Editorial serif for titles and literary moments; utilitarian sans for chrome; mono for instrument metadata and every number that must align.

### Hierarchy
- **Display** (400, 38px / 1.05, −0.015em): Page titles; login hero scales to ~64px with italic accent word.
- **Headline** (500, 26px / 1.15): Secondary page headings.
- **Title** (Inter 600, 18px): `h3` and denser section titles; widget titles use Fraunces 560 at 18px.
- **Body** (400, 14px / 1.55): Default UI copy; `ss01` + `cv11` features on.
- **Label** (Mono 500, 10px, 0.18em uppercase): Eyebrows, form labels, shell stamps.
- **Metric XL / LG** (Mono 500, 44px / 28px, tabular nums + `zero`): KPI heroes.

### Named Rules
**The Literary Gate Rule.** Fraunces italics and constellation copy belong on auth, empty states, and page titles — not inside dense data chrome.

**The Tabular Truth Rule.** All scan-critical numbers use JetBrains Mono with tabular figures.

## Layout

App shell: collapsible sidebar (232px expanded / 60px collapsed) + main column. Header is a mono instrument strip (live LED, UTC stamp, section label) with `backdrop-filter: blur(8px)` over the grid. Main content padding ≈ `28px 32px 64px`.

Page headers flex title/meta left and actions right (`gap` 20px, margin-bottom 20px). Dashboards use Gridstack widget canvases; widgets share panel chrome. Body background is a 22px radial-dot grid (`--grid-line`). Spacing scale: 4 / 8 / 12 / 16 / 24px. Density is ops-tight: 12–14px UI type, compact control padding.

## Elevation & Depth

Hybrid material: tonal parchment layers + hairline borders carry most hierarchy. Soft ambient shadow (`--shadow-sm`) sits on panels at rest; stronger `--shadow-md` appears on panel hover, dialogs, and elevated focus moments. Buttons lift `translateY(-1px)` on hover with sm shadow. Focus uses a 3px accent-tinted ring (`color-mix` 18%), not a heavy drop shadow.

### Shadow Vocabulary
- **Rest / ambient** (`0 1px 2px rgba(21,23,28,0.04), 0 4px 16px -8px rgba(21,23,28,0.08)` light): Default panel.
- **Lift / modal** (`0 2px 4px rgba(21,23,28,0.05), 0 14px 36px -14px rgba(21,23,28,0.16)` light): Hovered panel, confirm dialog. Dark theme uses deeper black-based equivalents.

### Named Rules
**The Hybrid Lift Rule.** Rest = border + sm shadow. md shadow is reserved for hover, focus emphasis, and modals — not every card.

## Shapes

Gently curved instrument faces: default radius 8px (controls, rows, uptime buckets), larger 14px for panels/dialogs, full circles for LEDs, pills (999px) for delta chips and progress tracks. Borders are 1px; panel borders often mix to 70% opacity. KPI heroes use a 3px left accent rail. No sharp zero-radius chrome; no oversized blob radii.

## Components

Instrument chrome throughout: mono labels, LED status, panels as faces.

### Buttons
- **Shape:** Soft rectangle (8px)
- **Primary:** Ink fill + ink border, parchment text, padding 9×18, weight 500. Hover: translateY(−1px), background/border → accent, sm shadow.
- **Ghost / type=button / header:** Transparent, border, text ink. Hover: accent-soft fill, accent border.
- **Focus:** Shared input-style accent ring when focused via keyboard paths; disabled at 45% opacity.

### Chips
- **KPI delta:** Pill chip, mono 11px; muted / ok / bad tonal fills via `color-mix`.
- **Related / filter chips** (analytics): Follow ghost-button + soft accent selected pattern.

### Cards / Containers
- **Corner Style:** 14px (`--radius-lg`)
- **Background:** `--panel`
- **Shadow Strategy:** sm at rest; md on hover (Hybrid Lift Rule)
- **Border:** 1px mixed border; hover shifts toward accent mix
- **Internal Padding:** 16px (`--space-4`)
- **Signature:** Widget title (Fraunces) + mono lowercase context line; LED + metric blocks inside

### Inputs / Fields
- **Style:** Elevated parchment well, 1px border, 8px radius, 10×12 padding
- **Label:** Mono uppercase tracked label above field
- **Focus:** Accent border + 3px accent ring at 18% mix
- **Error:** Prefer adjacent plain-language message; status colors for severity

### Navigation
- **Sidebar:** 232 / 60 width, section labels (Surveys / Analytics / Properties), Lucide icons + text (icon-only when collapsed)
- **Active:** Accent-tinted treatment; Observatory mark + wordmark when expanded
- **Shell header:** Mono uppercase live strip with LED; theme toggle (sun/moon)
- **Mobile:** Analytics rail may collapse to drawer; preserve labeled actions where possible

### Status LED (signature)
- 8–12px circle; ok glows; bad pulses (`pulse` 1.6s). Color alone is reinforced by adjacent mono state text where critical.

### Confirm Dialog (signature)
- Dim ink 35% backdrop; centered panel ≤360px; md shadow; Escape + cancel focus; danger confirm uses bad accent.

## Do's and Don'ts

### Do:
- **Do** keep accent scarce — teal by day, Beacon Amber by night — for signal, focus, and hover takeover.
- **Do** put literary Fraunces italics on auth/empty/hero moments; keep data chrome mono + Inter.
- **Do** use LED + mono state text for health; preserve tabular metrics.
- **Do** follow Hybrid Lift: sm at rest, md on hover/modal.
- **Do** honor `data-theme` token remap rather than hard-coding light hex in dark UI.

### Don't:
- **Don't** wash full screens in accent or replace parchment/night grounds with purple SaaS gradients.
- **Don't** sprinkle Fraunces italics through tables, nav, or dense forms.
- **Don't** put md shadows on every widget at rest.
- **Don't** invent multi-tenant marketing chrome or fake social proof — this is a single-seat instrument.
- **Don't** drop Inter for another UI sans or replace JetBrains Mono for metrics without an explicit redesign.
