import { CanaryLogo } from "@/components/canary-logo";

// Shared layout for the public pages (/login, /register): a centered card.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-t-4 border-t-primary bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <CanaryLogo className="size-12" />
          <p className="text-2xl font-semibold">Canary</p>
        </div>
        {children}
      </div>
    </main>
  );
}
