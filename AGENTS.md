# DelBG — Courier Delivery App

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project status

Phase 4 complete — IndexedDB + client/menu CRUD, pin-drop for coordinates, manifest creation and route planning. See `PRD.md` for full requirements.

## Commands

```bash
npm run dev          # dev server (PWA disabled in dev)
npm run build        # production build (uses --webpack for PWA plugin compat)
npm run start        # serve production build
npm run lint         # ESLint (excludes PWA-generated files in public/)
npx tsc --noEmit     # typecheck
```

**Build quirk:** `npm run build` passes `--webpack` because `@ducanh2912/next-pwa` requires webpack and Next.js 16 defaults to Turbopack. Do not remove this flag.

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 19 + Next.js 16 | Client-side rendering for map views |
| PWA | `@ducanh2912/next-pwa` | Service worker in `public/sw.js`, disabled in dev |
| Maps | Leaflet + react-leaflet | Pin tooltips show address; no clustering yet (Phase 6) |
| Local DB | IndexedDB via `idb` | Schema: clients, menuItems, manifests, stops |
| Styles | Tailwind CSS v4 | Via `@tailwindcss/postcss` |
| TypeScript | Strict mode | Path alias `@/*` → `./src/*` |

## Architecture (current)

- `src/app/page.tsx` — main page, tab navigation (Map / Clients / Routes / Menu)
- `src/components/DeliveryMap.tsx` — Leaflet map centered on Sebeș (45.95, 23.57)
- `src/components/PinCard.tsx` — slide-up card when pin is tapped
- `src/components/PinDropMap.tsx` — interactive map for dropping/editing pins (used in client form)
- `src/components/DriverView.tsx` — driver mode: color-coded pins, status updates, progress bar
- `src/components/markerIcons.ts` — custom colored Leaflet markers (gray/green/red)
- `src/components/ClientForm.tsx` — create/edit client with address fields + pin-drop
- `src/components/ClientList.tsx` — search/filter, edit, delete clients
- `src/components/MenuForm.tsx` — create/edit menu items
- `src/components/MenuList.tsx` — list menu items with edit/delete
- `src/components/ManifestForm.tsx` — edit manifest: add/remove stops, reorder, assign menu
- `src/components/ManifestList.tsx` — list manifests with clone/clone blank/drive/delete
- `src/lib/db.ts` — IndexedDB schema and initialization (idb wrapper)
- `src/lib/clients.ts` — client CRUD operations
- `src/lib/menus.ts` — menu item CRUD operations
- `src/lib/manifests.ts` — manifest CRUD + clone most recent
- `src/data/hardcoded.ts` — 8 hardcoded clients (legacy, map now reads from IndexedDB)
- `src/types/index.ts` — shared TypeScript interfaces

## Hard constraints

- **Fully offline-capable** during delivery — no assumptions about connectivity
- **$0 running cost** — no paid APIs, no subscriptions, no cloud services
- **Single user** — no auth, no multi-tenant, no role system
- **Self-hosted** on NAS/home lab
- Delivery area: **Sebeș, Alba County, Romania** + ~5km radius
- **Manual pin-drop** for coordinates — no Nominatim geocoding required
- **Safari on iPhone** — primary driver device

## Key design decisions

- One menu per day, same for every client
- Clone from most recent manifest (not necessarily yesterday)
- Single route template for v1
- Address format: "Strada X nr. 5 bl. Y ap. Z" (all optional except street + number)
- Planner = Driver = same person, different devices
- Street field stores name only (e.g. "Mihai Viteazu"), display adds "Strada" prefix

## IndexedDB schema

Database: `delbg`, version 1
- `clients` — keyPath: `id`, index: `by-name`
- `menuItems` — keyPath: `id`, index: `by-date`
- `manifests` — keyPath: `id`, index: `by-date`
- `stops` — keyPath: `id`, indexes: `by-manifest`, `by-client`

## Phased build plan

- **Phase 1 (complete):** Static map + hardcoded pins ✓
- **Phase 2 (complete):** IndexedDB + client/menu CRUD (pin-drop for coords) ✓
- **Phase 3 (complete):** Daily manifest + route planning (clone, edit, reorder) ✓
- **Phase 4 (current):** Driver view + status updates (color-coded pins, delivered/skipped) ✓
- **Phase 5:** Backend + sync (Next.js API routes + SQLite)
- **Phase 6:** Offline maps + walk-ins + clustering + polish

## File structure

```
src/
  app/
    layout.tsx      — root layout, PWA metadata, viewport config
    page.tsx        — main page, tab navigation (Map/Clients/Routes/Menu)
    globals.css     — Tailwind imports, Leaflet fixes, overscroll-behavior
  components/
    DeliveryMap.tsx — Leaflet map with markers
    PinCard.tsx     — slide-up detail card
    PinDropMap.tsx  — interactive pin-drop map
    DriverView.tsx  — driver mode: color-coded map, status updates
    markerIcons.ts  — custom colored Leaflet markers
    ClientForm.tsx  — create/edit client form
    ClientList.tsx  — client list with search
    MenuForm.tsx    — create/edit menu form
    MenuList.tsx    — menu item list
    ManifestForm.tsx  — edit manifest stops/order/menu
    ManifestList.tsx  — list manifests with clone/drive/delete
  lib/
    db.ts           — IndexedDB schema and initialization
    clients.ts      — client CRUD operations
    menus.ts        — menu item CRUD operations
    manifests.ts    — manifest CRUD + clone most recent
  data/
    hardcoded.ts    — legacy hardcoded test data
  types/
    index.ts        — Client, Stop, MenuItem, DailyManifest interfaces
public/
  manifest.json     — PWA manifest
  icons/            — PWA icons (placeholder, needs real icons)
  sw.js             — generated service worker (do not edit)
```
