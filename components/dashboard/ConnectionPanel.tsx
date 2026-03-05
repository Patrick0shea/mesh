"use client";

import { useState } from "react";
import { Usb, Bluetooth, Unplug, Loader2, AlertTriangle } from "lucide-react";

type ConnState = "disconnected" | "connecting" | "connected" | "error";

export default function ConnectionPanel() {
  const [connState, setConnState] = useState<ConnState>("disconnected");
  const [connType, setConnType] = useState<"serial" | "bluetooth" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasSerial = typeof navigator !== "undefined" && "serial" in navigator;
  const hasBluetooth = typeof navigator !== "undefined" && "bluetooth" in navigator;

  async function connectSerial() {
    if (!hasSerial) {
      setErrorMsg("WebSerial not supported. Use Chrome or Edge.");
      return;
    }
    setConnState("connecting");
    setConnType("serial");
    setErrorMsg(null);
    try {
      const { MeshSerialConnection } = await import("@/lib/meshtastic/serial");
      await MeshSerialConnection.getInstance().connect();
      setConnState("connected");
    } catch (e) {
      setConnState("error");
      setErrorMsg(e instanceof Error ? e.message : "Serial connection failed");
    }
  }

  async function connectBluetooth() {
    if (!hasBluetooth) {
      setErrorMsg("Web Bluetooth not supported. Use Chrome on HTTPS.");
      return;
    }
    setConnState("connecting");
    setConnType("bluetooth");
    setErrorMsg(null);
    try {
      const { MeshBluetoothConnection } = await import("@/lib/meshtastic/bluetooth");
      await MeshBluetoothConnection.getInstance().connect();
      setConnState("connected");
    } catch (e) {
      setConnState("error");
      setErrorMsg(e instanceof Error ? e.message : "Bluetooth connection failed");
    }
  }

  async function disconnect() {
    if (connType === "serial") {
      const { MeshSerialConnection } = await import("@/lib/meshtastic/serial");
      await MeshSerialConnection.getInstance().disconnect();
    } else if (connType === "bluetooth") {
      const { MeshBluetoothConnection } = await import("@/lib/meshtastic/bluetooth");
      await MeshBluetoothConnection.getInstance().disconnect();
    }
    setConnState("disconnected");
    setConnType(null);
  }

  const stateColor = {
    disconnected: "text-mesh-muted",
    connecting: "text-mesh-warn",
    connected: "text-mesh-online",
    error: "text-mesh-danger",
  }[connState];

  return (
    <div className="flex items-center gap-2">
      {errorMsg && (
        <div className="flex items-center gap-1 text-xs text-mesh-danger">
          <AlertTriangle size={12} />
          <span>{errorMsg}</span>
        </div>
      )}

      <span className={`text-xs font-medium ${stateColor}`}>
        {connState === "connecting" && <Loader2 size={12} className="inline animate-spin mr-1" />}
        {connState === "connected" ? `Connected via ${connType}` : connState}
      </span>

      {connState === "connected" ? (
        <button
          onClick={disconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mesh-border hover:bg-red-900/40 text-slate-300 hover:text-mesh-danger rounded transition-colors"
        >
          <Unplug size={12} />
          Disconnect
        </button>
      ) : (
        <>
          <button
            onClick={connectSerial}
            disabled={connState === "connecting"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mesh-border hover:bg-mesh-accent/20 text-slate-300 hover:text-mesh-accent rounded transition-colors disabled:opacity-50"
          >
            <Usb size={12} />
            USB
          </button>
          <button
            onClick={connectBluetooth}
            disabled={connState === "connecting"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mesh-border hover:bg-blue-900/40 text-slate-300 hover:text-blue-400 rounded transition-colors disabled:opacity-50"
          >
            <Bluetooth size={12} />
            BLE
          </button>
        </>
      )}
    </div>
  );
}
