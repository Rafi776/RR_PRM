import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

export async function createTaskType(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const defaultPoints = Number(formData.get("defaultPoints") ?? 0);
  if (!name) return { error: "Name is required." };

  const supabase = createClient();
  const { error } = await supabase
    .from("task_types")
    .insert({ name, default_points: defaultPoints });
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `Task type "${name}" created.` };
}

export async function updateTaskType(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const defaultPoints = Number(formData.get("defaultPoints") ?? 0);
  if (!id || !name) return { error: "Missing fields." };

  const supabase = createClient();
  const { error } = await supabase
    .from("task_types")
    .update({ name, default_points: defaultPoints })
    .eq("id", id);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Task type updated." };
}

export async function deleteTaskType(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin) return { error: "Not authorized." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing task type." };

  const supabase = createClient();
  const { error } = await supabase.from("task_types").delete().eq("id", id);
  if (error) {
    // Foreign key from team_tasks.task_type_id will block deletion of a
    // type that's in use — surface that plainly rather than a raw
    // Postgres constraint message.
    if (error.code === "23503") {
      return { error: "Can't delete — one or more tasks still use this type." };
    }
    return { error: error.message };
  }

  queryClient.invalidateQueries();
  return { error: null, success: "Task type deleted." };
}
