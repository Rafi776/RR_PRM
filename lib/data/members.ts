"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MemberStatus } from "@/lib/types/domain";

export type MemberDirectoryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  bs_id: string | null;
  stage: string | null;
  scout_group: string | null;
  district: string | null;
  team_name: string | null;
  position: string | null;
  status: MemberStatus;
  blocked_at: string | null;
  blocked_reason: string | null;
};

export type MemberDirectoryFilters = {
  q?: string;
  team?: string;
  stage?: string;
  district?: string;
  status?: string;
};

// PostgREST's `.or()` filter string is comma-delimited — strip commas and
// parens from free-text search input so it can't break the filter syntax.
function sanitizeForFilter(value: string) {
  return value.replace(/[,()]/g, "").trim();
}

export async function listMembersDirectory(
  filters: MemberDirectoryFilters,
): Promise<MemberDirectoryRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("prm_members")
    .select(
      "id, full_name, email, phone, photo, bs_id, stage, scout_group, district, team_name, position, status, blocked_at, blocked_reason",
    )
    .order("full_name");

  const q = filters.q ? sanitizeForFilter(filters.q) : "";
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,bs_id.ilike.%${q}%`,
    );
  }
  if (filters.team) query = query.eq("team_name", filters.team);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getOwnProfile(memberId: string): Promise<MemberDirectoryRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prm_members")
    .select(
      "id, full_name, email, phone, photo, bs_id, stage, scout_group, district, team_name, position, status, blocked_at, blocked_reason",
    )
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type MemberDirectoryFilterOptions = {
  teams: string[];
  stages: string[];
  districts: string[];
};

export async function getMemberDirectoryFilterOptions(): Promise<MemberDirectoryFilterOptions> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prm_members")
    .select("team_name, stage, district");
  if (error) throw error;

  const dedupe = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim())))).sort();

  return {
    teams: dedupe((data ?? []).map((r) => r.team_name)),
    stages: dedupe((data ?? []).map((r) => r.stage)),
    districts: dedupe((data ?? []).map((r) => r.district)),
  };
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useMembersDirectory(filters: MemberDirectoryFilters) {
  return useQuery({
    queryKey: ["members-directory", filters],
    queryFn: () => listMembersDirectory(filters),
  });
}

export function useOwnProfile(memberId: string | undefined) {
  return useQuery({
    queryKey: ["own-profile", memberId],
    queryFn: () => getOwnProfile(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberDirectoryFilterOptions() {
  return useQuery({
    queryKey: ["member-directory-filter-options"],
    queryFn: getMemberDirectoryFilterOptions,
  });
}
