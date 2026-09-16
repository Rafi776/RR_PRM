import Link from "next/link";
import { Trophy, ListChecks, FileCheck2, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/data/session";
import { getGlobalLeaderboard } from "@/lib/data/leaderboard";
import { listTasksForUser } from "@/lib/data/tasks";
import { getOwnNocs } from "@/lib/data/noc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [leaderboard, tasks, nocs] = await Promise.all([
    getGlobalLeaderboard(),
    listTasksForUser(user.id),
    getOwnNocs(user.id),
  ]);

  const myRank = leaderboard.find((r) => r.member_id === user.id);
  const pendingTasks = tasks.filter((t) => t.my_status === "not_submitted" || t.my_status === null);
  const latestNoc = nocs[0];

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
            <CardTitle className="text-3xl capitalize">
              {latestNoc ? latestNoc.status : "None"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestNoc ? (
              <Badge
                variant={
                  latestNoc.status === "approved"
                    ? "success"
                    : latestNoc.status === "rejected"
                      ? "destructive"
                      : "warning"
                }
              >
                {latestNoc.file_name}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">No submission yet</p>
            )}
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
