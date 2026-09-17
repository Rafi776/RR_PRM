"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useTeams, useTeamMembers, useAllMembers } from "@/lib/data/teams";
import { useSuperAdmins } from "@/lib/data/admin";
import { useTaskTypes } from "@/lib/data/tasks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTeamDialog } from "@/components/admin/create-team-dialog";
import { BulkImportMembersDialog } from "@/components/admin/bulk-import-dialog";
import { InviteExistingMemberDialog } from "@/components/admin/invite-existing-member-dialog";
import { CoreRoleSelect } from "@/components/admin/core-role-form";
import { SuperAdminManager } from "@/components/admin/super-admin-manager";
import { SyncTeamsButton } from "@/components/admin/sync-teams-button";
import { TaskTypeManager } from "@/components/admin/task-type-manager";
import { MemberRolesTable } from "@/components/admin/member-roles-table";

export default function AdminPage() {
  const { data: user } = useCurrentUser();
  const { data: teams = [] } = useTeams();
  const coreTeam = teams.find((t) => t.is_core_team);
  const operationalTeams = teams.filter((t) => !t.is_core_team);
  const { data: coreMembers = [] } = useTeamMembers(coreTeam?.id ?? "");
  const { data: allMembers = [] } = useAllMembers();
  const { data: superAdmins = [] } = useSuperAdmins();
  const { data: taskTypes = [] } = useTaskTypes();
  if (!user?.isSuperAdmin) return null;

  const superAdminIds = new Set(superAdmins.map((a) => a.member_id));
  const coreRoleByMemberId = new Map(coreMembers.map((m) => [m.member_id, m.core_role]));

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Console</h1>
          <p className="text-muted-foreground">
            Manage teams, leadership, and member onboarding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncTeamsButton />
          <BulkImportMembersDialog />
          <InviteExistingMemberDialog />
          <CreateTeamDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational teams</CardTitle>
          <CardDescription>
            Coordinators are auto-synced into the Core Team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operationalTeams.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No operational teams yet. Create one to get started.
            </p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border sm:hidden">
                {operationalTeams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/admin/teams/detail?id=${t.id}`}
                    className="block p-3 active:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{t.name}</p>
                      <Badge variant="outline">{t.member_count} members</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Coordinator: {t.coordinator?.full_name ?? "Unassigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deputy: {t.deputy_coordinator?.full_name ?? "Unassigned"}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Desktop / tablet: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Coordinator</TableHead>
                      <TableHead>Deputy Coordinator</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operationalTeams.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          {t.coordinator ? (
                            t.coordinator.full_name
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.deputy_coordinator ? (
                            t.deputy_coordinator.full_name
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>{t.member_count}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/teams/detail?id=${t.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Manage
                          </Link>
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

      <Card>
        <CardHeader>
          <CardTitle>Platform administrators</CardTitle>
          <CardDescription>
            Super Admins have full access to every team, task, NOC, and
            report on the platform. Grant this sparingly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuperAdminManager admins={superAdmins} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task types</CardTitle>
          <CardDescription>
            Configure the point weightage for each task type. Picking a type
            when creating a task fills in its default points automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskTypeManager taskTypes={taskTypes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Core Team
            <Badge variant="secondary">auto-synced</Badge>
          </CardTitle>
          <CardDescription>
            All team coordinators appear here automatically. Assign fixed
            roles (Convener, Joint Convener, Member Secretary, Deputy
            Member Secretary) to designate core leadership manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coreMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No Core Team members yet.</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border sm:hidden">
                {coreMembers.map((m) => (
                  <div key={m.membership_id} className="space-y-2 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{m.full_name}</p>
                      {m.is_auto_synced ? (
                        <Badge variant="outline">Auto</Badge>
                      ) : (
                        <Badge variant="secondary">Manual</Badge>
                      )}
                    </div>
                    <CoreRoleSelect memberId={m.member_id} currentRole={m.core_role} />
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Fixed core role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coreMembers.map((m) => (
                      <TableRow key={m.membership_id}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell>
                          {m.is_auto_synced ? (
                            <Badge variant="outline">Auto (Coordinator)</Badge>
                          ) : (
                            <Badge variant="secondary">Manual</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <CoreRoleSelect memberId={m.member_id} currentRole={m.core_role} />
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

      <Card>
        <CardHeader>
          <CardTitle>All members ({allMembers.length})</CardTitle>
          <CardDescription>
            Search the full roster to grant/revoke Super Admin access or
            assign a fixed Core Team role to anyone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberRolesTable
            members={allMembers}
            superAdminIds={superAdminIds}
            coreRoleByMemberId={coreRoleByMemberId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
