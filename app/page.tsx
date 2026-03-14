"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Radio, Map, Network, Shield, Bell, Activity, MessageSquare } from "lucide-react";
import ConnectionPanel from "@/components/dashboard/ConnectionPanel";
import NodeList from "@/components/dashboard/NodeList";
import MessageLog from "@/components/dashboard/MessageLog";
import SOSAlerts from "@/components/dashboard/SOSAlerts";
import DMSAlertBanner from "@/components/dead-man-switch/DMSAlertBanner";
import DMSEventLog from "@/components/dead-man-switch/DMSEventLog";
import MessagesPanel from "@/components/messages/MessagesPanel";
import { useDMSMonitor } from "@/components/dead-man-switch/hooks/useDMSMonitor";

const MeshMap = dynamic(() => import("@/components/map/MeshMap"), { ssr: false });
const TopologyViewer = dynamic(() => import("@/components/topology/TopologyViewer"), { ssr: false });

type Tab = "map" | "topology" | "messages" | "dms" | "alerts";

export interface NodeRecord {
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

export interface SosEvent {
  id: number;
  node_id: string;
  triggered_at: number;
  acknowledged_at: number | null;
  resolved_at: number | null;
  notes: string | null;
}

export interface DmsEvent {
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
  resolution_note: string | null;
  silence_duration_minutes: number | null;
  long_name?: string | null;
  short_name?: string | null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [dmsEvents, setDmsEvents] = useState<DmsEvent[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  useDMSMonitor();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nodesRes, sosRes, dmsRes] = await Promise.all([
          fetch("/api/nodes"),
          fetch("/api/events"),
          fetch("/api/dead-man-switch/events"),
        ]);
        if (nodesRes.ok) setNodes(await nodesRes.json());
        if (sosRes.ok) setSosEvents(await sosRes.json());
        if (dmsRes.ok) setDmsEvents(await dmsRes.json());
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // In live mode, filter out simulated nodes (IDs starting with !sim)
  const visibleNodes = demoMode ? nodes : nodes.filter(n => !n.node_id.startsWith("!sim"));

  const activeSos = sosEvents.filter((e) => !e.resolved_at);
  const activeDms = dmsEvents.filter((e) => !e.resolution);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "map", label: "Map", icon: <Map size={16} /> },
    { id: "topology", label: "Topology", icon: <Network size={16} /> },
    { id: "messages", label: "Messages", icon: <MessageSquare size={16} /> },
    {
      id: "dms",
      label: "Dead Man's Switch",
      icon: <Shield size={16} />,
      badge: activeDms.length || undefined,
    },
    {
      id: "alerts",
      label: "SOS Alerts",
      icon: <Bell size={16} />,
      badge: activeSos.length || undefined,
    },
  ];

  const refreshSos = async () => {
    const res = await fetch("/api/events");
    if (res.ok) setSosEvents(await res.json());
  };

  const refreshDms = async () => {
    const res = await fetch("/api/dead-man-switch/events");
    if (res.ok) setDmsEvents(await res.json());
  };

  // Messages tab gets the full screen — no sidebar
  const fullscreen = activeTab === "messages";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-mesh-card border-b border-mesh-border shrink-0">
        <div className="flex items-center gap-3">
          <Radio size={20} className="text-mesh-accent" />
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            MESH RESPONSE COORDINATOR
          </h1>
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-mesh-online" />
            <span className="text-xs text-mesh-muted">
              {visibleNodes.length} node{visibleNodes.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => setDemoMode(m => !m)}
            className={`ml-2 px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide transition-colors ${
              demoMode
                ? "bg-mesh-warn/20 text-mesh-warn border border-mesh-warn/40"
                : "bg-mesh-online/10 text-mesh-online border border-mesh-online/30"
            }`}
            title={demoMode ? "Showing simulated + real nodes" : "Showing real nodes only"}
          >
            {demoMode ? "DEMO" : "LIVE"}
          </button>
        </div>
        <ConnectionPanel />
      </header>

      {/* DMS Alert Banners */}
      {activeDms.map((event) => (
        <DMSAlertBanner
          key={event.id}
          event={event}
          nodes={visibleNodes}
          onUpdate={refreshDms}
        />
      ))}

      {/* SOS Banner */}
      {activeSos.length > 0 && (
        <div className="bg-mesh-danger/20 border-b border-mesh-danger/40 px-4 py-2 shrink-0">
          <p className="text-xs text-mesh-danger font-semibold">
            {activeSos.length} ACTIVE SOS ALERT{activeSos.length > 1 ? "S" : ""}
          </p>
        </div>
      )}

      {/* Tab bar */}
      <nav className="flex items-center gap-1 px-4 py-2 bg-mesh-card border-b border-mesh-border shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? "bg-mesh-accent text-white"
                : "text-slate-400 hover:text-slate-100 hover:bg-mesh-border"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge ? (
              <span className="absolute -top-1 -right-1 bg-mesh-danger text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on messages tab (it has its own sidebar) */}
        {!fullscreen && (
          <aside className="w-72 border-r border-mesh-border flex flex-col overflow-hidden shrink-0">
            <NodeList nodes={visibleNodes} />
            <div className="flex-1 overflow-hidden border-t border-mesh-border">
              <MessageLog />
            </div>
          </aside>
        )}

        {/* Content area */}
        <main className="flex-1 overflow-hidden">
          {activeTab === "map" && (
            <MeshMap nodes={visibleNodes} sosEvents={activeSos} dmsEvents={activeDms} />
          )}
          {activeTab === "topology" && <TopologyViewer />}
          {activeTab === "messages" && <MessagesPanel nodes={visibleNodes} />}
          {activeTab === "dms" && (
            <div className="h-full overflow-auto p-4">
              <DMSEventLog events={dmsEvents} nodes={visibleNodes} />
            </div>
          )}
          {activeTab === "alerts" && (
            <SOSAlerts events={sosEvents} nodes={visibleNodes} onUpdate={refreshSos} />
          )}
        </main>
      </div>
    </div>
  );
}
