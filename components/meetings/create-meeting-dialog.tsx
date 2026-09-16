"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting, type CreateMeetingResult } from "@/lib/actions/meetings";
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

const initial: CreateMeetingResult = { error: null };

export function CreateMeetingDialog({
  teams,
  isCoreTeam,
}: {
  teams: { id: string; name: string }[];
  isCoreTeam: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createMeeting, initial);

  useEffect(() => {
    if (state.meetingId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setOpen(false);
      router.push(`/meetings/detail?id=${state.meetingId}`);
    }
  }, [state.meetingId, router]);
  const [scope, setScope] = useState<"team" | "central_core">(teams.length ? "team" : "central_core");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-1 h-4 w-4" />
        Log meeting
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Log meeting minutes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={scope}
                items={[
                  { value: "team", label: "Team Meeting" },
                  ...(isCoreTeam ? [{ value: "central_core", label: "Central Core Meeting" }] : []),
                ]}
                onValueChange={(v) => v && setScope(v as typeof scope)}
              >
                <SelectTrigger className="w-full">
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
                <Select
                  value={teamId}
                  items={teams.map((t) => ({ value: t.id, label: t.name }))}
                  onValueChange={(v) => setTeamId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
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
