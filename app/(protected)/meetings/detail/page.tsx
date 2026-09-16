"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
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

function MeetingDetailInner() {
  const meetingId = useSearchParams().get("id") ?? undefined;
  const { data: user } = useCurrentUser();

  const { data: detail } = useQuery({
    queryKey: ["meeting-detail-full", meetingId],
    queryFn: async () => {
      const d = await getMeetingDetail(meetingId!);
      const attachmentUrl = d.meeting.attachment_url
        ? await getSignedMinutesUrl(d.meeting.attachment_url)
        : null;
      return { ...d, attachmentUrl };
    },
    enabled: !!meetingId,
  });

  if (!user || !meetingId) return null;
  if (!detail) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  const { meeting, roster, attachmentUrl } = detail;
  const canEditAttendance =
    user.isSuperAdmin ||
    (meeting.scope === "central_core" && user.isCoreTeam) ||
    (meeting.scope === "team" && meeting.team_id && user.leadershipTeamIds.includes(meeting.team_id));

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

export default function MeetingDetailPage() {
  return (
    <Suspense fallback={null}>
      <MeetingDetailInner />
    </Suspense>
  );
}
