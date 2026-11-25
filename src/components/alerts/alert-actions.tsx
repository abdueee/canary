"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { AlertStatus } from "@/generated/prisma/client";
import { acknowledgeAlert, resolveAlert } from "@/server/actions/alerts";

// Acknowledge / Resolve buttons for one alert (rendered for admins only; the
// Server Actions check the role again). After a successful action the server
// revalidates the page, so the new status appears without a reload.
export function AlertActions({ alertId, status }: { alertId: string; status: AlertStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "RESOLVED") return null;

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(alertId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "OPEN" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(acknowledgeAlert)}>
          Acknowledge
        </Button>
      )}
      <Button size="sm" disabled={pending} onClick={() => run(resolveAlert)}>
        Resolve
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
