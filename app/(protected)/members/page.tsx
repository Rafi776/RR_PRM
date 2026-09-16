"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useOrganogram } from "@/lib/data/teams";
import {
  useMembersDirectory,
  useMemberDirectoryFilterOptions,
} from "@/lib/data/members";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Organogram } from "@/components/members/organogram";
import { MemberFilters } from "@/components/members/member-filters";
import { MemberDirectoryTable } from "@/components/members/member-directory-table";

function MembersPageInner() {
  const { data: user } = useCurrentUser();
  const searchParams = useSearchParams();
  const filters = {
    q: searchParams.get("q") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    stage: searchParams.get("stage") ?? undefined,
    district: searchParams.get("district") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };

  const { data: organogram } = useOrganogram();
  const { data: filterOptions } = useMemberDirectoryFilterOptions();
  const { data: members = [] } = useMembersDirectory(filters);

  if (!user || !organogram || !filterOptions) return null;

  const canManage = user.isSuperAdmin || user.leadershipTeamIds.length > 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-muted-foreground">Core Team structure and the full member directory.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Team organogram</CardTitle>
          <CardDescription>
            Fixed core roles, followed by each operational team&apos;s Coordinator and
            Deputy Coordinator — who are automatically part of the Core Team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Organogram data={organogram} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All members ({members.length})</CardTitle>
          <CardDescription>
            Search and filter across the full directory. Click a member to see details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MemberFilters
            teams={filterOptions.teams}
            stages={filterOptions.stages}
            districts={filterOptions.districts}
          />
          <MemberDirectoryTable
            members={members}
            currentUserId={user.id}
            canManage={canManage}
            isSuperAdmin={user.isSuperAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersPageInner />
    </Suspense>
  );
}
