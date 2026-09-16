"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useGlobalLeaderboard, useTeamLeaderboard } from "@/lib/data/leaderboard";
import { useTeams } from "@/lib/data/teams";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy } from "lucide-react";
import type { PerformanceRow, TeamPerformanceRow } from "@/lib/types/domain";

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400/20 text-amber-600 dark:text-amber-400",
  2: "bg-slate-400/20 text-slate-500 dark:text-slate-300",
  3: "bg-orange-400/20 text-orange-600 dark:text-orange-400",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) return <span className="pl-1 font-medium">#{rank}</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${RANK_STYLES[rank]}`}
    >
      <Trophy className="h-3.5 w-3.5" />#{rank}
    </span>
  );
}

function LeaderboardRows({
  rows,
  rank,
  currentUserId,
  emptyMessage,
}: {
  rows: (PerformanceRow | TeamPerformanceRow)[];
  rank: (row: PerformanceRow | TeamPerformanceRow) => number;
  currentUserId: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="divide-y rounded-lg border sm:hidden">
        {rows.map((row) => (
          <div
            key={row.member_id}
            className={`flex items-center gap-3 p-3 ${row.member_id === currentUserId ? "bg-primary/5" : ""}`}
          >
            <RankBadge rank={rank(row)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{row.full_name}</p>
                {row.member_id === currentUserId ? (
                  <Badge variant="secondary" className="shrink-0">
                    You
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {row.task_score} task pts · {row.attendance_score} attendance pts
              </p>
            </div>
            <span className="shrink-0 text-lg font-semibold">{row.total_score}</span>
          </div>
        ))}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Task pts</TableHead>
              <TableHead>Attendance pts</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.member_id}
                className={row.member_id === currentUserId ? "bg-primary/5" : ""}
              >
                <TableCell className="font-medium">
                  <RankBadge rank={rank(row)} />
                </TableCell>
                <TableCell>
                  {row.full_name}
                  {row.member_id === currentUserId ? (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{row.task_score}</TableCell>
                <TableCell>{row.attendance_score}</TableCell>
                <TableCell className="font-semibold">{row.total_score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function LeaderboardPageInner() {
  const { data: user } = useCurrentUser();
  const searchParams = useSearchParams();
  const selectedTeamSlug = searchParams.get("team") ?? undefined;

  const { data: teams = [] } = useTeams();
  const operationalTeams = teams.filter((t) => !t.is_core_team);
  const selectedTeam =
    operationalTeams.find((t) => t.slug === selectedTeamSlug) ?? operationalTeams[0];

  const { data: global = [] } = useGlobalLeaderboard();
  const { data: teamRows = [] } = useTeamLeaderboard(selectedTeam?.id);

  if (!user) return null;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="text-muted-foreground">
          Score = completed weighted task points + meeting attendance points.
        </p>
      </div>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="team">By team</TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>Global ranking</CardTitle>
              <CardDescription>All active members, org-wide.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardRows
                rows={global}
                rank={(row) => (row as PerformanceRow).global_rank}
                currentUserId={user.id}
                emptyMessage="No scores yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team ranking</CardTitle>
              <CardDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                  {operationalTeams.map((t) => (
                    <a
                      key={t.id}
                      href={`/leaderboard?team=${t.slug}`}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selectedTeam?.id === t.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {t.name}
                    </a>
                  ))}
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardRows
                rows={teamRows}
                rank={(row) => (row as TeamPerformanceRow).team_rank}
                currentUserId={user.id}
                emptyMessage="No scores yet for this team."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardPageInner />
    </Suspense>
  );
}
