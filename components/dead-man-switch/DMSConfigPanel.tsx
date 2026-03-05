"use client";

import { useEffect, useState } from "react";
import { Shield, Save, ChevronDown } from "lucide-react";

interface DmsConfig {
  node_id: string;
  enabled: number;
  silence_timeout_minutes: number;
  movement_timeout_minutes: number | null;
  escalation_minutes: number;
  contact_note: string | null;
}

export default function DMSConfigPanel({ nodeId }: { nodeId: string }) {
  const [config, setConfig] = useState<DmsConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [silenceTimeout, setSilenceTimeout] = useState(45);
  const [movementTimeout, setMovementTimeout] = useState<number | "">("");
  const [escalationMinutes, setEscalationMinutes] = useState(15);
  const [contactNote, setContactNote] = useState("");

  useEffect(() => {
    fetch(`/api/dead-man-switch/config?nodeId=${nodeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setConfig(data);
          setEnabled(!!data.enabled);
          setSilenceTimeout(data.silence_timeout_minutes ?? 45);
          setMovementTimeout(data.movement_timeout_minutes ?? "");
          setEscalationMinutes(data.escalation_minutes ?? 15);
          setContactNote(data.contact_note ?? "");
        }
      })
      .catch(console.error);
  }, [nodeId]);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/dead-man-switch/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          enabled,
          silenceTimeout,
          movementTimeout: movementTimeout === "" ? null : movementTimeout,
          escalationMinutes,
          contactNote: contactNote || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-mesh-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-mesh-card hover:bg-mesh-border/50 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <Shield size={13} className="text-mesh-warn" />
          Safety Settings (Dead Man&apos;s Switch)
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-mesh-bg">
          <label className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Enable DMS</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                enabled ? "bg-mesh-warn" : "bg-mesh-border"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </label>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Silence timeout (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(Number(e.target.value))}
              className="w-full text-xs bg-mesh-card border border-mesh-border rounded px-2 py-1.5 text-slate-300 focus:outline-none focus:border-mesh-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Movement timeout (minutes, optional)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={movementTimeout}
              placeholder="disabled"
              onChange={(e) =>
                setMovementTimeout(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full text-xs bg-mesh-card border border-mesh-border rounded px-2 py-1.5 text-slate-300 placeholder-mesh-muted focus:outline-none focus:border-mesh-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Escalation delay (minutes after trigger)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={escalationMinutes}
              onChange={(e) => setEscalationMinutes(Number(e.target.value))}
              className="w-full text-xs bg-mesh-card border border-mesh-border rounded px-2 py-1.5 text-slate-300 focus:outline-none focus:border-mesh-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Contact note / emergency info
            </label>
            <textarea
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              rows={2}
              placeholder="Next of kin, medical info, etc."
              className="w-full text-xs bg-mesh-card border border-mesh-border rounded px-2 py-1.5 text-slate-300 placeholder-mesh-muted focus:outline-none focus:border-mesh-accent resize-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-mesh-accent hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
