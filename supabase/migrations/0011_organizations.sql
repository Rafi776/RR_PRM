-- =====================================================================
-- PRM / Team Management Platform — Phase 4: Multi-tenant, part 1
-- Organizations
-- =====================================================================
-- The portal now serves more than one organization out of the same
-- Supabase project. This migration only creates the `organizations`
-- table and seeds a row for the org that already has data in every
-- other table — 0012 adds `organization_id` everywhere and backfills
-- it to this seed row's id.
-- =====================================================================

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- Seed a row for the existing single-org data. Adjust the name/slug
-- afterward from the app or SQL editor if you want a different label —
-- what matters here is that exactly one row exists for 0012's backfill.
insert into public.organizations (name, slug)
select 'Default Organization', 'default'
where not exists (select 1 from public.organizations);

alter table public.organizations enable row level security;

-- No policy is created here: `prm_members.organization_id` (the column
-- this table's policy needs to reference) doesn't exist until 0012, and
-- `current_org_id()` isn't defined until 0013. RLS is enabled now with
-- zero policies (default-deny), and 0013 adds the real
-- `organizations_select_own` policy once both are in place. No
-- insert/update/delete policy is added at all — creating a new
-- organization is a manual bootstrap step (Supabase SQL editor /
-- service-role), not an app-facing action, for this release.

-- =====================================================================
-- End of 0011_organizations.sql
-- =====================================================================
