"use client";

import { Sparkles } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { UserMenu } from "@/components/nav/user-menu";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  if (!user) return null;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
          <Sparkles className="h-5 w-5 text-sidebar-primary" />
          <span className="text-lg font-semibold tracking-tight">PRM Portal</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav isSuperAdmin={user.isSuperAdmin} />
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header
          className="sticky z-40 flex items-center justify-between gap-2 border-b bg-card/95 px-3 py-3 backdrop-blur supports-backdrop-filter:bg-card/75 sm:px-6"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNav isSuperAdmin={user.isSuperAdmin} />
            <span className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              PRM Portal
            </span>
          </div>
          <div className="hidden lg:block" />
          <UserMenu
            fullName={user.fullName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            roles={user.roles}
          />
        </header>
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthGuard>
  );
}
