import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const {
    packet_id, from_node, to_node, via_nodes,
    port_num, timestamp, hop_limit, hop_start, rssi, snr,
  } = body;

  db.prepare(
    `INSERT INTO packet_log (packet_id, from_node, to_node, via_nodes, port_num, timestamp, hop_limit, hop_start, rssi, snr)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    packet_id ?? null,
    from_node ?? null,
    to_node ?? null,
    via_nodes ? JSON.stringify(via_nodes) : null,
    port_num ?? null,
    timestamp ?? Math.floor(Date.now() / 1000),
    hop_limit ?? null,
    hop_start ?? null,
    rssi ?? null,
    snr ?? null
  );

  return NextResponse.json({ ok: true });
}
