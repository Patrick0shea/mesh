import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const events = db
    .prepare(
      `SELECT e.*, n.long_name, n.short_name, n.latitude, n.longitude
       FROM dms_events e
       LEFT JOIN nodes n ON n.node_id = e.node_id
       ORDER BY
         CASE WHEN e.resolution IS NULL THEN 0 ELSE 1 END,
         e.triggered_at DESC`
    )
    .all();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const {
    nodeId,
    triggerType,
    lastHeard,
    lastKnownLat,
    lastKnownLon,
    silenceDurationMinutes,
  } = body;

  const result = db
    .prepare(
      `INSERT INTO dms_events (node_id, triggered_at, trigger_type, last_heard, last_known_lat, last_known_lon, silence_duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nodeId,
      Math.floor(Date.now() / 1000),
      triggerType ?? "silence",
      lastHeard ?? null,
      lastKnownLat ?? null,
      lastKnownLon ?? null,
      silenceDurationMinutes ?? null
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const body = await req.json();
  const { action, resolutionNote } = body;

  const now = Math.floor(Date.now() / 1000);

  if (action === "acknowledge") {
    db.prepare("UPDATE dms_events SET acknowledged_at = ? WHERE id = ?").run(now, id);
  } else if (action === "escalate") {
    db.prepare("UPDATE dms_events SET escalated_at = ? WHERE id = ?").run(now, id);
  } else if (action === "resolve") {
    const { resolution } = body;
    db.prepare(
      "UPDATE dms_events SET resolution = ?, resolution_note = ?, acknowledged_at = COALESCE(acknowledged_at, ?) WHERE id = ?"
    ).run(resolution ?? "dismissed", resolutionNote ?? null, now, id);
  }

  return NextResponse.json({ ok: true });
}
