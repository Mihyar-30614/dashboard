# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the owner/operator of a small multi-app fleet (Sportly, Honey Do Eh, DebtManager), working alone. Day-to-day job is checking health, traffic, KPIs, and process state without SSH into each host. Invite/admin machinery exists in the codebase but is not the primary audience for this record.

## Product Purpose

Self-hosted operations dashboard that aggregates read-only metrics from monitored apps and answers ad-hoc database questions. Success means: (1) glanceable overview and per-app boards for health, traffic, KPIs, and PM2 state; (2) Ask DB natural-language analytics with the ability to pin useful answers onto a board. Dashboards and Ask DB are equal pillars of the product.

## Positioning

Internal, single-tenant ops instrument for this fleet — not a multi-tenant SaaS and not an end-customer product. Differentiation: one login, one composed layout surface, and Ask DB over the same app databases, all self-hosted next to the apps it watches. Neighboring generic BI or uptime tools do not combine invite-gated local ops, Gridstack composition over those specific collectors, and Seer-backed Ask DB in this host setup.

## Operating Context

- Local/self-hosted: Vite SPA (`web`, port 4210) + Express API (`server`), dashboard Postgres, read-only `dashboard_reader` on app DBs; optional nginx logs and PM2 on the host.
- Auth: invite-based accounts, cookie sessions; admins manage invites and SQL widgets.
- Workflows: compose/save per-user grid layouts; overview + `/app/:slug` boards; time ranges and drilldowns; Ask DB (schema, history, saved, pin-to-dashboard); Settings for access.
- Config truth lives in repo `config/apps.json`, `config/widgets.json`, `config/data_sources.json` (parent of `web/`).

## Capabilities and Constraints

- Confirmed: overview and per-app dashboards; widget palette (metrics, KPIs, health, PM2, HTTP, SQL viz); Ask DB via Seer proxy; pin results as SQL widgets (admin); light/dark theme; single-tenant workspace.
- Read-oriented monitoring; not a write console into production app data.
- **Undecided (do not invent):** durable product name — UI currently says **Observatory**; repo/package often says **dashboard**. Monitored app set may change later; treat Sportly / Honey Do Eh / DebtManager as current examples, not permanent brand commitments.
- Do not fabricate testimonials, customers, benchmarks, pricing, or multi-tenant claims.

## Brand Commitments

- Working UI name: **Observatory** (login/sidebar/title); treat as provisional until the name decision is locked.
- Voice in auth surfaces: short, instrument-like, lightly playful (“constellation”, “keeping three applications honest”); mono eyebrows; version tag `v0.1 · observatory/ops`.
- Mark asset: `web/public/icon.svg` (plus favicons in `web/public/`).
- No binding visual-world brief in this file; incumbent look lives in code (`theme.css`, components) until documented or replaced elsewhere.

## Evidence on Hand

- Product copy: `web/src/auth/Login.tsx`, `web/index.html` title, `web/src/layout/Sidebar.tsx`.
- Setup and stack: repo `README.md`.
- App registry: `config/apps.json`; widget catalog: `config/widgets.json`.
- Logo/icons: `web/public/icon.svg`, favicon assets.
- Absences: no external case studies, press, or customer quotes — do not invent them.

## Product Principles

1. **Glance before drill** — default path is scan health and KPIs; detail and Ask DB are opt-in depth.
2. **One seat, one fleet** — design for a solo operator of a fixed (but evolveable) app set; single-tenant honesty over SaaS polish.
3. **Equal pillars** — metric boards and Ask DB both earn primary navigation and completion paths (including pin-to-board).
4. **Read-only trust** — monitoring and analytics must feel safe; never imply destructive control of app data.
5. **Name and apps stay provisional** — keep UI working as Observatory + current apps, but do not hard-code them as permanent brand or market claims until decided.

## Accessibility & Inclusion

No product-specific accessibility standard was set in init. Preserve existing ARIA/dialog patterns in the SPA; do not claim WCAG certification.
