"use client";

import Link from "next/link";
import { Trophy, ListChecks, FileCheck2, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useGlobalLeaderboard } from "@/lib/data/leaderboard";
import { useTasksForUser } from "@/lib/data/tasks";
import { useOwnNocs } from "@/lib/data/noc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: leaderboard = [] } = useGlobalLeaderboard();
  const { data: tasks = [] } = useTasksForUser(user?.memberId);
  const { data: nocs = [] } = useOwnNocs(user?.memberId);
  if (!user) return null;

  const myRank = leaderboard.find((r) => r.member_id === user.memberId);
  const pendingTasks = tasks.filter((t) => t.my_status === "not_submitted" || t.my_status === null);

  const latestByType = (type: "district" | "unit") =>
    nocs
      .filter((n) => n.noc_type === type)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
  const districtNoc = latestByType("district");
  const unitNoc = latestByType("unit");
  const nocsComplete = [districtNoc, unitNoc].filter((n) => n?.status === "approved").length;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Here&apos;s where things stand.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Your score</CardDescription>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Trophy className="h-4 w-4" />
              </span>
            </div>
            <CardTitle className="text-3xl">{myRank?.total_score ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {myRank ? `Global rank #${myRank.global_rank}` : "Not ranked yet"}
            </p>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View leaderboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent-foreground/70 to-accent-foreground/20" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Pending tasks</CardDescription>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ListChecks className="h-4 w-4" />
              </span>
            </div>
            <CardTitle className="text-3xl">{pendingTasks.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Awaiting your submission</p>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View tasks <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-warning to-warning/30" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>NOC status</CardDescription>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
                <FileCheck2 className="h-4 w-4" />
              </span>
            </div>
            <CardTitle className="text-3xl">{nocsComplete}/2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">District</span>
              <Badge
                variant={
                  districtNoc?.status === "approved"
                    ? "success"
                    : districtNoc?.status === "rejected"
                      ? "destructive"
                      : districtNoc
                        ? "warning"
                        : "outline"
                }
              >
                {districtNoc?.status ?? "not submitted"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unit</span>
              <Badge
                variant={
                  unitNoc?.status === "approved"
                    ? "success"
                    : unitNoc?.status === "rejected"
                      ? "destructive"
                      : unitNoc
                        ? "warning"
                        : "outline"
                }
              >
                {unitNoc?.status ?? "not submitted"}
              </Badge>
            </div>
            <div>
              <Link
                href="/noc"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Manage NOC <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {user.roles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your roles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {user.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
