"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the page every few seconds while a run is in progress.
// Temporary: replaced by live updates over SSE in feature 8.
export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
