"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Hash, Radio, ChevronDown } from "lucide-react";
import { sendMessage } from "@/lib/meshtastic/send";

interface Message {
  id: number;
  from_node: string;
  to_node: string | null;
  channel: number;
  text: string | null;
  timestamp: number;
}

interface Node {
  node_id: string;
  long_name: string | null;
  short_name: string | null;
  last_heard: number | null;
}

// Conversations are keyed by the "other party":
// - broadcast channel N  → key "ch:N"
// - direct to/from node  → key "node:!hexid"
type ConvoKey = string;

function convoKeyForMessage(msg: Message, localId = "!local"): ConvoKey {
  if (msg.to_node === "^all" || msg.to_node === null) return `ch:${msg.channel}`;
  if (msg.from_node === localId) return `node:${msg.to_node}`;
  return `node:${msg.from_node}`;
}

function convoLabel(key: ConvoKey, nodes: Node[]): string {
  if (key.startsWith("ch:")) {
    const ch = key.split(":")[1];
    return `Channel ${ch}`;
  }
  const nodeId = key.split(":")[1];
  const node = nodes.find((n) => n.node_id === nodeId);
  return node?.long_name ?? node?.short_name ?? nodeId;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function statusDot(lastHeard: number | null): string {
  if (!lastHeard) return "bg-mesh-muted";
  const diff = Math.floor(Date.now() / 1000) - lastHeard;
  if (diff < 300) return "bg-mesh-online";
  if (diff < 900) return "bg-mesh-warn";
  return "bg-mesh-danger";
}

const LOCAL_ID = "!local";

export default function MessagesPanel({ nodes }: { nodes: Node[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeKey, setActiveKey] = useState<ConvoKey>("ch:0");
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState(0);
  const [sending, setSending] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch("/api/messages?limit=500");
    if (res.ok) setMessages((await res.json()).reverse());
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeKey]);

  // Build conversation list from all messages
  const convoMap = new Map<ConvoKey, { lastMsg: Message; unread: number }>();

  // Always include channel 0
  if (!convoMap.has("ch:0")) {
    convoMap.set("ch:0", { lastMsg: { id: -1, from_node: "", to_node: "^all", channel: 0, text: null, timestamp: 0 }, unread: 0 });
  }

  messages.forEach((msg) => {
    const key = convoKeyForMessage(msg, LOCAL_ID);
    const existing = convoMap.get(key);
    if (!existing || msg.timestamp > existing.lastMsg.timestamp) {
      convoMap.set(key, { lastMsg: msg, unread: 0 });
    }
  });

  const convos = Array.from(convoMap.entries()).sort(
    (a, b) => (b[1].lastMsg.timestamp || 0) - (a[1].lastMsg.timestamp || 0)
  );

  // Messages for active conversation
  const threadMessages = messages.filter(
    (msg) => convoKeyForMessage(msg, LOCAL_ID) === activeKey
  );

  // Determine send destination from active key
  const sendTo = activeKey.startsWith("ch:") ? "^all" : activeKey.split(":")[1];
  const sendChannel = activeKey.startsWith("ch:") ? parseInt(activeKey.split(":")[1]) : channel;

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    try {
      await sendMessage(text, sendTo, sendChannel);
      await fetchMessages();
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function startDirectMessage(nodeId: string) {
    const key: ConvoKey = `node:${nodeId}`;
    if (!convoMap.has(key)) {
      // Create a placeholder entry
      convoMap.set(key, {
        lastMsg: { id: -1, from_node: "", to_node: nodeId, channel: 0, text: null, timestamp: 0 },
        unread: 0,
      });
    }
    setActiveKey(key);
    setShowNodePicker(false);
  }

  // Group thread messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of threadMessages) {
    const d = formatDate(msg.timestamp);
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: d, msgs: [msg] });
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — conversation list */}
      <aside className="w-64 border-r border-mesh-border flex flex-col shrink-0 bg-mesh-card">
        <div className="flex items-center justify-between px-3 py-3 border-b border-mesh-border">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Conversations
          </span>
          <div className="relative">
            <button
              onClick={() => setShowNodePicker(!showNodePicker)}
              className="flex items-center gap-1 text-xs text-mesh-accent hover:text-blue-300 px-2 py-1 rounded hover:bg-mesh-border transition-colors"
              title="Start direct message"
            >
              + Direct
              <ChevronDown size={11} />
            </button>
            {showNodePicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-mesh-card border border-mesh-border rounded-lg shadow-xl z-20 overflow-hidden">
                <p className="px-3 py-2 text-[10px] text-mesh-muted uppercase tracking-wider border-b border-mesh-border">
                  Select node
                </p>
                <div className="max-h-48 overflow-y-auto">
                  {nodes.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-mesh-muted">No nodes seen yet</p>
                  ) : (
                    nodes.map((n) => (
                      <button
                        key={n.node_id}
                        onClick={() => startDirectMessage(n.node_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-mesh-border transition-colors text-left"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(n.last_heard)}`} />
                        <span className="text-xs text-slate-300 truncate">
                          {n.long_name ?? n.short_name ?? n.node_id}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convos.map(([key, { lastMsg }]) => {
            const isChannel = key.startsWith("ch:");
            const nodeId = !isChannel ? key.split(":")[1] : null;
            const node = nodeId ? nodes.find((n) => n.node_id === nodeId) : null;
            const isActive = key === activeKey;

            return (
              <button
                key={key}
                onClick={() => setActiveKey(key)}
                className={`w-full text-left px-3 py-2.5 border-b border-mesh-border/50 transition-colors ${
                  isActive ? "bg-mesh-accent/15 border-l-2 border-l-mesh-accent" : "hover:bg-mesh-border/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {isChannel ? (
                    <Hash size={12} className="text-mesh-muted shrink-0" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(node?.last_heard ?? null)}`} />
                  )}
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {convoLabel(key, nodes)}
                  </span>
                </div>
                {lastMsg.text && (
                  <p className="text-[11px] text-mesh-muted truncate pl-4">{lastMsg.text}</p>
                )}
                {lastMsg.timestamp > 0 && (
                  <p className="text-[10px] text-mesh-muted/70 pl-4 mt-0.5">
                    {formatTime(lastMsg.timestamp)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-mesh-border bg-mesh-card shrink-0">
          {activeKey.startsWith("ch:") ? (
            <>
              <Hash size={16} className="text-mesh-muted" />
              <span className="font-medium text-slate-200">
                {convoLabel(activeKey, nodes)}
              </span>
              <span className="text-xs text-mesh-muted">— broadcast to all nodes</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-mesh-muted">Channel</span>
                <select
                  value={sendChannel}
                  onChange={(e) => {
                    const ch = parseInt(e.target.value);
                    setChannel(ch);
                    setActiveKey(`ch:${ch}`);
                  }}
                  className="text-xs bg-mesh-border border border-mesh-border rounded px-2 py-1 text-slate-300 focus:outline-none"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <Radio size={16} className="text-mesh-accent" />
              <span className="font-medium text-slate-200">
                {convoLabel(activeKey, nodes)}
              </span>
              <span className="text-xs text-mesh-muted font-mono">
                {activeKey.split(":")[1]}
              </span>
              {(() => {
                const nodeId = activeKey.split(":")[1];
                const node = nodes.find((n) => n.node_id === nodeId);
                return node ? (
                  <div className={`ml-1 w-2 h-2 rounded-full ${statusDot(node.last_heard)}`} />
                ) : null;
              })()}
            </>
          )}
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-mesh-muted">
              <Radio size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1 opacity-70">Send the first message below</p>
            </div>
          ) : (
            grouped.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-mesh-border" />
                  <span className="text-[10px] text-mesh-muted">{date}</span>
                  <div className="flex-1 h-px bg-mesh-border" />
                </div>
                {msgs.map((msg, i) => {
                  const isLocal = msg.from_node === LOCAL_ID;
                  const senderNode = nodes.find((n) => n.node_id === msg.from_node);
                  const senderName = isLocal
                    ? "You"
                    : senderNode?.long_name ?? senderNode?.short_name ?? msg.from_node.slice(-6).toUpperCase();
                  const showSender =
                    i === 0 || msgs[i - 1].from_node !== msg.from_node;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isLocal ? "justify-end" : "justify-start"} mb-0.5`}
                    >
                      <div className={`max-w-[70%] ${isLocal ? "items-end" : "items-start"} flex flex-col`}>
                        {showSender && (
                          <span className={`text-[10px] mb-1 px-1 ${isLocal ? "text-right text-mesh-muted" : "text-mesh-accent"}`}>
                            {senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            isLocal
                              ? "bg-mesh-accent text-white rounded-br-sm"
                              : "bg-mesh-card border border-mesh-border text-slate-200 rounded-bl-sm"
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-mesh-muted mt-0.5 px-1">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose box */}
        <div className="border-t border-mesh-border p-3 shrink-0 bg-mesh-card">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeKey.startsWith("ch:")
                  ? `Broadcast to channel ${sendChannel}…`
                  : `Message ${convoLabel(activeKey, nodes)}…`
              }
              rows={1}
              className="flex-1 bg-mesh-bg border border-mesh-border rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-mesh-muted focus:outline-none focus:border-mesh-accent resize-none leading-5"
              style={{ minHeight: "38px", maxHeight: "120px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-mesh-accent hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-mesh-muted mt-1.5 px-1">
            Enter to send · Shift+Enter for new line
            {activeKey.startsWith("ch:") ? "" : " · Radio transmits if device connected"}
          </p>
        </div>
      </div>
    </div>
  );
}
