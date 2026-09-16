"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShieldCheck,
  FileCheck2,
  ListChecks,
  CalendarClock,
  Trophy,
  ShieldQuestion,
  Users,
  Flag,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/noc", label: "NOC", icon: FileCheck2 },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/meetings", label: "Meetings", icon: CalendarClock },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/reports", label: "Reports", icon: Flag },
];

export function SidebarNav({
  isSuperAdmin,
  onNavigate,
}: {
  isSuperAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:py-2",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
      {isSuperAdmin ? (
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            "mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:py-2",
            pathname.startsWith("/admin")
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Admin Console
        </Link>
      ) : (
        <span className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/40">
          <ShieldQuestion className="h-4 w-4 shrink-0" />
          Admin (restricted)
        </span>
      )}
    </nav>
  );
}
