"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useVisibleReports } from "@/lib/data/reports";
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
import { ReportReviewActions } from "@/components/reports/review-actions";
import type { ReportStatus } from "@/lib/data/reports";

function statusBadge(status: ReportStatus) {
  const variant = status === "open" ? "warning" : status === "reviewed" ? "success" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function ReportsPage() {
  const { data: user } = useCurrentUser();
  // RLS already scopes this: a regular member's query returns only
  // reports they filed; a Super Admin's returns every report.
  const { data: reports = [] } = useVisibleReports();
  if (!user) return null;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          {user.isSuperAdmin
            ? "Every report filed across the platform. Visible only to you and each reporter."
            : "Reports you've filed. Only you and admins can see these."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{user.isSuperAdmin ? "All reports" : "My reports"} ({reports.length})</CardTitle>
          {!user.isSuperAdmin ? (
            <CardDescription>
              Open a member&apos;s profile from the Members directory to file a new report.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reports.</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y rounded-lg border lg:hidden">
                {reports.map((r) => (
                  <div key={r.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">Re: {r.reported_name}</p>
                        {user.isSuperAdmin ? (
                          <p className="text-xs text-muted-foreground">by {r.reporter_name}</p>
                        ) : null}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-sm">{r.reason}</p>
                    {r.details ? <p className="text-xs text-muted-foreground">{r.details}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      Filed {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    {user.isSuperAdmin && r.status === "open" ? (
                      <ReportReviewActions reportId={r.id} />
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Desktop / tablet: table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {user.isSuperAdmin ? <TableHead>Reporter</TableHead> : null}
                      <TableHead>Reported member</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Filed</TableHead>
                      <TableHead>Status</TableHead>
                      {user.isSuperAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        {user.isSuperAdmin ? <TableCell>{r.reporter_name}</TableCell> : null}
                        <TableCell className="font-medium">{r.reported_name}</TableCell>
                        <TableCell>
                          <div>{r.reason}</div>
                          {r.details ? (
                            <div className="text-xs text-muted-foreground">{r.details}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        {user.isSuperAdmin ? (
                          <TableCell className="text-right">
                            {r.status === "open" ? <ReportReviewActions reportId={r.id} /> : null}
                          </TableCell>
                        ) : null}
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
