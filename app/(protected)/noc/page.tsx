"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { getOwnNocs, getReviewQueue, getSignedNocUrl } from "@/lib/data/noc";
import { bulkApproveNocs, bulkDeleteNocs } from "@/lib/actions/noc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BulkImportNocsDialog } from "@/components/noc/bulk-import-dialog";
import { DeleteNocButton } from "@/components/noc/delete-noc-button";
import { Trash2, Search, Check } from "lucide-react";
import type { NocStatus, NocType } from "@/lib/types/domain";

const NOC_TYPES: { type: NocType; label: string }[] = [
  { type: "district", label: "District NOC" },
  { type: "unit", label: "Unit NOC" },
];

function statusBadge(status: NocStatus) {
  const variant =
    status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function typeBadge(type: NocType) {
  return <Badge variant="outline">{type === "district" ? "District" : "Unit"}</Badge>;
}

export default function NocPage() {
  const { data: user } = useCurrentUser();
  const isReviewer = !!user && (user.isCoreTeam || user.leadershipTeamIds.length > 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );
  const STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ] as const;

  const toggleSelected = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected NOC submission(s)? This can't be undone.`)) return;
    setDeleting(true);
    const result = await bulkDeleteNocs(Array.from(selected));
    setDeleting(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Deleted.");
      setSelected(new Set());
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Approve ${selected.size} selected NOC submission(s)?`)) return;
    setApproving(true);
    const result = await bulkApproveNocs(Array.from(selected));
    setApproving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Approved.");
      setSelected(new Set());
    }
  };

  const { data: myNocsWithUrl = [] } = useQuery({
    queryKey: ["own-nocs-with-url", user?.memberId],
    queryFn: async () => {
      const nocs = await getOwnNocs(user!.memberId);
      return Promise.all(nocs.map(async (n) => ({ ...n, url: await getSignedNocUrl(n.file_path) })));
    },
    enabled: !!user,
  });

  const { data: queueWithUrl = [] } = useQuery({
    queryKey: ["noc-review-queue-with-url"],
    queryFn: async () => {
      const queue = await getReviewQueue();
      return Promise.all(queue.map(async (n) => ({ ...n, url: await getSignedNocUrl(n.file_path) })));
    },
    enabled: isReviewer,
  });

  const pendingCount = queueWithUrl.filter((n) => n.status === "pending").length;
  const statusFilteredQueue =
    statusFilter === "all" ? queueWithUrl : queueWithUrl.filter((n) => n.status === statusFilter);

  const duplicateKeys = new Set(
    Object.entries(
      statusFilteredQueue.reduce<Record<string, number>>((acc, n) => {
        const key = `${n.member_id}:${n.noc_type}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );

  // One row per member — District and Unit each shown in their own
  // column instead of as separate rows. A slot normally holds a single
  // submission, but can hold more if a duplicate slipped in.
  type QueueEntry = (typeof statusFilteredQueue)[number];
  type QueueGroup = {
    member_id: string;
    member_name: string;
    member_email: string;
    member_team_name: string | null;
    district: QueueEntry[];
    unit: QueueEntry[];
  };
  const groupedQueue = Object.values(
    statusFilteredQueue.reduce<Record<string, QueueGroup>>((acc, n) => {
      if (!acc[n.member_id]) {
        acc[n.member_id] = {
          member_id: n.member_id,
          member_name: n.member_name,
          member_email: n.member_email,
          member_team_name: n.member_team_name,
          district: [],
          unit: [],
        };
      }
      acc[n.member_id][n.noc_type].push(n);
      return acc;
    }, {}),
  );

  const searchTerm = search.trim().toLowerCase();
  const filteredQueue = searchTerm
    ? groupedQueue.filter(
        (g) =>
          g.member_name.toLowerCase().includes(searchTerm) ||
          g.member_email.toLowerCase().includes(searchTerm) ||
          (g.member_team_name ?? "").toLowerCase().includes(searchTerm),
      )
    : groupedQueue;

  const visibleIds = filteredQueue.flatMap((g) => [...g.district, ...g.unit].map((n) => n.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleSelectAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  if (!user) return null;

  // Most recent submission per type drives the "current status" shown
  // next to each upload control — a member can re-upload after a
  // rejection, so history can hold several rows per type.
  const latestByType = (type: NocType) =>
    myNocsWithUrl
      .filter((n) => n.noc_type === type)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];

  const latestDistrict = latestByType("district");
  const latestUnit = latestByType("unit");
  const districtLocked = latestDistrict?.status === "pending" || latestDistrict?.status === "approved";
  const unitLocked = latestUnit?.status === "pending" || latestUnit?.status === "approved";

  const myNocsTable = (
    <Card>
      <CardHeader>
        <CardTitle>My NOC submissions</CardTitle>
        <CardDescription>
          Both a District NOC and a Unit NOC are required — upload one or both at once below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          {NOC_TYPES.map(({ type, label }) => {
            const latest = type === "district" ? latestDistrict : latestUnit;
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{label}</p>
                  {latest ? statusBadge(latest.status) : <Badge variant="outline">Not submitted</Badge>}
                </div>
                {latest?.rejection_reason ? (
                  <p className="text-xs text-destructive">{latest.rejection_reason}</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <NocUploadForm districtLocked={districtLocked} unitLocked={unitLocked} />

        {myNocsWithUrl.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No submissions yet.</p>
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
                    <div className="flex shrink-0 gap-1">
                      {typeBadge(n.noc_type)}
                      {statusBadge(n.status)}
                    </div>
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
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myNocsWithUrl.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>{typeBadge(n.noc_type)}</TableCell>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">NOC Management</h1>
        <BulkImportNocsDialog />
      </div>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Review queue
            {pendingCount > 0 ? (
              <Badge className="ml-2" variant="secondary">
                {pendingCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="mine">My submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>NOC submissions</CardTitle>
                  <CardDescription>
                    District and Unit NOCs from members on your team(s). Filter by status below.
                  </CardDescription>
                </div>
                {selected.size > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={approving}
                      onClick={handleBulkApprove}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {approving ? "Approving..." : `Approve selected (${selected.size})`}
                    </Button>
                    {user.isSuperAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deleting}
                        onClick={handleBulkDelete}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {deleting ? "Deleting..." : `Delete selected (${selected.size})`}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, or team..."
                    className="pl-8"
                  />
                </div>
                <Select
                  value={statusFilter}
                  items={STATUS_OPTIONS}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {visibleIds.length > 0 ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleSelectAll(checked)}
                    />
                    Select all ({visibleIds.length})
                  </label>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {statusFilteredQueue.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No {statusFilter === "all" ? "" : statusFilter} NOC submissions.
                </p>
              ) : filteredQueue.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No members match &quot;{search}&quot;.
                </p>
              ) : (
                <>
                  {/* Mobile: card list, one card per member */}
                  <div className="divide-y rounded-lg border md:hidden">
                    {filteredQueue.map((g) => (
                      <div key={g.member_id} className="space-y-3 p-3">
                        <div>
                          <p className="font-medium">{g.member_name}</p>
                          <p className="text-xs text-muted-foreground">{g.member_email}</p>
                          {g.member_team_name ? (
                            <Badge variant="secondary" className="mt-1">
                              {g.member_team_name}
                            </Badge>
                          ) : null}
                        </div>
                        {(["district", "unit"] as NocType[]).map((type) => {
                          const entries = g[type];
                          if (entries.length === 0) return null;
                          return (
                            <div key={type} className="space-y-2 rounded-md border p-2">
                              <div className="flex items-center gap-1">{typeBadge(type)}</div>
                              {entries.map((n) => {
                                const isDuplicate = duplicateKeys.has(`${n.member_id}:${n.noc_type}`);
                                return (
                                  <div key={n.id} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <Checkbox
                                          checked={selected.has(n.id)}
                                          onCheckedChange={(checked) => toggleSelected(n.id, checked)}
                                        />
                                        {n.url ? (
                                          <a
                                            href={n.url}
                                            target="_blank"
                                            className="truncate text-sm text-primary hover:underline"
                                          >
                                            {n.file_name}
                                          </a>
                                        ) : (
                                          <p className="truncate text-sm">{n.file_name}</p>
                                        )}
                                      </div>
                                      <div className="flex shrink-0 gap-1">
                                        {statusBadge(n.status)}
                                        {isDuplicate ? <Badge variant="destructive">Duplicate</Badge> : null}
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Submitted {new Date(n.submitted_at).toLocaleDateString()}
                                      {n.rejection_reason ? ` · ${n.rejection_reason}` : ""}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {n.status === "pending" ? <ReviewActions nocId={n.id} /> : null}
                                      {user.isSuperAdmin ? <DeleteNocButton nocId={n.id} /> : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Desktop / tablet: table, one row per member */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>District NOC</TableHead>
                          <TableHead>Unit NOC</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQueue.map((g) => (
                          <TableRow key={g.member_id}>
                            <TableCell className="align-top">
                              <div className="font-medium">{g.member_name}</div>
                              <div className="text-xs text-muted-foreground">{g.member_email}</div>
                              {g.member_team_name ? (
                                <Badge variant="secondary" className="mt-1">
                                  {g.member_team_name}
                                </Badge>
                              ) : null}
                            </TableCell>
                            {(["district", "unit"] as NocType[]).map((type) => {
                              const entries = g[type];
                              return (
                                <TableCell key={type} className="align-top">
                                  {entries.length === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="space-y-3">
                                      {entries.map((n) => {
                                        const isDuplicate = duplicateKeys.has(
                                          `${n.member_id}:${n.noc_type}`,
                                        );
                                        return (
                                          <div key={n.id} className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                checked={selected.has(n.id)}
                                                onCheckedChange={(checked) =>
                                                  toggleSelected(n.id, checked)
                                                }
                                              />
                                              {n.url ? (
                                                <a
                                                  href={n.url}
                                                  target="_blank"
                                                  className="text-primary hover:underline"
                                                >
                                                  {n.file_name}
                                                </a>
                                              ) : (
                                                n.file_name
                                              )}
                                              {statusBadge(n.status)}
                                              {isDuplicate ? (
                                                <Badge variant="destructive">Duplicate</Badge>
                                              ) : null}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                              Submitted {new Date(n.submitted_at).toLocaleDateString()}
                                              {n.rejection_reason ? ` · ${n.rejection_reason}` : ""}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {n.status === "pending" ? (
                                                <ReviewActions nocId={n.id} />
                                              ) : null}
                                              {user.isSuperAdmin ? (
                                                <DeleteNocButton nocId={n.id} />
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
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
