import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Sign in · Canary" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      {/* Both read request-time data (cookies, ?next=), so they sit in Suspense
          boundaries as Cache Components requires. */}
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
