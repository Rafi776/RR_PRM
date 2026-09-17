import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireSuperAdmin, adminClient } from "../_shared/require-super-admin.ts";

// Body: { email: string }
// For adding someone who ALREADY has a login (in another org) as a
// member of the caller's org too. bulk-import-members only handles
// brand-new emails (it fails on a duplicate, since Supabase Auth
// enforces one email per project) — this is the other half: find their
// existing auth account by email and give them a new prm_members row in
// this org, without touching their auth account at all.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResult = await requireSuperAdmin(req);
  if (authResult instanceof Response) return authResult;
  const { organizationId } = authResult;

  const { email } = await req.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return jsonResponse({ error: "Missing email." }, 400);

  const admin = adminClient();

  // The admin SDK has no direct "get user by email" — paginate through
  // listUsers looking for a case-insensitive match. Fine at this app's
  // scale (hundreds, not millions, of accounts); caps at 10k scanned.
  let targetUserId: string | null = null;
  for (let page = 1; page <= 10 && !targetUserId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return jsonResponse({ error: error.message }, 400);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (match) targetUserId = match.id;
    if (data.users.length < 1000) break; // last page
  }

  if (!targetUserId) {
    return jsonResponse(
      {
        error:
          "No account with that email exists on this platform — use bulk import to create a new account instead.",
      },
      404,
    );
  }

  const { data: existingMembership } = await admin
    .from("prm_members")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existingMembership) {
    return jsonResponse({ error: "This person is already a member of your organization." }, 409);
  }

  const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
  const fullName =
    (authUser?.user?.user_metadata?.full_name as string | undefined) ??
    authUser?.user?.email ??
    "New member";

  const { error: insertError } = await admin.from("prm_members").insert({
    user_id: targetUserId,
    organization_id: organizationId,
    full_name: fullName,
    email: authUser?.user?.email ?? normalizedEmail,
  });
  if (insertError) return jsonResponse({ error: insertError.message }, 400);

  return jsonResponse({ error: null });
});
