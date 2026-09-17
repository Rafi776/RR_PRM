import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireSuperAdmin, adminClient } from "../_shared/require-super-admin.ts";

// Body: { userId: string, banDuration: string }
// userId is the target's AUTH user id (auth.users.id) — NOT a
// prm_members.id, since one login can now hold a membership row in more
// than one org. banDuration is a Supabase Auth ban duration string
// ("87600h" to block, "none" to unblock). The prm_members.status/
// blocked_* columns are updated by the caller directly (RLS already
// permits a Super Admin to do that) — this function only does the half
// that requires the service-role key: banning the auth account itself.
//
// Note: banning is at the AUTH ACCOUNT level, which is shared across
// every org that person belongs to — blocking them in one org blocks
// their login everywhere, not just here. There's no per-org sign-in
// restriction in this release (each org's own `blocked_at` still keeps
// them out of THAT org's data even without a ban, via RLS/AuthGuard, but
// a ban additionally locks their login entirely).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResult = await requireSuperAdmin(req);
  if (authResult instanceof Response) return authResult;
  const { organizationId } = authResult;

  const { userId, banDuration } = await req.json();
  if (!userId || !banDuration) {
    return jsonResponse({ error: "Missing userId or banDuration." }, 400);
  }

  const admin = adminClient();

  // A Super Admin's power stops at their own org — verify the target
  // actually holds a membership in it before touching their auth
  // account (this call uses the service-role key, so RLS doesn't apply
  // here; this is the only thing standing between it and a cross-org
  // ban).
  const { data: target } = await admin
    .from("prm_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!target) {
    return jsonResponse({ error: "Member not found in your organization." }, 404);
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  });
  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ error: null });
});
