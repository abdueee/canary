import Link from "next/link";
import { CanaryLogo } from "@/components/canary-logo";
import { buttonVariants } from "@/components/ui/button";

// Landing page: the first thing you see after signing in. Just the name, what
// Canary does, and a way into the dashboard.
export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <CanaryLogo className="size-24" />
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Canary</h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Upload each new version of a CSV dataset and Canary checks it right away, so you hear about bad data before
          anyone uses it.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
        Go to dashboard
      </Link>
    </section>
  );
}
