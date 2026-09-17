"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// AuthGuard needs to tell apart "not signed in" from "signed in but
// belongs to 2+ orgs and hasn't picked one yet" — fetchCurrentUser()
// returns null for both (and for other not-ready states), which is
// fine for every other consumer, but AuthGuard specifically must not
// bounce a real, signed-in, multi-org user to /login. This is a small,
// separate query used only by AuthGuard.
export type AuthStatus =
  | { kind: "signed-out" }
  | { kind: "needs-org-selection"; organizations: { id: string; name: string }[] }
  | { kind: "ready" };

function orgName(field: { name: string } | { name: string }[] | null): string {
  if (!field) return "Organization";
  const single = Array.isArray(field) ? field[0] : field;
  return single?.name ?? "Organization";
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed-out" };

  const { data: memberships } = await supabase
    .from("prm_members")
    .select("organization_id, blocked_at, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships) return { kind: "ready" };

  // A blocked org isn't a valid destination — only offer/consider the
  // ones this person can actually still use. If they're blocked
  // everywhere, fall through to "ready" so fetchCurrentUser's blockedAt
  // (on their sole/active membership) drives AuthGuard's sign-out, same
  // as the single-org case.
  const nonBlocked = memberships.filter((m) => !m.blocked_at);
  if (nonBlocked.length <= 1) return { kind: "ready" };

  const { data: active } = await supabase
    .from("user_active_organization")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (active && nonBlocked.some((m) => m.organization_id === active.organization_id)) {
    return { kind: "ready" };
  }

  return {
    kind: "needs-org-selection",
    organizations: nonBlocked.map((m) => ({
      id: m.organization_id,
      name: orgName(m.organizations as { name: string } | { name: string }[] | null),
    })),
  };
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: fetchAuthStatus,
    staleTime: 30_000,
  });
}
