import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

export async function fileReport(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const reportedMemberId = String(formData.get("reportedMemberId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();

  if (!reportedMemberId) return { error: "Missing member." };
  if (reportedMemberId === user.id) return { error: "You can't report yourself." };
  if (!reason) return { error: "A reason is required." };

  const supabase = createClient();
  const { error } = await supabase.from("member_reports").insert({
    reporter_id: user.id,
    reported_member_id: reportedMemberId,
    reason,
    details: details || null,
  });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Report submitted. Only you and admins can see it." };
}

export async function reviewReport(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? ""); // "reviewed" | "dismissed"
  if (!reportId || !["reviewed", "dismissed"].includes(status)) {
    return { error: "Invalid update." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("member_reports")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", reportId);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Report updated." };
}
