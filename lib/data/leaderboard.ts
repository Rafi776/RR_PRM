"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PerformanceRow, TeamPerformanceRow } from "@/lib/types/domain";

export async function getGlobalLeaderboard(): Promise<PerformanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("member_performance_ranking")
    .select("*")
    .order("global_rank");
  if (error) throw error;
  return data ?? [];
}

export async function getTeamLeaderboard(teamId: string): Promise<TeamPerformanceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_performance_ranking")
    .select("*")
    .eq("team_id", teamId)
    .order("team_rank");
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useGlobalLeaderboard() {
  return useQuery({ queryKey: ["global-leaderboard"], queryFn: getGlobalLeaderboard });
}

export function useTeamLeaderboard(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-leaderboard", teamId],
    queryFn: () => getTeamLeaderboard(teamId!),
    enabled: !!teamId,
  });
}
