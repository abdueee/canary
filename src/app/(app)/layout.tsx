import { Suspense } from "react";
import { TopBar } from "@/components/top-bar";

// Wraps every logged-in page. The top bar reads the user and the database, so it
// streams in behind its own Suspense boundary (required with cacheComponents).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<header className="border-b p-4">Canary</header>}>
        <TopBar />
      </Suspense>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </>
  );
}
