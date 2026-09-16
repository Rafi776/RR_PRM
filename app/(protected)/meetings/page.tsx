"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useMeetings } from "@/lib/data/meetings";
import { useTeams } from "@/lib/data/teams";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";

export default function MeetingsPage() {
  const { data: user } = useCurrentUser();
  const { data: meetings = [] } = useMeetings();
  const { data: teams = [] } = useTeams();
  if (!user) return null;

  const canLog = user.isSuperAdmin || user.isCoreTeam || user.leadershipTeamIds.length > 0;

  const manageableTeams = user.isSuperAdmin
    ? teams.filter((t) => !t.is_core_team)
    : teams.filter((t) => user.leadershipTeamIds.includes(t.id));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meeting Minutes</h1>
          <p className="text-muted-foreground">Central Core and team meeting records.</p>
        </div>
        {canLog ? (
          <CreateMeetingDialog teams={manageableTeams} isCoreTeam={user.isCoreTeam} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All meetings</CardTitle>
          <CardDescription>Attendance feeds directly into the scoring engine.</CardDescription>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No meetings logged yet.</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border sm:hidden">
                {meetings.map((m) => (
                  <Link key={m.id} href={`/meetings/detail?id=${m.id}`} className="block p-3 active:bg-muted">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-primary">{m.title}</p>
                      {m.scope === "central_core" ? (
                        <Badge>Central Core</Badge>
                      ) : (
                        <Badge variant="secondary">{m.team_name}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(m.meeting_date).toLocaleString()}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Desktop / tablet: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link href={`/meetings/detail?id=${m.id}`} className="font-medium text-primary hover:underline">
                            {m.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {m.scope === "central_core" ? (
                            <Badge>Central Core</Badge>
                          ) : (
                            <Badge variant="secondary">{m.team_name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(m.meeting_date).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
