




# Dashboard User Guide

This guide explains what everything on the screen means and how to use it during a response operation.

---

## Connecting a Radio

In the top-right corner are two buttons: **USB** and **BLE**.

- **USB** — plug a Meshtastic device into your computer via USB, then click USB. Your browser will show a port picker — select the device. Requires Chrome or Edge.
- **BLE** — connects over Bluetooth. Your browser will show a device picker. Requires Chrome and HTTPS (localhost works too).

Once connected, the status next to the buttons changes to **"Connected via serial"** or **"Connected via bluetooth"**. Packets from the mesh will start flowing into the dashboard automatically.

If you don't have hardware, run the simulator instead:
```
npx tsx scripts/simulate-nodes.ts
```

---

## Header Bar

```
MESH RESPONSE COORDINATOR   [activity icon] 10 nodes       [USB] [BLE]
```

- The node count shows how many unique radios have been heard since the database was last cleared.
- A red or amber bar appears below the header when there are active SOS or Dead Man's Switch alerts.

---

## Left Sidebar

### Nodes Panel (top half)

Lists every radio node the network has heard. Each entry shows:

| Element | Meaning |
|---|---|
| Coloured dot | Green = heard in last 5 min. Amber = 5–15 min ago. Red = over 15 min ago. Grey = never heard. |
| Node name | Long name set on the device (e.g. "Alpha Base") |
| Battery % | Last reported battery level. Goes red below 20%. |
| Role badge | What the device is doing on the network (see below) |
| Last seen | How long ago the last packet arrived |
| SNR | Signal quality of the last received packet |

**Click a node** to expand it and see its hex ID, GPS coordinates, RSSI, and hop count.

**Node roles:**

| Role | What it means |
|---|---|
| `CLIENT` | A normal handheld device. Sends and receives. |
| `ROUTER` | A fixed relay node. Forwards packets for others, extends range. |
| `ROUTER_CLIENT` | Acts as both a router and a user device. |
| `REPEATER` | Forwards packets only — no user interface. Usually a high-mounted fixed node. |

### Messages Panel (bottom half)

A live feed of all text messages received from the mesh, newest at the bottom. Shows:
- Sender's short ID (last 6 hex chars of their node ID)
- Timestamp
- Message text

Scrolls automatically when new messages arrive. Scroll up to pause auto-scroll.

---

## Map Tab

Shows all nodes that have reported GPS coordinates as markers on the map.

**Marker shapes:**
- **Circle** — CLIENT node
- **Hexagon** — ROUTER or REPEATER node

**Marker colours** match the node status (same as the sidebar dots):
- Green — heard recently
- Amber — heard 5–15 min ago
- Red — not heard for over 15 min

**Pulsing rings:**
- **Amber pulse** — this node has an active Dead Man's Switch alert
- **Red pulse** — this node has an active SOS alert

**Click any marker** to open a popup with the node's name, role, battery, SNR, and alert status.

Use the scroll wheel to zoom, click and drag to pan.

---

## Topology Tab

Shows the mesh network as a graph — nodes are the circles/hexagons, lines between them are radio links.

### What the topology graph actually tells you

The graph answers one core question: **if a node goes down, who loses communications?**

- A node with no lines connecting to it is **isolated** — messages to or from it have no path through the network
- A node that is the *only* connection between two groups is a **single point of failure** — if it goes offline, those two sides of the network are cut off from each other entirely
- Routers (hexagons) should have the most connections. If a router goes red or disappears, look at which client nodes (circles) suddenly have fewer or no links — those are the people who just lost their relay
- A node going **amber** (5–15 min silent) is a warning. If it goes **red**, assume it's out of range or the device is off
- **Red links** between two online nodes means the signal between them is very weak — messages may fail to get through even though both devices are running

In short: green nodes with green links and multiple connections = healthy. Any red, any isolated node, or any single link holding two halves of the network together = a problem to address.

---

### Reading the graph

**Node size** — larger nodes have more battery remaining.

**Node colour** — same green/amber/red/grey status as everywhere else.

**Node shape:**
- Circle = CLIENT
- Hexagon = ROUTER or REPEATER

**Link colours:**
- Green — strong link (SNR above 5 dB)
- Yellow — marginal link (SNR 0–5 dB)
- Red — weak link (SNR below 0 dB) — packets may be unreliable

**Animated blue dots** — when new topology data arrives, a dot travels along each active link to show a packet was recently relayed that way.

### Interacting with the graph

- **Hover a node** — tooltip shows name, role, battery, status, last seen, number of neighbours
- **Hover a link** — tooltip shows SNR and when the last packet was relayed
- **Drag a node** — pins it in place so you can rearrange the layout
- **Scroll** — zoom in/out
- **Click and drag background** — pan

### Mesh Health Score (right panel)

A single number out of 100 showing how well-connected and reliable the network is right now.

| Score | Meaning |
|---|---|
| 70–100 (green) | Healthy — good redundancy and signal quality |
| 40–69 (amber) | Degraded — some nodes isolated or weak links |
| 0–39 (red) | Critical — major coverage gaps or very poor signals |

The score is made up of three components:
- **Connectivity** (40%) — average number of links per node. More links = more redundancy.
- **Avg SNR** (30%) — average signal quality across all links.
- **Coverage** (30%) — penalises nodes with zero connections (isolated nodes).

---

## Dead Man's Switch Tab

The Dead Man's Switch (DMS) is a safety check for field operatives. If a node stops transmitting for longer than its configured time, an alert fires so the coordinator knows something may be wrong.

### Alert Banner

When a DMS fires, an amber bar appears across the top of the screen (below the header):

```
[shield icon] DEAD MAN'S SWITCH — Delta Unit  [clock] Silent 7m  [lat, lon]   [Safe] [Escalate to SOS] [Dismiss]
```

- **Node name** — which operative has gone silent
- **Silent duration** — how long since their last transmission
- **Coordinates** — last known GPS position

**Buttons:**

| Button | What it does |
|---|---|
| Safe | The operative has checked in by other means. Closes the alert and marks it resolved. |
| Escalate to SOS | Situation is serious. Converts to a full SOS alert, turns the banner red, and plays the SOS alarm. |
| Dismiss | Close the alert with a reason (e.g. "device turned off intentionally"). |

If the alert is not acknowledged within the escalation time (default 15 minutes), it automatically escalates — the banner turns red and the SOS tone plays.

### DMS Event Log (main area of this tab)

A table of all Dead Man's Switch events, past and present.

| Column | Meaning |
|---|---|
| Node | Which node triggered the alert |
| Triggered | When the alert first fired |
| Type | `silence` = went quiet / `movement` = stopped moving |
| Duration | How long they were silent when the alert fired |
| Status | Active (amber) / Escalated (red) / Resolved (green) |
| Resolution | `safe`, `escalated`, or `dismissed` — and any note entered |

Use the **All / Active / Resolved** filter buttons to narrow the list.

---

## SOS Alerts Tab

Shows all SOS events — triggered either by a node sending a message containing "SOS" or by the DMS being escalated.

### Active alerts (red cards)

Each card shows:
- Node name and hex ID
- How long ago the SOS was triggered
- GPS coordinates of the node at time of alert

**Acknowledge** — confirms you've seen the alert. Timestamp recorded. The alert stays active.

**Resolve** — marks the situation as handled. Moves the card to the resolved list.

### Resolved alerts (grey list)

A compact list of past SOS events for the record. Shows node name and how long ago it occurred.

---

## Status Indicators Quick Reference

| Colour | Status | Meaning |
|---|---|---|
| Green | Online | Heard in last 5 minutes |
| Amber | Marginal | Heard 5–15 minutes ago |
| Red | Offline | Not heard for over 15 minutes |
| Grey | Unknown | Never heard |
| Blue pulse (topology) | Packet | A message just relayed along this link |
| Amber pulse (map) | DMS active | This node has a Dead Man's Switch alert |
| Red pulse (map) | SOS active | This node has an active SOS alert |

---

## Alarm Sounds

- **DMS alert tone** (`dms-alert.mp3`) — plays when a Dead Man's Switch fires
- **SOS tone** (`sos-alert.mp3`) — plays when a DMS escalates to SOS or a direct SOS is received

Place audio files in `public/sounds/` to enable them. The dashboard will silently continue if the files are missing or if the browser blocks autoplay.
