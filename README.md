# Mesh — Disaster Response Coordinator

A command and control dashboard for emergency responders using Meshtastic LoRa mesh radio networks. Built to work with zero internet, zero phone signal, and zero infrastructure — because those are exactly the conditions you face when things go wrong.

---

## The Problem

When a disaster hits — flood, earthquake, power outage — the first thing that goes is the phone network. Emergency coordinators lose visibility of their field teams. People die because no one knows where they are or whether they're in trouble.

This is built to solve that. Field operatives carry **LILYGO T-Beam** devices — compact ESP32 boards with a LoRa radio, GPS, and a small screen. They communicate purely by radio. A base station Raspberry Pi running this dashboard receives those radio packets and displays everything in a browser accessible to any coordinator on the same local WiFi. No internet. No cloud. No dependencies that can fail.

```
[Field operative]
  T-Beam in 3D printed case
        |
        | LoRa radio — 868MHz, up to 10km per hop
        |
[Intermediate nodes] ← automatic multi-hop routing
        |
        | LoRa radio
        |
[Base station T-Beam] — plugged into Raspberry Pi via USB
        |
        | USB serial
        |
[bridge.py on Pi] — decodes Meshtastic packets, POSTs to dashboard API
        |
        | HTTP on localhost
        |
[Next.js dashboard on Pi] — stores in SQLite, serves to browsers
        |
        | Local WiFi (Pi hotspot or shared network)
        |
[Coordinator's browser] — live map, messages, alerts
```

---

## What the Dashboard Shows

**Map** — Live GPS positions of all field nodes on an OpenStreetMap base. SOS nodes flash red with a pulsing ring. Node colour shows last contact: green (< 5 min), amber (5–15 min), red (> 15 min).

**Topology** — Force-directed graph of the mesh. Shows which nodes can hear each other, SNR of every link, and a real-time mesh health score. Routers show as hexagons, clients as circles.

**Messages** — All text received from the mesh, in order, with node name and timestamp. Persistent across page refresh.

**Dead Man's Switch** — The most important tab. Fires an alert automatically if a field operative goes silent for longer than their configured timeout. If someone is unconscious and cannot press SOS, this catches it. Silence itself is the trigger. Unacknowledged alerts escalate to full SOS.

**SOS Alerts** — Dedicated view for all active SOS events. One-click acknowledge. The node flashes red on the map.

---

## Why Not Just Use Walkie-Talkies?

| | Walkie-talkie | This system |
|---|---|---|
| Communication type | Voice only | Text + GPS + data |
| Range extension | No | Yes — multi-hop mesh |
| Message history | Gone if you miss it | Stored in SQLite |
| GPS tracking | No | Yes — live map |
| Automated alerts | No | Yes — DMS fires on silence |
| Multi-user visibility | One device, one user | Anyone on the WiFi |
| Infrastructure needed | None | None |

---

## Hardware

| Component | Purpose |
|---|---|
| LILYGO T-Beam (×N) | Field devices — LoRa radio + GPS + ESP32 + OLED |
| Raspberry Pi 4 or 5 | Base station — runs dashboard + bridge |
| USB-A to USB-C cable | Connects T-Beam to Pi |
| Power bank / 18650 cells | Field device battery |
| Car battery / solar | Pi power in the field |

A 5-node deployment runs around €300–350. No subscriptions, no licences — 868MHz is an unlicensed ISM band in Europe.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the dashboard
npm run dev

# In a second terminal — run the simulator (no hardware needed)
npx tsx scripts/simulate-nodes.ts
```

Open `http://localhost:3000`. The simulator populates the dashboard with 10 nodes around Limerick city within seconds.

**Simulator keyboard controls:**
- `s` — trigger SOS on a random node
- `d` — toggle Delta Unit silent (Dead Man's Switch demo, fires after ~2 min)
- `Ctrl+C` — quit

---

## Running With Real Hardware (Pi Deployment)

```bash
# Terminal 1 — dashboard
npm start

# Terminal 2 — bridge (reads from T-Beam over USB, posts to dashboard)
python3 bridge.py

# Terminal 3 — simulator (optional, for demo alongside real hardware)
npx tsx scripts/simulate-nodes.ts
```

`bridge.py` connects to the T-Beam on `/dev/ttyACM0`, decodes Meshtastic protobuf packets, and forwards them as REST calls to the dashboard. It also hosts a small HTTP server on port 5001 so the dashboard can send messages back out through the radio.

---

## MQTT (Internet Fallback)

When internet is available, the dashboard connects to the public Meshtastic MQTT broker. This gives a second message path — useful for testing or for internet-connected nodes to reach the dashboard. It is a fallback only; the system is fully functional without it.

**Transport priority:**
1. USB Serial (bridge.py) — no internet needed
2. Bluetooth — no internet needed
3. MQTT — internet required
4. Local only — saved to DB, not transmitted

### Environment variables (`.env.local`)

```
MQTT_BROKER_URL=mqtt://mqtt.meshtastic.org:1883
MQTT_USERNAME=meshdev
MQTT_PASSWORD=large4cats
MQTT_ROOT_TOPIC=msh/EU_868
MY_NODE_ID=0   # replace with your decimal node ID
```

To find your decimal node ID:
```bash
node -e "console.log(parseInt('a1b2c3d4', 16))"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Radio bridge | Python 3 (`meshtastic`, `requests`) |
| Browser radio | `@meshtastic/js` (WebSerial + Web Bluetooth) |
| MQTT | `mqtt` (MQTT.js — server-side singleton) |
| Map | Leaflet + OpenStreetMap |
| Topology graph | D3.js v7 force simulation |
| Styling | Tailwind CSS (dark theme) |

> **Browser note:** USB Serial requires Chrome or Edge (WebSerial API). Bluetooth requires Chrome over HTTPS or localhost.

---

## Project Structure

```
mesh/
├── app/
│   ├── page.tsx                # Main dashboard — tabs, polling, DMS monitor
│   └── api/
│       ├── nodes/              # GET all nodes / POST upsert
│       ├── messages/           # GET messages / POST new
│       ├── events/             # GET/POST/PATCH SOS events
│       ├── neighbour-info/     # GET topology graph / POST edge
│       └── dead-man-switch/
│           ├── config/         # GET/POST DMS config per node
│           └── events/         # GET/POST/PATCH DMS events
│
├── components/
│   ├── dashboard/              # ConnectionPanel, NodeList, MessageLog, SOSAlerts
│   ├── map/MeshMap.tsx         # Leaflet map with animated node markers
│   ├── topology/               # D3 graph, health score, topology viewer
│   └── dead-man-switch/        # Alert banner, event log, DMS monitor hook
│
├── lib/
│   ├── db.ts                   # SQLite singleton (WAL mode)
│   ├── schema.ts               # All table definitions
│   ├── mqtt-client.ts          # Server-side MQTT singleton
│   ├── dms-monitor.ts          # DMS silence detection logic
│   └── meshtastic/             # WebSerial, BLE, packet decoder
│
├── bridge.py                   # Python serial bridge for Pi deployment
└── scripts/
    └── simulate-nodes.ts       # Dev/demo simulator — 10 nodes, keyboard controls
```

---

## Dead Man's Switch

Most emergency systems wait for someone to press a button. This one watches for silence. If a node stops transmitting for longer than its configured timeout, an alert fires automatically — no action required from the field operative.

```
[node goes silent]
      |
      | silence_timeout_minutes exceeded (default 45 min, demo 2 min)
      |
[DMS triggered] → coordinator sees alert banner
      |
      | escalation_minutes exceeded without acknowledgement
      |
[escalated to SOS] → node flashes red on map
      |
[coordinator resolves] → marked safe / dismissed
```

**Config per node** (stored in `dms_config` table):
- `silence_timeout_minutes` — how long before trigger (default 45)
- `escalation_minutes` — how long before SOS escalation (default 15)
- `contact_note` — free text, e.g. next of kin, medical info

---

## Database Schema

All data lives in `mesh.db`, created automatically on first run.

- **`nodes`** — one row per node ever seen. GPS, battery, role, signal strength, last heard.
- **`messages`** — all text messages with sender, recipient, channel, transport, timestamp.
- **`sos_events`** — SOS alerts with acknowledged/resolved timestamps.
- **`neighbour_info`** — mesh topology edges. One row per directed node pair, latest SNR.
- **`dms_config`** — per-node Dead Man's Switch settings.
- **`dms_events`** — DMS alert lifecycle tracking.

---

## What Makes This Different

No existing Meshtastic tooling combines all of the following:

- Fully offline — no MQTT broker dependency, no cloud
- Raspberry Pi as shared access point with multi-user browser access
- Python bridge for shared serial access across the local network
- Dead Man's Switch with automatic silence detection and escalation
- Purpose-built first responder workflow — not a general analytics tool

See `NOVELTY.md` for a detailed comparison with existing tools (Malla, PotatoMesh, the official web client).