"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Loader2 } from "lucide-react";

// Replaces the old proxy.ts middleware, which can't run under
// `output: 'export'` (no server). Redirects to /login if there's no
// session, and force-signs-out a blocked member (blocked_at set) —
// mirroring the two checks the middleware used to do server-side.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      setCheckedSession(true);
    });
    supabase.auth.getSession().then(() => setCheckedSession(true));
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    if (!checkedSession || isLoading) return;

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
  }, [checkedSession, isLoading, user, pathname, router]);

  if (!checkedSession || isLoading || !user || user.blockedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
