-- =====================================================================
-- PRM / Team Management Platform — Phase 4: Multi-tenant, part 2
-- organization_id everywhere
-- =====================================================================
-- Adds `organization_id` to every table (root entities AND child/detail
-- tables — denormalized rather than resolved via joins, so every RLS
-- policy in 0013/0014 can be a simple, auditable `organization_id =
-- current_org_id()` check instead of a nested subquery). Every existing
-- row belongs to the single org seeded in 0011, so the backfill is the
-- same one-liner everywhere: point every row at that org's id.
--
-- Also fixes constraints that were only ever "globally unique" because
-- there used to be only one org's data: `prm_members.email`/`bs_id` and
-- `teams.name`/`slug` become unique *per organization*, and the
-- single-Core-Team index becomes one-per-organization instead of one
-- for the whole database.
-- =====================================================================

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then
    raise exception 'No organization row found — 0011_organizations.sql must run first.';
  end if;

  -- Root entities -------------------------------------------------------
  alter table public.teams add column if not exists organization_id uuid references public.organizations(id);
  update public.teams set organization_id = v_org_id where organization_id is null;
  alter table public.teams alter column organization_id set not null;

  alter table public.prm_members add column if not exists organization_id uuid references public.organizations(id);
  update public.prm_members set organization_id = v_org_id where organization_id is null;
  alter table public.prm_members alter column organization_id set not null;

  alter table public.task_types add column if not exists organization_id uuid references public.organizations(id);
  update public.task_types set organization_id = v_org_id where organization_id is null;
  alter table public.task_types alter column organization_id set not null;

  alter table public.team_tasks add column if not exists organization_id uuid references public.organizations(id);
  update public.team_tasks set organization_id = v_org_id where organization_id is null;
  alter table public.team_tasks alter column organization_id set not null;

  alter table public.team_meeting_minutes add column if not exists organization_id uuid references public.organizations(id);
  update public.team_meeting_minutes set organization_id = v_org_id where organization_id is null;
  alter table public.team_meeting_minutes alter column organization_id set not null;

  alter table public.noc_submissions add column if not exists organization_id uuid references public.organizations(id);
  update public.noc_submissions set organization_id = v_org_id where organization_id is null;
  alter table public.noc_submissions alter column organization_id set not null;

  alter table public.member_reports add column if not exists organization_id uuid references public.organizations(id);
  update public.member_reports set organization_id = v_org_id where organization_id is null;
  alter table public.member_reports alter column organization_id set not null;

  -- Child/detail tables (denormalized for simple RLS) --------------------
  alter table public.user_roles add column if not exists organization_id uuid references public.organizations(id);
  update public.user_roles set organization_id = v_org_id where organization_id is null;
  alter table public.user_roles alter column organization_id set not null;

  alter table public.team_memberships add column if not exists organization_id uuid references public.organizations(id);
  update public.team_memberships set organization_id = v_org_id where organization_id is null;
  alter table public.team_memberships alter column organization_id set not null;

  alter table public.task_member_status add column if not exists organization_id uuid references public.organizations(id);
  update public.task_member_status set organization_id = v_org_id where organization_id is null;
  alter table public.task_member_status alter column organization_id set not null;

  alter table public.task_comments add column if not exists organization_id uuid references public.organizations(id);
  update public.task_comments set organization_id = v_org_id where organization_id is null;
  alter table public.task_comments alter column organization_id set not null;

  alter table public.task_attachments add column if not exists organization_id uuid references public.organizations(id);
  update public.task_attachments set organization_id = v_org_id where organization_id is null;
  alter table public.task_attachments alter column organization_id set not null;

  alter table public.meeting_attendance add column if not exists organization_id uuid references public.organizations(id);
  update public.meeting_attendance set organization_id = v_org_id where organization_id is null;
  alter table public.meeting_attendance alter column organization_id set not null;

  -- Schema-only tables (no app/UI wiring today — see plan notes) get the
  -- column for consistency, but stay out of scope for the RLS rewrite.
  alter table public.prm_recruitment add column if not exists organization_id uuid references public.organizations(id);
  update public.prm_recruitment set organization_id = v_org_id where organization_id is null;

  alter table public.prm_submissions add column if not exists organization_id uuid references public.organizations(id);
  update public.prm_submissions set organization_id = v_org_id where organization_id is null;

  alter table public.footer_config add column if not exists organization_id uuid references public.organizations(id);
  update public.footer_config set organization_id = v_org_id where organization_id is null;
end $$;

create index if not exists teams_org_idx on public.teams (organization_id);
create index if not exists prm_members_org_idx on public.prm_members (organization_id);
create index if not exists task_types_org_idx on public.task_types (organization_id);
create index if not exists team_tasks_org_idx on public.team_tasks (organization_id);
create index if not exists team_meeting_minutes_org_idx on public.team_meeting_minutes (organization_id);
create index if not exists noc_submissions_org_idx on public.noc_submissions (organization_id);
create index if not exists member_reports_org_idx on public.member_reports (organization_id);
create index if not exists user_roles_org_idx on public.user_roles (organization_id);
create index if not exists team_memberships_org_idx on public.team_memberships (organization_id);
create index if not exists task_member_status_org_idx on public.task_member_status (organization_id);
create index if not exists task_comments_org_idx on public.task_comments (organization_id);
create index if not exists task_attachments_org_idx on public.task_attachments (organization_id);
create index if not exists meeting_attendance_org_idx on public.meeting_attendance (organization_id);

-- ---------------------------------------------------------------------
-- Uniqueness constraints that were only "global" by accident of being
-- single-org — rescope to per-organization.
-- ---------------------------------------------------------------------
alter table public.prm_members drop constraint if exists prm_members_email_key;
alter table public.prm_members drop constraint if exists prm_members_bs_id_key;
create unique index if not exists prm_members_org_email_idx
  on public.prm_members (organization_id, email);
create unique index if not exists prm_members_org_bs_id_idx
  on public.prm_members (organization_id, bs_id) where bs_id is not null;

alter table public.teams drop constraint if exists teams_name_key;
alter table public.teams drop constraint if exists teams_slug_key;
create unique index if not exists teams_org_name_idx
  on public.teams (organization_id, name);
create unique index if not exists teams_org_slug_idx
  on public.teams (organization_id, slug);

alter table public.task_types drop constraint if exists task_types_name_key;
create unique index if not exists task_types_org_name_idx
  on public.task_types (organization_id, name);

-- One Core Team per organization, not one for the whole database.
drop index if exists public.teams_single_core_team_idx;
create unique index if not exists teams_single_core_team_per_org_idx
  on public.teams (organization_id)
  where is_core_team = true;

-- =====================================================================
-- End of 0012_organization_id_columns.sql
-- =====================================================================
