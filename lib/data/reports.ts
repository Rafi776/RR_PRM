"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ReportStatus = "open" | "reviewed" | "dismissed";

export type MemberReportRow = {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_member_id: string;
  reported_name: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
};

// RLS (member_reports_select_own_or_admin, 0007) does the real
// filtering: a regular member's query only ever returns rows where
// they're the reporter; a Super Admin's returns everything. Same query
// for both — visibility is enforced at the database, not here.
export async function listVisibleReports(): Promise<MemberReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("member_reports")
    .select(
      "id, reporter_id, reported_member_id, reason, details, status, created_at, reviewed_at, reporter:prm_members!member_reports_reporter_id_fkey(full_name), reported:prm_members!member_reports_reported_member_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type NameField = { full_name: string } | { full_name: string }[] | null;
  const resolveName = (field: NameField) => {
    const single = Array.isArray(field) ? field[0] : field;
    return single?.full_name ?? "Unknown";
  };

  return (data ?? []).map((row) => ({
    id: row.id,
    reporter_id: row.reporter_id,
    reporter_name: resolveName(row.reporter as NameField),
    reported_member_id: row.reported_member_id,
    reported_name: resolveName(row.reported as NameField),
    reason: row.reason,
    details: row.details,
    status: row.status as ReportStatus,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  }));
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useVisibleReports() {
  return useQuery({ queryKey: ["visible-reports"], queryFn: listVisibleReports });
}
