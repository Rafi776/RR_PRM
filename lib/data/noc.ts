import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NocSubmission } from "@/lib/types/domain";

export async function getOwnNocs(memberId: string): Promise<NocSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("noc_submissions")
    .select("*")
    .eq("member_id", memberId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type NocReviewRow = NocSubmission & {
  member_name: string;
  member_email: string;
};

// Every NOC visible to the caller under RLS (their own team's members if
// they're leadership, or everyone if Core Team / Super Admin).
export async function getReviewQueue(): Promise<NocReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("noc_submissions")
    .select("*, prm_members(full_name, email)")
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const pm = row.prm_members as
      | { full_name: string; email: string }
      | { full_name: string; email: string }[]
      | null;
    const single = Array.isArray(pm) ? pm[0] : pm;
    return {
      ...row,
      member_name: single?.full_name ?? "Unknown",
      member_email: single?.email ?? "",
    };
  });
}

export async function getSignedNocUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("nocs")
    .createSignedUrl(filePath, 300);
  if (error) return null;
  return data.signedUrl;
}
