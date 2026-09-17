"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { getTaskDetail, getSignedTaskAttachmentUrl } from "@/lib/data/tasks";
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
import { SubmissionForm } from "@/components/tasks/submission-form";
import { ReviewStatusActions } from "@/components/tasks/review-status-actions";
import { CommentForm } from "@/components/tasks/comment-form";
import { AttachmentUpload } from "@/components/tasks/attachment-upload";
import type { TaskStatus } from "@/lib/types/domain";

function statusBadge(status: TaskStatus) {
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

function TaskDetailInner() {
  const taskId = useSearchParams().get("id") ?? undefined;
  const { data: user } = useCurrentUser();

  const { data: detail } = useQuery({
    queryKey: ["task-detail-full", taskId],
    queryFn: async () => {
      const d = await getTaskDetail(taskId!);
      const attachmentsWithUrl = await Promise.all(
        d.attachments.map(async (a) => ({ ...a, url: await getSignedTaskAttachmentUrl(a.file_path) })),
      );
      return { ...d, attachmentsWithUrl };
    },
    enabled: !!taskId,
  });

  if (!user || !taskId) return null;
  if (!detail) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  const { task, statuses, comments, attachmentsWithUrl } = detail;
  const canReview =
    user.isSuperAdmin || (task.team_id && user.leadershipTeamIds.includes(task.team_id));
  const myStatus = statuses.find((s) => s.member_id === user.memberId);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          <Badge variant="outline">{task.points} pts</Badge>
        </div>
        <p className="text-muted-foreground">
          {task.team_name ?? "Global task"}
          {task.assignee_name ? ` · Assigned to ${task.assignee_name}` : ""}
          {task.due_date ? ` · Due ${new Date(task.due_date).toLocaleDateString()}` : ""}
        </p>
        {task.description ? <p className="mt-3 whitespace-pre-wrap">{task.description}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your submission</CardTitle>
          {myStatus ? <CardDescription>Status: {statusBadge(myStatus.status)}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <SubmissionForm taskId={taskId} currentUrl={myStatus?.submission_url ?? null} />
        </CardContent>
      </Card>

      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Submissions ({statuses.length})</CardTitle>
            <CardDescription>Review and select/reject member submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="divide-y rounded-lg border md:hidden">
              {statuses.map((s) => (
                <div key={s.id} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                  {s.submission_url ? (
                    <a
                      href={s.submission_url}
                      target="_blank"
                      className="text-sm text-primary hover:underline"
                    >
                      View submission
                    </a>
                  ) : null}
                  {s.status === "submitted" ? (
                    <ReviewStatusActions taskId={taskId} memberId={s.member_id} />
                  ) : null}
                </div>
              ))}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statuses.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </TableCell>
                      <TableCell>
                        {s.submission_url ? (
                          <a
                            href={s.submission_url}
                            target="_blank"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="text-right">
                        {s.status === "submitted" ? (
                          <ReviewStatusActions taskId={taskId} memberId={s.member_id} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AttachmentUpload taskId={taskId} />
          <ul className="space-y-1">
            {attachmentsWithUrl.map((a) => (
              <li key={a.id} className="text-sm">
                {a.url ? (
                  <a href={a.url} target="_blank" className="text-primary hover:underline">
                    {a.file_name}
                  </a>
                ) : (
                  a.file_name
                )}
              </li>
            ))}
            {attachmentsWithUrl.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attachments yet.</p>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{c.comment}</p>
              </li>
            ))}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : null}
          </ul>
          <CommentForm taskId={taskId} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={null}>
      <TaskDetailInner />
    </Suspense>
  );
}
