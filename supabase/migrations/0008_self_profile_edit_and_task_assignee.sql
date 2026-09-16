-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): broaden self-service
-- profile editing; per-member task assignment
-- =====================================================================
-- 1. Members can now edit their own profile (name, stage, scout group,
--    district, team label, position, phone, photo) — everything except
--    bs_id, email, status, and the blocked_* audit columns, which stay
--    admin/leadership-managed. Relaxes the restrict_self_member_update
--    trigger from 0005/0007 accordingly (still the real boundary — the
--    app UI is just a fast-path convenience on top of it).
--
-- 2. team_tasks gains an optional assignee_id: when set, the task was
--    created for one specific member rather than a whole team. Nullable
--    FK, no RLS change needed (existing team_tasks policies already
--    cover it).
-- =====================================================================

create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() and not public.is_super_admin() then
    new.email          := old.email;
    new.bs_id          := old.bs_id;
    new.status         := old.status;
    new.blocked_at     := old.blocked_at;
    new.blocked_reason := old.blocked_reason;
    new.blocked_by     := old.blocked_by;
    -- full_name, stage, scout_group, district, team_name, position,
    -- phone, and photo are now self-editable.
  end if;
  return new;
end;
$$;

alter table public.team_tasks
  add column if not exists assignee_id uuid references public.prm_members(id) on delete set null;

comment on column public.team_tasks.assignee_id is
  'When set, this task was created for one specific member rather than seeded across the whole team. task_member_status still carries the actual per-member tracking row.';

-- =====================================================================
-- End of 0008_self_profile_edit_and_task_assignee.sql
-- =====================================================================
