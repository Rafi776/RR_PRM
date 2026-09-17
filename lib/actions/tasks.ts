import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";
import { parseTabularFile } from "@/lib/utils/parse-tabular";

async function seedMemberStatusesForTask(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
  organizationId: string,
  teamId: string | null,
  assigneeId: string | null,
) {
  // Assigned to one specific member: seed just that row, regardless of
  // team size.
  if (assigneeId) {
    await supabase.from("task_member_status").upsert(
      { task_id: taskId, member_id: assigneeId, organization_id: organizationId, status: "not_submitted" },
      { onConflict: "task_id,member_id", ignoreDuplicates: true },
    );
    return;
  }

  if (!teamId) return; // global task: members opt in by submitting directly
  const { data: members } = await supabase
    .from("team_memberships")
    .select("member_id")
    .eq("team_id", teamId);

  if (!members?.length) return;

  await supabase.from("task_member_status").upsert(
    members.map((m) => ({
      task_id: taskId,
      member_id: m.member_id,
      organization_id: organizationId,
      status: "not_submitted",
    })),
    { onConflict: "task_id,member_id", ignoreDuplicates: true },
  );
}

export async function createTask(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "") || null;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const taskTypeId = String(formData.get("taskTypeId") ?? "") || null;
  const points = Number(formData.get("points") ?? 0);
  const dueDate = String(formData.get("dueDate") ?? "") || null;

  if (!title) return { error: "Title is required." };
  if (teamId && !user.isSuperAdmin && !user.leadershipTeamIds.includes(teamId)) {
    return { error: "Not authorized for this team." };
  }

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from("team_tasks")
    .insert({
      title,
      description: description || null,
      team_id: teamId,
      assignee_id: assigneeId,
      task_type_id: taskTypeId,
      organization_id: user.organizationId,
      points,
      due_date: dueDate,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await seedMemberStatusesForTask(supabase, created.id, user.organizationId, teamId, assigneeId);

  queryClient.invalidateQueries();
  return { error: null, success: `Task "${title}" created.` };
}

// ---------------------------------------------------------------------
// Bulk CSV task import.
// Columns: title, description, team_slug (optional -> global if blank),
// task_type (optional, matches task_types.name), points, due_date (ISO)
// ---------------------------------------------------------------------
export type BulkTaskImportResult = {
  error: string | null;
  imported: number;
  skipped: { row: number; reason: string }[];
};

export async function bulkImportTasks(
  _prev: BulkTaskImportResult,
  formData: FormData,
): Promise<BulkTaskImportResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin && !(user && user.leadershipTeamIds.length > 0)) {
    return { error: "Not authorized.", imported: 0, skipped: [] };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file uploaded.", imported: 0, skipped: [] };
  }

  const { data: rows, error: parseError } = await parseTabularFile(file);
  if (parseError) return { error: parseError, imported: 0, skipped: [] };

  const supabase = createClient();
  const [{ data: teams }, { data: taskTypes }] = await Promise.all([
    supabase.from("teams").select("id, slug"),
    supabase.from("task_types").select("id, name, default_points"),
  ]);

  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.title?.trim();
    if (!title) {
      skipped.push({ row: i + 2, reason: "Missing title." });
      continue;
    }

    const teamSlug = row.team_slug?.trim();
    const team = teamSlug ? teams?.find((t) => t.slug === teamSlug) : null;
    if (teamSlug && !team) {
      skipped.push({ row: i + 2, reason: `Unknown team_slug "${teamSlug}".` });
      continue;
    }
    if (team && !user!.isSuperAdmin && !user!.leadershipTeamIds.includes(team.id)) {
      skipped.push({ row: i + 2, reason: `Not authorized for team "${teamSlug}".` });
      continue;
    }

    const taskTypeName = row.task_type?.trim();
    const taskType = taskTypeName ? taskTypes?.find((t) => t.name === taskTypeName) : null;
    const points = row.points ? Number(row.points) : taskType?.default_points ?? 0;

    const { data: created, error } = await supabase
      .from("team_tasks")
      .insert({
        title,
        description: row.description?.trim() || null,
        team_id: team?.id ?? null,
        task_type_id: taskType?.id ?? null,
        organization_id: user!.organizationId,
        points,
        due_date: row.due_date?.trim() || null,
        created_by: user!.id,
      })
      .select("id")
      .single();

    if (error) {
      skipped.push({ row: i + 2, reason: error.message });
      continue;
    }

    await seedMemberStatusesForTask(supabase, created.id, user!.organizationId, team?.id ?? null, null);
    imported++;
  }

  queryClient.invalidateQueries();
  return { error: null, imported, skipped };
}

// RLS (team_tasks_modify_leadership_or_admin, 0002) restricts this to a
// Super Admin, or a team's leadership for that team's own tasks — global
// tasks (team_id null) can only be deleted by a Super Admin.
export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!taskId) return { error: "Missing task." };

  const supabase = createClient();
  const { error } = await supabase.from("team_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Task deleted." };
}

export async function submitTask(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const taskId = String(formData.get("taskId") ?? "");
  const submissionUrl = String(formData.get("submissionUrl") ?? "").trim();
  if (!taskId) return { error: "Missing task." };

  const supabase = createClient();
  const { error } = await supabase.from("task_member_status").upsert(
    {
      task_id: taskId,
      member_id: user.memberId,
      organization_id: user.organizationId,
      status: "submitted",
      submission_url: submissionUrl || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "task_id,member_id" },
  );
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Submission recorded." };
}

export async function reviewTaskStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const taskId = String(formData.get("taskId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? ""); // "selected" | "rejected"
  if (!taskId || !memberId || !["selected", "rejected"].includes(status)) {
    return { error: "Invalid review submission." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("task_member_status")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("member_id", memberId);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `Marked ${status}.` };
}

export async function addTaskComment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const taskId = String(formData.get("taskId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!taskId || !comment) return { error: "Comment cannot be empty." };

  const supabase = createClient();
  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, member_id: user.memberId, organization_id: user.organizationId, comment });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null };
}

export async function addTaskAttachment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");
  if (!taskId || !(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file." };
  }

  const supabase = createClient();
  const path = `${taskId}/${user.memberId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    member_id: user.memberId,
    organization_id: user.organizationId,
    file_path: path,
    file_name: file.name,
  });
  if (insertError) return { error: insertError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Attachment uploaded." };
}
