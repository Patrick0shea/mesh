"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, MapPin, Clock, X, ArrowUp, CheckCircle } from "lucide-react";
import { sendMessage } from "@/lib/meshtastic/send";

interface DmsEvent {
  id: number;
  node_id: string;
  triggered_at: number;
  trigger_type: string;
  last_heard: number | null;
  last_known_lat: number | null;
  last_known_lon: number | null;
  acknowledged_at: number | null;
  escalated_at: number | null;
  resolution: string | null;
  silence_duration_minutes: number | null;
  long_name?: string | null;
  short_name?: string | null;
}

interface Node {
  node_id: string;
  long_name: string | null;
  short_name: string | null;
}

interface Props {
  event: DmsEvent;
  nodes: Node[];
  onUpdate: () => void;
}

function elapsed(fromTs: number): string {
  const mins = Math.floor((Date.now() / 1000 - fromTs) / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DMSAlertBanner({ event, nodes, onUpdate }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissNote, setDismissNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isEscalated = !!event.escalated_at;
  const node = nodes.find((n) => n.node_id === event.node_id);
  const nodeName = event.long_name ?? node?.long_name ?? node?.short_name ?? event.node_id;

  // Play alert sound on mount
  useEffect(() => {
    const src = isEscalated ? "/sounds/sos-alert.mp3" : "/sounds/dms-alert.mp3";
    if (typeof window !== "undefined") {
      const audio = new Audio(src);
      audio.volume = 0.6;
      audio.play().catch(() => {/* autoplay blocked - ignore */});
      audioRef.current = audio;
    }
    return () => {
      audioRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEscalated]);

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await fetch(`/api/dead-man-switch/events?id=${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      onUpdate();
    } finally {
      setBusy(false);
    }
  }

  async function markSafe() {
    await patch("resolve", { resolution: "safe" });
  }

  async function escalateToSos() {
    await patch("escalate");
    const silentMins = Math.round(event.silence_duration_minutes ?? 0);
    const alertText = `🚨 SOS ALERT: ${nodeName} — DMS escalated after ${silentMins}m silence`;
    // Broadcast over radio or MQTT
    sendMessage(alertText, "^all", 0).catch(() => {/* best effort */});
    // Create a SOS event record
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: event.node_id,
        notes: `Escalated from Dead Man's Switch — silent for ${silentMins}m`,
      }),
    });
  }

  async function dismiss() {
    await patch("resolve", { resolution: "dismissed", resolutionNote: dismissNote });
    setDismissOpen(false);
  }

  const bgClass = isEscalated
    ? "bg-mesh-danger/20 border-mesh-danger/50"
    : "bg-yellow-900/20 border-mesh-warn/50";

  const iconClass = isEscalated ? "text-mesh-danger" : "text-mesh-warn";

  return (
    <div className={`border-b px-4 py-2 shrink-0 ${bgClass}`}>
      <div className="flex items-center gap-3">
        <Shield size={16} className={`${iconClass} shrink-0`} />

        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold uppercase tracking-wider ${iconClass}`}>
            {isEscalated ? "ESCALATED — " : "DEAD MAN'S SWITCH — "}
          </span>
          <span className="text-xs font-semibold text-slate-200">{nodeName}</span>

          <span className="text-xs text-mesh-muted ml-2">
            <Clock size={10} className="inline mr-0.5" />
            Silent {elapsed(event.triggered_at)}
          </span>

          {event.last_known_lat != null && (
            <span className="text-xs text-mesh-muted ml-2">
              <MapPin size={10} className="inline mr-0.5" />
              {event.last_known_lat.toFixed(4)}, {event.last_known_lon?.toFixed(4)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={markSafe}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-mesh-online/20 hover:bg-mesh-online/30 text-mesh-online rounded transition-colors"
          >
            <CheckCircle size={12} />
            Safe
          </button>

          {!isEscalated && (
            <button
              onClick={escalateToSos}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-mesh-danger/20 hover:bg-mesh-danger/30 text-mesh-danger rounded transition-colors"
            >
              <ArrowUp size={12} />
              Escalate to SOS
            </button>
          )}

          <button
            onClick={() => setDismissOpen(!dismissOpen)}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-mesh-border hover:bg-mesh-card text-slate-400 rounded transition-colors"
          >
            <X size={12} />
            Dismiss
          </button>
        </div>
      </div>

      {dismissOpen && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={dismissNote}
            onChange={(e) => setDismissNote(e.target.value)}
            placeholder="Reason for dismissal..."
            className="flex-1 text-xs bg-mesh-card border border-mesh-border rounded px-2 py-1 text-slate-300 placeholder-mesh-muted focus:outline-none focus:border-mesh-accent"
          />
          <button
            onClick={dismiss}
            className="px-3 py-1 text-xs bg-mesh-border hover:bg-mesh-card text-slate-300 rounded"
          >
            Confirm
          </button>
          <button
            onClick={() => setDismissOpen(false)}
            className="px-2 py-1 text-xs text-mesh-muted hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
