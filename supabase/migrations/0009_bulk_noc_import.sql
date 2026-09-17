-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): admin bulk NOC
-- import from CSV/Excel
-- =====================================================================
-- `noc_insert_own` (0002) only lets a member insert their own NOC row.
-- An admin/leadership bulk-importing NOC records on behalf of many
-- members (e.g. from an existing compliance spreadsheet, with a link
-- to each member's already-hosted certificate) needs to insert rows
-- for OTHER members too. Adds a second, additive insert policy scoped
-- the same way the rest of this table's admin/leadership access is
-- (shares_team_with / is_super_admin) — noc_insert_own is untouched,
-- so self-service upload keeps working exactly as before.
-- =====================================================================

create policy noc_insert_admin_or_leadership
  on public.noc_submissions for insert
  to authenticated
  with check (public.shares_team_with(member_id) or public.is_super_admin());

-- =====================================================================
-- End of 0009_bulk_noc_import.sql
-- =====================================================================
