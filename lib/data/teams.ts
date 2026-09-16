import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TeamWithLeadership = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_core_team: boolean;
  member_count: number;
  coordinator: { id: string; full_name: string } | null;
  deputy_coordinator: { id: string; full_name: string } | null;
};

export async function listTeams(): Promise<TeamWithLeadership[]> {
  const supabase = await createClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select(
      "id, name, slug, description, is_core_team, team_memberships(member_id, is_coordinator, is_deputy_coordinator, prm_members(id, full_name))",
    )
    .order("is_core_team", { ascending: false })
    .order("name");

  if (error) throw error;

  return (teams ?? []).map((t) => {
    const memberships = (t.team_memberships ?? []) as {
      member_id: string;
      is_coordinator: boolean;
      is_deputy_coordinator: boolean;
      prm_members: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    }[];

    const resolveMember = (m: (typeof memberships)[number]) => {
      const pm = m.prm_members;
      const single = Array.isArray(pm) ? pm[0] : pm;
      return single ? { id: single.id, full_name: single.full_name } : null;
    };

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      is_core_team: t.is_core_team,
      member_count: memberships.length,
      coordinator: resolveMember(
        memberships.find((m) => m.is_coordinator) ?? ({} as (typeof memberships)[number]),
      ),
      deputy_coordinator: resolveMember(
        memberships.find((m) => m.is_deputy_coordinator) ??
          ({} as (typeof memberships)[number]),
      ),
    };
  });
}

export async function getTeam(teamId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, slug, description, is_core_team")
    .eq("id", teamId)
    .single();
  if (error) throw error;
  return data;
}

export type TeamMemberRow = {
  membership_id: string;
  member_id: string;
  full_name: string;
  email: string;
  status: string;
  is_coordinator: boolean;
  is_deputy_coordinator: boolean;
  core_role: string | null;
  is_auto_synced: boolean;
  bs_id: string | null;
  stage: string | null;
  scout_group: string | null;
  district: string | null;
  team_name: string | null;
  position: string | null;
};

export async function getTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select(
      "id, member_id, is_coordinator, is_deputy_coordinator, core_role, is_auto_synced, prm_members(full_name, email, status, bs_id, stage, scout_group, district, team_name, position)",
    )
    .eq("team_id", teamId);
  if (error) throw error;

  type MemberFields = {
    full_name: string;
    email: string;
    status: string;
    bs_id: string | null;
    stage: string | null;
    scout_group: string | null;
    district: string | null;
    team_name: string | null;
    position: string | null;
  };

  return (data ?? []).map((row) => {
    const pm = row.prm_members as MemberFields | MemberFields[] | null;
    const single = Array.isArray(pm) ? pm[0] : pm;
    return {
      membership_id: row.id,
      member_id: row.member_id,
      full_name: single?.full_name ?? "Unknown",
      email: single?.email ?? "",
      status: single?.status ?? "active",
      is_coordinator: row.is_coordinator,
      is_deputy_coordinator: row.is_deputy_coordinator,
      core_role: row.core_role,
      is_auto_synced: row.is_auto_synced,
      bs_id: single?.bs_id ?? null,
      stage: single?.stage ?? null,
      scout_group: single?.scout_group ?? null,
      district: single?.district ?? null,
      team_name: single?.team_name ?? null,
      position: single?.position ?? null,
    };
  });
}

export async function listAllMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prm_members")
    .select("id, full_name, email, status")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function listAllRoles() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

const FIXED_CORE_ROLES = [
  "Convener",
  "Joint Convener",
  "Member Secretary",
  "Deputy Member Secretary",
] as const;

export type OrganogramData = {
  fixedRoles: { role: string; member: { id: string; full_name: string } | null }[];
  teams: { id: string; name: string; coordinator: { id: string; full_name: string } | null; deputy_coordinator: { id: string; full_name: string } | null }[];
};

// Two-tier org chart data: fixed Core Team roles at the top, then every
// operational team's Coordinator/Deputy Coordinator (who are themselves
// auto-synced into the Core Team) as the next tier.
export async function getOrganogramData(): Promise<OrganogramData> {
  const allTeams = await listTeams();
  const coreTeam = allTeams.find((t) => t.is_core_team);
  const operationalTeams = allTeams.filter((t) => !t.is_core_team);

  const coreMembers = coreTeam ? await getTeamMembers(coreTeam.id) : [];

  const fixedRoles = FIXED_CORE_ROLES.map((role) => {
    const holder = coreMembers.find((m) => m.core_role === role);
    return {
      role,
      member: holder ? { id: holder.member_id, full_name: holder.full_name } : null,
    };
  });

  return {
    fixedRoles,
    teams: operationalTeams.map((t) => ({
      id: t.id,
      name: t.name,
      coordinator: t.coordinator,
      deputy_coordinator: t.deputy_coordinator,
    })),
  };
}
