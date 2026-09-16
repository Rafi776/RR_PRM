import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

export async function uploadNoc(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return { error: "Only PDF or image files are accepted." };
  }

  const supabase = createClient();
  const path = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("nocs")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("noc_submissions").insert({
    member_id: user.id,
    file_path: path,
    file_name: file.name,
    status: "pending",
  });
  if (insertError) return { error: insertError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "NOC uploaded — pending review." };
}

export async function reviewNoc(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const nocId = String(formData.get("nocId") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "approved" | "rejected"
  const rejectionReason = String(formData.get("rejectionReason") ?? "");

  if (!nocId || !["approved", "rejected"].includes(decision)) {
    return { error: "Invalid review submission." };
  }
  if (decision === "rejected" && !rejectionReason.trim()) {
    return { error: "A rejection reason is required." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("noc_submissions")
    .update({
      status: decision,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      rejection_reason: decision === "rejected" ? rejectionReason : null,
    })
    .eq("id", nocId);

  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `NOC ${decision}.` };
}
