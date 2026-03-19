// Server-side Dead Man's Switch monitor.
// Runs via setInterval — no browser required.
// Mirrors the logic in lib/dms-monitor.ts but uses direct DB calls.

import { getDb } from "./db";

let started = false;

function runServerDmsCheck() {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const configs = db
      .prepare("SELECT * FROM dms_config WHERE enabled = 1")
      .all() as Array<{
        node_id: string;
        silence_timeout_minutes: number;
        escalation_minutes: number;
      }>;

    for (const config of configs) {
      const node = db
        .prepare("SELECT node_id, last_heard, latitude, longitude FROM nodes WHERE node_id = ?")
        .get(config.node_id) as {
          node_id: string;
          last_heard: number | null;
          latitude: number | null;
          longitude: number | null;
        } | undefined;

      if (!node) continue;

      const lastHeard = node.last_heard ?? 0;
      const silenceSecs = config.silence_timeout_minutes * 60;
      const silenceDurationSecs = now - lastHeard;

      // Find unresolved event for this node
      const activeEvent = db
        .prepare(
          "SELECT * FROM dms_events WHERE node_id = ? AND resolution IS NULL ORDER BY triggered_at DESC LIMIT 1"
        )
        .get(config.node_id) as {
          id: number;
          triggered_at: number;
          acknowledged_at: number | null;
          escalated_at: number | null;
        } | undefined;

      if (!activeEvent) {
        if (silenceDurationSecs >= silenceSecs) {
          db.prepare(`
            INSERT INTO dms_events
              (node_id, triggered_at, trigger_type, last_heard, last_known_lat, last_known_lon, silence_duration_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            config.node_id,
            now,
            "silence",
            lastHeard,
            node.latitude,
            node.longitude,
            silenceDurationSecs / 60
          );
          console.log(
            `[DMS-server] Triggered for ${config.node_id} (silent ${Math.round(silenceDurationSecs / 60)}m)`
          );
        }
      } else {
        // Escalate if not acknowledged within escalation window
        if (!activeEvent.acknowledged_at && !activeEvent.escalated_at) {
          const timeSinceTrigger = now - activeEvent.triggered_at;
          if (timeSinceTrigger >= config.escalation_minutes * 60) {
            db.prepare(
              "UPDATE dms_events SET escalated_at = ? WHERE id = ?"
            ).run(now, activeEvent.id);

            // Create a corresponding SOS event
            db.prepare(
              "INSERT INTO sos_events (node_id, triggered_at, notes) VALUES (?, ?, ?)"
            ).run(
              config.node_id,
              now,
              `DMS auto-escalated (server): node silent for ${Math.round((now - lastHeard) / 60)}m`
            );

            console.log(`[DMS-server] Escalated for ${config.node_id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[DMS-server] Check error:", err);
  }
}

export function startServerDmsMonitor() {
  if (started) return;
  started = true;
  console.log("[DMS-server] Monitor started (60s interval)");
  runServerDmsCheck();
  setInterval(runServerDmsCheck, 60_000);
}