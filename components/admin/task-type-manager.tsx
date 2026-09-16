"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createTaskType,
  updateTaskType,
  deleteTaskType,
} from "@/lib/actions/task-types";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

const initial: ActionResult = { error: null };

function TaskTypeRow({ taskType }: { taskType: { id: string; name: string; default_points: number } }) {
  const [name, setName] = useState(taskType.name);
  const [points, setPoints] = useState(String(taskType.default_points));
  const [updateState, updateAction, updatePending] = useActionState(updateTaskType, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTaskType, initial);

  useEffect(() => {
    if (updateState.success) toast.success(updateState.success);
    if (updateState.error) toast.error(updateState.error);
  }, [updateState.success, updateState.error]);

  useEffect(() => {
    if (deleteState.success) toast.success(deleteState.success);
    if (deleteState.error) toast.error(deleteState.error);
  }, [deleteState.success, deleteState.error]);

  const dirty = name !== taskType.name || points !== String(taskType.default_points);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-40"
        aria-label="Task type name"
      />
      <Input
        type="number"
        step="0.5"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="h-8 w-24"
        aria-label="Default points"
      />
      {dirty ? (
        <form action={updateAction}>
          <input type="hidden" name="id" value={taskType.id} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="defaultPoints" value={points} />
          <Button type="submit" size="sm" variant="outline" disabled={updatePending}>
            {updatePending ? "Saving..." : "Save"}
          </Button>
        </form>
      ) : null}
      <form action={deleteAction} className="ml-auto">
        <input type="hidden" name="id" value={taskType.id} />
        <Button type="submit" size="icon" variant="ghost" disabled={deletePending}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </form>
    </div>
  );
}

export function TaskTypeManager({
  taskTypes,
}: {
  taskTypes: { id: string; name: string; default_points: number }[];
}) {
  const [createState, createAction, createPending] = useActionState(createTaskType, initial);

  useEffect(() => {
    if (createState.success) toast.success(createState.success);
    if (createState.error) toast.error(createState.error);
  }, [createState.success, createState.error]);

  return (
    <div className="space-y-3">
      {taskTypes.map((tt) => (
        <TaskTypeRow key={tt.id} taskType={tt} />
      ))}
      {taskTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No task types yet.</p>
      ) : null}

      <form action={createAction} className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="space-y-1">
          <Label htmlFor="new-type-name" className="text-xs">
            New task type
          </Label>
          <Input id="new-type-name" name="name" placeholder="e.g. Blog Post" className="h-8 w-40" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-type-points" className="text-xs">
            Default points
          </Label>
          <Input
            id="new-type-points"
            name="defaultPoints"
            type="number"
            step="0.5"
            defaultValue="0"
            className="h-8 w-24"
          />
        </div>
        <Button type="submit" size="sm" disabled={createPending}>
          <Plus className="mr-1 h-4 w-4" />
          {createPending ? "Adding..." : "Add"}
        </Button>
      </form>
    </div>
  );
}
