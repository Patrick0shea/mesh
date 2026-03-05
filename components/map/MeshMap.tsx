"use client";

import { useEffect, useRef } from "react";

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
}

interface SosEvent {
  id: number;
  node_id: string;
  triggered_at: number;
  resolved_at: number | null;
}

interface DmsEvent {
  id: number;
  node_id: string;
  resolution: string | null;
}

function statusColor(lastHeard: number | null): string {
  if (!lastHeard) return "#6b7280";
  const diff = Math.floor(Date.now() / 1000) - lastHeard;
  if (diff < 300) return "#22c55e";
  if (diff < 900) return "#f59e0b";
  return "#ef4444";
}

function makeMarkerSvg(color: string, role: string, pulse?: "amber" | "red"): string {
  const size = 28;
  const pulseRing = pulse
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${pulse === "red" ? "#ef4444" : "#f59e0b"}" stroke-width="2" opacity="0.6">
        <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
      </circle>`
    : "";

  const shape =
    role === "ROUTER" || role === "REPEATER"
      ? `<polygon points="14,4 24,10 24,22 14,28 4,22 4,10" fill="${color}" stroke="#0f1117" stroke-width="2"/>`
      : `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#0f1117" stroke-width="2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
    ${pulseRing}${shape}
  </svg>`;
}

export default function MeshMap({
  nodes,
  sosEvents,
  dmsEvents,
}: {
  nodes: Node[];
  sosEvents: SosEvent[];
  dmsEvents: DmsEvent[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());

  const sosNodeIds = new Set(sosEvents.map((e) => e.node_id));
  const dmsNodeIds = new Set(dmsEvents.filter((e) => !e.resolution).map((e) => e.node_id));

  // Init map once
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    let mounted = true;

    import("leaflet").then((mod) => {
      if (!mounted || !mapRef.current || leafletMap.current) return;

      const L = mod.default;

      // Fix broken default icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [52.6638, -8.6267],
        zoom: 13,
        zoomControl: true,
      });

      // OSM tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;
    });

    return () => {
      mounted = false;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  // Update markers when nodes change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    import("leaflet").then((mod) => {
      const L = mod.default;
      const currentIds = new Set(nodes.map((n) => n.node_id));

      // Remove stale markers
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      });

      // Add/update node markers
      nodes
        .filter((n) => n.latitude != null && n.longitude != null)
        .forEach((node) => {
          const hasSos = sosNodeIds.has(node.node_id);
          const hasDms = dmsNodeIds.has(node.node_id);
          const color = hasSos ? "#ef4444" : statusColor(node.last_heard);
          const pulse = hasSos ? "red" : hasDms ? "amber" : undefined;

          const icon = L.divIcon({
            html: makeMarkerSvg(color, node.role ?? "CLIENT", pulse),
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const name = node.long_name ?? node.short_name ?? node.node_id;
          const popupHtml = `
            <div style="font-family:monospace;font-size:12px;min-width:150px">
              <b>${name}</b><br/>
              <span style="color:#6b7280">${node.node_id}</span><br/>
              Role: ${node.role ?? "CLIENT"}<br/>
              ${node.battery_level != null ? `Battery: ${node.battery_level}%<br/>` : ""}
              ${node.snr != null ? `SNR: ${node.snr.toFixed(1)} dB<br/>` : ""}
              ${hasSos ? "<b style='color:#ef4444'>SOS ACTIVE</b><br/>" : ""}
              ${hasDms ? "<b style='color:#f59e0b'>DMS TRIGGERED</b><br/>" : ""}
            </div>
          `;

          if (markersRef.current.has(node.node_id)) {
            const m = markersRef.current.get(node.node_id)!;
            m.setLatLng([node.latitude!, node.longitude!]).setIcon(icon).setPopupContent(popupHtml);
          } else {
            const marker = L.marker([node.latitude!, node.longitude!], { icon })
              .addTo(map)
              .bindPopup(popupHtml);
            markersRef.current.set(node.node_id, marker);
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, sosEvents, dmsEvents]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      {nodes.filter((n) => n.latitude != null).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1a1d27]/80 border border-[#2a2d3a] rounded-lg px-4 py-3 text-center">
            <p className="text-sm text-slate-400">No nodes with GPS coordinates</p>
            <p className="text-xs text-[#6b7280] mt-1">Run simulation or connect device</p>
          </div>
        </div>
      )}
    </div>
  );
}
