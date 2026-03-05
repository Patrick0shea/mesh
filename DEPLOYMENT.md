# Deployment Guide

## The short version

This dashboard is built for disaster response. That means it needs to work when the internet doesn't. **Run it on a laptop at your command post, not on a cloud server.** Everyone at the incident connects to the same local WiFi and opens the dashboard in their browser — no internet required.

Cloud hosting (Railway, Vercel, etc.) is fine for demos and development, but if you're relying on this in the field and the internet goes down, a cloud-hosted dashboard is just a blank screen.

---

## Recommended: Local Network Setup

### How it works

```
[USB Meshtastic radio]
        |
[Laptop running dashboard]  ← one person operates this
        |
   [WiFi hotspot / router]  ← no internet needed
     /    |    \
[Phone] [Tablet] [Laptop]   ← everyone else views the dashboard
```

- The operator laptop runs the dashboard and has a Meshtastic radio plugged in via USB
- It shares a WiFi hotspot (or connects to a local router)
- Anyone on that WiFi opens `http://[laptop-ip]:3000` in their browser and sees the live map, messages, and alerts
- The radio on the operator laptop picks up packets from all field units automatically

### What each person sees

- **Operator laptop** — full dashboard, can connect the USB radio, send messages
- **Everyone else on the network** — can view the map, read messages, see SOS alerts. Cannot initiate a radio connection from their own device (browser security restriction on non-HTTPS), but they don't need to

---

## Setting It Up

### 1. Install Node.js

```bash
# macOS
brew install node

# Ubuntu / Debian / Raspberry Pi
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone and build

```bash
git clone https://github.com/Patrick0shea/mesh.git
cd mesh
npm install
npm run build
```

### 3. Run it manually (to test)

```bash
npm start
```

Open `http://localhost:3000` — dashboard should load. To find your local IP so others can connect:

```bash
# macOS
ipconfig getifaddr en0

# Linux
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Others on the same network open `http://192.168.x.x:3000` (whatever your IP is).

---

## Auto-start on Boot with PM2

You don't want to manually start the dashboard every time the machine powers on. PM2 keeps it running and restarts it if it crashes.

```bash
# Install PM2
npm install -g pm2

# Start the dashboard
cd /path/to/mesh
pm2 start npm --name mesh -- start

# Save the process list
pm2 save

# Register PM2 to run on boot (run the command it outputs)
pm2 startup
```

After this, the dashboard starts automatically whenever the machine boots. No manual steps needed in the field.

**Useful PM2 commands:**

```bash
pm2 status          # check if it's running
pm2 logs mesh       # see live logs
pm2 restart mesh    # restart after config changes
pm2 stop mesh       # stop it
```

---

## Fixed Local Address with mesh.local

Telling people "go to 192.168.1.47:3000" is error-prone. With mDNS you can give it a proper hostname so the URL is always the same regardless of what IP the machine gets.

### macOS (built-in, nothing to install)

macOS broadcasts its hostname automatically. Find it:

```bash
scutil --get LocalHostName
```

If it says `Patricks-MacBook`, the dashboard is reachable at:
```
http://patricks-macbook.local:3000
```

You can set a custom hostname:
```bash
sudo scutil --set LocalHostName mesh-command
# Now reachable at http://mesh-command.local:3000
```

### Linux / Raspberry Pi

```bash
sudo apt install -y avahi-daemon
sudo systemctl enable avahi-daemon
sudo hostnamectl set-hostname mesh-command
```

Reachable at `http://mesh-command.local:3000`.

---

## HTTPS (Optional but Recommended)

Plain HTTP works fine for viewing the dashboard on other devices. However, to use **USB Serial or Bluetooth** from a device other than the server machine, you need HTTPS. Browsers block WebSerial and Web Bluetooth on non-secure origins.

If you only ever connect the radio on the server machine itself (recommended), you can skip this.

If you want full HTTPS on your local network, install Caddy:

```bash
# Ubuntu / Debian
sudo apt install -y caddy

# macOS
brew install caddy
```

Create `/etc/caddy/Caddyfile`:

```
mesh-command.local {
    tls internal
    reverse_proxy localhost:3000
}
```

Start Caddy:
```bash
sudo systemctl enable --now caddy
```

The first time other devices visit `https://mesh-command.local` they'll get a certificate warning — click through and accept the self-signed cert once. After that it works normally.

---

## Raspberry Pi Dedicated Setup

A Raspberry Pi 4 makes an ideal always-on command post server. It's cheap (~£50), runs on a USB battery pack, and can be left running indefinitely.

```bash
# On the Pi (Raspberry Pi OS Lite recommended)
sudo apt update && sudo apt install -y git

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and build
git clone https://github.com/you/mesh.git ~/mesh
cd ~/mesh
npm install
npm run build

# Set hostname
sudo hostnamectl set-hostname mesh-command
sudo apt install -y avahi-daemon

# Auto-start
npm install -g pm2
pm2 start npm --name mesh -- start
pm2 save && pm2 startup
# Run the command it outputs
```

Plug a Meshtastic radio into the Pi's USB port, connect the Pi to your field router, done. The dashboard is at `http://mesh-command.local:3000` for everyone on the network.

**Power:** A 20,000mAh USB battery pack runs a Pi 4 for ~12–15 hours.

---

## Cloud Hosting (for demos / remote access)

If you want the dashboard accessible over the internet — for training, demos, or remote monitoring when infrastructure is intact — Railway is the easiest option.

### Railway

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a persistent volume: service → **Volumes** → mount at `/data`
4. Add an environment variable: `DB_PATH=/data/mesh.db`
5. Update `lib/db.ts` to use it:

```ts
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "mesh.db");
```

6. Deploy — Railway detects Next.js automatically

**Cost:** ~$5/month for an always-on instance.

> Do not rely on this for actual field operations. If the internet is down, this is unreachable.

---

## Summary

| Setup | Good for | Works offline | Cost |
|---|---|---|---|
| Laptop + hotspot | Field operations | Yes | Free |
| Raspberry Pi | Permanent command post | Yes | ~£50 one-time |
| Railway | Demos, remote access | No | ~$5/mo |
| Vercel | Development only | No | Free tier |

For anything operational: **local is the only reliable option.**
