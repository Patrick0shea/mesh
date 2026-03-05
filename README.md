# Mesh — Disaster Response Coordinator

A real-time dashboard for coordinating Meshtastic radio mesh networks during disaster response operations. Tracks node positions on a map, visualises network topology, monitors messages, handles SOS alerts, and implements a Dead Man's Switch safety system for field operatives.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the dashboard
npm run dev

# In a second terminal — run the simulator (no radio hardware needed)
npx tsx scripts/simulate-nodes.ts
```

Open [http://localhost:3000](http://localhost:3000). The simulator will populate the dashboard with 10 fake nodes around Limerick city within a few seconds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Radio protocol | `@meshtastic/js` (WebSerial + Web Bluetooth) |
| Map | Leaflet + react-leaflet |
| Topology graph | D3.js v7 (force simulation) |
| Styling | Tailwind CSS (dark theme) |

> **Browser requirement:** USB Serial connection requires Chrome or Edge (WebSerial API). Bluetooth requires Chrome over HTTPS or localhost.

---

## Project Structure

```
mesh/
├── app/
│   ├── layout.tsx              # Root HTML shell, imports global CSS
│   ├── page.tsx                # Main dashboard — tab routing, data polling, DMS monitor
│   ├── globals.css             # Tailwind + Leaflet CSS
│   └── api/
│       ├── nodes/route.ts          # GET all nodes / POST upsert node
│       ├── messages/route.ts       # GET messages (paginated) / POST new message
│       ├── events/route.ts         # GET SOS events / POST new SOS / PATCH acknowledge
│       ├── packets/route.ts        # POST raw packet log
│       ├── neighbour-info/route.ts # GET topology data / POST upsert edge
│       └── dead-man-switch/
│           ├── config/route.ts     # GET/POST DMS config per node
│           └── events/route.ts     # GET DMS events / POST trigger / PATCH resolve
│
├── components/
│   ├── dashboard/
│   │   ├── ConnectionPanel.tsx  # USB / Bluetooth connect buttons + status
│   │   ├── NodeList.tsx         # Sidebar: all nodes with battery, role, last seen
│   │   ├── MessageLog.tsx       # Scrolling live message feed
│   │   └── SOSAlerts.tsx        # Active SOS cards with acknowledge / resolve
│   ├── map/
│   │   └── MeshMap.tsx          # Leaflet map, node markers, popup info
│   ├── topology/
│   │   ├── TopologyViewer.tsx   # Container: polls API, layout, tooltips
│   │   ├── TopologyGraph.tsx    # D3 force-directed graph (SVG)
│   │   ├── MeshHealthScore.tsx  # Weighted health score + bar chart
│   │   └── hooks/
│   │       └── useTopologyData.ts  # Polling hook, new-edge detection for animation
│   └── dead-man-switch/
│       ├── DMSAlertBanner.tsx   # Alert bar across top of screen when DMS fires
│       ├── DMSConfigPanel.tsx   # Per-node settings panel (timeout, escalation)
│       ├── DMSEventLog.tsx      # Table of all DMS events with filter
│       └── hooks/
│           └── useDMSMonitor.ts # setInterval hook — runs DMS check every 60s
│
├── lib/
│   ├── db.ts                   # SQLite singleton (one connection, WAL mode)
│   ├── schema.ts               # CREATE TABLE IF NOT EXISTS for all tables
│   ├── dms-monitor.ts          # Core DMS check logic (silence detection, escalation)
│   └── meshtastic/
│       ├── serial.ts           # WebSerial connection wrapper
│       ├── bluetooth.ts        # Web Bluetooth connection wrapper
│       └── packet-handler.ts   # Decodes packets, routes to API routes
│
└── scripts/
    └── simulate-nodes.ts       # Dev simulator — 10 nodes, topology, messages, DMS demo
```

---

## Database Schema

All data is stored in `mesh.db` (SQLite, created automatically on first run).

### `nodes`
One row per Meshtastic node ever seen. Upserted on every received packet.

| Column | Type | Description |
|---|---|---|
| `node_id` | TEXT PK | Hex ID e.g. `!a1b2c3d4` |
| `long_name` | TEXT | Full display name |
| `short_name` | TEXT | 4-char callsign |
| `role` | TEXT | `CLIENT`, `ROUTER`, `ROUTER_CLIENT`, `REPEATER` |
| `latitude/longitude` | REAL | GPS coordinates (decimal degrees) |
| `battery_level` | INT | 0–100% |
| `last_heard` | INT | Unix timestamp of most recent packet |
| `snr` | REAL | Signal-to-noise ratio of last received packet |
| `rssi` | INT | Received signal strength (dBm) |
| `hops_away` | INT | How many relay hops from base node |

### `messages`
All text messages received from the mesh.

### `sos_events`
SOS alerts. A node triggers one by sending a message containing "SOS", or the simulator can inject them directly. Has `acknowledged_at` and `resolved_at` timestamps.

### `packet_log`
Raw log of every packet received — portnum, hop info, RSSI/SNR. Used for debugging and future analysis.

### `neighbour_info`
One row per directed edge in the mesh topology. Upserted on every `NEIGHBORINFO_APP` packet — keeps only the latest SNR reading per node pair.

| Column | Description |
|---|---|
| `node_id` | The node reporting |
| `neighbour_id` | The neighbour it can hear |
| `snr` | SNR of that link |
| `timestamp` | When last seen |

### `dms_config`
Per-node Dead Man's Switch configuration.

| Column | Description |
|---|---|
| `enabled` | 0 or 1 |
| `silence_timeout_minutes` | How long silent before trigger (default 45m) |
| `escalation_minutes` | How long after trigger before escalating to SOS (default 15m) |
| `contact_note` | Free text — next of kin, medical info, etc. |

### `dms_events`
A DMS event is created when a node's silence exceeds its timeout. Tracks the full lifecycle: triggered → acknowledged → escalated → resolved.

---

## API Routes

All routes are Next.js Route Handlers under `app/api/`. They all use the SQLite singleton via `getDb()`.

### `GET /api/nodes`
Returns all nodes ordered by `last_heard` descending.

### `POST /api/nodes`
Upserts a node. Uses `ON CONFLICT(node_id) DO UPDATE` — only overwrites non-null values, so partial updates (e.g. just battery) don't wipe GPS coordinates.

### `GET /api/neighbour-info`
Returns the full topology graph shaped for D3:
```json
{
  "nodes": [{ "id": "!abc123", "role": "ROUTER", "status": "online", "battery": 85 }],
  "edges": [{ "source": "!abc123", "target": "!def456", "snr": 8.5 }],
  "lastUpdated": 1700000000
}
```
Node `status` is computed server-side: `online` < 5 min, `marginal` 5–15 min, `offline` > 15 min.

### `POST /api/neighbour-info`
Upserts one directed edge: `{ nodeId, neighbourId, snr }`.

### `GET/POST/PATCH /api/dead-man-switch/events`
- `PATCH` accepts `action`: `"acknowledge"`, `"escalate"`, or `"resolve"` with optional `resolution` and `resolutionNote`.

---

## Meshtastic Connection Layer

`lib/meshtastic/` handles real hardware connections. Both are lazy-loaded (dynamic imports inside async functions) so they never run server-side.

### `serial.ts` / `bluetooth.ts`
Singleton wrappers around `@meshtastic/js` `SerialConnection` / `BleConnection`. The `ConnectionPanel` component calls these on button click.

### `packet-handler.ts`
Called for every decoded packet from the radio. Handles these port numbers:

| PortNum | Action |
|---|---|
| `TEXT_MESSAGE_APP` (1) | Save to `messages`, check for "SOS" keyword |
| `POSITION_APP` (3) | Decode `PositionSchema`, upsert node lat/lon |
| `NODEINFO_APP` (4) | Decode `UserSchema`, upsert node name/role |
| `TELEMETRY_APP` (67) | Decode `TelemetrySchema`, upsert battery/voltage |
| `NEIGHBORINFO_APP` (69) | Decode `NeighborInfoSchema`, upsert all neighbour edges |

Protobuf decoding uses `fromBinary(Schema, payload)` from `@bufbuild/protobuf` with schemas from `@meshtastic/js`'s `Protobuf` namespace.

---

## Topology Graph (D3)

`components/topology/TopologyGraph.tsx` runs a D3 force simulation entirely in an SVG element.

**Forces:**
- `forceLink` — pulls connected nodes together (distance 120px)
- `forceManyBody` — repels all nodes from each other (strength -300)
- `forceCenter` — keeps the graph centred in the viewport
- `forceCollide` — prevents node overlap (radius 30)

**Node shapes by role:**
- `CLIENT` — circle
- `ROUTER` / `REPEATER` — hexagon
- `ROUTER_CLIENT` — star

**Colours:**
- Node fill: green (online), amber (marginal), red (offline), grey (unknown)
- Link stroke: green (SNR > 5), yellow (0–5), red (< 0)
- Battery arc: thin ring around each node, green or red

**Interactions:**
- Drag nodes to pin them
- Scroll to zoom
- Hover node/edge for tooltip
- Animated blue dots travel along edges when new topology data arrives

**Health Score** (`MeshHealthScore.tsx`) is a weighted average:
- 40% — average node degree (how many connections each node has)
- 30% — average SNR across all links
- 30% — isolated node penalty (nodes with zero neighbours hurt the score)

---

## Dead Man's Switch

The DMS is a safety system for field operatives. If a node goes silent for longer than its configured timeout, an alert fires so the coordinator knows to check on that person.

**How it works:**

1. Each node can have a DMS config stored in `dms_config` (set via the dashboard or API)
2. `lib/dms-monitor.ts` runs client-side via `useDMSMonitor` hook (every 60 seconds)
3. For each enabled node it checks: `now - node.last_heard >= silence_timeout`
4. If exceeded and no active event exists → `POST /api/dead-man-switch/events` (trigger)
5. If active event exists and not acknowledged within `escalation_minutes` → `PATCH` escalate
6. Escalation creates a full SOS event and turns the banner red

**Lifecycle:** `triggered` → `acknowledged` → `escalated` → `resolved` (`safe` / `escalated` / `dismissed`)

---

## VPS / Cloud Deployment (Planned)

The current setup is designed for **local network operation** — a laptop at a command post, radio plugged in via USB, with everyone on the same WiFi. This is the primary use case and works without internet.

The planned VPS deployment is for situations where teams are geographically distributed and internet infrastructure is still intact (training exercises, multi-site coordination, remote monitoring):

```
[Field site A — Meshtastic radio + laptop]
        |
   [VPS — runs the dashboard, publicly accessible]
        |
[Field site B — browser-only viewers]
[HQ — browser-only command overview]
```

**Planned stack:**
- VPS (e.g. DigitalOcean, Hetzner, or any Ubuntu server)
- PM2 for process management and auto-restart on boot
- Nginx as a reverse proxy (port 80/443 → 3000)
- Let's Encrypt for HTTPS (required for WebSerial on non-localhost)
- DB_PATH env var to persist `mesh.db` outside the app directory

This is not yet implemented. See `DEPLOYMENT.md` for the current local setup guide and a Railway cloud hosting option that works today.

---

## Simulator

`scripts/simulate-nodes.ts` — run with `npx tsx scripts/simulate-nodes.ts`.

Creates 10 nodes around Limerick (52.6638°N, 8.6267°W):
- 3 ROUTERs, 1 REPEATER, 6 CLIENTs
- 14 topology edges with realistic SNR values
- Nodes drift position slightly every 10s
- Messages sent every 15s
- Neighbour info broadcast every 30s
- ~4% chance of SOS per node per 20s tick
- 2 nodes have DMS enabled with a 2-minute silence timeout (shortened for demo)
- Randomly silences a DMS node (~1.5% chance per 45s tick) to demo the alert

The simulator POSTs directly to `http://localhost:3000/api/*`. Change `SIM_URL` env var to point elsewhere.
