"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createTask } from "@/lib/actions/tasks";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const initial: ActionResult = { error: null };

export function CreateTaskDialog({
  teams,
  taskTypes,
}: {
  teams: { id: string; name: string }[];
  taskTypes: { id: string; name: string; default_points: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTask, initial);
  const [teamId, setTeamId] = useState("global");
  const [taskTypeId, setTaskTypeId] = useState("none");
  const [points, setPoints] = useState("0");

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setOpen(false);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" />
        New task
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input type="hidden" name="teamId" value={teamId === "global" ? "" : teamId} />
            <input type="hidden" name="taskTypeId" value={taskTypeId === "none" ? "" : taskTypeId} />
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "global")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (all members)</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task type</Label>
                <Select
                  value={taskTypeId}
                  onValueChange={(v) => {
                    if (v === null) return;
                    setTaskTypeId(v);
                    const tt = taskTypes.find((t) => t.id === v);
                    if (tt) setPoints(String(tt.default_points));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Untyped</SelectItem>
                    {taskTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.default_points} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  step="0.5"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
