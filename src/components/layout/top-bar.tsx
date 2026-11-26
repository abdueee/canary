"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/authz";
import { SignOutButton } from "./sign-out-button";
import { useAlertsSeen } from "./use-alerts-seen";

type NavItem = { href: string; label: string; adminOnly?: boolean };

// Top bar on every signed-in page. The Users link is hidden from viewers, but
// that's only a convenience: /admin/users checks the role on the server too.
// openAlertTimes (creation times of open alerts, in ms) come from the server and
// refresh live through LiveUpdates. The red badge on Alerts counts the ones
// raised since this browser last opened the Alerts tab.
export function TopBar({
  user,
  openAlertTimes,
}: {
  user: Pick<CurrentUser, "id" | "name" | "role">;
  openAlertTimes: number[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { seenAt, markSeen } = useAlertsSeen(user.id);
  const onAlertsPage = pathname.startsWith("/alerts");

  // Opening the Alerts tab (or a new alert arriving while it's open) marks
  // everything up to now as seen.
  const latestAlert = openAlertTimes[0] ?? 0;
  useEffect(() => {
    if (onAlertsPage) markSeen(Math.max(Date.now(), latestAlert));
  }, [onAlertsPage, latestAlert, markSeen]);

  const newAlerts = seenAt === null || onAlertsPage ? 0 : openAlertTimes.filter((t) => t > seenAt).length;

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard" },
    { href: "/alerts", label: "Alerts" },
    { href: "/admin/users", label: "Users", adminOnly: true },
  ];
  const items = navItems.filter((item) => !item.adminOnly || user.role === "admin");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const links = items.map((item) => {
    const isAlerts = item.href === "/alerts";
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        aria-current={isActive(item.href) ? "page" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive(item.href) ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
      >
        {isAlerts && <Bell aria-hidden className="size-4" />}
        {item.label}
        {isAlerts && newAlerts > 0 && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white tabular-nums"
            aria-label={`${newAlerts} new alert${newAlerts === 1 ? "" : "s"}`}
          >
            {newAlerts > 99 ? "99+" : newAlerts}
          </span>
        )}
      </Link>
    );
  });

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
          className="relative rounded-md p-2 text-xl md:hidden"
          aria-label={newAlerts > 0 ? `Toggle menu (${newAlerts} new alerts)` : "Toggle menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
          {newAlerts > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-600" />}
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
