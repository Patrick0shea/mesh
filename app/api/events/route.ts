import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const events = db
    .prepare(
      "SELECT * FROM sos_events ORDER BY triggered_at DESC"
    )
    .all();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { node_id, triggered_at, notes } = body;

  const result = db
    .prepare(
      "INSERT INTO sos_events (node_id, triggered_at, notes) VALUES (?, ?, ?)"
    )
    .run(
      node_id,
      triggered_at ?? Math.floor(Date.now() / 1000),
      notes ?? null
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const body = await req.json();
  const { action, acknowledged_by, notes } = body;

  const now = Math.floor(Date.now() / 1000);

  if (action === "resolve") {
    // Keep existing acknowledged_at if already set; set resolved_at now
    db.prepare(
      `UPDATE sos_events
       SET resolved_at = ?,
           acknowledged_at = COALESCE(acknowledged_at, ?),
           notes = COALESCE(?, notes)
       WHERE id = ?`
    ).run(now, now, notes ?? null, id);
  } else {
    // Acknowledge only — don't touch resolved_at
    db.prepare(
      `UPDATE sos_events
       SET acknowledged_at = COALESCE(acknowledged_at, ?),
           acknowledged_by = COALESCE(acknowledged_by, ?),
           notes = COALESCE(?, notes)
       WHERE id = ?`
    ).run(now, acknowledged_by ?? "operator", notes ?? null, id);
  }

  return NextResponse.json({ ok: true });
}
