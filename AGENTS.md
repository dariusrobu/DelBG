# DelBG — Courier Delivery App

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev          # dev server (PWA disabled in dev)
npm run build        # production build (uses --webpack for PWA plugin compat)
npm run start        # serve production build
npm run lint         # ESLint (excludes PWA-generated files in public/)
npx tsc --noEmit     # typecheck
```

**Build quirk:** `npm run build` and `npm run dev` both pass `--webpack` because `@ducanh2912/next-pwa` requires webpack and Next.js 16 defaults to Turbopack. Do not remove this flag.

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 19 + Next.js 16 | Client-side rendering for map views |
| Backend | Next.js API routes | `/api/clients`, `/api/manifests`, `/api/menu-items`, `/api/sync` |
| Server DB | Turso (SQLite edge DB) | Via `@libsql/client`, lazy table creation + migration |
| Local DB | IndexedDB via `idb` | Schema: clients, menuItems, manifests, stops |
| Sync | localStorage queue | Mutations queued locally, auto-sync every 30s to Turso |
| PWA | `@ducanh2912/next-pwa` | Service worker in `public/sw.js`, disabled in dev |
| Maps | Leaflet (raw, not react-leaflet) | `react-leaflet` v5 installed but unused; all map code uses raw Leaflet API |
| Offline tiles | Workbox `CacheFirst` | OSM tiles cached for 30 days, 2000 entries |
| Clustering | `leaflet.markercluster` | DeliveryMap only — DriverView has no clustering |
| Styles | Tailwind CSS v4 | Via `@tailwindcss/postcss` |
| TypeScript | Strict mode | Path alias `@/*` → `./src/*` |

## Architecture

```
src/
  app/
    page.tsx              — main page, tab navigation (Map/Clients/Routes/Menu)
    api/
      clients/route.ts    — GET/POST/PUT/DELETE for clients (async libsql)
      manifests/route.ts  — GET/POST/PUT/DELETE for manifests
      menu-items/route.ts — GET/POST/PUT/DELETE for menu items
      sync/route.ts       — POST: batch apply mutations + return changes since timestamp
  components/
    DeliveryMap.tsx       — Leaflet map with marker clustering, manifest/tag/section filters
    DriverView.tsx        — driver mode: color-coded markers, walk-in support, section tabs
    PinCard.tsx           — slide-up detail card for map pins
    PinDropMap.tsx        — interactive pin-drop map (used by DriverView walk-ins)
    markerIcons.ts        — custom colored Leaflet divIcons (lazy-loaded, SSR-safe)
    ClientForm.tsx        — create/edit client, copy-from-existing, coordinate input + map preview
    ClientList.tsx        — search/filter, edit, delete, export/import JSON backup
    MenuForm.tsx          — create/edit menu items
    MenuList.tsx          — menu item list with edit/delete
    ManifestForm.tsx      — section management, stop reorder, menu/section assignment
    ManifestList.tsx      — list manifests with clone/clone blank/drive/delete
  lib/
    db.ts                 — IndexedDB schema and initialization (idb wrapper)
    clients.ts            — client CRUD + sync queueing + getAllTags()
    menus.ts              — menu item CRUD + sync queueing
    manifests.ts          — manifest CRUD + cloneMostRecentManifest + getAllManifests
    sync.ts               — queueMutation, pushSync, applyServerChanges, startAutoSync
    server/
      db.ts               — Turso client via @libsql/client, lazy table creation + schema migration
  types/
    index.ts              — Client, Stop, ManifestSection, MenuItem, DailyManifest
```

## Sync architecture

- All CRUD operations go through `src/lib/clients.ts` / `menus.ts` / `manifests.ts`
- Each mutation is queued in localStorage via `queueMutation()` (key: `delbg_sync_queue`)
- `pushSync()` sends queue + `lastSyncTimestamp` to `/api/sync`
- Server applies mutations to Turso via `INSERT ... ON CONFLICT DO UPDATE`
- Server returns all rows changed since `lastSyncTimestamp`
- Client applies server changes to IndexedDB via `applyServerChanges()`
- **Full-sync cleanup** (only when `lastSyncTimestamp` is null): deletes local entries not in server response — removes stale data from schema migrations
- Auto-sync runs every 30s + on `online` event
- Initial sync runs explicitly on page load in `page.tsx` useEffect

**Critical sync bug that was fixed:** `applyServerChanges` cleanup must ONLY run on full sync (first load). On incremental syncs, the server returns only changes — running cleanup would delete unchanged local entries.

## Turso schema

Database: `delbg-dariusrobu` on `aws-eu-west-1`

**`clients`:** id TEXT PK, name TEXT, street TEXT, number TEXT, bloc TEXT, apartment TEXT, lat REAL, lng REAL, phone TEXT, notes TEXT, tags_json TEXT, updated_at TEXT

**`menu_items`:** id TEXT PK, name TEXT, description TEXT, date TEXT, updated_at TEXT

**`manifests`:** id TEXT PK, date TEXT, stops_json TEXT (array of Stop), sections_json TEXT (array of ManifestSection), updated_at TEXT

**Schema migration** (`src/lib/server/db.ts`): detects old schema (has `address` column in clients) and drops/recreates tables. This runs on every cold start but is idempotent.

## IndexedDB schema

Database: `delbg`, version 1
- `clients` — keyPath: `id`, index: `by-name`
- `menuItems` — keyPath: `id`, index: `by-date`
- `manifests` — keyPath: `id`, index: `by-date`
- `stops` — keyPath: `id`, indexes: `by-manifest`, `by-client`

## Deployment

- **Vercel project:** `del-bg` at `del-bg.vercel.app` (production)
- **Linked via** `.vercel/project.json` (do not delete)
- **GitHub push** triggers auto-deploy
- **Env vars** (Vercel dashboard, not in repo):
  - `TURSO_DATABASE_URL` = `libsql://delbg-dariusrobu.aws-eu-west-1.turso.io`
  - `TURSO_AUTH_TOKEN` = (generated via `turso db tokens create delbg`)
- `.env.local` has same vars locally (gitignored via `.env*` rule)
- **Vercel Deployment Protection** must be disabled in production (Settings → Deployment Protection)

## Hard constraints

- **Fully offline-capable** during delivery — no assumptions about connectivity
- **$0 running cost** — no paid APIs, no subscriptions, no cloud services (Turso free tier)
- **Single user** — no auth, no multi-tenant, no role system
- Delivery area: **Sebeș, Alba County, Romania** + ~5km radius
- **Manual pin-drop** for coordinates — no geocoding
- **Safari on iPhone** — primary driver device (test PWA behavior)
- **One menu per day**, same for every client
- Street field stores name only (e.g. "Kogalniceanu"), display adds "Strada" prefix
- Address format: "Strada X nr. 5 bl. Y ap. Z" (all optional except street + number)
- Planner = Driver = same person, different devices

## Gotchas for agents

- **Leaflet SSR:** All Leaflet code uses raw API, NOT react-leaflet. `markerIcons.ts` uses lazy `require("leaflet")`. Components using Leaflet (`DeliveryMap`, `DriverView`, `ClientForm`) are dynamically imported with `ssr: false`.
- **fitBounds race:** `fitBounds` must be deferred to `requestAnimationFrame` after map init, otherwise Leaflet throws `_leaflet_pos` error (map pane not laid out yet).
- **Null coordinates:** Always guard `client.lat`/`client.lng` with `typeof x !== "number"` before passing to `L.marker()` — clients from old schema or incomplete data can have null coords.
- **ESLint suppressions:** `react-hooks/set-state-in-effect` is suppressed in: `ClientList.tsx`, `MenuList.tsx`, `ManifestList.tsx`, `page.tsx`, `DeliveryMap.tsx`.
- **Tag input pattern:** ClientForm and ManifestForm both have tag inputs with autocomplete from `getAllTags()`. Use the same `onBlur → setTimeout` pattern for dropdown dismissal.
- **Manifest sections** are per-manifest (not global), embedded in the manifest object.
- **Client tags** are free-form strings (not predefined).
- **Sync mutation format:** `{ entityType, entityId, action, payload, timestamp }` — all CRUD operations queue mutations, even if push fails (queue persists in localStorage).
- **Import/export:** ClientList has JSON export/import for backup. Import skips clients with duplicate IDs. Export downloads `delbg-clients-YYYY-MM-DD.json`.
