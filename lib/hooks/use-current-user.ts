"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RoleName } from "@/lib/types/domain";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: RoleName[];
  isSuperAdmin: boolean;
  isCoreTeam: boolean;
  leadershipTeamIds: string[];
  blockedAt: string | null;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: member }, { data: roleRows }, { data: leadershipRows }] =
    await Promise.all([
      supabase
        .from("prm_members")
        .select("id, full_name, email, photo, blocked_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("roles(name)").eq("member_id", user.id),
      supabase
        .from("team_memberships")
        .select("team_id")
        .eq("member_id", user.id)
        .or("is_coordinator.eq.true,is_deputy_coordinator.eq.true"),
    ]);

  const roles = (roleRows ?? [])
    .map((r: { roles: { name: RoleName } | { name: RoleName }[] | null }) => {
      const roleField = r.roles;
      if (!roleField) return null;
      return Array.isArray(roleField) ? roleField[0]?.name : roleField.name;
    })
    .filter((r): r is RoleName => Boolean(r));

  return {
    id: user.id,
    email: user.email ?? member?.email ?? "",
    fullName: member?.full_name ?? user.email ?? "Unknown",
    avatarUrl: member?.photo ?? null,
    roles,
    isSuperAdmin: roles.includes("Super Admin"),
    isCoreTeam: roles.includes("Core Team") || roles.includes("Super Admin"),
    leadershipTeamIds: (leadershipRows ?? []).map((r: { team_id: string }) => r.team_id),
    blockedAt: member?.blocked_at ?? null,
  };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 30_000,
  });
}
