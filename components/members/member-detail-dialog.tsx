"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PhotoEditor } from "@/components/members/photo-editor";
import { BlockMemberControl } from "@/components/members/block-member-control";
import { ReportMemberDialog } from "@/components/members/report-member-dialog";
import type { MemberDirectoryRow } from "@/lib/data/members";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function MemberDetailDialog({
  member,
  open,
  onOpenChange,
  canEditPhoto,
  isSuperAdmin,
  isSelf,
}: {
  member: MemberDirectoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEditPhoto: boolean;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Member details</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {member.photo ? <AvatarImage src={member.photo} alt={member.full_name} /> : null}
              <AvatarFallback className="text-lg">{initials(member.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{member.full_name}</p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <Badge
                variant={member.status === "active" ? "default" : "secondary"}
                className="mt-1"
              >
                {member.status}
              </Badge>
            </div>
          </div>
          {!isSelf ? <ReportMemberDialog memberId={member.id} fullName={member.full_name} /> : null}
        </div>

        {canEditPhoto ? (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Change photo</p>
            <PhotoEditor memberId={member.id} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Phone" value={member.phone} />
          <Field label="BS ID" value={member.bs_id} />
          <Field label="Stage" value={member.stage} />
          <Field label="Scout Group" value={member.scout_group} />
          <Field label="District" value={member.district} />
          <Field label="Team" value={member.team_name} />
          <Field label="Position" value={member.position} />
        </div>

        {isSuperAdmin && !isSelf ? (
          <BlockMemberControl
            memberId={member.id}
            fullName={member.full_name}
            blockedAt={member.blocked_at}
            blockedReason={member.blocked_reason}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
