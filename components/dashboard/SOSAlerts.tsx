"use client";

import { AlertTriangle, CheckCircle, Clock, MapPin, Send, Radio, Cloud } from "lucide-react";
import { useState } from "react";
import { sendMessage } from "@/lib/meshtastic/send";

interface SosEvent {
  id: number;
  node_id: string;
  triggered_at: number;
  acknowledged_at: number | null;
  resolved_at: number | null;
  notes: string | null;
}

interface Node {
  node_id: string;
  long_name: string | null;
  short_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function SOSAlerts({
  events,
  nodes,
  onUpdate,
}: {
  events: SosEvent[];
  nodes: Node[];
  onUpdate?: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sosNote, setSosNote] = useState("");
  const [sending, setSending] = useState(false);
  const [lastTransport, setLastTransport] = useState<"radio" | "mqtt" | "local" | null>(null);

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.node_id, n]));

  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/events?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error("PATCH failed", await res.text());
      onUpdate?.();
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendSos() {
    const note = sosNote.trim();
    const text = `🚨 SOS ALERT: ${note || "Manual distress signal"}`;
    setSending(true);
    setLastTransport(null);
    try {
      // Transmit over mesh (radio or MQTT fallback)
      const { transport } = await sendMessage(text, "^all", 0);
      setLastTransport(transport);

      // Create SOS event record
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: "!local",
          triggered_at: Math.floor(Date.now() / 1000),
          notes: text,
        }),
      });

      setSosNote("");
      onUpdate?.();
    } catch (e) {
      console.error("SOS send failed:", e);
    } finally {
      setSending(false);
    }
  }

  const active = events.filter((e) => !e.resolved_at);
  const resolved = events.filter((e) => e.resolved_at);

  return (
    <div className="h-full overflow-auto p-4">
      {/* Manual SOS send panel */}
      <div className="mb-6 bg-mesh-danger/10 border border-mesh-danger/30 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-mesh-danger uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertTriangle size={14} />
          Send Emergency Alert
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={sosNote}
            onChange={(e) => setSosNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendSos(); }}
            placeholder="Optional note — e.g. 'Person injured at grid ref 52.6N 8.6W'"
            className="flex-1 bg-mesh-bg border border-mesh-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-mesh-muted focus:outline-none focus:border-mesh-danger"
          />
          <button
            onClick={handleSendSos}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-mesh-danger hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            {sending ? "Sending…" : "Send SOS"}
          </button>
        </div>
        {lastTransport && (
          <p className="text-xs text-mesh-muted mt-2 flex items-center gap-1">
            Sent via{" "}
            {lastTransport === "radio" && <><Radio size={10} className="text-mesh-online" /> radio</>}
            {lastTransport === "mqtt" && <><Cloud size={10} className="text-mesh-accent" /> MQTT</>}
            {lastTransport === "local" && "local only (no outbound path available)"}
          </p>
        )}
        <p className="text-[11px] text-mesh-muted mt-2">
          Broadcasts <span className="font-mono text-mesh-danger">🚨 SOS ALERT:</span> to all nodes.
          Uses radio if connected, MQTT otherwise.
        </p>
      </div>

      {active.length === 0 && resolved.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-mesh-muted">
          <CheckCircle size={48} className="mb-3 text-mesh-online opacity-50" />
          <p className="text-sm">No SOS events</p>
        </div>
      )}

      {active.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-mesh-danger uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} />
            Active SOS ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((evt) => {
              const node = nodeMap[evt.node_id];
              const busy = busyId === evt.id;
              return (
                <div
                  key={evt.id}
                  className="bg-mesh-card border border-mesh-danger/40 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-mesh-danger">
                        {node?.long_name ?? node?.short_name ?? evt.node_id}
                      </p>
                      <p className="text-xs text-mesh-muted font-mono">{evt.node_id}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-mesh-muted">
                      <Clock size={12} />
                      {timeAgo(evt.triggered_at)}
                    </div>
                  </div>

                  {node?.latitude != null && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
                      <MapPin size={12} />
                      {node.latitude.toFixed(5)}, {node.longitude?.toFixed(5)}
                    </div>
                  )}

                  {evt.notes && (
                    <p className="text-xs text-slate-400 mb-3 italic">{evt.notes}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {!evt.acknowledged_at && (
                      <button
                        onClick={() => patch(evt.id, { action: "acknowledge" })}
                        disabled={busy}
                        className="px-3 py-1.5 text-xs bg-mesh-warn/20 hover:bg-mesh-warn/30 text-mesh-warn rounded transition-colors disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => patch(evt.id, { action: "resolve" })}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs bg-mesh-online/20 hover:bg-mesh-online/30 text-mesh-online rounded transition-colors disabled:opacity-50"
                    >
                      {busy ? "Resolving…" : "Resolve"}
                    </button>
                    {evt.acknowledged_at && (
                      <span className="text-xs text-mesh-muted">
                        Ack&apos;d {timeAgo(evt.acknowledged_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-mesh-muted uppercase tracking-wider mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.slice(0, 20).map((evt) => {
              const node = nodeMap[evt.node_id];
              return (
                <div
                  key={evt.id}
                  className="bg-mesh-card border border-mesh-border rounded-lg px-4 py-2 flex items-center justify-between opacity-60"
                >
                  <div>
                    <span className="text-sm text-slate-400">
                      {node?.long_name ?? evt.node_id}
                    </span>
                    {evt.acknowledged_at && (
                      <span className="text-xs text-mesh-muted ml-2">
                        Ack&apos;d {timeAgo(evt.acknowledged_at)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-mesh-muted">
                    {timeAgo(evt.triggered_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}