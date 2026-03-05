"use client";

import { useRef, useState, useEffect } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useTopologyData } from "./hooks/useTopologyData";
import TopologyGraph from "./TopologyGraph";
import MeshHealthScore from "./MeshHealthScore";
import type { TopologyNode, TopologyEdge } from "./hooks/useTopologyData";

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function TopologyViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<TopologyEdge | null>(null);

  const { data, loading, error, newPacketEdges } = useTopologyData(5000);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Graph area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-mesh-muted" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-mesh-danger">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {data && dims.width > 0 && (
          <TopologyGraph
            nodes={data.nodes}
            edges={data.edges}
            newPacketEdges={newPacketEdges}
            width={dims.width}
            height={dims.height}
            onNodeHover={setHoveredNode}
            onEdgeHover={setHoveredEdge}
          />
        )}

        {/* Node tooltip */}
        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-mesh-card border border-mesh-border rounded-lg p-3 text-xs shadow-xl z-10 w-52">
            <p className="font-semibold text-slate-200 mb-1">{hoveredNode.longName}</p>
            <p className="text-mesh-muted font-mono text-[11px] mb-2">{hoveredNode.id}</p>
            <div className="space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Role</span>
                <span className="text-slate-300">{hoveredNode.role}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span
                  className={
                    hoveredNode.status === "online"
                      ? "text-mesh-online"
                      : hoveredNode.status === "marginal"
                      ? "text-mesh-warn"
                      : "text-mesh-danger"
                  }
                >
                  {hoveredNode.status}
                </span>
              </div>
              {hoveredNode.battery != null && (
                <div className="flex justify-between">
                  <span>Battery</span>
                  <span className="text-slate-300">{hoveredNode.battery}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Last seen</span>
                <span className="text-slate-300">{timeAgo(hoveredNode.lastHeard)}</span>
              </div>
              {hoveredNode.lat != null && (
                <div className="flex justify-between">
                  <span>Position</span>
                  <span className="text-slate-300 text-[10px]">
                    {hoveredNode.lat.toFixed(4)}, {hoveredNode.lon?.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Neighbours</span>
                <span className="text-slate-300">
                  {data?.edges.filter((e) => {
                    const src = typeof e.source === "string" ? e.source : (e.source as TopologyNode).id;
                    const tgt = typeof e.target === "string" ? e.target : (e.target as TopologyNode).id;
                    return src === hoveredNode.id || tgt === hoveredNode.id;
                  }).length ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Edge tooltip */}
        {hoveredEdge && !hoveredNode && (
          <div className="absolute top-4 left-4 bg-mesh-card border border-mesh-border rounded-lg p-3 text-xs shadow-xl z-10 w-48">
            <p className="font-semibold text-slate-200 mb-2">Link</p>
            <div className="space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>SNR</span>
                <span
                  className={
                    hoveredEdge.snr != null && hoveredEdge.snr > 5
                      ? "text-mesh-online"
                      : hoveredEdge.snr != null && hoveredEdge.snr >= 0
                      ? "text-mesh-warn"
                      : "text-mesh-danger"
                  }
                >
                  {hoveredEdge.snr?.toFixed(1) ?? "N/A"} dB
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last packet</span>
                <span className="text-slate-300">{timeAgo(hoveredEdge.lastPacket)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {data && data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-mesh-muted">
              <p className="text-sm mb-1">No topology data</p>
              <p className="text-xs">Run simulation or connect a Meshtastic device</p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="w-60 border-l border-mesh-border p-3 flex flex-col gap-3 overflow-y-auto shrink-0">
        {data && <MeshHealthScore data={data} />}

        {data && (
          <div className="bg-mesh-card border border-mesh-border rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Legend
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-mesh-online" />
                <span>Online (&lt;5m)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-mesh-warn" />
                <span>Marginal (5–15m)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-mesh-danger" />
                <span>Offline (&gt;15m)</span>
              </div>
              <hr className="border-mesh-border my-1" />
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-mesh-online/40 rounded-sm" />
                <span>SNR &gt; 5 dB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-mesh-warn/40 rounded-sm" />
                <span>SNR 0–5 dB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-mesh-danger/40 rounded-sm" />
                <span>SNR &lt; 0 dB</span>
              </div>
              <hr className="border-mesh-border my-1" />
              <div className="flex items-center gap-2">
                <svg width="16" height="14"><circle cx="8" cy="7" r="5" fill="#6b7280" stroke="#0f1117" strokeWidth="1.5"/></svg>
                <span>CLIENT</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="14"><polygon points="8,1 15,5 15,11 8,15 1,11 1,5" fill="#6b7280" stroke="#0f1117" strokeWidth="1.5"/></svg>
                <span>ROUTER / REPEATER</span>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="text-xs text-mesh-muted text-center">
            Updated {timeAgo(data.lastUpdated)}
          </div>
        )}
      </div>
    </div>
  );
}
