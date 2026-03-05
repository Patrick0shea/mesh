import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const nodes = db
    .prepare("SELECT * FROM nodes ORDER BY last_heard DESC")
    .all() as Array<{
      node_id: string;
      long_name: string | null;
      short_name: string | null;
      role: string | null;
      battery_level: number | null;
      last_heard: number | null;
      latitude: number | null;
      longitude: number | null;
    }>;

  const edges = db
    .prepare("SELECT * FROM neighbour_info ORDER BY timestamp DESC")
    .all() as Array<{
      node_id: string;
      neighbour_id: string;
      snr: number | null;
      timestamp: number | null;
    }>;

  const now = Math.floor(Date.now() / 1000);

  const formattedNodes = nodes.map((n) => ({
    id: n.node_id,
    longName: n.long_name ?? n.node_id,
    shortName: n.short_name ?? n.node_id.slice(-4),
    role: n.role ?? "CLIENT",
    battery: n.battery_level,
    status:
      n.last_heard && now - n.last_heard < 300
        ? "online"
        : n.last_heard && now - n.last_heard < 900
        ? "marginal"
        : "offline",
    lat: n.latitude,
    lon: n.longitude,
    lastHeard: n.last_heard,
  }));

  const formattedEdges = edges.map((e) => ({
    source: e.node_id,
    target: e.neighbour_id,
    snr: e.snr,
    lastPacket: e.timestamp,
  }));

  return NextResponse.json({
    nodes: formattedNodes,
    edges: formattedEdges,
    lastUpdated: now,
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { nodeId, neighbourId, snr } = body;

  db.prepare(
    `INSERT INTO neighbour_info (node_id, neighbour_id, snr, timestamp)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(node_id, neighbour_id) DO UPDATE SET
       snr = excluded.snr,
       timestamp = excluded.timestamp`
  ).run(nodeId, neighbourId, snr ?? null, Math.floor(Date.now() / 1000));

  return NextResponse.json({ ok: true });
}
