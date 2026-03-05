#!/usr/bin/env tsx
/**
 * Meshtastic Network Simulator
 * Simulates 10 nodes around Limerick city for development/testing.
 * Features: node positions, messages, neighbour info (topology), SOS, DMS.
 *
 * Run with: npx tsx scripts/simulate-nodes.ts
 */

const BASE_URL = process.env.SIM_URL ?? "http://localhost:3000";
const LIMERICK_LAT = 52.6638;
const LIMERICK_LON = -8.6267;

// ---- Node definitions --------------------------------------------------------

interface SimNode {
  id: string;
  longName: string;
  shortName: string;
  role: "ROUTER" | "CLIENT" | "REPEATER";
  lat: number;
  lon: number;
  battery: number;
  lastSeen: number;
  dmsEnabled: boolean;
  dmsSilenced: boolean;     // If true, node will stop responding (DMS demo)
  dmsSilenceAt: number | null;
}

const NAMES = [
  { long: "Alpha Base", short: "ALPH", role: "ROUTER" as const },
  { long: "Bravo Team", short: "BRAV", role: "CLIENT" as const },
  { long: "Charlie Post", short: "CHAR", role: "ROUTER" as const },
  { long: "Delta Unit", short: "DELT", role: "CLIENT" as const },
  { long: "Echo Relay", short: "ECHO", role: "REPEATER" as const },
  { long: "Foxtrot Scout", short: "FOX1", role: "CLIENT" as const },
  { long: "Golf Mobile", short: "GOLF", role: "CLIENT" as const },
  { long: "Hotel Station", short: "HOTL", role: "ROUTER" as const },
  { long: "India Field", short: "INDI", role: "CLIENT" as const },
  { long: "Juliet Medic", short: "JULI", role: "CLIENT" as const },
];

function randId(): string {
  const hex = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, "0");
  return `!${hex}`;
}

function randOffset(scale = 0.05): number {
  return (Math.random() - 0.5) * 2 * scale;
}

let nodes: SimNode[] = NAMES.map((n, i) => ({
  id: `!sim${i.toString(16).padStart(6, "0")}`,
  longName: n.long,
  shortName: n.short,
  role: n.role,
  lat: LIMERICK_LAT + randOffset(0.045),
  lon: LIMERICK_LON + randOffset(0.07),
  battery: 60 + Math.floor(Math.random() * 40),
  lastSeen: Math.floor(Date.now() / 1000),
  dmsEnabled: i === 3 || i === 8, // Delta and India have DMS enabled
  dmsSilenced: false,
  dmsSilenceAt: null,
}));

// ---- Neighbour topology (static topology with SNR) --------------------------
// Each ROUTER sees 3–4 nodes; clients see 1–2 routers
const topology: Array<[number, number, number]> = [
  // [nodeIdx, neighbourIdx, snr]
  [0, 1, 9.5],   // Alpha ↔ Bravo
  [0, 2, 7.2],   // Alpha ↔ Charlie
  [0, 4, 11.0],  // Alpha ↔ Echo
  [0, 7, 6.8],   // Alpha ↔ Hotel
  [1, 4, 4.2],   // Bravo ↔ Echo
  [1, 5, 2.1],   // Bravo ↔ Foxtrot
  [2, 3, 8.9],   // Charlie ↔ Delta
  [2, 6, 5.5],   // Charlie ↔ Golf
  [2, 9, 3.8],   // Charlie ↔ Juliet
  [4, 7, 12.3],  // Echo ↔ Hotel
  [5, 6, 1.2],   // Foxtrot ↔ Golf
  [7, 8, 9.1],   // Hotel ↔ India
  [7, 9, 7.7],   // Hotel ↔ Juliet
  [3, 8, -2.1],  // Delta ↔ India (weak link)
];

const MESSAGES = [
  "All units check in",
  "Sector clear, proceeding",
  "Supply drop at grid reference 4-7",
  "Medical team needed at shelter 3",
  "Road blocked, rerouting",
  "Water distribution point active",
  "Generator fuel low — 2h remaining",
  "Check in confirmation",
  "Position updated",
  "Standby for further orders",
  "Search area completed — negative",
  "Casualties evacuated to field hospital",
];

// ---- API helpers -------------------------------------------------------------

async function post(path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`POST ${path} failed ${res.status}: ${txt.slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`POST ${path} error:`, e);
  }
}

// ---- Simulation loops -------------------------------------------------------

async function upsertNodes() {
  const now = Math.floor(Date.now() / 1000);
  for (const node of nodes) {
    if (node.dmsSilenced) continue; // Silenced node stops transmitting

    // Small position drift
    node.lat += randOffset(0.0003);
    node.lon += randOffset(0.0005);
    node.battery = Math.max(5, node.battery - 0.1 + Math.random() * 0.05);
    node.lastSeen = now;

    await post("/api/nodes", {
      node_id: node.id,
      long_name: node.longName,
      short_name: node.shortName,
      role: node.role,
      latitude: node.lat,
      longitude: node.lon,
      battery_level: Math.round(node.battery),
      last_heard: now,
      snr: +(4 + Math.random() * 8).toFixed(1),
      rssi: -(60 + Math.floor(Math.random() * 40)),
      hops_away: node.role === "ROUTER" ? 0 : 1,
    });
  }
  console.log(`[${ts()}] Nodes updated`);
}

async function broadcastNeighbourInfo() {
  for (const [aIdx, bIdx, baseSNR] of topology) {
    const a = nodes[aIdx];
    const b = nodes[bIdx];
    const snr = +(baseSNR + (Math.random() - 0.5) * 2).toFixed(1);

    await post("/api/neighbour-info", {
      nodeId: a.id,
      neighbourId: b.id,
      snr,
    });
    await post("/api/neighbour-info", {
      nodeId: b.id,
      neighbourId: a.id,
      snr,
    });
  }
  console.log(`[${ts()}] Neighbour info broadcasted (${topology.length} links)`);
}

async function sendMessages() {
  // 2–3 random messages per tick
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const sender = nodes[Math.floor(Math.random() * nodes.length)];
    if (sender.dmsSilenced) continue;
    const text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

    await post("/api/messages", {
      from_node: sender.id,
      to_node: "^all",
      channel: 0,
      text: `[${sender.shortName}] ${text}`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }
  console.log(`[${ts()}] Messages sent`);
}

async function maybeTriggerSos() {
  for (const node of nodes) {
    if (node.dmsSilenced) continue;
    if (Math.random() < 0.04) {  // 4% chance per node per tick
      await post("/api/events", {
        node_id: node.id,
        triggered_at: Math.floor(Date.now() / 1000),
        notes: `SOS from ${node.longName}`,
      });
      console.log(`[${ts()}] SOS triggered: ${node.longName}`);
    }
  }
}

async function manageDmsSilence() {
  const now = Math.floor(Date.now() / 1000);

  for (const node of nodes) {
    if (!node.dmsEnabled) continue;

    if (!node.dmsSilenced && Math.random() < 0.015) {
      // Randomly silence this node
      node.dmsSilenced = true;
      node.dmsSilenceAt = now;
      console.log(`[${ts()}] DMS: ${node.longName} has gone silent!`);
    }

    // Optionally un-silence after ~10 minutes (for demo cycling)
    if (node.dmsSilenced && node.dmsSilenceAt && (now - node.dmsSilenceAt) > 600) {
      node.dmsSilenced = false;
      node.dmsSilenceAt = null;
      node.lastSeen = now;
      console.log(`[${ts()}] DMS: ${node.longName} back online`);
    }
  }
}

async function setupDmsConfig() {
  for (const node of nodes) {
    if (!node.dmsEnabled) continue;
    await post("/api/dead-man-switch/config", {
      nodeId: node.id,
      enabled: true,
      silenceTimeout: 2,   // 2 min for demo (not 45)
      escalationMinutes: 3, // 3 min escalation for demo
      contactNote: `Emergency contact for ${node.longName}: radio channel 3`,
    });
  }
  console.log(`[${ts()}] DMS configs registered for ${nodes.filter(n => n.dmsEnabled).length} nodes`);
}

function ts(): string {
  return new Date().toLocaleTimeString();
}

// ---- Main -------------------------------------------------------------------

async function main() {
  console.log("Meshtastic Simulator starting...");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Nodes: ${nodes.length} (${nodes.filter(n => n.role === "ROUTER").length} routers, ${nodes.filter(n => n.role === "REPEATER").length} repeaters)`);
  console.log(`DMS-enabled nodes: ${nodes.filter(n => n.dmsEnabled).map(n => n.longName).join(", ")}`);
  console.log("");

  // Wait briefly for Next.js to start
  await new Promise(r => setTimeout(r, 2000));

  // Initial seeding
  await upsertNodes();
  await broadcastNeighbourInfo();
  await setupDmsConfig();
  await sendMessages();

  // Loops
  setInterval(upsertNodes, 10_000);           // every 10s
  setInterval(sendMessages, 15_000);           // every 15s
  setInterval(broadcastNeighbourInfo, 30_000); // every 30s
  setInterval(maybeTriggerSos, 20_000);        // every 20s
  setInterval(manageDmsSilence, 45_000);       // every 45s (DMS demo)

  console.log("Simulation running. Press Ctrl+C to stop.\n");
}

main().catch(console.error);
