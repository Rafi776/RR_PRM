"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberDetailDialog } from "@/components/members/member-detail-dialog";
import type { MemberDirectoryRow } from "@/lib/data/members";
import { ChevronRight } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MemberDirectoryTable({
  members,
  currentUserId,
  canManage,
  isSuperAdmin,
}: {
  members: MemberDirectoryRow[];
  currentUserId: string;
  canManage: boolean;
  isSuperAdmin: boolean;
}) {
  const [selected, setSelected] = useState<MemberDirectoryRow | null>(null);

  if (members.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No members match these filters.</p>;
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="divide-y rounded-lg border sm:hidden">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m)}
            className="flex w-full items-center gap-3 p-3 text-left active:bg-muted"
          >
            <Avatar className="h-10 w-10 shrink-0">
              {m.photo ? <AvatarImage src={m.photo} alt={m.full_name} /> : null}
              <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{m.full_name}</p>
                <Badge variant={m.status === "active" ? "default" : "secondary"} className="shrink-0">
                  {m.status}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[m.team_name, m.stage, m.district].filter(Boolean).join(" · ") || "No details on file"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>District</TableHead>
              <TableHead>BS ID</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {m.photo ? <AvatarImage src={m.photo} alt={m.full_name} /> : null}
                      <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{m.team_name ?? "—"}</TableCell>
                <TableCell>{m.stage ?? "—"}</TableCell>
                <TableCell>{m.district ?? "—"}</TableCell>
                <TableCell>{m.bs_id ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <MemberDetailDialog
          member={selected}
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
          canEditPhoto={canManage || selected.id === currentUserId}
          isSuperAdmin={isSuperAdmin}
          isSelf={selected.id === currentUserId}
        />
      ) : null}
    </>
  );
}
