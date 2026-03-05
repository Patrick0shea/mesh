import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const nodes = db.prepare("SELECT * FROM nodes ORDER BY last_heard DESC").all();
  return NextResponse.json(nodes);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const {
    node_id, long_name, short_name, hardware, role,
    latitude, longitude, altitude, battery_level, voltage,
    last_heard, snr, rssi, hops_away,
  } = body;

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO nodes (node_id, long_name, short_name, hardware, role, latitude, longitude, altitude, battery_level, voltage, last_heard, first_seen, snr, rssi, hops_away)
    VALUES (@node_id, @long_name, @short_name, @hardware, @role, @latitude, @longitude, @altitude, @battery_level, @voltage, @last_heard, @first_seen, @snr, @rssi, @hops_away)
    ON CONFLICT(node_id) DO UPDATE SET
      long_name = excluded.long_name,
      short_name = excluded.short_name,
      hardware = excluded.hardware,
      role = excluded.role,
      latitude = COALESCE(excluded.latitude, latitude),
      longitude = COALESCE(excluded.longitude, longitude),
      altitude = COALESCE(excluded.altitude, altitude),
      battery_level = COALESCE(excluded.battery_level, battery_level),
      voltage = COALESCE(excluded.voltage, voltage),
      last_heard = excluded.last_heard,
      snr = COALESCE(excluded.snr, snr),
      rssi = COALESCE(excluded.rssi, rssi),
      hops_away = COALESCE(excluded.hops_away, hops_away)
  `).run({
    node_id,
    long_name: long_name ?? null,
    short_name: short_name ?? null,
    hardware: hardware ?? null,
    role: role ?? "CLIENT",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    altitude: altitude ?? null,
    battery_level: battery_level ?? null,
    voltage: voltage ?? null,
    last_heard: last_heard ?? now,
    first_seen: now,
    snr: snr ?? null,
    rssi: rssi ?? null,
    hops_away: hops_away ?? null,
  });

  return NextResponse.json({ ok: true });
}
