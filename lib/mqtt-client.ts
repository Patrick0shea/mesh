// Server-only MQTT singleton.
// Never import this in "use client" files — use /api/mqtt/* routes instead.

import mqtt, { type MqttClient } from "mqtt";
import { getDb } from "./db";

type MqttStatus = "connecting" | "connected" | "disconnected";

const BROKER_URL  = process.env.MQTT_BROKER_URL  ?? "mqtt://mqtt.meshtastic.org:1883";
const USERNAME    = process.env.MQTT_USERNAME    ?? "meshdev";
const PASSWORD    = process.env.MQTT_PASSWORD    ?? "large4cats";
const ROOT_TOPIC  = process.env.MQTT_ROOT_TOPIC  ?? "msh/EU_868";
const MY_NODE_ID  = parseInt(process.env.MY_NODE_ID ?? "0", 10);

const SUBSCRIBE_TOPIC = `${ROOT_TOPIC}/2/json/#`;
// Downlink topic — addressed to our specific gateway node so the device picks it up
const MY_NODE_HEX   = MY_NODE_ID !== 0 ? `!${MY_NODE_ID.toString(16).padStart(8, "0")}` : "";
const PUBLISH_TOPIC = `${ROOT_TOPIC}/2/json/mqtt/${MY_NODE_HEX}`;

// Use globalThis so the singleton survives HMR module re-evaluation in dev mode
const g = globalThis as typeof globalThis & {
  __mqttClient?: MqttClient;
  __mqttStatus?: MqttStatus;
};
if (!g.__mqttStatus) g.__mqttStatus = "disconnected";

function getClient(): MqttClient | undefined { return g.__mqttClient; }
function setClient(c: MqttClient) { g.__mqttClient = c; }
function getStatus(): MqttStatus { return g.__mqttStatus!; }
function setStatus(s: MqttStatus) { g.__mqttStatus = s; }

function nodeIdHex(decimalId: number): string {
  return `!${decimalId.toString(16).padStart(8, "0")}`;
}

function handleIncomingMessage(topic: string, raw: Buffer) {
  try {
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw.toString());
      if (!parsed || typeof parsed !== "object") return; // null, number, etc.
      payload = parsed as Record<string, unknown>;
    } catch {
      return; // binary/protobuf packet — not JSON, skip silently
    }

    // Only handle text messages
    if (payload.type !== "text" && !topic.includes("TEXT_MESSAGE_APP")) return;

    const fromDecimal = typeof payload.from === "number" ? payload.from : 0;
    const fromId      = nodeIdHex(fromDecimal);
    const toDecimal   = typeof payload.to === "number" ? payload.to : 0;
    const toId        = toDecimal === 4294967295 ? "^all" : nodeIdHex(toDecimal);
    const channel     = typeof payload.channel === "number" ? payload.channel : 0;
    const ts          = typeof payload.timestamp === "number"
      ? payload.timestamp
      : Math.floor(Date.now() / 1000);

    // Extract text from nested payload or top-level
    let text = "";
    if (typeof payload.payload === "object" && payload.payload !== null) {
      const p = payload.payload as Record<string, unknown>;
      if (typeof p.text === "string") text = p.text;
    } else if (typeof payload.payload === "string") {
      text = payload.payload;
    }

    if (!text) return;

    // Skip echo of our own messages
    if (fromDecimal === MY_NODE_ID && MY_NODE_ID !== 0) return;

    const db = getDb();

    db.prepare(
      "INSERT INTO messages (from_node, to_node, channel, text, timestamp, transport) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(fromId, toId, channel, text, ts, "mqtt");

    // Upsert node as "seen"
    db.prepare(`
      INSERT INTO nodes (node_id, last_heard)
      VALUES (?, ?)
      ON CONFLICT(node_id) DO UPDATE SET last_heard = excluded.last_heard
    `).run(fromId, ts);

    // Auto-trigger SOS
    if (text.toUpperCase().includes("SOS")) {
      db.prepare(
        "INSERT INTO sos_events (node_id, triggered_at, notes) VALUES (?, ?, ?)"
      ).run(fromId, ts, `SOS message via MQTT: ${text}`);
    }

    console.log(`[MQTT] Message from ${fromId}: ${text}`);
  } catch (err) {
    console.warn("[MQTT] Failed to process message:", err);
  }
}

export function getMqttClient(): MqttClient {
  if (getClient()) return getClient()!;

  console.log(`[MQTT] Connecting to ${BROKER_URL} …`);
  setStatus("connecting");

  const c = mqtt.connect(BROKER_URL, {
    username:          USERNAME,
    password:          PASSWORD,
    reconnectPeriod:   5000,
    connectTimeout:    30000,
    keepalive:         60,
    clientId:          `mesh-dashboard-${Math.random().toString(16).slice(2, 8)}`,
  });
  setClient(c);

  c.on("connect", () => {
    setStatus("connected");
    console.log(`[MQTT] Connected — subscribing to ${SUBSCRIBE_TOPIC}`);
    c.subscribe(SUBSCRIBE_TOPIC, { qos: 0 }, (err) => {
      if (err) console.error("[MQTT] Subscribe error:", err);
    });
  });

  c.on("reconnect", () => {
    setStatus("connecting");
    console.log("[MQTT] Reconnecting…");
  });

  c.on("offline", () => {
    setStatus("disconnected");
    console.log("[MQTT] Offline");
  });

  c.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
  });

  c.on("message", handleIncomingMessage);

  return c;
}

export function getMqttStatus(): MqttStatus {
  return getStatus();
}

export function publishMessage(
  text: string,
  toDecimal?: number,
  channel = 0
): boolean {
  const c = getClient();
  if (!c || getStatus() !== "connected") return false;

  const envelope: Record<string, unknown> = {
    from:    MY_NODE_ID || 1, // use 1 as fallback if node ID not configured
    type:    "sendtext",
    payload: text,
    channel,
    hopLimit: 3,
  };
  if (toDecimal !== undefined) envelope.to = toDecimal;

  c.publish(PUBLISH_TOPIC, JSON.stringify(envelope), { qos: 0 });
  return true;
}