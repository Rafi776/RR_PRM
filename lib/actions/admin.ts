import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

async function getSuperAdminRoleId(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("roles").select("id").eq("name", "Super Admin").single();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------
// Super Admin access grants. Only an existing Super Admin can grant or
// revoke this — enforced both here and by the `user_roles_modify_admin`
// RLS policy (0002), which is the real boundary.
// ---------------------------------------------------------------------
export async function grantSuperAdmin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const supabase = createClient();
  const roleId = await getSuperAdminRoleId(supabase);
  if (!roleId) return { error: "Super Admin role not found." };

  const { error } = await supabase.from("user_roles").insert({
    member_id: memberId,
    role_id: roleId,
    organization_id: user.organizationId,
    granted_by: user.id,
  });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Admin access granted." };
}

export async function revokeSuperAdmin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const supabase = createClient();
  const roleId = await getSuperAdminRoleId(supabase);
  if (!roleId) return { error: "Super Admin role not found." };

  const { count } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role_id", roleId)
    .eq("organization_id", user.organizationId);
  if ((count ?? 0) <= 1) {
    return { error: "Can't remove the last Super Admin — grant someone else first." };
  }

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("member_id", memberId)
    .eq("role_id", roleId);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Admin access revoked." };
}

// ---------------------------------------------------------------------
// Blocking = membership cancellation: status -> inactive, scoped to
// THIS org's prm_members row only (RLS-gated, safe to do directly from
// the client). Since one login can hold a membership in more than one
// org, blocking someone in org A must NOT lock them out of org B — so
// the auth account itself is only banned (via the `block-member` Edge
// Function, which needs the service-role key) when this is the
// person's ONLY remaining non-blocked membership anywhere. If they
// still have another active org, the ban is skipped entirely; RLS +
// AuthGuard already keep a blocked member out of THAT org's data via
// `blocked_at` on their org-specific row.
// ---------------------------------------------------------------------
export async function blockMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!memberId) return { error: "Missing member." };
  if (memberId === user.memberId) return { error: "You can't block yourself." };

  const supabase = createClient();

  // The Edge Function (if used below) bans an AUTH account, not an
  // org-membership row — prm_members.id is no longer the same value as
  // auth.users.id since a person can hold more than one org membership
  // under one login.
  const { data: target } = await supabase
    .from("prm_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) return { error: "Member not found." };

  const { data: targetRoles } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("member_id", memberId);
  const isTargetAdmin = (targetRoles ?? []).some((r) => {
    const roleField = r.roles as { name: string } | { name: string }[] | null;
    const name = Array.isArray(roleField) ? roleField[0]?.name : roleField?.name;
    return name === "Super Admin";
  });
  if (isTargetAdmin) {
    return { error: "Revoke their admin access before blocking them." };
  }

  const { error: updateError } = await supabase
    .from("prm_members")
    .update({
      status: "inactive",
      blocked_at: new Date().toISOString(),
      blocked_reason: reason || null,
      blocked_by: user.id,
    })
    .eq("id", memberId);
  if (updateError) return { error: updateError.message };

  // Only ban the shared login if they have no other unblocked
  // membership left anywhere — otherwise this ban would also lock them
  // out of every other org they belong to.
  const { data: otherMemberships } = await supabase
    .from("prm_members")
    .select("id")
    .eq("user_id", target.user_id)
    .neq("id", memberId)
    .is("blocked_at", null);

  if (!otherMemberships || otherMemberships.length === 0) {
    const { error: banError } = await supabase.functions.invoke("block-member", {
      body: { userId: target.user_id, banDuration: "87600h" }, // ~10 years; effectively indefinite, reversible via unblock
    });
    if (banError) {
      return {
        error: `Membership cancelled, but sign-in couldn't be blocked: ${banError.message}`,
      };
    }
  }

  queryClient.invalidateQueries();
  return { error: null, success: "Member blocked and membership cancelled." };
}

export async function unblockMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const supabase = createClient();

  const { data: target } = await supabase
    .from("prm_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) return { error: "Member not found." };

  const { error: updateError } = await supabase
    .from("prm_members")
    .update({ status: "active", blocked_at: null, blocked_reason: null, blocked_by: null })
    .eq("id", memberId);
  if (updateError) return { error: updateError.message };

  // Harmless if they were never actually banned (e.g. they had another
  // active org at block time) — always clear any ban just in case.
  const { error: banError } = await supabase.functions.invoke("block-member", {
    body: { userId: target.user_id, banDuration: "none" },
  });
  if (banError) return { error: banError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Member unblocked." };
}

// ---------------------------------------------------------------------
// Add someone who already has a login (in another org) as a member of
// the caller's org too — bulk import only creates brand-new accounts
// and fails on a duplicate email, since Supabase Auth enforces one
// email per project. Delegates to the invite-existing-member Edge
// Function, which needs the service-role key to look up the account by
// email without exposing the whole user list to the client.
// ---------------------------------------------------------------------
export async function inviteExistingMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = createClient();
  const { error } = await supabase.functions.invoke("invite-existing-member", {
    body: { email },
  });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `${email} added to your organization.` };
}
