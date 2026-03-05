"use client";

import { useEffect, useRef, useState } from "react";

export interface TopologyNode {
  id: string;
  longName: string;
  shortName: string;
  role: string;
  battery: number | null;
  status: "online" | "marginal" | "offline";
  lat: number | null;
  lon: number | null;
  lastHeard: number | null;
  // D3 simulation fields
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface TopologyEdge {
  source: string | TopologyNode;
  target: string | TopologyNode;
  snr: number | null;
  lastPacket: number | null;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  lastUpdated: number;
}

export function useTopologyData(pollInterval = 5000) {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevEdgesRef = useRef<Set<string>>(new Set());
  const [newPacketEdges, setNewPacketEdges] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/neighbour-info");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        if (!mounted) return;

        // Detect new/updated edges for animation
        const newEdgeKeys = new Set<string>();
        const updatedNow = new Set<string>();

        for (const edge of raw.edges as TopologyEdge[]) {
          const src = typeof edge.source === "string" ? edge.source : edge.source.id;
          const tgt = typeof edge.target === "string" ? edge.target : edge.target.id;
          const key = `${src}:${tgt}`;
          newEdgeKeys.add(key);
          if (!prevEdgesRef.current.has(key)) {
            updatedNow.add(key);
          }
        }

        if (updatedNow.size > 0) {
          setNewPacketEdges(updatedNow);
          setTimeout(() => setNewPacketEdges(new Set()), 3000);
        }

        prevEdgesRef.current = newEdgeKeys;
        setData(raw);
        setError(null);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Fetch failed");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { data, loading, error, newPacketEdges };
}
