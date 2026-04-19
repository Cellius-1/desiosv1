-- Migration: auth profile auto-creation + strict checklist status transitions
-- Run this after base schema.sql is applied.

create extension if not exists pgcrypto;

create table if not exists public.alert_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  status text not null,
  details text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_alert_delivery_logs_alert_id
on public.alert_delivery_logs(alert_id);

alter table public.alert_delivery_logs enable row level security;

drop policy if exists alert_delivery_logs_admin_select on public.alert_delivery_logs;
create policy alert_delivery_logs_admin_select on public.alert_delivery_logs
for select using (public.is_admin());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid;
  v_display_name text;
  v_role text;
begin
  select id into v_location_id
  from public.locations
  order by created_at asc
  limit 1;

  if v_location_id is null then
    insert into public.locations(name, campus_code)
    values ('Default Campus', 'DEF')
    returning id into v_location_id;
  end if;

  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'DesiOS User'
  );

  v_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'staff'));
  if v_role not in ('staff', 'admin') then
    v_role := 'staff';
  end if;

  insert into public.users (id, email, display_name, role, location_id)
  values (
    new.id,
    new.email,
    v_display_name,
    v_role::public.user_role,
    v_location_id
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.users.display_name, excluded.display_name),
    location_id = coalesce(public.users.location_id, excluded.location_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.validate_checklist_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_time time;
  v_required_task_count int;
  v_completed_required_count int;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status not in ('in_progress', 'overdue') then
    raise exception 'Invalid transition from pending to %', new.status;
  end if;

  if old.status = 'in_progress' and new.status not in ('completed', 'overdue') then
    raise exception 'Invalid transition from in_progress to %', new.status;
  end if;

  if old.status = 'overdue' and new.status not in ('completed') then
    raise exception 'Invalid transition from overdue to %', new.status;
  end if;

  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'Completed checklist cannot transition to %', new.status;
  end if;

  if new.status = 'overdue' then
    select cd.due_time
    into v_due_time
    from public.checklist_definitions cd
    where cd.id = new.checklist_definition_id;

    if current_time <= v_due_time and new.service_date >= current_date then
      raise exception 'Cannot set checklist to overdue before due_time (%).', v_due_time;
    end if;
  end if;

  if new.status = 'completed' then
    select count(*) into v_required_task_count
    from public.checklist_task_definitions ctd
    where ctd.checklist_definition_id = new.checklist_definition_id
      and ctd.is_required = true
      and (ctd.friday_only = false or extract(isodow from new.service_date) = 5);

    select count(*) into v_completed_required_count
    from public.task_completions tc
    join public.checklist_task_definitions ctd
      on ctd.id = tc.task_definition_id
    where tc.checklist_completion_id = new.id
      and tc.status = 'completed'
      and ctd.is_required = true
      and (ctd.friday_only = false or extract(isodow from new.service_date) = 5);

    if v_completed_required_count < v_required_task_count then
      raise exception 'Checklist cannot be completed until all required tasks are completed (%/%).',
        v_completed_required_count, v_required_task_count;
    end if;

    if new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_checklist_status_transition on public.checklist_completions;
create trigger trg_validate_checklist_status_transition
before update on public.checklist_completions
for each row execute procedure public.validate_checklist_status_transition();

create or replace function public.transition_checklist_completion(
  p_completion_id uuid,
  p_target_status public.checklist_status
)
returns public.checklist_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.checklist_completions;
begin
  update public.checklist_completions
  set status = p_target_status,
      completed_at = case when p_target_status = 'completed' then coalesce(completed_at, now()) else completed_at end
  where id = p_completion_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Checklist completion % not found', p_completion_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.transition_checklist_completion(uuid, public.checklist_status) to authenticated;

create or replace function public.evaluate_alerts(p_location_id uuid, p_service_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now time := (now() at time zone 'utc')::time;
  v_due_breach_count int;
  v_missed_temp_count int;
begin
  update public.checklist_completions cc
  set status = 'overdue'
  from public.checklist_definitions cd
  where cc.checklist_definition_id = cd.id
    and cc.location_id = p_location_id
    and cc.service_date = p_service_date
    and cc.status in ('pending', 'in_progress')
    and cd.due_time < v_now;

  select count(*) into v_due_breach_count
  from public.checklist_completions cc
  where cc.location_id = p_location_id
    and cc.service_date = p_service_date
    and cc.status = 'overdue';

  if v_due_breach_count > 0 then
    insert into public.alerts(location_id, alert_type, severity, module, title, message, is_escalated)
    values (
      p_location_id,
      'checklist_deadline_breach',
      'critical',
      'checklists',
      'Checklist overdue',
      'At least one required checklist is overdue.',
      true
    );
  end if;

  select count(*) into v_missed_temp_count
  from (
    select st.scheduled_time
    from (values ('11:30'::time), ('13:30'::time), ('15:30'::time), ('17:30'::time), ('19:30'::time), ('21:00'::time)) as st(scheduled_time)
    left join public.temp_logs tl
      on tl.location_id = p_location_id
     and tl.service_date = p_service_date
     and tl.scheduled_time = st.scheduled_time
    where st.scheduled_time + interval '30 min' < v_now
      and tl.id is null
  ) missed;

  if v_missed_temp_count > 0 then
    insert into public.alerts(location_id, alert_type, severity, module, title, message, is_escalated)
    values (
      p_location_id,
      'missed_temp_checkin',
      'critical',
      'temps',
      'Temperature check-in missed',
      'One or more scheduled temperature check-ins were missed by over 30 minutes.',
      true
    );
  end if;
end;
$$;
