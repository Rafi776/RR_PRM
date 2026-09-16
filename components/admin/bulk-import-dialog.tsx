"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { bulkImportMembers, type BulkImportResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download } from "lucide-react";

const initial: BulkImportResult = { error: null, imported: 0, skipped: [], setupLinks: [] };

function downloadSetupLinksCsv(links: { email: string; link: string }[]) {
  const csv = ["email,setup_link", ...links.map((l) => `${l.email},${l.link}`)].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "member-setup-links.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkImportMembersDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(bulkImportMembers, initial);

  useEffect(() => {
    if (state.imported > 0) {
      toast.success(`Imported ${state.imported} member(s).`);
    }
  }, [state.imported]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload className="mr-1 h-4 w-4" />
        Bulk import members
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Bulk import members</DialogTitle>
            <DialogDescription>
              CSV or Excel (.xlsx/.xls). Columns: <code>name (or full_name),
              email, phone, bs_id, stage, scout_group, district, team_name,
              position, photo</code>. Only name and email are required.
              created_at is set automatically and ignored if present.
              Accounts are created without sending email (no rate limit) —
              download the setup-link CSV afterward and distribute it
              yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">CSV or Excel file</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                required
              />
            </div>
            {pending ? (
              <p className="text-sm text-muted-foreground">
                Importing — large files can take a minute or more. Don&apos;t
                close this dialog or click Import again; re-submitting won&apos;t
                create duplicates, but it will re-check every row.
              </p>
            ) : null}
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            {state.setupLinks.length > 0 ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <p className="text-sm">
                  {state.setupLinks.length} setup link(s) generated.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadSetupLinksCsv(state.setupLinks)}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            ) : null}
            {state.skipped.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
                <p className="mb-1 font-medium text-destructive">
                  {state.skipped.length} row(s) skipped:
                </p>
                <ul className="space-y-0.5">
                  {state.skipped.map((s) => (
                    <li key={s.row}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
