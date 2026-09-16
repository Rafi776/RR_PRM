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

  const { error } = await supabase
    .from("user_roles")
    .insert({ member_id: memberId, role_id: roleId, granted_by: user.id });
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
    .eq("role_id", roleId);
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
// Blocking = membership cancellation: status -> inactive (RLS-gated,
// safe to do directly from the client), plus banning the auth account
// — that half requires the service-role key, so it's delegated to the
// `block-member` Supabase Edge Function
// (supabase/functions/block-member). AuthGuard also force-signs-out a
// blocked member on their next request, since a JWT already issued
// stays technically valid for the rest of its lifetime even after the
// ban is set.
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
  if (memberId === user.id) return { error: "You can't block yourself." };

  const supabase = createClient();

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

  const { error: banError } = await supabase.functions.invoke("block-member", {
    body: { memberId, banDuration: "87600h" }, // ~10 years; effectively indefinite, reversible via unblock
  });
  if (banError) {
    return {
      error: `Membership cancelled, but sign-in couldn't be blocked: ${banError.message}`,
    };
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
  const { error: updateError } = await supabase
    .from("prm_members")
    .update({ status: "active", blocked_at: null, blocked_reason: null, blocked_by: null })
    .eq("id", memberId);
  if (updateError) return { error: updateError.message };

  const { error: banError } = await supabase.functions.invoke("block-member", {
    body: { memberId, banDuration: "none" },
  });
  if (banError) return { error: banError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Member unblocked." };
}
