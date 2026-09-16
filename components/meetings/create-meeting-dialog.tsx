"use client";

import { useActionState, useState } from "react";
import { createMeeting } from "@/lib/actions/meetings";
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

export function CreateMeetingDialog({
  teams,
  isCoreTeam,
}: {
  teams: { id: string; name: string }[];
  isCoreTeam: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createMeeting, initial);
  const [scope, setScope] = useState<"team" | "central_core">(teams.length ? "team" : "central_core");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" />
        Log meeting
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} encType="multipart/form-data">
          <DialogHeader>
            <DialogTitle>Log meeting minutes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => v && setScope(v as typeof scope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Team Meeting</SelectItem>
                  {isCoreTeam ? (
                    <SelectItem value="central_core">Central Core Meeting</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <input type="hidden" name="scope" value={scope} />
            </div>
            {scope === "team" ? (
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="teamId" value={teamId} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingDate">Date</Label>
              <Input id="meetingDate" name="meetingDate" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea id="agenda" name="agenda" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attachment">Minutes document (optional)</Label>
              <Input id="attachment" name="attachment" type="file" />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
