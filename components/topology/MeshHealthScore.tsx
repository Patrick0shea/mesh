"use client";

import type { TopologyData } from "./hooks/useTopologyData";

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return Math.max(outMin, Math.min(outMax, outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)));
}

export function calcHealthScore(data: TopologyData): {
  score: number;
  connectedness: number;
  avgSnr: number;
  isolatedPenalty: number;
} {
  const { nodes, edges } = data;
  if (nodes.length === 0) return { score: 0, connectedness: 0, avgSnr: 0, isolatedPenalty: 0 };

  // Build degree map
  const degree = new Map<string, number>();
  nodes.forEach((n) => degree.set(n.id, 0));
  edges.forEach((e) => {
    const src = typeof e.source === "string" ? e.source : e.source.id;
    const tgt = typeof e.target === "string" ? e.target : e.target.id;
    degree.set(src, (degree.get(src) ?? 0) + 1);
    degree.set(tgt, (degree.get(tgt) ?? 0) + 1);
  });

  // Average node degree → connectedness score 0–100
  const avgDegree = Array.from(degree.values()).reduce((a, b) => a + b, 0) / nodes.length;
  const connectedness = Math.min(100, lerp(avgDegree, 0, 4, 0, 100));

  // Average SNR of links → 0–100
  const snrs = edges.map((e) => e.snr).filter((s): s is number => s != null);
  const avgSnr = snrs.length > 0 ? snrs.reduce((a, b) => a + b, 0) / snrs.length : 0;
  const snrScore = Math.min(100, lerp(avgSnr, -10, 15, 0, 100));

  // Isolated nodes penalty
  const isolated = Array.from(degree.values()).filter((d) => d === 0).length;
  const isolatedRatio = isolated / nodes.length;
  const isolatedPenalty = Math.max(0, 100 - isolatedRatio * 200);

  const score = Math.round(
    connectedness * 0.4 + snrScore * 0.3 + isolatedPenalty * 0.3
  );

  return { score, connectedness: Math.round(connectedness), avgSnr, isolatedPenalty: Math.round(isolatedPenalty) };
}

export default function MeshHealthScore({ data }: { data: TopologyData }) {
  const { score, connectedness, avgSnr, isolatedPenalty } = calcHealthScore(data);

  const color =
    score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-mesh-card border border-mesh-border rounded-lg p-4 w-56 shrink-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Mesh Health
      </p>
      <div className="flex items-end gap-2 mb-4">
        <span className="text-5xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-xl text-slate-500 mb-1">/ 100</span>
      </div>

      <div className="space-y-2">
        <ScoreRow label="Connectivity" value={connectedness} />
        <ScoreRow
          label="Avg SNR"
          value={Math.min(100, Math.round(lerp(avgSnr, -10, 15, 0, 100)))}
          detail={`${avgSnr.toFixed(1)} dB`}
        />
        <ScoreRow label="Coverage" value={isolatedPenalty} />
      </div>

      <div className="mt-3 pt-3 border-t border-mesh-border">
        <p className="text-xs text-mesh-muted">
          {data.nodes.length} nodes · {data.edges.length} links
        </p>
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  const color =
    value >= 70 ? "bg-mesh-online" : value >= 40 ? "bg-mesh-warn" : "bg-mesh-danger";

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{detail ?? `${value}%`}</span>
      </div>
      <div className="h-1.5 bg-mesh-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
