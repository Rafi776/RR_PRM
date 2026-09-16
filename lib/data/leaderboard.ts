import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PerformanceRow, TeamPerformanceRow } from "@/lib/types/domain";

export async function getGlobalLeaderboard(): Promise<PerformanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_performance_ranking")
    .select("*")
    .order("global_rank");
  if (error) throw error;
  return data ?? [];
}

export async function getTeamLeaderboard(teamId: string): Promise<TeamPerformanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_performance_ranking")
    .select("*")
    .eq("team_id", teamId)
    .order("team_rank");
  if (error) throw error;
  return data ?? [];
}
