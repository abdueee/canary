"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CurrentUser } from "@/lib/authz";
import { SignOutButton } from "./sign-out-button";

type NavItem = { href: string; label: string; adminOnly?: boolean };

// Top bar on every signed-in page. The Users link is hidden from viewers, but
// that's only a convenience: /admin/users checks the role on the server too.
// openAlerts is counted on the server when the page renders.
// TODO(alerts): keep it live over SSE.
export function TopBar({
  user,
  openAlerts,
}: {
  user: Pick<CurrentUser, "name" | "role">;
  openAlerts: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard" },
    { href: "/alerts", label: `Alerts (${openAlerts})` },
    { href: "/admin/users", label: "Users", adminOnly: true },
  ];
  const items = navItems.filter((item) => !item.adminOnly || user.role === "admin");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const links = items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setMenuOpen(false)}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        isActive(item.href) ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
      }`}
    >
      {item.label}
    </Link>
  ));

  const userInfo = (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-700">{user.name}</span>
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700">
        {user.role}
      </span>
      <SignOutButton />
    </div>
  );

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            Canary
          </Link>
          <nav className="hidden items-center gap-1 md:flex">{links}</nav>
        </div>

        <div className="hidden md:block">{userInfo}</div>

        {/* Phones: links and user menu collapse behind a ☰ button. */}
        <button
          type="button"
          className="rounded-md p-2 text-xl md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 md:hidden">
          <nav className="flex flex-col">{links}</nav>
          {userInfo}
        </div>
      )}
    </header>
  );
}
