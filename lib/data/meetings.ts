"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MeetingScope, AttendanceStatus } from "@/lib/types/domain";

export type MeetingListRow = {
  id: string;
  title: string;
  scope: MeetingScope;
  team_id: string | null;
  team_name: string | null;
  meeting_date: string;
};

export async function listMeetings(): Promise<MeetingListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_meeting_minutes")
    .select("id, title, scope, team_id, meeting_date, teams(name)")
    .order("meeting_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((m) => {
    const team = m.teams as { name: string } | { name: string }[] | null;
    const teamSingle = Array.isArray(team) ? team[0] : team;
    return {
      id: m.id,
      title: m.title,
      scope: m.scope as MeetingScope,
      team_id: m.team_id,
      team_name: teamSingle?.name ?? null,
      meeting_date: m.meeting_date,
    };
  });
}

export async function getMeetingDetail(meetingId: string) {
  const supabase = createClient();
  const { data: meeting, error } = await supabase
    .from("team_meeting_minutes")
    .select("id, title, scope, team_id, meeting_date, agenda, summary, attachment_url, teams(name)")
    .eq("id", meetingId)
    .single();
  if (error) throw error;

  const team = meeting.teams as { name: string } | { name: string }[] | null;
  const teamSingle = Array.isArray(team) ? team[0] : team;

  // Roster: Core Team meetings roster the Core Team; team meetings roster
  // that team's members.
  let rosterTeamId = meeting.team_id;
  if (meeting.scope === "central_core") {
    const { data: coreTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("is_core_team", true)
      .single();
    rosterTeamId = coreTeam?.id ?? null;
  }

  const [{ data: roster }, { data: attendance }] = await Promise.all([
    rosterTeamId
      ? supabase
          .from("team_memberships")
          .select("member_id, prm_members(full_name, email)")
          .eq("team_id", rosterTeamId)
      : Promise.resolve({ data: [] }),
    supabase
      .from("meeting_attendance")
      .select("member_id, status")
      .eq("meeting_id", meetingId),
  ]);

  const attendanceMap = new Map(
    (attendance ?? []).map((a) => [a.member_id, a.status as AttendanceStatus]),
  );

  const rosterRows = (roster ?? []).map((r) => {
    const pm = r.prm_members as
      | { full_name: string; email: string }
      | { full_name: string; email: string }[]
      | null;
    const single = Array.isArray(pm) ? pm[0] : pm;
    return {
      member_id: r.member_id,
      full_name: single?.full_name ?? "Unknown",
      email: single?.email ?? "",
      status: attendanceMap.get(r.member_id) ?? ("absent" as AttendanceStatus),
    };
  });

  return {
    meeting: { ...meeting, team_name: teamSingle?.name ?? null },
    roster: rosterRows,
  };
}

export async function getSignedMinutesUrl(filePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("meeting-minutes")
    .createSignedUrl(filePath, 300);
  if (error) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useMeetings() {
  return useQuery({ queryKey: ["meetings"], queryFn: listMeetings });
}

export function useMeetingDetail(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["meeting-detail", meetingId],
    queryFn: () => getMeetingDetail(meetingId!),
    enabled: !!meetingId,
  });
}
