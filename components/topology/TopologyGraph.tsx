"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { TopologyNode, TopologyEdge } from "./hooks/useTopologyData";

interface Props {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  newPacketEdges: Set<string>;
  width: number;
  height: number;
  onNodeHover: (node: TopologyNode | null) => void;
  onEdgeHover: (edge: TopologyEdge | null) => void;
}

function snrColor(snr: number | null): string {
  if (snr == null) return "#4b5563";
  if (snr > 5) return "#22c55e";
  if (snr >= 0) return "#f59e0b";
  return "#ef4444";
}

function nodeColor(status: string): string {
  if (status === "online") return "#22c55e";
  if (status === "marginal") return "#f59e0b";
  if (status === "offline") return "#ef4444";
  return "#6b7280";
}

function nodeRadius(battery: number | null): number {
  if (battery == null) return 12;
  return 10 + (battery / 100) * 10;
}

function hexagonPath(r: number): string {
  const pts = d3.range(6).map((i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
  });
  return d3.line()(pts)! + "Z";
}

function starPath(r: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    pts.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return d3.line()(pts)! + "Z";
}

function edgeKey(e: TopologyEdge): string {
  const src = typeof e.source === "string" ? e.source : (e.source as TopologyNode).id;
  const tgt = typeof e.target === "string" ? e.target : (e.target as TopologyNode).id;
  return `${src}:${tgt}`;
}

export default function TopologyGraph({
  nodes,
  edges,
  newPacketEdges,
  width,
  height,
  onNodeHover,
  onEdgeHover,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<TopologyNode, TopologyEdge> | null>(null);

  const setupGraph = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Zoom / pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const g = svg.append("g");

    // Clone for simulation
    const simNodes: TopologyNode[] = nodes.map((n) => ({
      ...n,
      x: n.x ?? width / 2 + (Math.random() - 0.5) * 200,
      y: n.y ?? height / 2 + (Math.random() - 0.5) * 200,
    }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges = edges
      .map((e) => {
        const src = typeof e.source === "string" ? e.source : (e.source as TopologyNode).id;
        const tgt = typeof e.target === "string" ? e.target : (e.target as TopologyNode).id;
        if (!nodeById.has(src) || !nodeById.has(tgt)) return null;
        return { snr: e.snr, lastPacket: e.lastPacket, source: src as string | TopologyNode, target: tgt as string | TopologyNode };
      })
      .filter((e): e is TopologyEdge => e !== null);

    // Force simulation
    const sim = d3
      .forceSimulation<TopologyNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<TopologyNode, TopologyEdge>(simEdges)
          .id((d) => d.id)
          .distance(120)
          .strength(0.6)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(30))
      .alphaDecay(0.03);

    simRef.current = sim;

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, TopologyEdge>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => snrColor(d.snr))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.7)
      .attr("cursor", "pointer")
      .on("mouseenter", function (_ev, d) {
        d3.select(this).attr("stroke-opacity", 1).attr("stroke-width", 3);
        onEdgeHover(d);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", 0.7).attr("stroke-width", 1.5);
        onEdgeHover(null);
      });

    // Packet dots layer
    const dotsG = g.append("g").attr("class", "dots");

    // Node groups — use SVGGElement for drag type safety
    const nodeG = g
      .append("g")
      .selectAll<SVGGElement, TopologyNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "grab");

    // Drag behaviour
    const drag = d3.drag<SVGGElement, TopologyNode>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeG.call(drag);
    nodeG
      .on("mouseenter", (_ev, d) => onNodeHover(d))
      .on("mouseleave", () => onNodeHover(null));

    // Draw shapes per node
    nodeG.each(function (d) {
      const el = d3.select<SVGGElement, TopologyNode>(this);
      const r = nodeRadius(d.battery);
      const color = nodeColor(d.status);

      if (d.role === "ROUTER" || d.role === "REPEATER") {
        el.append("path").attr("d", hexagonPath(r)).attr("fill", color).attr("stroke", "#0f1117").attr("stroke-width", 2);
      } else if (d.role === "ROUTER_CLIENT") {
        el.append("path").attr("d", starPath(r)).attr("fill", color).attr("stroke", "#0f1117").attr("stroke-width", 2);
      } else {
        el.append("circle").attr("r", r).attr("fill", color).attr("stroke", "#0f1117").attr("stroke-width", 2);
      }

      // Label
      el.append("text")
        .text(d.shortName)
        .attr("text-anchor", "middle")
        .attr("dy", r + 14)
        .attr("fill", "#cbd5e1")
        .attr("font-size", "11px")
        .attr("font-family", "monospace")
        .attr("pointer-events", "none");

      // Battery arc
      if (d.battery != null) {
        const arc = d3.arc<number>()
          .innerRadius(r + 3)
          .outerRadius(r + 5)
          .startAngle(0)
          .endAngle((d.battery / 100) * 2 * Math.PI);
        el.append("path")
          .datum(d.battery)
          .attr("d", arc)
          .attr("fill", d.battery > 20 ? "#22c55e" : "#ef4444")
          .attr("opacity", 0.7);
      }
    });

    // Tick
    sim.on("tick", () => {
      link
        .attr("x1", (d) => String((d.source as TopologyNode).x ?? 0))
        .attr("y1", (d) => String((d.source as TopologyNode).y ?? 0))
        .attr("x2", (d) => String((d.target as TopologyNode).x ?? 0))
        .attr("y2", (d) => String((d.target as TopologyNode).y ?? 0));

      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Animate packet dots for new edges
    if (newPacketEdges.size > 0) {
      animateDots(dotsG, simEdges, newPacketEdges);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, width, height]);

  useEffect(() => {
    setupGraph();
    return () => { simRef.current?.stop(); };
  }, [setupGraph]);

  // Animate new packet dots without re-rendering the full graph
  useEffect(() => {
    if (newPacketEdges.size === 0 || !svgRef.current) return;
    const dotsG = d3.select(svgRef.current).select<SVGGElement>(".dots");
    if (dotsG.empty()) return;

    // Get current simulation edges from link selection
    const linkSel = d3.select(svgRef.current).selectAll<SVGLineElement, TopologyEdge>("line");
    const simEdges = linkSel.data();
    animateDots(dotsG, simEdges, newPacketEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPacketEdges]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-mesh-bg rounded-lg"
    />
  );
}

function animateDots(
  dotsG: d3.Selection<SVGGElement, unknown, null, undefined>,
  simEdges: TopologyEdge[],
  newPacketEdges: Set<string>
) {
  for (const edge of simEdges) {
    const key = edgeKey(edge);
    if (!newPacketEdges.has(key)) continue;

    const src = edge.source as TopologyNode;
    const tgt = edge.target as TopologyNode;
    if (src.x == null || tgt.x == null) continue;

    const x1 = src.x;
    const y1 = src.y ?? 0;
    const x2 = tgt.x;
    const y2 = tgt.y ?? 0;

    const dot = dotsG
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#3b82f6")
      .attr("opacity", 0.9)
      .attr("cx", x1)
      .attr("cy", y1);

    dot
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("cx", x2)
      .attr("cy", y2)
      .attr("opacity", 0)
      .remove();
  }
}
