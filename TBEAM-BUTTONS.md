# TBEAM Button Reference (Meshtastic 2.7.x)

## Button Layout

```
[ Power ]  [ User/Boot ]  [ Reset ]
  left         middle        right
```
> T-Beam Supreme has Power in the middle, User on the left.

---

## Power Button (left)
| Press | Action |
|-------|--------|
| Long press | Power on / power off |

---

## Reset Button (right)
| Press | Action |
|-------|--------|
| Single press | Reboot the device (reloads firmware) |

---

## User/Boot Button (middle) — main navigation button
| Press | Action |
|-------|--------|
| Single press | Cycle through OLED screen pages |
| Double press | Broadcast a position ping to the mesh |
| Triple press | Toggle GPS on/off |
| Long press (5s) | Shutdown with 5-second countdown |

### OLED screen pages (cycle with single press):
- Node list
- Messages
- GPS position
- LoRa settings
- System info (heap, uptime)
- Clock

---

## Canned Messages (once module is enabled)
When you navigate to the canned messages screen:

| Press | Action |
|-------|--------|
| Short press | Scroll to next message (shown on screen) |
| Long press | Send the currently selected message |

---

## Setting Canned Messages via Python CLI
The iOS app has a known bug where canned messages don't save.
Use this on the Pi instead (stop bridge.py first):

```bash
python3 -m meshtastic --port /dev/ttyUSB0 --set-canned-message "SOS - Need assistance|Position update|All clear|Requesting backup"

# Verify it saved:
python3 -m meshtastic --port /dev/ttyUSB0 --get-canned-message
```

If `/dev/ttyUSB0` doesn't work, try `/dev/ttyACM0`.

---

## Firmware Download Mode (for flashing)
1. Hold the Boot/User button
2. Press Reset once
3. Release Boot/User button