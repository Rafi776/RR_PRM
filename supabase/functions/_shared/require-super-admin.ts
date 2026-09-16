import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Verifies the caller (via their own JWT, forwarded automatically by
// supabase.functions.invoke) is a signed-in Super Admin, using an
// anon-scoped client so RLS/the is_super_admin() function does the real
// check — never trust a client-supplied "isSuperAdmin" flag. Returns
// the caller's user id on success, or a Response to return immediately
// on failure.
export async function requireSuperAdmin(
  req: Request,
): Promise<{ userId: string } | Response> {
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

  return { userId: user.id };
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
