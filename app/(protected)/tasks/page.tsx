"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useTasksForUser, useTaskTypes } from "@/lib/data/tasks";
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
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { BulkImportTasksDialog } from "@/components/tasks/bulk-import-dialog";
import type { TaskStatus } from "@/lib/types/domain";

function statusBadge(status: TaskStatus | null) {
  if (!status) return <Badge variant="outline">Not assigned</Badge>;
  const variant =
    status === "selected"
      ? "success"
      : status === "rejected"
        ? "destructive"
        : status === "submitted"
          ? "warning"
          : "outline";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

export default function TasksPage() {
  const { data: user } = useCurrentUser();
  const { data: tasks = [] } = useTasksForUser(user?.id);
  const { data: teams = [] } = useTeams();
  const { data: taskTypes = [] } = useTaskTypes();
  if (!user) return null;

  const canManage = user.isSuperAdmin || user.leadershipTeamIds.length > 0;

  const manageableTeams = user.isSuperAdmin
    ? teams.filter((t) => !t.is_core_team)
    : teams.filter((t) => user.leadershipTeamIds.includes(t.id));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-muted-foreground">
            Track submissions and review status across teams.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <BulkImportTasksDialog />
            <CreateTaskDialog teams={manageableTeams} taskTypes={taskTypes} />
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All tasks</CardTitle>
          <CardDescription>Global tasks apply to every member.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border sm:hidden">
                {tasks.map((t) => (
                  <Link key={t.id} href={`/tasks/detail?id=${t.id}`} className="block p-3 active:bg-muted">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-primary">{t.title}</p>
                      {statusBadge(t.my_status)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.team_name ?? "Global"}
                      {t.assignee_name ? ` · ${t.assignee_name}` : ""} · {t.points} pts
                      {t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString()}` : ""}
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
                      <TableHead>Team</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>My status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link href={`/tasks/detail?id=${t.id}`} className="font-medium text-primary hover:underline">
                            {t.title}
                          </Link>
                        </TableCell>
                        <TableCell>{t.team_name ?? <span className="text-muted-foreground">Global</span>}</TableCell>
                        <TableCell>{t.assignee_name ?? <span className="text-muted-foreground">Everyone</span>}</TableCell>
                        <TableCell>{t.points}</TableCell>
                        <TableCell>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(t.my_status)}</TableCell>
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
