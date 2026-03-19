"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: number;
  from_node: string;
  text: string | null;
  timestamp: number;
  transport: string | null;
}

export default function TestPage() {
  const [mqttStatus, setMqttStatus] = useState("...");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Poll MQTT status every 3s
  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch("/api/mqtt/status");
        const d = await r.json() as { status: string };
        setMqttStatus(d.status);
      } catch { setMqttStatus("error"); }
    }
    poll();
    const i = setInterval(poll, 3000);
    return () => clearInterval(i);
  }, []);

  // Poll messages every 2s
  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch("/api/messages?limit=20");
        const data = await r.json() as Message[];
        setMessages(data.reverse());
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch {}
    }
    poll();
    const i = setInterval(poll, 2000);
    return () => clearInterval(i);
  }, []);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setLastResult(null);
    setDraft("");
    try {
      const r = await fetch("/api/mqtt/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, to: "^all", channel: 0 }),
      });
      const d = await r.json() as { success: boolean; transport: string };
      setLastResult(d.success ? `Sent via ${d.transport}` : "MQTT not connected — message saved locally only");
    } catch (e) {
      setLastResult("Send failed");
    } finally {
      setSending(false);
    }
  }

  const statusColor = mqttStatus === "connected" ? "#22c55e" : mqttStatus === "connecting" ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 600, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 18, marginBottom: 24 }}>MQTT Test</h1>

      {/* Status */}
      <div style={{ marginBottom: 24, padding: "12px 16px", background: "#1a1d27", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
        <span>MQTT: <strong>{mqttStatus}</strong></span>
      </div>

      {/* Send */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Type a message and press Enter..."
            style={{ flex: 1, padding: "10px 14px", background: "#0f1117", border: "1px solid #2a2d3a", borderRadius: 8, color: "#fff", fontSize: 14 }}
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: sending ? 0.5 : 1 }}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
        {lastResult && (
          <p style={{ marginTop: 8, fontSize: 12, color: lastResult.startsWith("Sent") ? "#22c55e" : "#ef4444" }}>
            {lastResult}
          </p>
        )}
      </div>

      {/* Messages */}
      <div style={{ background: "#1a1d27", borderRadius: 8, padding: 16, minHeight: 200, maxHeight: 400, overflowY: "auto" }}>
        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          Last 20 messages (all channels)
        </p>
        {messages.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: 13 }}>No messages yet</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: "#6b7280" }}>
              {new Date(msg.timestamp * 1000).toLocaleTimeString()}
            </span>
            {" "}
            <span style={{ color: "#3b82f6" }}>{msg.from_node}</span>
            {msg.transport && (
              <span style={{ color: "#6b7280", fontSize: 11 }}> [{msg.transport}]</span>
            )}
            {": "}
            <span style={{ color: "#e2e8f0" }}>{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "#6b7280" }}>
        Send a message above → check your Meshtastic app for it to appear there.
        Messages from the mesh appear here automatically.
      </p>
    </div>
  );
}