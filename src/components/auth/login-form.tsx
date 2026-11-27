"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "./safe-next";

// TODO(ui): swap the plain inputs and button for shadcn/ui components once the
// foundation PR adds them. The logic stays the same.
export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);

    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      // Same message for wrong email or wrong password, so the form doesn't
      // reveal which emails have accounts.
      setError(error.status === 401 ? "Incorrect email or password." : error.message ?? "Sign-in failed.");
      setPending(false);
      return;
    }

    // Full page load so the app starts fresh with the new session (see
    // SignOutButton: client navigation would restore cached pages and state).
    window.location.replace(safeNextPath(searchParams.get("next")));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-zinc-600">
        No account?{" "}
        <Link href="/register" className="font-medium text-zinc-900 underline">
          Register
        </Link>
      </p>
    </form>
  );
}

export function Field({
  label,
  name,
  type,
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className="rounded-md border border-zinc-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
