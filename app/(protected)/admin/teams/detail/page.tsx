"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useTeam, useTeamMembers, useAllMembers } from "@/lib/data/teams";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadershipSelect } from "@/components/admin/leadership-select";
import { AddMemberForm } from "@/components/admin/add-member-form";
import { EditMemberDialog } from "@/components/admin/edit-member-dialog";

function TeamDetailInner() {
  const teamId = useSearchParams().get("id") ?? "";
  const { data: user } = useCurrentUser();
  const { data: team } = useTeam(teamId);
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: allMembers = [] } = useAllMembers();

  if (!user || !teamId) return null;
  if (!user.isSuperAdmin && !user.leadershipTeamIds.includes(teamId)) return null;
  if (!team) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  const memberOptions = members.map((m) => ({ id: m.member_id, full_name: m.full_name }));
  const candidates = allMembers.filter(
    (m) => !members.some((tm) => tm.member_id === m.id),
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        {team.description ? (
          <p className="text-muted-foreground">{team.description}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leadership</CardTitle>
          <CardDescription>
            The Coordinator is auto-synced into the Core Team.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 sm:gap-8">
          <div className="space-y-2">
            <p className="text-sm font-medium">Team Coordinator</p>
            <LeadershipSelect
              teamId={teamId}
              role="coordinator"
              members={memberOptions}
              currentMemberId={members.find((m) => m.is_coordinator)?.member_id ?? null}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Deputy Coordinator</p>
            <LeadershipSelect
              teamId={teamId}
              role="deputy"
              members={memberOptions}
              currentMemberId={
                members.find((m) => m.is_deputy_coordinator)?.member_id ?? null
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddMemberForm teamId={teamId} candidates={candidates} />

          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border md:hidden">
                {members.map((m) => (
                  <div key={m.membership_id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <EditMemberDialog member={m} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                      {m.is_coordinator ? (
                        <Badge>Coordinator</Badge>
                      ) : m.is_deputy_coordinator ? (
                        <Badge variant="secondary">Deputy Coordinator</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.membership_id}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === "active" ? "default" : "secondary"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.is_coordinator ? (
                            <Badge>Coordinator</Badge>
                          ) : m.is_deputy_coordinator ? (
                            <Badge variant="secondary">Deputy Coordinator</Badge>
                          ) : (
                            <span className="text-muted-foreground">Member</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EditMemberDialog member={m} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={null}>
      <TeamDetailInner />
    </Suspense>
  );
}
