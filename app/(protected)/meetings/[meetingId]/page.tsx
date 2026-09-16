import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/data/session";
import { getMeetingDetail, getSignedMinutesUrl } from "@/lib/data/meetings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendanceChecklist } from "@/components/meetings/attendance-checklist";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const detail = await getMeetingDetail(meetingId).catch(() => null);
  if (!detail) notFound();

  const { meeting, roster } = detail;
  const canEditAttendance =
    user.isSuperAdmin ||
    (meeting.scope === "central_core" && user.isCoreTeam) ||
    (meeting.scope === "team" && meeting.team_id && user.leadershipTeamIds.includes(meeting.team_id));

  const attachmentUrl = meeting.attachment_url
    ? await getSignedMinutesUrl(meeting.attachment_url)
    : null;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{meeting.title}</h1>
          {meeting.scope === "central_core" ? (
            <Badge>Central Core</Badge>
          ) : (
            <Badge variant="secondary">{meeting.team_name}</Badge>
          )}
        </div>
        <p className="text-muted-foreground">{new Date(meeting.meeting_date).toLocaleString()}</p>
      </div>

      {meeting.agenda || meeting.summary || attachmentUrl ? (
        <Card>
          <CardHeader>
            <CardTitle>Minutes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {meeting.agenda ? (
              <div>
                <p className="text-sm font-medium">Agenda</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meeting.agenda}</p>
              </div>
            ) : null}
            {meeting.summary ? (
              <div>
                <p className="text-sm font-medium">Summary</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meeting.summary}</p>
              </div>
            ) : null}
            {attachmentUrl ? (
              <a href={attachmentUrl} target="_blank" className="text-sm text-primary hover:underline">
                Download minutes document
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Attendance ({roster.length})</CardTitle>
          <CardDescription>
            {canEditAttendance
              ? "Mark each member Present, Absent, or Excused."
              : "Attendance recorded for this meeting."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceChecklist meetingId={meetingId} roster={roster} readOnly={!canEditAttendance} />
        </CardContent>
      </Card>
    </div>
  );
}
