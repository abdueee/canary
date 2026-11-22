import type { Metadata } from "next";
import { Suspense } from "react";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Register · Canary" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Create an account</h1>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <RegisterForm />
    </>
  );
}
