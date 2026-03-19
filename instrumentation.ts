// Next.js instrumentation hook — runs once on server startup, before any requests.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run in the Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // MQTT disabled — using USB serial as primary transport
    // Uncomment to re-enable MQTT internet fallback:
    // const { getMqttClient } = await import("./lib/mqtt-client");
    // getMqttClient();

    const { startServerDmsMonitor } = await import("./lib/dms-monitor-server");
    startServerDmsMonitor(); // server-side DMS — runs even with no browser open
  }
}