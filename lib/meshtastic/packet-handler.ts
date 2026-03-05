"use client";

// PortNum values from Meshtastic protobuf
const PortNum = {
  TEXT_MESSAGE_APP: 1,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  TELEMETRY_APP: 67,
  NEIGHBORINFO_APP: 69,
};

interface MeshPacket {
  id?: number;
  from?: number;
  to?: number;
  channel?: number;
  hopLimit?: number;
  hopStart?: number;
  rxSnr?: number;
  rxRssi?: number;
  decoded?: {
    portnum?: number;
    payload?: Uint8Array;
    text?: string;
  };
  viaNodes?: number[];
}

function nodeIdHex(num?: number): string {
  if (!num) return "unknown";
  return `!${num.toString(16).padStart(8, "0")}`;
}

const baseUrl =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

async function post(path: string, body: unknown) {
  await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function handlePacket(packet: MeshPacket): Promise<void> {
  const fromId = nodeIdHex(packet.from);
  const toId = nodeIdHex(packet.to);
  const now = Math.floor(Date.now() / 1000);

  // Log every packet
  await post("/api/packets", {
    packet_id: packet.id?.toString(),
    from_node: fromId,
    to_node: toId,
    via_nodes: packet.viaNodes?.map(nodeIdHex) ?? [],
    port_num: packet.decoded?.portnum,
    timestamp: now,
    hop_limit: packet.hopLimit,
    hop_start: packet.hopStart,
    rssi: packet.rxRssi,
    snr: packet.rxSnr,
  });

  if (!packet.decoded) return;

  const { portnum, payload } = packet.decoded;

  switch (portnum) {
    case PortNum.TEXT_MESSAGE_APP: {
      const text = packet.decoded.text ?? "";
      await post("/api/messages", {
        from_node: fromId,
        to_node: toId,
        channel: packet.channel ?? 0,
        text,
        timestamp: now,
        packet_id: packet.id?.toString(),
      });

      if (text.toUpperCase().includes("SOS") || text.includes("!SOS")) {
        await post("/api/events", {
          node_id: fromId,
          triggered_at: now,
          notes: `SOS message: ${text}`,
        });
      }
      break;
    }

    case PortNum.POSITION_APP: {
      if (!payload) break;
      try {
        const { fromBinary } = await import("@bufbuild/protobuf");
        const { Protobuf } = await import("@meshtastic/js");
        const pos = fromBinary(Protobuf.Mesh.PositionSchema, payload);
        await post("/api/nodes", {
          node_id: fromId,
          latitude: pos.latitudeI ? pos.latitudeI * 1e-7 : undefined,
          longitude: pos.longitudeI ? pos.longitudeI * 1e-7 : undefined,
          altitude: pos.altitude,
          last_heard: now,
          snr: packet.rxSnr,
          rssi: packet.rxRssi,
        });
      } catch (e) {
        console.warn("[packet-handler] Position decode error:", e);
      }
      break;
    }

    case PortNum.NODEINFO_APP: {
      if (!payload) break;
      try {
        const { fromBinary } = await import("@bufbuild/protobuf");
        const { Protobuf } = await import("@meshtastic/js");
        const user = fromBinary(Protobuf.Mesh.UserSchema, payload);
        await post("/api/nodes", {
          node_id: fromId,
          long_name: user.longName,
          short_name: user.shortName,
          hardware: user.hwModel?.toString(),
          role: user.role?.toString(),
          last_heard: now,
          snr: packet.rxSnr,
          rssi: packet.rxRssi,
        });
      } catch (e) {
        console.warn("[packet-handler] NodeInfo decode error:", e);
      }
      break;
    }

    case PortNum.TELEMETRY_APP: {
      if (!payload) break;
      try {
        const { fromBinary } = await import("@bufbuild/protobuf");
        const { Protobuf } = await import("@meshtastic/js");
        const telemetry = fromBinary(Protobuf.Telemetry.TelemetrySchema, payload);
        const dm = telemetry.variant?.value as { batteryLevel?: number; voltage?: number } | undefined;
        if (dm) {
          await post("/api/nodes", {
            node_id: fromId,
            battery_level: dm.batteryLevel,
            voltage: dm.voltage,
            last_heard: now,
          });
        }
      } catch (e) {
        console.warn("[packet-handler] Telemetry decode error:", e);
      }
      break;
    }

    case PortNum.NEIGHBORINFO_APP: {
      if (!payload) break;
      try {
        const { fromBinary } = await import("@bufbuild/protobuf");
        const { Protobuf } = await import("@meshtastic/js");
        const ni = fromBinary(Protobuf.Mesh.NeighborInfoSchema, payload);
        for (const nb of ni.neighbors ?? []) {
          const nbId = nodeIdHex(nb.nodeId);
          await fetch(`${baseUrl}/api/neighbour-info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: fromId, neighbourId: nbId, snr: nb.snr }),
          });
        }
      } catch (e) {
        console.warn("[packet-handler] NeighborInfo decode error:", e);
      }
      break;
    }
  }
}
