"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RoleName } from "@/lib/types/domain";

export type CurrentUser = {
  id: string; // the auth user (login) id
  memberId: string; // this organization's prm_members.id — NOT the same as `id` once someone belongs to more than one org
  organizationId: string;
  organizationName: string;
  availableOrganizations: { id: string; name: string }[];
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: RoleName[];
  isSuperAdmin: boolean;
  isCoreTeam: boolean;
  leadershipTeamIds: string[];
  blockedAt: string | null;
};

function orgName(field: { name: string } | { name: string }[] | null): string {
  if (!field) return "Organization";
  const single = Array.isArray(field) ? field[0] : field;
  return single?.name ?? "Organization";
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // A login can hold one prm_members row per organization it belongs
  // to — fetch all of them, then resolve which one is "active."
  const { data: memberships } = await supabase
    .from("prm_members")
    .select("id, organization_id, full_name, email, photo, blocked_at, organizations(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) return null;

  // A person blocked in org A must still be able to use org B — so
  // "active org" resolution only considers non-blocked memberships when
  // more than one exists. Only fall back to a blocked one when it's
  // literally the only membership left (AuthGuard's blockedAt check
  // then correctly signs them out entirely, same as single-org before).
  const nonBlocked = memberships.filter((m) => !m.blocked_at);

  let activeOrgId: string;
  if (nonBlocked.length === 0) {
    activeOrgId = memberships[0].organization_id;
  } else if (nonBlocked.length === 1) {
    // Only one usable org — nothing to choose, keep the active-org
    // pointer in sync silently.
    activeOrgId = nonBlocked[0].organization_id;
    await supabase
      .from("user_active_organization")
      .upsert({ user_id: user.id, organization_id: activeOrgId }, { onConflict: "user_id" });
  } else {
    const { data: active } = await supabase
      .from("user_active_organization")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const activeIsUsable = active && nonBlocked.some((m) => m.organization_id === active.organization_id);
    // No active org chosen yet, or it just got blocked out from under
    // them — AuthGuard's separate status check (use-auth-status.ts) is
    // what shows the org-picker gate for this case; returning null here
    // just means "not ready."
    if (!activeIsUsable) return null;
    activeOrgId = active.organization_id;
  }

  const member = memberships.find((m) => m.organization_id === activeOrgId);
  if (!member) return null; // active-org pointer refers to a membership that no longer exists

  const [{ data: roleRows }, { data: leadershipRows }] = await Promise.all([
    supabase.from("user_roles").select("roles(name)").eq("member_id", member.id),
    supabase
      .from("team_memberships")
      .select("team_id")
      .eq("member_id", member.id)
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
    memberId: member.id,
    organizationId: activeOrgId,
    organizationName: orgName(member.organizations as { name: string } | { name: string }[] | null),
    availableOrganizations: nonBlocked.map((m) => ({
      id: m.organization_id,
      name: orgName(m.organizations as { name: string } | { name: string }[] | null),
    })),
    email: user.email ?? member.email ?? "",
    fullName: member.full_name ?? user.email ?? "Unknown",
    avatarUrl: member.photo ?? null,
    roles,
    isSuperAdmin: roles.includes("Super Admin"),
    isCoreTeam: roles.includes("Core Team") || roles.includes("Super Admin"),
    leadershipTeamIds: (leadershipRows ?? []).map((r: { team_id: string }) => r.team_id),
    blockedAt: member.blocked_at ?? null,
  };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 30_000,
  });
}
