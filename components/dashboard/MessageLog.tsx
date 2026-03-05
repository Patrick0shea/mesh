"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, ChevronDown } from "lucide-react";

interface Message {
  id: number;
  from_node: string;
  to_node: string | null;
  channel: number;
  text: string | null;
  timestamp: number;
  packet_id: string | null;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function MessageLog() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/messages?limit=200");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.reverse());
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-mesh-border/50 shrink-0"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare size={12} />
          Messages ({messages.length})
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </div>

      {!collapsed && (
        <div
          className="flex-1 overflow-y-auto px-2 py-1 space-y-1"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            setAutoScroll(atBottom);
          }}
        >
          {messages.length === 0 ? (
            <p className="text-xs text-mesh-muted text-center py-4">No messages yet</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded px-2 py-1.5 bg-mesh-card border border-mesh-border/50"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-medium text-mesh-accent font-mono">
                    {msg.from_node.slice(-6).toUpperCase()}
                  </span>
                  <span className="text-[10px] text-mesh-muted">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                {msg.text && (
                  <p className="text-xs text-slate-300 break-words">{msg.text}</p>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
