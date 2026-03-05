"use client";

import { handlePacket } from "./packet-handler";

export class MeshSerialConnection {
  private static instance: MeshSerialConnection;
  private connection: unknown = null;

  static getInstance(): MeshSerialConnection {
    if (!MeshSerialConnection.instance) {
      MeshSerialConnection.instance = new MeshSerialConnection();
    }
    return MeshSerialConnection.instance;
  }

  async connect(): Promise<void> {
    const { SerialConnection } = await import("@meshtastic/js");

    const conn = new SerialConnection(0);

    conn.events.onDeviceStatus.subscribe((status) => {
      console.log("[Meshtastic Serial] Device status:", status);
    });

    conn.events.onMeshPacket.subscribe((packet) => {
      handlePacket(packet).catch(console.error);
    });

    await conn.connect({
      baudRate: 115200,
      concurrentLogOutput: false,
    });

    this.connection = conn;
  }

  async sendText(text: string, destination?: number, channel = 0): Promise<void> {
    if (!this.connection) throw new Error("Not connected");
    const conn = this.connection as {
      sendText: (text: string, destination?: number, wantAck?: boolean, channel?: number) => Promise<void>;
    };
    await conn.sendText(text, destination, true, channel);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      const conn = this.connection as { disconnect?: () => Promise<void> };
      await conn.disconnect?.();
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
