import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";
import { parseTabularFile } from "@/lib/utils/parse-tabular";
import type { NocStatus, NocType } from "@/lib/types/domain";

const NOC_TYPE_LABELS: Record<NocType, string> = { district: "District", unit: "Unit" };

async function uploadOneNoc(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  nocType: NocType,
  file: File,
): Promise<{ ok: boolean; message: string }> {
  const label = NOC_TYPE_LABELS[nocType];

  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return { ok: false, message: `${label}: only PDF or image files are accepted.` };
  }

  const { data: existing } = await supabase
    .from("noc_submissions")
    .select("id")
    .eq("member_id", userId)
    .eq("noc_type", nocType)
    .in("status", ["pending", "approved"])
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      ok: false,
      message: `${label}: you already have one pending or approved — no need to upload again.`,
    };
  }

  const path = `${userId}/${nocType}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("nocs")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, message: `${label}: ${uploadError.message}` };

  const { error: insertError } = await supabase.from("noc_submissions").insert({
    member_id: userId,
    organization_id: organizationId,
    noc_type: nocType,
    file_path: path,
    file_name: file.name,
    status: "pending",
  });
  if (insertError) return { ok: false, message: `${label}: ${insertError.message}` };

  return { ok: true, message: `${label} NOC uploaded — pending review.` };
}

// Uploads whichever of the two files were selected in a single submit —
// a member can supply just one (if the other's already pending/approved)
// or both at once.
export async function uploadNocs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const districtFile = formData.get("districtFile");
  const unitFile = formData.get("unitFile");
  const files: { nocType: NocType; file: File }[] = [];
  if (districtFile instanceof File && districtFile.size > 0) {
    files.push({ nocType: "district", file: districtFile });
  }
  if (unitFile instanceof File && unitFile.size > 0) {
    files.push({ nocType: "unit", file: unitFile });
  }
  if (files.length === 0) {
    return { error: "Please choose at least one file to upload." };
  }

  const supabase = createClient();
  const results = await Promise.all(
    files.map(({ nocType, file }) =>
      uploadOneNoc(supabase, user.memberId, user.organizationId, nocType, file),
    ),
  );

  queryClient.invalidateQueries();

  const anySucceeded = results.some((r) => r.ok);
  return {
    error: anySucceeded ? null : results.map((r) => r.message).join(" "),
    success: anySucceeded ? results.map((r) => r.message).join(" ") : undefined,
  };
}

export async function reviewNoc(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const nocId = String(formData.get("nocId") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "approved" | "rejected"
  const rejectionReason = String(formData.get("rejectionReason") ?? "");

  if (!nocId || !["approved", "rejected"].includes(decision)) {
    return { error: "Invalid review submission." };
  }
  if (decision === "rejected" && !rejectionReason.trim()) {
    return { error: "A rejection reason is required." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("noc_submissions")
    .update({
      status: decision,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      rejection_reason: decision === "rejected" ? rejectionReason : null,
    })
    .eq("id", nocId);

  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `NOC ${decision}.` };
}

// ---------------------------------------------------------------------
// Admin/leadership bulk NOC import from CSV/Excel.
// A spreadsheet cell can't hold a binary PDF, so each row references
// a member (by email or bs_id) plus a link to their already-hosted
// certificate (a shared Drive link, etc.) rather than a file upload.
// Columns: email or bs_id (one required, to match the member),
// team_name (optional — disambiguates when the same email/bs_id maps
// to more than one member), district_file_url and/or unit_file_url
// (at least one required per row — a member's row can carry both at
// once), district_status/unit_status (optional: pending/approved/
// rejected, default pending), district_notes/unit_notes (optional —
// used as the rejection reason when that type's status is rejected).
// The older single-type layout (noc_type + file_url + status + notes,
// one row per type) is still accepted for backward compatibility.
// RLS (noc_insert_admin_or_leadership, 0009) is what actually lets this
// insert rows for members other than the caller.
// ---------------------------------------------------------------------
export type BulkNocImportResult = {
  error: string | null;
  imported: number;
  skipped: { row: number; reason: string }[];
};

const VALID_STATUSES: NocStatus[] = ["pending", "approved", "rejected"];

export async function bulkImportNocs(
  _prev: BulkNocImportResult,
  formData: FormData,
): Promise<BulkNocImportResult> {
  const user = await fetchCurrentUser();
  if (!user?.isSuperAdmin && !(user && user.leadershipTeamIds.length > 0)) {
    return { error: "Not authorized.", imported: 0, skipped: [] };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file uploaded.", imported: 0, skipped: [] };
  }

  const { data: rows, error: parseError } = await parseTabularFile(file);
  if (parseError) return { error: parseError, imported: 0, skipped: [] };

  const supabase = createClient();
  const { data: members } = await supabase
    .from("prm_members")
    .select("id, email, bs_id, team_name");
  const { data: existingNocs } = await supabase
    .from("noc_submissions")
    .select("member_id, noc_type")
    .in("status", ["pending", "approved"]);
  const existingKeys = new Set(
    (existingNocs ?? []).map((n) => `${n.member_id}:${n.noc_type}`),
  );

  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email?.trim().toLowerCase();
    const bsId = row.bs_id?.trim();
    const teamName = row.team_name?.trim();

    if (!email && !bsId) {
      skipped.push({ row: i + 2, reason: "Missing email or bs_id to identify the member." });
      continue;
    }

    // Combined layout: one row per member, up to two entries (district
    // and/or unit). Falls back to the legacy single-type layout
    // (noc_type + file_url) when neither combined column is present.
    const districtUrl = row.district_file_url?.trim();
    const unitUrl = row.unit_file_url?.trim();
    const entries: { nocType: NocType; fileUrl: string; status: string; notes?: string }[] = [];
    if (districtUrl) {
      entries.push({
        nocType: "district",
        fileUrl: districtUrl,
        status: row.district_status?.trim().toLowerCase() ?? "",
        notes: row.district_notes?.trim() || row.notes?.trim(),
      });
    }
    if (unitUrl) {
      entries.push({
        nocType: "unit",
        fileUrl: unitUrl,
        status: row.unit_status?.trim().toLowerCase() ?? "",
        notes: row.unit_notes?.trim() || row.notes?.trim(),
      });
    }
    if (entries.length === 0) {
      const legacyUrl = (row.file_url ?? row.url ?? row.link)?.trim();
      const legacyType = row.noc_type?.trim().toLowerCase();
      if (!legacyUrl) {
        skipped.push({
          row: i + 2,
          reason: "Missing district_file_url and/or unit_file_url.",
        });
        continue;
      }
      if (legacyType !== "district" && legacyType !== "unit") {
        skipped.push({ row: i + 2, reason: 'noc_type must be "district" or "unit".' });
        continue;
      }
      entries.push({
        nocType: legacyType,
        fileUrl: legacyUrl,
        status: row.status?.trim().toLowerCase() ?? "",
        notes: row.notes?.trim() || row.rejection_reason?.trim(),
      });
    }

    let candidates = members?.filter(
      (m) => (email && m.email?.toLowerCase() === email) || (bsId && m.bs_id === bsId),
    );
    if (!candidates || candidates.length === 0) {
      skipped.push({ row: i + 2, reason: `No member found for "${email || bsId}".` });
      continue;
    }
    if (candidates.length > 1 && teamName) {
      const byTeam = candidates.filter(
        (m) => m.team_name?.trim().toLowerCase() === teamName.toLowerCase(),
      );
      if (byTeam.length > 0) candidates = byTeam;
    }
    if (candidates.length > 1) {
      skipped.push({
        row: i + 2,
        reason: `Multiple members found for "${email || bsId}" — add a team_name column to disambiguate.`,
      });
      continue;
    }
    const member = candidates[0];

    for (const entry of entries) {
      const dedupeKey = `${member.id}:${entry.nocType}`;
      if (existingKeys.has(dedupeKey)) {
        skipped.push({
          row: i + 2,
          reason: `${member.email ?? member.bs_id} already has a pending or approved ${entry.nocType} NOC — skipped.`,
        });
        continue;
      }

      const status: NocStatus = VALID_STATUSES.includes(entry.status as NocStatus)
        ? (entry.status as NocStatus)
        : "pending";

      const { error: insertError } = await supabase.from("noc_submissions").insert({
        member_id: member.id,
        organization_id: user!.organizationId,
        noc_type: entry.nocType,
        file_path: entry.fileUrl,
        file_name: entry.fileUrl.split("/").pop() || "NOC document",
        status,
        verified_at: status === "pending" ? null : new Date().toISOString(),
        verified_by: status === "pending" ? null : user!.id,
        rejection_reason: status === "rejected" ? entry.notes || "Imported as rejected." : null,
      });

      if (insertError) {
        skipped.push({ row: i + 2, reason: `${entry.nocType}: ${insertError.message}` });
        continue;
      }

      existingKeys.add(dedupeKey);
      imported++;
    }
  }

  queryClient.invalidateQueries();
  return { error: null, imported, skipped };
}

// ---------------------------------------------------------------------
// Super Admin cleanup: delete a submission (e.g. a duplicate left over
// from a bulk import or a re-upload race). RLS (noc_delete_admin, 0002)
// restricts this to Super Admins.
// ---------------------------------------------------------------------
export async function deleteNoc(nocId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("noc_submissions").delete().eq("id", nocId);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "NOC submission deleted." };
}

export async function bulkApproveNocs(nocIds: string[]): Promise<ActionResult> {
  if (nocIds.length === 0) return { error: "Nothing selected." };

  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = createClient();
  const { error } = await supabase
    .from("noc_submissions")
    .update({
      status: "approved",
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      rejection_reason: null,
    })
    .in("id", nocIds);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `${nocIds.length} NOC submission(s) approved.` };
}

export async function bulkDeleteNocs(nocIds: string[]): Promise<ActionResult> {
  if (nocIds.length === 0) return { error: "Nothing selected." };

  const supabase = createClient();
  const { error } = await supabase.from("noc_submissions").delete().in("id", nocIds);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: `${nocIds.length} NOC submission(s) deleted.` };
}
