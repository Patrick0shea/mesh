"use client";

import { Battery, Clock, Wifi, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Node {
  node_id: string;
  long_name: string | null;
  short_name: string | null;
  role: string | null;
  battery_level: number | null;
  latitude: number | null;
  longitude: number | null;
  last_heard: number | null;
  snr: number | null;
  rssi: number | null;
  hops_away: number | null;
}

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusColor(lastHeard: number | null): string {
  if (!lastHeard) return "bg-mesh-muted";
  const diff = Math.floor(Date.now() / 1000) - lastHeard;
  if (diff < 300) return "bg-mesh-online";
  if (diff < 900) return "bg-mesh-warn";
  return "bg-mesh-danger";
}

function batteryColor(level: number | null): string {
  if (!level) return "text-mesh-muted";
  if (level > 50) return "text-mesh-online";
  if (level > 20) return "text-mesh-warn";
  return "text-mesh-danger";
}

const ROLE_BADGE: Record<string, string> = {
  ROUTER: "bg-blue-900/50 text-blue-300",
  ROUTER_CLIENT: "bg-indigo-900/50 text-indigo-300",
  REPEATER: "bg-purple-900/50 text-purple-300",
  CLIENT: "bg-slate-700/50 text-slate-400",
};

export default function NodeList({ nodes }: { nodes: Node[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex flex-col" style={{ maxHeight: "50%" }}>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-mesh-border/50 shrink-0"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Nodes ({nodes.length})
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </div>

      {!collapsed && (
        <div className="overflow-y-auto flex-1">
          {nodes.length === 0 ? (
            <p className="px-3 py-4 text-xs text-mesh-muted text-center">
              No nodes. Connect device or run simulation.
            </p>
          ) : (
            nodes.map((node) => (
              <button
                key={node.node_id}
                onClick={() => setSelected(selected === node.node_id ? null : node.node_id)}
                className={`w-full text-left px-3 py-2 border-b border-mesh-border/50 hover:bg-mesh-card transition-colors ${
                  selected === node.node_id ? "bg-mesh-accent/10" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor(node.last_heard)}`} />
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {node.long_name ?? node.short_name ?? node.node_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {node.battery_level != null && (
                      <span className={`text-xs ${batteryColor(node.battery_level)}`}>
                        <Battery size={12} className="inline" /> {node.battery_level}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      ROLE_BADGE[node.role ?? "CLIENT"] ?? ROLE_BADGE.CLIENT
                    }`}
                  >
                    {node.role ?? "CLIENT"}
                  </span>
                  <span className="text-[11px] text-mesh-muted flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(node.last_heard)}
                  </span>
                  {node.snr != null && (
                    <span className="text-[11px] text-mesh-muted flex items-center gap-1">
                      <Wifi size={10} />
                      SNR {node.snr.toFixed(1)}
                    </span>
                  )}
                </div>

                {selected === node.node_id && (
                  <div className="mt-2 pt-2 border-t border-mesh-border/50 text-xs text-slate-400 space-y-1">
                    <div className="font-mono text-[11px]">{node.node_id}</div>
                    {node.latitude != null && (
                      <div>
                        {node.latitude.toFixed(5)}, {node.longitude?.toFixed(5)}
                      </div>
                    )}
                    {node.rssi != null && <div>RSSI: {node.rssi} dBm</div>}
                    {node.hops_away != null && <div>Hops: {node.hops_away}</div>}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
