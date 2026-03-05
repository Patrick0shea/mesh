import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const messages = db
    .prepare("SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?")
    .all(limit, offset);

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { from_node, to_node, channel, text, timestamp, packet_id } = body;

  const result = db
    .prepare(
      "INSERT INTO messages (from_node, to_node, channel, text, timestamp, packet_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      from_node,
      to_node ?? null,
      channel ?? 0,
      text ?? null,
      timestamp ?? Math.floor(Date.now() / 1000),
      packet_id ?? null
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}
