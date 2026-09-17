"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { bulkImportNocs, type BulkNocImportResult } from "@/lib/actions/noc";
import { downloadExampleCsv } from "@/lib/utils/download-csv";
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
import { Upload, FileDown } from "lucide-react";

const initial: BulkNocImportResult = { error: null, imported: 0, skipped: [] };

export function BulkImportNocsDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(bulkImportNocs, initial);

  useEffect(() => {
    if (state.imported > 0) toast.success(`Imported ${state.imported} NOC record(s).`);
  }, [state.imported]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload className="mr-1 h-4 w-4" />
        Bulk import NOCs
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Bulk import NOC records</DialogTitle>
            <DialogDescription>
              CSV or Excel (.xlsx/.xls). A spreadsheet cell can&apos;t hold a
              PDF, so each row links to already-hosted documents instead of
              uploading files. One row per member — columns:{" "}
              <code>email</code> (or <code>bs_id</code>) to match the member,
              optional <code>team_name</code> (disambiguates if the same
              email/bs_id matches more than one member), and either or both
              of <code>district_file_url</code> / <code>unit_file_url</code>{" "}
              (at least one required). Optional per type:{" "}
              <code>district_status</code> / <code>unit_status</code>{" "}
              (pending/approved/rejected — defaults to pending) and{" "}
              <code>district_notes</code> / <code>unit_notes</code> (used as
              the rejection reason). Rows for a member who already has a
              pending or approved NOC of that type are skipped as
              duplicates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={() =>
                downloadExampleCsv(
                  "noc-import-example.csv",
                  [
                    "email",
                    "bs_id",
                    "team_name",
                    "district_file_url",
                    "district_status",
                    "unit_file_url",
                    "unit_status",
                    "notes",
                  ],
                  [
                    [
                      "jane.doe@example.com",
                      "BS12345",
                      "Media Team",
                      "https://drive.google.com/file/d/district-example/view",
                      "pending",
                      "https://drive.google.com/file/d/unit-example/view",
                      "pending",
                      "",
                    ],
                    [
                      "john.smith@example.com",
                      "BS67890",
                      "Media Team",
                      "https://drive.google.com/file/d/district-example2/view",
                      "approved",
                      "",
                      "",
                      "",
                    ],
                  ],
                )
              }
            >
              <FileDown className="mr-1 h-4 w-4" />
              Download example file
            </Button>
            <div className="space-y-2">
              <Label htmlFor="noc-import-file">CSV or Excel file</Label>
              <Input
                id="noc-import-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                required
              />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
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
