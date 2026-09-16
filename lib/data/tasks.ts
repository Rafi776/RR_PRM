"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TaskStatus } from "@/lib/types/domain";

export type TaskListRow = {
  id: string;
  title: string;
  team_id: string | null;
  team_name: string | null;
  points: number;
  due_date: string | null;
  my_status: TaskStatus | null;
};

export async function listTasksForUser(memberId: string): Promise<TaskListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_tasks")
    .select(
      "id, title, points, due_date, team_id, teams(name), task_member_status(status, member_id)",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((t) => {
    const team = t.teams as { name: string } | { name: string }[] | null;
    const teamSingle = Array.isArray(team) ? team[0] : team;
    const statuses = (t.task_member_status ?? []) as {
      status: TaskStatus;
      member_id: string;
    }[];
    const mine = statuses.find((s) => s.member_id === memberId);
    return {
      id: t.id,
      title: t.title,
      team_id: t.team_id,
      team_name: teamSingle?.name ?? null,
      points: t.points,
      due_date: t.due_date,
      my_status: mine?.status ?? null,
    };
  });
}

export async function getTaskTypes() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_types")
    .select("id, name, default_points")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTaskDetail(taskId: string) {
  const supabase = createClient();
  const { data: task, error } = await supabase
    .from("team_tasks")
    .select("id, title, description, points, due_date, team_id, teams(name)")
    .eq("id", taskId)
    .single();
  if (error) throw error;

  const team = task.teams as { name: string } | { name: string }[] | null;
  const teamSingle = Array.isArray(team) ? team[0] : team;

  const [{ data: statuses }, { data: comments }, { data: attachments }] = await Promise.all([
    supabase
      .from("task_member_status")
      .select("id, member_id, status, submission_url, submitted_at, prm_members(full_name, email)")
      .eq("task_id", taskId),
    supabase
      .from("task_comments")
      .select("id, comment, created_at, member_id, prm_members(full_name)")
      .eq("task_id", taskId)
      .order("created_at"),
    supabase
      .from("task_attachments")
      .select("id, file_name, file_path, member_id, uploaded_at")
      .eq("task_id", taskId)
      .order("uploaded_at"),
  ]);

  return {
    task: { ...task, team_name: teamSingle?.name ?? null },
    statuses: (statuses ?? []).map((s) => {
      const pm = s.prm_members as
        | { full_name: string; email: string }
        | { full_name: string; email: string }[]
        | null;
      const single = Array.isArray(pm) ? pm[0] : pm;
      return {
        id: s.id,
        member_id: s.member_id,
        status: s.status as TaskStatus,
        submission_url: s.submission_url,
        submitted_at: s.submitted_at,
        full_name: single?.full_name ?? "Unknown",
        email: single?.email ?? "",
      };
    }),
    comments: (comments ?? []).map((c) => {
      const pm = c.prm_members as { full_name: string } | { full_name: string }[] | null;
      const single = Array.isArray(pm) ? pm[0] : pm;
      return {
        id: c.id,
        comment: c.comment,
        created_at: c.created_at,
        author: single?.full_name ?? "Unknown",
      };
    }),
    attachments: attachments ?? [],
  };
}

export async function getSignedTaskAttachmentUrl(filePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(filePath, 300);
  if (error) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// react-query hooks
// ---------------------------------------------------------------------
export function useTasksForUser(memberId: string | undefined) {
  return useQuery({
    queryKey: ["tasks-for-user", memberId],
    queryFn: () => listTasksForUser(memberId!),
    enabled: !!memberId,
  });
}

export function useTaskTypes() {
  return useQuery({ queryKey: ["task-types"], queryFn: getTaskTypes });
}

export function useTaskDetail(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => getTaskDetail(taskId!),
    enabled: !!taskId,
  });
}
