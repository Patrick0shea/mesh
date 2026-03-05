"use client";

import { useState } from "react";
import { Shield, Clock, CheckCircle, AlertTriangle } from "lucide-react";

interface DmsEvent {
  id: number;
  node_id: string;
  triggered_at: number;
  trigger_type: string;
  last_heard: number | null;
  acknowledged_at: number | null;
  escalated_at: number | null;
  resolution: string | null;
  resolution_note: string | null;
  silence_duration_minutes: number | null;
  long_name?: string | null;
  short_name?: string | null;
}

interface Node {
  node_id: string;
  long_name: string | null;
  short_name: string | null;
}

type Filter = "all" | "active" | "resolved";

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsed(from: number, to?: number | null): string {
  const diff = (to ?? Math.floor(Date.now() / 1000)) - from;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DMSEventLog({
  events,
  nodes,
}: {
  events: DmsEvent[];
  nodes: Node[];
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.node_id, n]));

  const filtered = events.filter((e) => {
    if (filter === "active") return !e.resolution;
    if (filter === "resolved") return !!e.resolution;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header + filter */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Shield size={16} className="text-mesh-warn" />
          Dead Man&apos;s Switch Events
        </h2>
        <div className="flex gap-1">
          {(["all", "active", "resolved"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded transition-colors capitalize ${
                filter === f
                  ? "bg-mesh-accent text-white"
                  : "bg-mesh-border text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-mesh-muted">
          <Shield size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No events</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-mesh-bg">
              <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 pr-4">Node</th>
                <th className="text-left py-2 pr-4">Triggered</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Duration</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Resolution</th>
              </tr>
              <tr>
                <td colSpan={6} className="pb-2">
                  <div className="h-px bg-mesh-border" />
                </td>
              </tr>
            </thead>
            <tbody className="divide-y divide-mesh-border/50">
              {filtered.map((evt) => {
                const node = nodeMap[evt.node_id];
                const name =
                  evt.long_name ??
                  node?.long_name ??
                  node?.short_name ??
                  evt.node_id;
                const isActive = !evt.resolution;
                const isEscalated = !!evt.escalated_at;

                return (
                  <tr
                    key={evt.id}
                    className={`${isActive ? "bg-yellow-900/10" : "opacity-60"}`}
                  >
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-200">{name}</div>
                      <div className="text-mesh-muted font-mono text-[10px]">
                        {evt.node_id.slice(-6).toUpperCase()}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {formatTs(evt.triggered_at)}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-mesh-warn capitalize">
                        {evt.trigger_type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      <Clock size={10} className="inline mr-1" />
                      {evt.silence_duration_minutes != null
                        ? `${Math.round(evt.silence_duration_minutes)}m`
                        : elapsed(evt.triggered_at, evt.resolution ? evt.acknowledged_at : undefined)}
                    </td>
                    <td className="py-2 pr-4">
                      {isActive ? (
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isEscalated ? "text-mesh-danger" : "text-mesh-warn"
                          }`}
                        >
                          <AlertTriangle size={11} />
                          {isEscalated ? "Escalated" : "Active"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-mesh-online">
                          <CheckCircle size={11} />
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500 capitalize">
                      {evt.resolution ?? "—"}
                      {evt.resolution_note && (
                        <div className="text-[10px] text-mesh-muted truncate max-w-32">
                          {evt.resolution_note}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
