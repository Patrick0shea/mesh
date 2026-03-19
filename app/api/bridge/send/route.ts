import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const BRIDGE_URL = "http://localhost:5001/send";

export async function POST(req: NextRequest) {
  const { text, to, channel = 0 } = await req.json() as { text: string; to: string; channel?: number };

  try {
    const res = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, to, channel }),
    });
    if (!res.ok) return NextResponse.json({ success: false });
    const data = await res.json() as { success: boolean };
    if (!data.success) return NextResponse.json({ success: false });
  } catch {
    return NextResponse.json({ success: false });
  }

  // Save to DB
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    "INSERT INTO messages (from_node, to_node, channel, text, timestamp, transport) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("!local", to, channel, text, now, "radio");

  return NextResponse.json({ success: true });
}
