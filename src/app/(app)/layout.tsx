import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { requireUser } from "@/lib/authz";

// Every page inside (app) requires a signed-in user. The route group's name in
// parentheses doesn't appear in the URL: (app)/page.tsx is "/".
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    // The session is read per request, so it lives inside Suspense
    // (required by Cache Components). The fallback is a plain top-bar strip.
    <Suspense fallback={<div className="h-14 border-b border-zinc-200 bg-white" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // redirects to /login if not signed in

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </>
  );
}
