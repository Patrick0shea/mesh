import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");

  if (nodeId) {
    const config = db
      .prepare("SELECT * FROM dms_config WHERE node_id = ?")
      .get(nodeId);
    return NextResponse.json(config ?? null);
  }

  const configs = db.prepare("SELECT * FROM dms_config").all();
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const {
    nodeId,
    enabled,
    silenceTimeout,
    movementTimeout,
    escalationMinutes,
    contactNote,
  } = body;

  db.prepare(
    `INSERT INTO dms_config (node_id, enabled, silence_timeout_minutes, movement_timeout_minutes, escalation_minutes, contact_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(node_id) DO UPDATE SET
       enabled = excluded.enabled,
       silence_timeout_minutes = excluded.silence_timeout_minutes,
       movement_timeout_minutes = excluded.movement_timeout_minutes,
       escalation_minutes = excluded.escalation_minutes,
       contact_note = excluded.contact_note,
       updated_at = excluded.updated_at`
  ).run(
    nodeId,
    enabled ? 1 : 0,
    silenceTimeout ?? 45,
    movementTimeout ?? null,
    escalationMinutes ?? 15,
    contactNote ?? null,
    Math.floor(Date.now() / 1000)
  );

  return NextResponse.json({ ok: true });
}
