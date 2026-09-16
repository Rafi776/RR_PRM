"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/session";
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
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Team name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({
    name,
    slug: slugify(name),
    description: description || null,
    is_core_team: false,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { error: null, success: `Team "${name}" created.` };
}

export async function setTeamLeadership(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const teamId = String(formData.get("teamId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? ""); // "coordinator" | "deputy"

  if (!user?.isSuperAdmin && !user?.leadershipTeamIds.includes(teamId)) {
    return { error: "Not authorized." };
  }
  if (!teamId || !memberId || !["coordinator", "deputy"].includes(role)) {
    return { error: "Missing or invalid fields." };
  }

  const supabase = await createClient();

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

  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin");
  return { error: null, success: "Leadership updated." };
}

export async function addTeamMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const teamId = String(formData.get("teamId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  if (!user?.isSuperAdmin && !user?.leadershipTeamIds.includes(teamId)) {
    return { error: "Not authorized." };
  }
  if (!teamId || !memberId) return { error: "Missing fields." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_memberships")
    .upsert({ team_id: teamId, member_id: memberId }, { onConflict: "team_id,member_id" });
  if (error) return { error: error.message };

  revalidatePath(`/admin/teams/${teamId}`);
  return { error: null, success: "Member added to team." };
}

export async function setCoreRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  const coreRole = String(formData.get("coreRole") ?? "") || null;
  if (!memberId) return { error: "Missing member." };

  const supabase = await createClient();
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

  revalidatePath("/admin");
  return { error: null, success: "Core role updated." };
}

// ---------------------------------------------------------------------
// Bulk member onboarding via CSV.
// Expected columns: full_name, email, phone (optional), bs_id (optional)
// Creates an auth.users invite + prm_members row per data row. Runs with
// the service-role client since inviting users and inserting members
// must bypass RLS and requires the Auth Admin API.
// ---------------------------------------------------------------------
export type BulkImportResult = {
  error: string | null;
  imported: number;
  skipped: { row: number; reason: string }[];
  // email + a one-time "set your password" link, generated locally with
  // the Admin API rather than sent by Supabase's built-in mailer, which
  // has a very low default rate limit (fine for a handful of invites,
  // not for a few hundred). Distribute these yourself in one batch
  // email/message rather than relying on Supabase to send them.
  setupLinks: { email: string; link: string }[];
};

function randomTempPassword() {
  // Only ever used server-side as a throwaway initial password the
  // member immediately overwrites via their setup link — never surfaced
  // to anyone.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Runs `fn` over `items` with at most `concurrency` in flight at once.
// 250 sequential Admin API round-trips (createUser + generateLink each)
// took over 4 minutes end-to-end — long enough that an admin waiting on
// an unresponsive dialog understandably re-submitted, which is what
// actually caused this bug: the second submission raced the first and
// hit "already registered" for every row. Bounded concurrency cuts wall
// time to a fraction of that without hammering the Auth Admin API.
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function bulkImportMembers(
  _prev: BulkImportResult,
  formData: FormData,
): Promise<BulkImportResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return { error: "Not authorized.", imported: 0, skipped: [], setupLinks: [] };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file uploaded.", imported: 0, skipped: [], setupLinks: [] };
  }

  const { data: rows, error: parseError } = await parseTabularFile(file);
  if (parseError) return { error: parseError, imported: 0, skipped: [], setupLinks: [] };

  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  const recoveryRedirectTo = `${origin}/auth/callback?redirectTo=/auth/set-password`;

  const admin = createServiceRoleClient();

  // Fast-path re-submissions (or a re-uploaded file with overlapping
  // rows): skip anyone already imported without touching the Auth
  // Admin API at all, instead of a slow, confusing "already registered"
  // failure per row.
  const { data: existingRows } = await admin.from("prm_members").select("email");
  const existingEmails = new Set(
    (existingRows ?? []).map((r: { email: string }) => r.email.toLowerCase()),
  );

  type RowOutcome =
    | { kind: "skip"; row: number; reason: string }
    | { kind: "imported"; email: string; link: string | null };

  const outcomes = await mapWithConcurrency(rows, 10, async (row, i): Promise<RowOutcome> => {
    const email = row.email?.trim();
    // Accepts either "name" or "full_name" as the header for this column.
    const fullName = (row.name ?? row.full_name)?.trim();

    if (!email || !fullName) {
      return { kind: "skip", row: i + 2, reason: "Missing name or email." };
    }
    if (existingEmails.has(email.toLowerCase())) {
      return { kind: "skip", row: i + 2, reason: "Already imported." };
    }

    // createUser (unlike inviteUserByEmail) does not send an email, so
    // it isn't subject to Supabase's mailer rate limit — safe for bulk
    // imports of any size.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomTempPassword(),
      email_confirm: true,
    });

    if (createError || !created?.user) {
      return {
        kind: "skip",
        row: i + 2,
        reason: createError?.message ?? "Account creation failed.",
      };
    }

    const { error: insertError } = await admin.from("prm_members").insert({
      id: created.user.id,
      full_name: fullName,
      email,
      phone: row.phone?.trim() || null,
      photo: row.photo?.trim() || null,
      bs_id: row.bs_id?.trim() || null,
      stage: row.stage?.trim() || null,
      scout_group: row.scout_group?.trim() || null,
      district: row.district?.trim() || null,
      team_name: row.team_name?.trim() || null,
      position: row.position?.trim() || null,
    });

    if (insertError) {
      return { kind: "skip", row: i + 2, reason: insertError.message };
    }

    // generateLink only returns a URL — it does not dispatch email — so
    // this step is also unaffected by the mailer rate limit.
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: recoveryRedirectTo },
    });

    return { kind: "imported", email, link: linkData?.properties?.action_link ?? null };
  });

  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];
  const setupLinks: { email: string; link: string }[] = [];

  for (const outcome of outcomes) {
    if (outcome.kind === "skip") {
      skipped.push({ row: outcome.row, reason: outcome.reason });
    } else {
      imported++;
      if (outcome.link) setupLinks.push({ email: outcome.email, link: outcome.link });
    }
  }

  revalidatePath("/admin");
  return { error: null, imported, skipped, setupLinks };
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
  const user = await getCurrentUser();
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

  const supabase = await createClient();
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

  revalidatePath("/members");
  revalidatePath("/admin");
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
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return { error: "Not authorized.", teamsCreated: [], membersLinked: 0 };
  }

  const supabase = await createClient();

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

  revalidatePath("/admin");
  revalidatePath("/members");
  return {
    error: null,
    teamsCreated: createdTeams.map((t) => t.name),
    membersLinked: links.length,
  };
}
