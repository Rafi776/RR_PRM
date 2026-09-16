import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireSuperAdmin, adminClient } from "../_shared/require-super-admin.ts";

type Row = Record<string, string>;

type Outcome =
  | { kind: "skip"; row: number; reason: string }
  | { kind: "imported"; email: string; link: string | null };

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

function randomTempPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Body: { rows: Row[], redirectOrigin: string }
// Reimplements the old bulkImportMembers server action: creates an auth
// account per row (no email sent — createUser, not inviteUserByEmail,
// so this isn't subject to Supabase's mailer rate limit), inserts the
// prm_members row, and generates a "set your password" recovery link
// (also no email sent) for the caller to distribute themselves.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResult = await requireSuperAdmin(req);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { rows, redirectOrigin } = (await req.json()) as {
    rows: Row[];
    redirectOrigin: string;
  };
  if (!Array.isArray(rows)) {
    return jsonResponse({ error: "Missing rows.", imported: 0, skipped: [], setupLinks: [] }, 400);
  }

  const recoveryRedirectTo = `${redirectOrigin}/auth/callback?redirectTo=/auth/set-password`;
  const admin = adminClient();

  const { data: existingRows } = await admin.from("prm_members").select("email");
  const existingEmails = new Set(
    (existingRows ?? []).map((r: { email: string }) => r.email.toLowerCase()),
  );

  const outcomes = await mapWithConcurrency(rows, 10, async (row, i): Promise<Outcome> => {
    const email = row.email?.trim();
    const fullName = (row.name ?? row.full_name)?.trim();

    if (!email || !fullName) {
      return { kind: "skip", row: i + 2, reason: "Missing name or email." };
    }
    if (existingEmails.has(email.toLowerCase())) {
      return { kind: "skip", row: i + 2, reason: "Already imported." };
    }

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

  console.log(`bulk-import-members: ${imported} imported by ${userId}`);

  return jsonResponse({ error: null, imported, skipped, setupLinks });
});
