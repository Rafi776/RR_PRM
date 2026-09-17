"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useAuthStatus } from "@/lib/hooks/use-auth-status";
import { OrgPickerGate } from "@/components/auth/org-picker-gate";
import { Loader2 } from "lucide-react";

// Replaces the old proxy.ts middleware, which can't run under
// `output: 'export'` (no server). Redirects to /login if there's no
// session, force-signs-out a blocked member (blocked_at set), and — for
// a member of more than one organization who hasn't picked one yet —
// shows an org picker instead of bouncing to /login. useCurrentUser()
// returns null for that last case too (it's "not ready" from every
// other consumer's point of view), so useAuthStatus() is what tells
// this specific case apart from a genuinely missing session.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();
  const { data: authStatus, isLoading: authStatusLoading } = useAuthStatus();
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      setCheckedSession(true);
    });
    supabase.auth.getSession().then(() => setCheckedSession(true));
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    if (!checkedSession || isLoading || authStatusLoading) return;
    if (authStatus?.kind === "needs-org-selection") return;

    if (!user) {
      router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user.blockedAt) {
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        router.replace("/login?blocked=1");
      });
    }
  }, [checkedSession, isLoading, authStatusLoading, authStatus, user, pathname, router]);

  if (!checkedSession || isLoading || authStatusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authStatus?.kind === "needs-org-selection") {
    return <OrgPickerGate organizations={authStatus.organizations} />;
  }

  if (!user || user.blockedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
