"use client";

// Sends a message via the best available transport:
//   1. USB Serial radio  (if connected)
//   2. Bluetooth radio   (if connected)
//   3. MQTT              (via /api/mqtt/send — server-side broker)
//   4. Bridge            (via /api/bridge/send → bridge.py → LoRa, Pi deployment)
//   5. Local DB only     (no outbound path — message appears in feed but not sent)
//
// Always saves to the local DB so the message appears in the feed immediately.

export type Transport = "radio" | "mqtt" | "local";

export async function sendMessage(
  text: string,
  toNodeId: string,   // "^all" for broadcast, or a hex node id like "!a1b2c3d4"
  channel = 0
): Promise<{ transport: Transport }> {
  const fromNodeId = "!local";
  const now = Math.floor(Date.now() / 1000);

  // --- 1. Try serial radio ---
  try {
    const { MeshSerialConnection } = await import("./serial");
    const serial = MeshSerialConnection.getInstance();
    if (serial.isConnected()) {
      const destNum = toNodeId === "^all" ? undefined : parseInt(toNodeId.replace("!", ""), 16);
      await serial.sendText(text, destNum, channel);
      // Save with transport='radio'
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_node: fromNodeId, to_node: toNodeId, channel, text, timestamp: now, transport: "radio" }),
      });
      return { transport: "radio" };
    }
  } catch {
    // serial not available
  }

  // --- 2. Try Bluetooth radio ---
  try {
    const { MeshBluetoothConnection } = await import("./bluetooth");
    const ble = MeshBluetoothConnection.getInstance();
    if (ble.isConnected()) {
      const destNum = toNodeId === "^all" ? undefined : parseInt(toNodeId.replace("!", ""), 16);
      await ble.sendText(text, destNum, channel);
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_node: fromNodeId, to_node: toNodeId, channel, text, timestamp: now, transport: "radio" }),
      });
      return { transport: "radio" };
    }
  } catch {
    // ble not available
  }

  // --- 3. Try MQTT ---
  try {
    const res = await fetch("/api/mqtt/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, to: toNodeId, channel }),
    });
    if (res.ok) {
      const data = await res.json() as { success: boolean };
      if (data.success) {
        // /api/mqtt/send already saved to DB with transport='mqtt'
        return { transport: "mqtt" };
      }
    }
  } catch {
    // MQTT not available
  }

  // --- 4. Try bridge (Pi deployment) ---
  try {
    const res = await fetch("/api/bridge/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, to: toNodeId, channel }),
    });
    if (res.ok) {
      const data = await res.json() as { success: boolean };
      if (data.success) return { transport: "radio" };
    }
  } catch {
    // bridge not available
  }

  // --- 5. Local only ---
  await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_node: fromNodeId, to_node: toNodeId, channel, text, timestamp: now, transport: "local" }),
  });
  return { transport: "local" };
}