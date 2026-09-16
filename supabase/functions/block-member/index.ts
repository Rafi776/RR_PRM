import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireSuperAdmin, adminClient } from "../_shared/require-super-admin.ts";

// Body: { memberId: string, banDuration: string }
// banDuration: a Supabase Auth ban duration string ("87600h" to block,
// "none" to unblock). The prm_members.status/blocked_* columns are
// updated by the caller directly (RLS already permits a Super Admin to
// do that) — this function only does the half that requires the
// service-role key: banning the auth account itself.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResult = await requireSuperAdmin(req);
  if (authResult instanceof Response) return authResult;

  const { memberId, banDuration } = await req.json();
  if (!memberId || !banDuration) {
    return jsonResponse({ error: "Missing memberId or banDuration." }, 400);
  }

  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(memberId, {
    ban_duration: banDuration,
  });
  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ error: null });
});
