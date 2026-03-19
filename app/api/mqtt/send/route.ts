import { NextRequest, NextResponse } from "next/server";
import { getMqttStatus, publishMessage } from "@/lib/mqtt-client";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    text: string;
    to?: string;   // hex node id like "!a1b2c3d4", or "^all"
    channel?: number;
  };

  const { text, to = "^all", channel = 0 } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (getMqttStatus() !== "connected") {
    return NextResponse.json({ success: false, transport: "disconnected" });
  }

  // Convert hex node id to decimal for MQTT envelope
  let toDecimal: number | undefined;
  if (to !== "^all") {
    const hex = to.startsWith("!") ? to.slice(1) : to;
    toDecimal = parseInt(hex, 16);
  }

  const published = publishMessage(text, toDecimal, channel);
  if (!published) {
    return NextResponse.json({ success: false, transport: "disconnected" });
  }

  // Save to local DB so it appears in the Messages feed
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const toNode = to === "^all" ? "^all" : to;

  db.prepare(
    "INSERT INTO messages (from_node, to_node, channel, text, timestamp, transport) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("!local", toNode, channel, text, now, "mqtt");

  return NextResponse.json({ success: true, transport: "mqtt" });
}