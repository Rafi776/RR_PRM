"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { saveAttendance } from "@/lib/actions/meetings";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttendanceStatus } from "@/lib/types/domain";

const initial: ActionResult = { error: null };

const STATUSES: AttendanceStatus[] = ["present", "absent", "excused"];

export function AttendanceChecklist({
  meetingId,
  roster,
  readOnly,
}: {
  meetingId: string;
  roster: { member_id: string; full_name: string; email: string; status: AttendanceStatus }[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAttendance, initial);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(roster.map((r) => [r.member_id, r.status])),
  );

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  if (roster.length === 0) {
    return <p className="text-sm text-muted-foreground">No roster found for this meeting.</p>;
  }

  const AttendanceControl = ({ memberId }: { memberId: string }) =>
    readOnly ? (
      <span className="capitalize">{statuses[memberId]}</span>
    ) : (
      <Select
        value={statuses[memberId]}
        items={STATUSES.map((s) => ({ value: s, label: s }))}
        onValueChange={(v) => {
          if (v === null) return;
          setStatuses((prev) => ({ ...prev, [memberId]: v as AttendanceStatus }));
        }}
      >
        <SelectTrigger className="h-8 w-[140px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="meetingId" value={meetingId} />

      {/* Mobile: card list */}
      <div className="divide-y rounded-lg border sm:hidden">
        {roster.map((r) => (
          <div key={r.member_id} className="space-y-2 p-3">
            <div>
              <p className="font-medium">{r.full_name}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
              <input type="hidden" name="memberId" value={r.member_id} />
              <input type="hidden" name={`status_${r.member_id}`} value={statuses[r.member_id]} />
            </div>
            <AttendanceControl memberId={r.member_id} />
          </div>
        ))}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((r) => (
              <TableRow key={r.member_id}>
                <TableCell>
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell>
                  <AttendanceControl memberId={r.member_id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save attendance"}
        </Button>
      ) : null}
    </form>
  );
}
