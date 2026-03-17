#!/usr/bin/env python3
"""
bridge.py — Meshtastic serial bridge for Pi deployment.

Connects to the TBEAM via USB serial, listens for incoming LoRa packets,
and POSTs them to the dashboard API (localhost:3000).

Replaces the browser WebSerial connection when the dashboard runs on a Pi
and multiple people access it remotely via http://[pi-ip]:3000.

Run with:
    python3 bridge.py

Requirements:
    pip install meshtastic requests
"""

import meshtastic
import meshtastic.serial_interface
import requests
import time

BASE_URL = "http://localhost:3000"


def on_receive(packet, interface):
    try:
        decoded = packet.get("decoded", {})
        portnum = decoded.get("portnum", "")
        from_id = f"!{packet.get('from', 0):08x}"
        to_num = packet.get("to", 0)
        to_id = "^all" if to_num == 4294967295 else f"!{to_num:08x}"
        now = int(time.time())

        if portnum == "TEXT_MESSAGE_APP":
            text = decoded.get("text", "")
            if not text:
                return
            requests.post(f"{BASE_URL}/api/messages", json={
                "from_node": from_id,
                "to_node": to_id,
                "channel": packet.get("channel", 0),
                "text": text,
                "timestamp": now,
                "transport": "radio",
            }, timeout=3)
            if "SOS" in text.upper():
                requests.post(f"{BASE_URL}/api/events", json={
                    "node_id": from_id,
                    "triggered_at": now,
                    "notes": f"SOS message: {text}",
                }, timeout=3)
            print(f"[bridge] Message from {from_id}: {text}")

        elif portnum == "POSITION_APP":
            pos = decoded.get("position", {})
            if pos.get("latitudeI"):
                requests.post(f"{BASE_URL}/api/nodes", json={
                    "node_id": from_id,
                    "latitude": pos["latitudeI"] * 1e-7,
                    "longitude": pos["longitudeI"] * 1e-7,
                    "last_heard": now,
                }, timeout=3)
                print(f"[bridge] Position from {from_id}")

        elif portnum == "NODEINFO_APP":
            user = decoded.get("user", {})
            requests.post(f"{BASE_URL}/api/nodes", json={
                "node_id": from_id,
                "long_name": user.get("longName"),
                "short_name": user.get("shortName"),
                "role": user.get("role"),
                "last_heard": now,
            }, timeout=3)
            print(f"[bridge] NodeInfo from {from_id}: {user.get('longName')}")

        elif portnum == "TELEMETRY_APP":
            telemetry = decoded.get("deviceMetrics", {})
            if telemetry.get("batteryLevel") is not None:
                requests.post(f"{BASE_URL}/api/nodes", json={
                    "node_id": from_id,
                    "battery_level": telemetry["batteryLevel"],
                    "last_heard": now,
                }, timeout=3)

    except Exception as e:
        print(f"[bridge] error: {e}")


print("Connecting to TBEAM via USB serial...")
iface = meshtastic.serial_interface.SerialInterface(devPath="/dev/ttyACM0")
iface.onReceive = on_receive
print(f"Bridge running — listening for LoRa packets on {BASE_URL}")
print("Ctrl+C to stop.\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopping bridge.")
    iface.close()