-- =====================================================================
-- PRM / Team Management Platform — Phase 1 (cont.): prm_members fields
-- =====================================================================
-- Adds the additional profile fields requested for prm_members, while
-- preserving the 1:1 link to auth.users.id (uuid) that every other
-- table's foreign keys and every RLS policy depend on. See requirement
-- #1: "Link prm_members 1:1 with auth.users.id" — id stays the PK, it
-- is NOT switched to a bigint identity or to email, so nothing else in
-- the schema needs to change.
--
-- avatar_url is renamed to photo (same purpose, requested name).
-- full_name is left as-is (renaming it would touch the scoring views
-- and every data-layer query that selects it — out of scope here).
-- =====================================================================

alter table public.prm_members
  add column if not exists stage        text,
  add column if not exists scout_group  text,
  add column if not exists district     text,
  add column if not exists team_name    text,
  add column if not exists position     text;

alter table public.prm_members
  rename column avatar_url to photo;

comment on column public.prm_members.team_name is
  'Free-text team label from external/import data. Operational team assignment for RBAC and task/meeting scoping is still tracked relationally via team_memberships — this column does not drive access control.';

comment on column public.prm_members.position is
  'Free-text role/position label from external/import data (e.g. "Scout Leader"). Distinct from team_memberships.is_coordinator / is_deputy_coordinator / core_role, which drive RBAC.';

-- =====================================================================
-- End of 0004_prm_members_fields.sql
-- =====================================================================
