"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_DELAY_MS = 300;

// Listens to the site-wide SSE stream (/api/events) and refreshes the current
// page when a run starts or finishes or an alert changes, so the alert count,
// dashboard and dataset pages stay current without reloading.
// Several events in a row cause a single refresh.
export function LiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource("/api/events");
    source.addEventListener("app", () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    });

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);

  return null;
}
