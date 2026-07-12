# Courier Delivery App — Product Requirements Document

## 1. Context & Problem

Darius works as a courier delivering food (subscriptions + day-menu meals) around **Sebeș, Alba County, Romania**, and nearby communes. He receives a full client list for the next day in advance (on paper), and the route is almost identical day-to-day — same addresses, different meal each day. While actively delivering, he also receives ad-hoc phone/text orders that need to be added to the route on the fly.

He needs an app that:
- Works **fully offline** while driving/delivering (connectivity in the delivery area is not guaranteed)
- Shows a **fast, glanceable map** with clustered client pins, usable safely while driving
- Lets him **plan tomorrow's route** the night before/morning of, based on the paper list
- Lets him **add, edit, delete, and complete orders in real time** during delivery, fully offline, syncing later
- Costs **$0 to run** — self-hosted on his own NAS/home lab, free map data, free geocoding

## 2. Non-Goals (v1)

- No live push of orders from an external dispatcher/system (orders always come in via phone call/text and are typed in manually by Darius)
- No turn-by-turn navigation built into the app (deep-link to Google Maps / Waze instead)
- No multi-courier / multi-user support — single user (Darius)
- No payment processing or client billing

## 3. Users

Single user: Darius, acting in two modes:
- **Planner** (evening/morning, desktop or tablet): prepares tomorrow's manifest
- **Driver** (during delivery, phone): views the map, updates order status, adds walk-in orders

## 4. Core Concepts / Data Model

### Client
- `id`
- `name`
- `address` (text, as written on paper list)
- `lat`, `lng` (geocoded once, reused every day; manual pin-drop fallback if geocoding fails/is imprecise)
- `phone` (optional)
- `notes` (optional — e.g. "leave with neighbor", gate code)
- `defaultSubscription` (optional link to a recurring meal type)

### Menu Item
- `id`
- `name` (e.g. "Meniu zi — ciorbă + friptură")
- `description` (optional)
- `date` or recurring flag (day menus change daily; some items may be fixed subscription items)

### Route Template
- `id`
- `name` (e.g. "Ruta principală")
- ordered list of `clientId`s representing the "usual" stop order — used to pre-sort new manifests

### Daily Manifest
- `id`
- `date`
- ordered list of **Stops**:
  - `stopId`
  - `clientId`
  - `menuItemId` (what they get today)
  - `position` (route order, drag-reorderable)
  - `status`: `pending | delivered | skipped`
  - `notes` (optional, per-stop)
  - `completedAt` (timestamp, if delivered/skipped)
  - `isWalkIn` (bool — true if added mid-route rather than planned the night before)

### Sync Queue (local, per device)
- Every local mutation (create/edit/delete/complete) is queued with a timestamp and pushed to the backend when connectivity is available. Last-write-wins conflict resolution is sufficient given single-user usage.

## 5. Key Flows

### 5.1 Planning Flow (Desktop/Tablet)
1. Darius opens the Planner view the evening before or morning of.
2. He clicks "Clone yesterday's manifest" → creates a new Daily Manifest pre-filled with yesterday's clients/order, all in `pending` status.
3. He edits the diff against the paper list: removes clients not ordering today, adds new ones, changes the assigned menu item per client.
4. New clients are geocoded automatically (Nominatim); if geocoding fails or is imprecise, he manually drops a pin on the map — saved permanently to that Client record.
5. He drags stops into route order (defaults to the saved Route Template order, only exceptions need manual reordering).
6. He confirms the manifest is ready → it syncs to the backend and becomes available for the phone to pull down.

### 5.2 Delivery Flow (Phone, Offline-First)
1. Before heading out, the phone pulls the day's manifest + client data into IndexedDB and caches the map tiles for the Sebeș delivery area (pre-downloaded or cached from prior use).
2. Map view shows all stops as color-coded pins (gray = pending, green = delivered, red = skipped), clustered by proximity so Darius can see at a glance "3 stops here, 2 there" without reading addresses.
3. Tapping a stop/cluster shows a compact card: client name, meal, notes, and action buttons (Delivered / Skipped / Navigate).
4. "Navigate" deep-links into Google Maps or Waze for actual turn-by-turn directions.
5. A new order comes in by phone call → Darius taps "Add stop," types in name/address/meal → it's geocoded if possible or dropped as a pin, added to the map and route immediately, fully offline-capable.
6. All actions write instantly to local IndexedDB (optimistic UI, no waiting on network) and queue for background sync.
7. Whenever the phone regains connectivity, queued changes push to the home server; the next planning session already reflects today's completed history.

## 6. Map & Offline Requirements

- **Library:** Leaflet or MapLibre GL, with marker clustering plugin
- **Tiles:** OpenStreetMap, cached via service worker or pre-downloaded as a tile pack covering Sebeș + surrounding communes (small area — low storage cost)
- **Geocoding:** Nominatim (OSM), run during planning (online), results cached permanently per client
- **Manual pin-drop:** fallback UI for imprecise/missing OSM address data (common in smaller Romanian towns)

## 7. Tech Stack

- **Frontend:** React + Next.js, built as an installable PWA (service worker, manifest.json, offline app shell caching)
- **Local storage:** IndexedDB (via a small wrapper like `idb`) as source of truth on-device
- **Backend:** Next.js API routes (or a small separate Node/Express layer, consistent with existing self-hosted setup) + SQLite, self-hosted on Darius's NAS/home lab
- **Sync:** custom lightweight sync engine — local-first writes, background push/pull, last-write-wins
- **Remote access (optional, if needed later):** Tailscale free tier, so the phone can reach the home server from outside the home network
- **Maps/geocoding:** OpenStreetMap tiles + Nominatim — no paid API keys required
- **Navigation handoff:** deep link to Google Maps / Waze

All components are free at this usage scale — no subscriptions, no paid APIs.

## 8. Success Criteria for v1

- Darius can plan tomorrow's route in under 5 minutes by cloning + editing yesterday's manifest
- The phone app is fully usable with zero connectivity for an entire delivery run
- The map is glanceable while driving — clusters, color status, minimal taps to act
- A walk-in order can be added and appear on the map in under 15 seconds
- Nothing in the stack requires a paid subscription or API key

## 9. Open Questions (to resolve with the coding agent before implementation)

- Exact delivery radius around Sebeș (to size the offline tile pack)
- Preferred approach for the backend: reuse the existing Node/Express/SQLite pattern from "Now," or use Next.js API routes for a single unified codebase?
- Whether Route Templates should support multiple named routes (e.g. if the route ever splits into two runs) or a single template is enough for v1
- Any device constraints (which phone, OS version) that affect PWA installability assumptions
