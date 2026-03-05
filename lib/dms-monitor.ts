"use client";

// DMS monitor runs entirely client-side via setInterval.
// Called from useDMSMonitor hook.

interface Node {
  node_id: string;
  long_name: string | null;
  latitude: number | null;
  longitude: number | null;
  last_heard: number | null;
}

interface DmsConfig {
  node_id: string;
  enabled: number;
  silence_timeout_minutes: number;
  movement_timeout_minutes: number | null;
  escalation_minutes: number;
}

interface DmsEvent {
  id: number;
  node_id: string;
  resolution: string | null;
  acknowledged_at: number | null;
  escalated_at: number | null;
  triggered_at: number;
}

export async function runDmsCheck(): Promise<void> {
  const [nodesRes, configsRes, eventsRes] = await Promise.all([
    fetch("/api/nodes"),
    fetch("/api/dead-man-switch/config"),
    fetch("/api/dead-man-switch/events"),
  ]);

  if (!nodesRes.ok || !configsRes.ok || !eventsRes.ok) return;

  const nodes: Node[] = await nodesRes.json();
  const configs: DmsConfig[] = await configsRes.json();
  const events: DmsEvent[] = await eventsRes.json();

  const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));
  const now = Math.floor(Date.now() / 1000);

  for (const config of configs) {
    if (!config.enabled) continue;

    const node = nodeMap.get(config.node_id);
    if (!node) continue;

    const lastHeard = node.last_heard ?? 0;
    const silenceSecs = config.silence_timeout_minutes * 60;
    const silenceDurationSecs = now - lastHeard;

    // Find active (unresolved) event for this node
    const activeEvent = events.find(
      (e) => e.node_id === config.node_id && !e.resolution
    );

    if (!activeEvent) {
      // Check if we should trigger
      if (silenceDurationSecs >= silenceSecs) {
        await fetch("/api/dead-man-switch/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: config.node_id,
            triggerType: "silence",
            lastHeard: lastHeard,
            lastKnownLat: node.latitude,
            lastKnownLon: node.longitude,
            silenceDurationMinutes: silenceDurationSecs / 60,
          }),
        });
        console.log(`[DMS] Triggered for ${config.node_id} (silent ${Math.round(silenceDurationSecs / 60)}m)`);
      }
    } else {
      // Check if we should escalate
      if (
        !activeEvent.acknowledged_at &&
        !activeEvent.escalated_at
      ) {
        const timeSinceTrigger = now - activeEvent.triggered_at;
        if (timeSinceTrigger >= config.escalation_minutes * 60) {
          await fetch(`/api/dead-man-switch/events?id=${activeEvent.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "escalate" }),
          });
          console.log(`[DMS] Escalated for ${config.node_id}`);
        }
      }
    }
  }
}
