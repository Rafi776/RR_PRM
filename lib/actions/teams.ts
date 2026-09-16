import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import { parseTabularFile } from "@/lib/utils/parse-tabular";

export type ActionResult = { error: string | null; success?: string };

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTeam(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Team name is required." };

  const supabase = createClient();
  const { error } = await supabase.from("teams").insert({
    name,
    slug: slugify(name),
    description: description || null,
    is_core_team: false,
  });

  if (error) return { error: error.message };
  queryClient.invalidateQueries();
  return { error: null, success: `Team "${name}" created.` };
}

export async function setTeamLeadership(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  const teamId = String(formData.get("teamId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? ""); // "coordinator" | "deputy"

  if (!user?.isSuperAdmin && !user?.leadershipTeamIds.includes(teamId)) {
    return { error: "Not authorized." };
  }
  if (!teamId || !memberId || !["coordinator", "deputy"].includes(role)) {
    return { error: "Missing or invalid fields." };
  }

  const supabase = createClient();

  // Clear the existing holder of this leadership slot on the team, then
  // upsert the new one — the DB's partial unique index also protects
  // against two simultaneous holders.
  const column = role === "coordinator" ? "is_coordinator" : "is_deputy_coordinator";

  const { error: clearError } = await supabase
    .from("team_memberships")
    .update({ [column]: false })
    .eq("team_id", teamId)
    .eq(column, true);
  if (clearError) return { error: clearError.message };

  const { error: upsertError } = await supabase
    .from("team_memberships")
    .upsert(
      { team_id: teamId, member_id: memberId, [column]: true },
      { onConflict: "team_id,member_id" },
    );
  if (upsertError) return { error: upsertError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Leadership updated." };
}

export async function addTeamMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  const teamId = String(formData.get("teamId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  if (!user?.isSuperAdmin && !user?.leadershipTeamIds.includes(teamId)) {
    return { error: "Not authorized." };
  }
  if (!teamId || !memberId) return { error: "Missing fields." };

  const supabase = createClient();
  const { error } = await supabase
    .from("team_memberships")
    .upsert({ team_id: teamId, member_id: memberId }, { onConflict: "team_id,member_id" });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Member added to team." };
}

export async function setCoreRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  const coreRole = String(formData.get("coreRole") ?? "") || null;
  if (!memberId) return { error: "Missing member." };

  const supabase = createClient();
  const { data: coreTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("is_core_team", true)
    .single();
  if (!coreTeam) return { error: "Core Team not found." };

  const { error } = await supabase.from("team_memberships").upsert(
    {
      team_id: coreTeam.id,
      member_id: memberId,
      core_role: coreRole,
      is_auto_synced: false,
    },
    { onConflict: "team_id,member_id" },
  );
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Core role updated." };
}

// ---------------------------------------------------------------------
// Bulk member onboarding via CSV/Excel. Parsing happens here in the
// browser (parseTabularFile), but creating auth accounts requires the
// service-role key, which can never live in a static site's bundle — so
// the parsed rows are handed to the `bulk-import-members` Supabase Edge
// Function (supabase/functions/bulk-import-members), which does the
// createUser/generateLink/insert loop server-side and returns the same
// shape this action used to build directly.
// ---------------------------------------------------------------------
export type BulkImportResult = {
  error: string | null;
  imported: number;
  skipped: { row: number; reason: string }[];
  setupLinks: { email: string; link: string }[];
};

export async function bulkImportMembers(
  _prev: BulkImportResult,
  formData: FormData,
): Promise<BulkImportResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) {
    return { error: "Not authorized.", imported: 0, skipped: [], setupLinks: [] };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file uploaded.", imported: 0, skipped: [], setupLinks: [] };
  }

  const { data: rows, error: parseError } = await parseTabularFile(file);
  if (parseError) return { error: parseError, imported: 0, skipped: [], setupLinks: [] };

  const supabase = createClient();
  const redirectOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const { data, error } = await supabase.functions.invoke<BulkImportResult>(
    "bulk-import-members",
    { body: { rows, redirectOrigin } },
  );

  if (error) {
    return { error: error.message, imported: 0, skipped: [], setupLinks: [] };
  }

  queryClient.invalidateQueries();
  return data ?? { error: "No response from import function.", imported: 0, skipped: [], setupLinks: [] };
}

// ---------------------------------------------------------------------
// Admin/leadership edit of a member's official record fields. Members
// can never reach this path for their own row — the RLS self-update
// policy plus the restrict_self_member_update() trigger (0005) block
// it at the database level even if someone called the table API
// directly, so this is deliberately the only place these fields can
// change after CSV import.
// ---------------------------------------------------------------------
export async function updateMemberDetails(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin && !(user && user.leadershipTeamIds.length > 0)) {
    return { error: "Not authorized." };
  }

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const stage = String(formData.get("stage") ?? "").trim();
  const scoutGroup = String(formData.get("scoutGroup") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const teamName = String(formData.get("teamName") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const bsId = String(formData.get("bsId") ?? "").trim();
  const status = String(formData.get("status") ?? "active");

  const supabase = createClient();
  const { error } = await supabase
    .from("prm_members")
    .update({
      stage: stage || null,
      scout_group: scoutGroup || null,
      district: district || null,
      team_name: teamName || null,
      position: position || null,
      bs_id: bsId || null,
      status,
    })
    .eq("id", memberId);

  // RLS (shares_team_with / is_super_admin) is the real authorization
  // boundary here — a leadership check above only short-circuits the
  // obvious case. If RLS silently no-ops (0 rows matched, no error),
  // treat it as unauthorized rather than reporting false success.
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Member record updated." };
}

// ---------------------------------------------------------------------
// Bootstraps `teams` (and links members into `team_memberships`) from
// the free-text prm_members.team_name column — useful right after a
// bulk CSV import that carried team labels but no relational structure
// yet. Idempotent: existing teams/memberships are left untouched
// (`ignoreDuplicates`), so this is safe to re-run after every import.
//
// Deliberately skips any team_name that matches the real Core Team
// (case-insensitive) — Core Team membership is driven by the
// sync_core_team_membership() trigger off Coordinator assignments, not
// free-text import data, so blindly linking members in would dilute
// what "Core Team member" means.
// ---------------------------------------------------------------------
export type SyncTeamsResult = {
  error: string | null;
  teamsCreated: string[];
  membersLinked: number;
};

export async function syncTeamsFromMemberRecords(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prev: SyncTeamsResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature; this action takes no form input
  _formData: FormData,
): Promise<SyncTeamsResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) {
    return { error: "Not authorized.", teamsCreated: [], membersLinked: 0 };
  }

  const supabase = createClient();

  const [{ data: existingTeams }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, is_core_team"),
    supabase.from("prm_members").select("id, team_name").not("team_name", "is", null),
  ]);

  const coreNames = new Set(
    (existingTeams ?? []).filter((t) => t.is_core_team).map((t) => t.name.trim().toLowerCase()),
  );
  const existingNames = new Set((existingTeams ?? []).map((t) => t.name.trim().toLowerCase()));

  const distinctNames = Array.from(
    new Set(
      (members ?? [])
        .map((m) => m.team_name?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  );

  const toCreate = distinctNames.filter(
    (n) => !existingNames.has(n.toLowerCase()) && !coreNames.has(n.toLowerCase()),
  );

  let createdTeams: { id: string; name: string }[] = [];
  if (toCreate.length > 0) {
    const { data, error } = await supabase
      .from("teams")
      .insert(toCreate.map((name) => ({ name, slug: slugify(name), is_core_team: false })))
      .select("id, name");
    if (error) return { error: error.message, teamsCreated: [], membersLinked: 0 };
    createdTeams = data ?? [];
  }

  const { data: allTeams } = await supabase.from("teams").select("id, name, is_core_team");
  const nameToId = new Map(
    (allTeams ?? []).filter((t) => !t.is_core_team).map((t) => [t.name.trim().toLowerCase(), t.id]),
  );

  const links = (members ?? [])
    .map((m) => {
      const tn = m.team_name?.trim().toLowerCase();
      if (!tn || coreNames.has(tn)) return null;
      const teamId = nameToId.get(tn);
      return teamId ? { team_id: teamId, member_id: m.id } : null;
    })
    .filter((r): r is { team_id: string; member_id: string } => r !== null);

  if (links.length > 0) {
    const { error } = await supabase
      .from("team_memberships")
      .upsert(links, { onConflict: "team_id,member_id", ignoreDuplicates: true });
    if (error) return { error: error.message, teamsCreated: [], membersLinked: 0 };
  }

  queryClient.invalidateQueries();
  return {
    error: null,
    teamsCreated: createdTeams.map((t) => t.name),
    membersLinked: links.length,
  };
}
