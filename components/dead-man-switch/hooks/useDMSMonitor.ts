"use client";

import { useEffect } from "react";
import { runDmsCheck } from "@/lib/dms-monitor";

const CHECK_INTERVAL_MS = 60_000; // every 60 seconds

export function useDMSMonitor() {
  useEffect(() => {
    // Run immediately on mount, then on interval
    runDmsCheck().catch(console.error);

    const interval = setInterval(() => {
      runDmsCheck().catch(console.error);
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
