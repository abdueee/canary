"use client";

import { useCallback, useSyncExternalStore } from "react";

// Remembers (in this browser) when the user last opened the Alerts tab, so the
// top bar can count alerts raised since then. Stored per user; if storage is
// unavailable, every open alert counts as new.
const EVENT = "canary:alerts-seen";
const keyFor = (userId: string) => `canary:alerts-seen:${userId}`;

function read(userId: string): number {
  try {
    return Number(localStorage.getItem(keyFor(userId))) || 0;
  } catch {
    return 0;
  }
}

function subscribe(onChange: () => void) {
  // "storage" fires when another tab changes it; EVENT when this tab does.
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useAlertsSeen(userId: string) {
  // null on the server and during hydration, so no badge flashes before the stored time is known.
  const seenAt = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => null,
  );

  const markSeen = useCallback(
    (at: number) => {
      if (at <= read(userId)) return;
      try {
        localStorage.setItem(keyFor(userId), String(at));
      } catch {
        // Storage blocked: nothing to remember.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [userId],
  );

  return { seenAt, markSeen };
}
