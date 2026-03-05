"use client";

import { handlePacket } from "./packet-handler";

export class MeshBluetoothConnection {
  private static instance: MeshBluetoothConnection;
  private connection: unknown = null;

  static getInstance(): MeshBluetoothConnection {
    if (!MeshBluetoothConnection.instance) {
      MeshBluetoothConnection.instance = new MeshBluetoothConnection();
    }
    return MeshBluetoothConnection.instance;
  }

  async connect(): Promise<void> {
    const { BleConnection } = await import("@meshtastic/js");

    const conn = new BleConnection(0);

    conn.events.onDeviceStatus.subscribe((status) => {
      console.log("[Meshtastic BLE] Device status:", status);
    });

    conn.events.onMeshPacket.subscribe((packet) => {
      handlePacket(packet).catch(console.error);
    });

    await conn.connect({
      // No device passed → triggers browser BLE device picker
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
