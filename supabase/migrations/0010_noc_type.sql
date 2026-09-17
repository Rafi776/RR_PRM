-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): District vs Unit NOC
-- =====================================================================
-- A member's NOC compliance now has two independent parts: a District
-- NOC and a Unit NOC, each uploaded and reviewed separately. Existing
-- rows (pre-dating this distinction) are backfilled as 'district' —
-- an assumption worth confirming/correcting manually if any of those
-- were actually unit-level documents.
-- =====================================================================

alter table public.noc_submissions
  add column if not exists noc_type text not null default 'district'
    check (noc_type in ('district', 'unit'));

comment on column public.noc_submissions.noc_type is
  'Which NOC this submission is: district (from the District Scout organization) or unit (from the local Unit/Group). A member uploads both, independently reviewed.';

create index if not exists noc_submissions_type_idx on public.noc_submissions (noc_type);

-- =====================================================================
-- End of 0010_noc_type.sql
-- =====================================================================
