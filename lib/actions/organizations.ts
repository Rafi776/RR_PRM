import { createClient } from "@/lib/supabase/client";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

// Switches which of the caller's organizations is "active." RLS
// (user_active_organization_upsert_own/_update_own, 0015) independently
// rejects switching into an org the caller has no membership row in —
// this is the real boundary, not just a UI restriction.
export async function switchActiveOrganization(organizationId: string): Promise<ActionResult> {
  if (!organizationId) return { error: "Missing organization." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("user_active_organization")
    .upsert({ user_id: user.id, organization_id: organizationId }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  // Every cached query in the app is scoped to whichever org was active
  // when it was fetched — nothing here is safe to keep after a switch.
  await queryClient.invalidateQueries();
  await queryClient.refetchQueries({ queryKey: ["current-user"] });
  await queryClient.refetchQueries({ queryKey: ["auth-status"] });

  return { error: null, success: "Switched organization." };
}
