"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { getOwnNocs, getReviewQueue, getSignedNocUrl } from "@/lib/data/noc";
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
import { NocUploadForm } from "@/components/noc/upload-form";
import { ReviewActions } from "@/components/noc/review-actions";
import type { NocStatus } from "@/lib/types/domain";

function statusBadge(status: NocStatus) {
  const variant =
    status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function NocPage() {
  const { data: user } = useCurrentUser();
  const isReviewer = !!user && (user.isCoreTeam || user.leadershipTeamIds.length > 0);

  const { data: myNocsWithUrl = [] } = useQuery({
    queryKey: ["own-nocs-with-url", user?.id],
    queryFn: async () => {
      const nocs = await getOwnNocs(user!.id);
      return Promise.all(nocs.map(async (n) => ({ ...n, url: await getSignedNocUrl(n.file_path) })));
    },
    enabled: !!user,
  });

  const { data: pendingWithUrl = [] } = useQuery({
    queryKey: ["noc-review-queue-with-url"],
    queryFn: async () => {
      const queue = await getReviewQueue();
      const pending = queue.filter((n) => n.status === "pending");
      return Promise.all(pending.map(async (n) => ({ ...n, url: await getSignedNocUrl(n.file_path) })));
    },
    enabled: isReviewer,
  });

  if (!user) return null;

  const myNocsTable = (
    <Card>
      <CardHeader>
        <CardTitle>My NOC submissions</CardTitle>
        <CardDescription>Upload your No Objection Certificate for review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <NocUploadForm />

        {myNocsWithUrl.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="divide-y rounded-lg border sm:hidden">
              {myNocsWithUrl.map((n) => (
                <div key={n.id} className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    {n.url ? (
                      <a href={n.url} target="_blank" className="truncate font-medium text-primary hover:underline">
                        {n.file_name}
                      </a>
                    ) : (
                      <span className="truncate font-medium">{n.file_name}</span>
                    )}
                    {statusBadge(n.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(n.submitted_at).toLocaleDateString()}
                    {n.rejection_reason ? ` · ${n.rejection_reason}` : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myNocsWithUrl.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        {n.url ? (
                          <a href={n.url} target="_blank" className="text-primary hover:underline">
                            {n.file_name}
                          </a>
                        ) : (
                          n.file_name
                        )}
                      </TableCell>
                      <TableCell>{new Date(n.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell>{statusBadge(n.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {n.rejection_reason ?? "—"}
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
  );

  if (!isReviewer) {
    return <div className="space-y-6 p-4 sm:p-6 lg:p-8">{myNocsTable}</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">NOC Management</h1>
      </div>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Review queue
            {pendingWithUrl.length > 0 ? (
              <Badge className="ml-2" variant="secondary">
                {pendingWithUrl.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="mine">My submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Pending review</CardTitle>
              <CardDescription>
                NOCs from members on your team(s), awaiting verification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingWithUrl.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing pending review.</p>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="divide-y rounded-lg border md:hidden">
                    {pendingWithUrl.map((n) => (
                      <div key={n.id} className="space-y-2 p-3">
                        <div>
                          <p className="font-medium">{n.member_name}</p>
                          <p className="text-xs text-muted-foreground">{n.member_email}</p>
                        </div>
                        {n.url ? (
                          <a href={n.url} target="_blank" className="text-sm text-primary hover:underline">
                            {n.file_name}
                          </a>
                        ) : (
                          <p className="text-sm">{n.file_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted {new Date(n.submitted_at).toLocaleDateString()}
                        </p>
                        <ReviewActions nocId={n.id} />
                      </div>
                    ))}
                  </div>

                  {/* Desktop / tablet: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingWithUrl.map((n) => (
                          <TableRow key={n.id}>
                            <TableCell>
                              <div className="font-medium">{n.member_name}</div>
                              <div className="text-xs text-muted-foreground">{n.member_email}</div>
                            </TableCell>
                            <TableCell>
                              {n.url ? (
                                <a href={n.url} target="_blank" className="text-primary hover:underline">
                                  {n.file_name}
                                </a>
                              ) : (
                                n.file_name
                              )}
                            </TableCell>
                            <TableCell>{new Date(n.submitted_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <ReviewActions nocId={n.id} />
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
        </TabsContent>
        <TabsContent value="mine">{myNocsTable}</TabsContent>
      </Tabs>
    </div>
  );
}
