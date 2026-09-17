import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Verifies the caller (via their own JWT, forwarded automatically by
// supabase.functions.invoke) is a signed-in Super Admin, using an
// anon-scoped client so RLS/the is_super_admin() function does the real
// check — never trust a client-supplied "isSuperAdmin" flag or org id.
// Also resolves the caller's organization_id the same way (via
// public.current_org_id(), derived server-side from their own
// prm_members row) so callers of this function operate strictly within
// their own org. Returns the caller's user id + org id on success, or a
// Response to return immediately on failure.
export async function requireSuperAdmin(
  req: Request,
): Promise<{ userId: string; organizationId: string } | Response> {
  const { jsonResponse } = await import("./cors.ts");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Not authenticated." }, 401);

  const anonClient: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await anonClient.auth.getUser();
  if (!user) return jsonResponse({ error: "Not authenticated." }, 401);

  const { data: isAdmin } = await anonClient.rpc("is_super_admin");
  if (!isAdmin) return jsonResponse({ error: "Not authorized." }, 403);

  const { data: organizationId } = await anonClient.rpc("current_org_id");
  if (!organizationId) return jsonResponse({ error: "No organization found for caller." }, 403);

  return { userId: user.id, organizationId };
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
