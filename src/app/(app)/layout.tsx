import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { LiveUpdates } from "@/components/live-updates";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";

// Every page inside (app) requires a signed-in user. The route group's name in
// parentheses doesn't appear in the URL: (app)/page.tsx is "/".
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    // The session and the open alerts are read per request, so they live inside
    // Suspense (required by Cache Components). The fallback is a plain top-bar strip.
    <Suspense fallback={<div className="h-14 border-b-2 border-primary bg-zinc-900" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const [user, openAlerts] = await Promise.all([
    requireUser(), // redirects to /login if not signed in
    // Open alerts, newest first. The top bar compares their times with when this
    // browser last opened the Alerts tab to show how many are new.
    db.alert.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true },
    }),
  ]);

  return (
    <>
      <TopBar user={user} openAlertTimes={openAlerts.map((a) => a.createdAt.getTime())} />
      <LiveUpdates />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-6">
        {children}
      </main>
    </>
  );
}
