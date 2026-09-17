import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

export type CreateMeetingResult = ActionResult & { meetingId?: string };

export async function createMeeting(
  _prev: CreateMeetingResult,
  formData: FormData,
): Promise<CreateMeetingResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const scope = String(formData.get("scope") ?? "team") as "central_core" | "team";
  const teamId = scope === "team" ? String(formData.get("teamId") ?? "") || null : null;
  const title = String(formData.get("title") ?? "").trim();
  const meetingDate = String(formData.get("meetingDate") ?? "");
  const agenda = String(formData.get("agenda") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (!title || !meetingDate) return { error: "Title and date are required." };
  if (scope === "team" && !teamId) return { error: "Select a team for a team meeting." };
  if (scope === "central_core" && !user.isCoreTeam) {
    return { error: "Only Core Team members can log central meetings." };
  }
  if (scope === "team" && !user.isSuperAdmin && !user.leadershipTeamIds.includes(teamId!)) {
    return { error: "Not authorized for this team." };
  }

  const supabase = createClient();

  const { data: created, error } = await supabase
    .from("team_meeting_minutes")
    .insert({
      scope,
      team_id: teamId,
      organization_id: user.organizationId,
      title,
      meeting_date: meetingDate,
      agenda: agenda || null,
      summary: summary || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const path = `${created.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("meeting-minutes")
      .upload(path, file, { contentType: file.type });
    if (!uploadError) {
      await supabase
        .from("team_meeting_minutes")
        .update({ attachment_url: path })
        .eq("id", created.id);
    }
  }

  queryClient.invalidateQueries();
  return { error: null, meetingId: created.id };
}

export async function saveAttendance(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const meetingId = String(formData.get("meetingId") ?? "");
  const memberIds = formData.getAll("memberId").map(String);
  if (!meetingId || memberIds.length === 0) return { error: "Nothing to save." };

  const rows = memberIds.map((memberId) => ({
    meeting_id: meetingId,
    member_id: memberId,
    organization_id: user.organizationId,
    status: String(formData.get(`status_${memberId}`) ?? "absent"),
  }));

  const supabase = createClient();
  const { error } = await supabase
    .from("meeting_attendance")
    .upsert(rows, { onConflict: "meeting_id,member_id" });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Attendance saved." };
}
