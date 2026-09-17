"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { NocStatus, NocSubmission, NocType } from "@/lib/types/domain";

export async function getOwnNocs(memberId: string): Promise<NocSubmission[]> {
  const supabase = createClient();
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
  member_team_name: string | null;
};

// Every NOC visible to the caller under RLS (their own team's members if
// they're leadership, or everyone if Core Team / Super Admin).
export async function getReviewQueue(): Promise<NocReviewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("noc_submissions")
    .select("*, prm_members(full_name, email, team_name)")
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const pm = row.prm_members as
      | { full_name: string; email: string; team_name: string | null }
      | { full_name: string; email: string; team_name: string | null }[]
      | null;
    const single = Array.isArray(pm) ? pm[0] : pm;
    return {
      ...row,
      member_name: single?.full_name ?? "Unknown",
      member_email: single?.email ?? "",
      member_team_name: single?.team_name ?? null,
    };
  });
}

export type MemberNocStatus = { district: NocStatus | null; unit: NocStatus | null };

// A compact per-member "latest status per type" map — drives the NOC tag
// shown in the Members directory. Visible only for the members a reviewer
// can see under RLS (their team, or everyone for Core Team/Super Admin);
// for a plain member this comes back covering just themselves.
export async function getNocStatusByMember(): Promise<Record<string, MemberNocStatus>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("noc_submissions")
    .select("member_id, noc_type, status, submitted_at")
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  const map: Record<string, MemberNocStatus> = {};
  for (const row of data ?? []) {
    if (!map[row.member_id]) map[row.member_id] = { district: null, unit: null };
    const type = row.noc_type as NocType;
    // Rows are newest-first, so the first one seen per type is the latest.
    if (map[row.member_id][type] === null) {
      map[row.member_id][type] = row.status;
    }
  }
  return map;
}

export async function getSignedNocUrl(filePath: string) {
  // Bulk-imported rows (see bulkImportNocs) store an external link
  // directly in file_path rather than a Storage object path — nothing
  // to sign, just use it as-is.
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("nocs")
    .createSignedUrl(filePath, 300);
  if (error) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useOwnNocs(memberId: string | undefined) {
  return useQuery({
    queryKey: ["own-nocs", memberId],
    queryFn: () => getOwnNocs(memberId!),
    enabled: !!memberId,
  });
}

export function useReviewQueue(enabled: boolean) {
  return useQuery({ queryKey: ["noc-review-queue"], queryFn: getReviewQueue, enabled });
}

export function useNocStatusByMember(enabled: boolean) {
  return useQuery({
    queryKey: ["noc-status-by-member"],
    queryFn: getNocStatusByMember,
    enabled,
  });
}
