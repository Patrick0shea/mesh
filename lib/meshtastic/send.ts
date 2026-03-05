"use client";

// Try to send via active radio connection.
// Always also POSTs to /api/messages so it appears in the local feed
// regardless of whether hardware is connected.

export async function sendMessage(
  text: string,
  toNodeId: string,   // "^all" for broadcast, or a hex node id like "!a1b2c3d4"
  channel = 0
): Promise<void> {
  const fromNodeId = "!local";
  const now = Math.floor(Date.now() / 1000);

  // Save to local DB immediately so it shows up in the feed
  await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from_node: fromNodeId,
      to_node: toNodeId,
      channel,
      text,
      timestamp: now,
    }),
  });

  // Attempt to transmit over radio if connected
  try {
    const { MeshSerialConnection } = await import("./serial");
    const serial = MeshSerialConnection.getInstance();
    if (serial.isConnected()) {
      const destNum = toNodeId === "^all" ? undefined : parseInt(toNodeId.replace("!", ""), 16);
      await serial.sendText(text, destNum, channel);
      return;
    }
  } catch {
    // serial not available
  }

  try {
    const { MeshBluetoothConnection } = await import("./bluetooth");
    const ble = MeshBluetoothConnection.getInstance();
    if (ble.isConnected()) {
      const destNum = toNodeId === "^all" ? undefined : parseInt(toNodeId.replace("!", ""), 16);
      await ble.sendText(text, destNum, channel);
    }
  } catch {
    // ble not available
  }
}
