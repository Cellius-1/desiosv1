-- DesiOS V1 schema for Supabase (PostgreSQL)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create type public.user_role as enum ('staff', 'admin');
create type public.item_type as enum ('cold', 'hot');
create type public.checklist_status as enum ('pending', 'in_progress', 'completed', 'overdue');
create type public.task_status as enum ('pending', 'completed', 'failed');
create type public.temp_log_status as enum ('in_progress', 'completed', 'failed', 'missed');
create type public.alert_severity as enum ('reminder', 'critical');

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campus_code text not null,
  timezone text not null default 'America/Chicago',
  service_days int[] not null default '{1,2,3,4,5}',
  service_open time not null default '08:00',
  service_close time not null default '21:00',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role public.user_role not null default 'staff',
  location_id uuid not null references public.locations(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  scheduled_time time not null,
  due_time time not null,
  available_time time not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  day_type text not null default 'regular',
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_task_definitions (
  id uuid primary key default gen_random_uuid(),
  checklist_definition_id uuid not null references public.checklist_definitions(id) on delete cascade,
  sort_order int not null,
  title text not null,
  description text,
  input_type text not null,
  input_config jsonb not null default '{}'::jsonb,
  sop_section_id text,
  is_required boolean not null default true,
  friday_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique (checklist_definition_id, sort_order)
);

create table if not exists public.checklist_completions (
  id uuid primary key default gen_random_uuid(),
  checklist_definition_id uuid not null references public.checklist_definitions(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  service_date date not null,
  status public.checklist_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (checklist_definition_id, location_id, service_date)
);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  checklist_completion_id uuid not null references public.checklist_completions(id) on delete cascade,
  task_definition_id uuid not null references public.checklist_task_definitions(id) on delete cascade,
  status public.task_status not null default 'completed',
  input_value jsonb not null default '{}'::jsonb,
  photo_url text,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.users(id) on delete set null,
  unique (checklist_completion_id, task_definition_id)
);

create table if not exists public.temp_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  item_type public.item_type not null,
  min_safe_temp numeric,
  max_safe_temp numeric,
  sort_order int not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, name)
);

create table if not exists public.temp_logs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  service_date date not null,
  scheduled_time time not null,
  status public.temp_log_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (location_id, service_date, scheduled_time)
);

create table if not exists public.temp_log_entries (
  id uuid primary key default gen_random_uuid(),
  temp_log_id uuid not null references public.temp_logs(id) on delete cascade,
  temp_item_id uuid not null references public.temp_items(id) on delete cascade,
  temperature numeric,
  is_valid boolean not null,
  photo_url text,
  skipped boolean not null default false,
  logged_by uuid references public.users(id) on delete set null,
  logged_at timestamptz not null default now(),
  unique (temp_log_id, temp_item_id)
);

create table if not exists public.waste_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  service_date date not null,
  item_name text not null,
  batch_number text,
  quantity_portions numeric not null check (quantity_portions > 0),
  reason text not null,
  notes text,
  logged_by uuid references public.users(id) on delete set null,
  logged_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  alert_type text not null,
  severity public.alert_severity not null,
  module text not null,
  title text not null,
  message text not null,
  reference_id uuid,
  is_read boolean not null default false,
  is_escalated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  sale_date date not null,
  item_name text not null,
  quantity numeric not null,
  revenue numeric not null,
  source_file text,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.users(id) on delete set null
);

create table if not exists public.sop_sections (
  id text primary key,
  title text not null,
  content_md text not null,
  section_number int not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklist_completions_loc_date on public.checklist_completions(location_id, service_date);
create index if not exists idx_temp_logs_loc_date on public.temp_logs(location_id, service_date);
create index if not exists idx_temp_log_entries_log on public.temp_log_entries(temp_log_id);
create index if not exists idx_waste_entries_loc_date on public.waste_entries(location_id, service_date);
create index if not exists idx_alerts_unread on public.alerts(location_id, is_read) where is_read = false;
create index if not exists idx_sales_records_loc_date on public.sales_records(location_id, sale_date);

create or replace function public.current_location_id()
returns uuid
language sql
stable
as $$
  select location_id from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.create_unsafe_temp_alert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_location uuid;
  v_item_name text;
  v_safe text;
begin
  if new.is_valid then
    return new;
  end if;

  select tl.location_id, ti.name,
    case
      when ti.min_safe_temp is not null then '>= ' || ti.min_safe_temp::text || 'F'
      else '<= ' || ti.max_safe_temp::text || 'F'
    end
  into v_location, v_item_name, v_safe
  from public.temp_logs tl
  join public.temp_items ti on ti.id = new.temp_item_id
  where tl.id = new.temp_log_id;

  insert into public.alerts (
    location_id, alert_type, severity, module, title, message, reference_id, is_escalated
  ) values (
    v_location,
    'unsafe_temperature',
    'critical',
    'temps',
    'Unsafe temperature detected',
    v_item_name || ' recorded unsafe reading. Required safe range: ' || v_safe,
    new.temp_log_id,
    true
  );

  return new;
end;
$$;

drop trigger if exists trg_unsafe_temp_alert on public.temp_log_entries;
create trigger trg_unsafe_temp_alert
after insert on public.temp_log_entries
for each row
execute procedure public.create_unsafe_temp_alert();

create or replace function public.evaluate_alerts(p_location_id uuid, p_service_date date)
returns void
language plpgsql
security definer
as $$
declare
  v_now time := (now() at time zone 'utc')::time;
  v_due_breach_count int;
  v_missed_temp_count int;
begin
  select count(*) into v_due_breach_count
  from public.checklist_completions cc
  join public.checklist_definitions cd on cd.id = cc.checklist_definition_id
  where cc.location_id = p_location_id
    and cc.service_date = p_service_date
    and cc.status <> 'completed'
    and cd.due_time < v_now;

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

alter table public.locations enable row level security;
alter table public.users enable row level security;
alter table public.checklist_definitions enable row level security;
alter table public.checklist_task_definitions enable row level security;
alter table public.checklist_completions enable row level security;
alter table public.task_completions enable row level security;
alter table public.temp_items enable row level security;
alter table public.temp_logs enable row level security;
alter table public.temp_log_entries enable row level security;
alter table public.waste_entries enable row level security;
alter table public.alerts enable row level security;
alter table public.sales_records enable row level security;
alter table public.sop_sections enable row level security;

drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users for select using (id = auth.uid());
drop policy if exists users_admin_select on public.users;
create policy users_admin_select on public.users for select using (public.is_admin());

drop policy if exists checklist_definitions_select on public.checklist_definitions;
create policy checklist_definitions_select on public.checklist_definitions
for select using (location_id = public.current_location_id());

drop policy if exists checklist_task_definitions_select on public.checklist_task_definitions;
create policy checklist_task_definitions_select on public.checklist_task_definitions
for select using (
  exists (
    select 1 from public.checklist_definitions cd
    where cd.id = checklist_definition_id
      and cd.location_id = public.current_location_id()
  )
);

drop policy if exists checklist_completions_select on public.checklist_completions;
create policy checklist_completions_select on public.checklist_completions
for select using (location_id = public.current_location_id());
drop policy if exists checklist_completions_insert on public.checklist_completions;
create policy checklist_completions_insert on public.checklist_completions
for insert with check (location_id = public.current_location_id());
drop policy if exists checklist_completions_update on public.checklist_completions;
create policy checklist_completions_update on public.checklist_completions
for update using (location_id = public.current_location_id());

drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions
for select using (
  exists (
    select 1 from public.checklist_completions cc
    where cc.id = checklist_completion_id
      and cc.location_id = public.current_location_id()
  )
);
drop policy if exists task_completions_insert on public.task_completions;
create policy task_completions_insert on public.task_completions
for insert with check (
  exists (
    select 1 from public.checklist_completions cc
    where cc.id = checklist_completion_id
      and cc.location_id = public.current_location_id()
  )
);

drop policy if exists temp_items_select on public.temp_items;
create policy temp_items_select on public.temp_items
for select using (location_id = public.current_location_id());

drop policy if exists temp_logs_select on public.temp_logs;
create policy temp_logs_select on public.temp_logs
for select using (location_id = public.current_location_id());
drop policy if exists temp_logs_insert on public.temp_logs;
create policy temp_logs_insert on public.temp_logs
for insert with check (location_id = public.current_location_id());
drop policy if exists temp_logs_update on public.temp_logs;
create policy temp_logs_update on public.temp_logs
for update using (location_id = public.current_location_id());

drop policy if exists temp_log_entries_select on public.temp_log_entries;
create policy temp_log_entries_select on public.temp_log_entries
for select using (
  exists (
    select 1 from public.temp_logs tl
    where tl.id = temp_log_id
      and tl.location_id = public.current_location_id()
  )
);
drop policy if exists temp_log_entries_insert on public.temp_log_entries;
create policy temp_log_entries_insert on public.temp_log_entries
for insert with check (
  exists (
    select 1 from public.temp_logs tl
    where tl.id = temp_log_id
      and tl.location_id = public.current_location_id()
  )
);

drop policy if exists waste_entries_select on public.waste_entries;
create policy waste_entries_select on public.waste_entries
for select using (location_id = public.current_location_id());
drop policy if exists waste_entries_insert on public.waste_entries;
create policy waste_entries_insert on public.waste_entries
for insert with check (location_id = public.current_location_id());

drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
for select using (location_id = public.current_location_id());
drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
for insert with check (location_id = public.current_location_id() or public.is_admin());
drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts
for update using (location_id = public.current_location_id() or public.is_admin());

drop policy if exists sales_records_admin_all on public.sales_records;
create policy sales_records_admin_all on public.sales_records
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sop_sections_select on public.sop_sections;
create policy sop_sections_select on public.sop_sections
for select using (true);

insert into storage.buckets (id, name, public)
values ('temp-proofs', 'temp-proofs', false)
on conflict (id) do nothing;

drop policy if exists temp_proofs_read on storage.objects;
create policy temp_proofs_read on storage.objects
for select to authenticated
using (bucket_id = 'temp-proofs');

drop policy if exists temp_proofs_write on storage.objects;
create policy temp_proofs_write on storage.objects
for insert to authenticated
with check (bucket_id = 'temp-proofs');

-- Seed initial definitions and temp items for one location if empty.
do $$
declare
  v_loc uuid;
  v_opening uuid;
  v_midday uuid;
  v_closing uuid;
begin
  select id into v_loc from public.locations limit 1;
  if v_loc is null then
    insert into public.locations(name, campus_code) values ('Default Campus', 'DEF') returning id into v_loc;
  end if;

  insert into public.checklist_definitions(name, slug, scheduled_time, due_time, available_time, location_id)
  values
    ('Opening Inspection', 'opening', '08:00', '11:30', '08:00', v_loc),
    ('Safe Food Intervals', 'midday', '12:00', '16:00', '12:00', v_loc),
    ('Closing Procedure', 'closing', '21:00', '23:59', '21:00', v_loc)
  on conflict (slug) do nothing;

  select id into v_opening from public.checklist_definitions where slug = 'opening' and location_id = v_loc;
  select id into v_midday from public.checklist_definitions where slug = 'midday' and location_id = v_loc;
  select id into v_closing from public.checklist_definitions where slug = 'closing' and location_id = v_loc;

  insert into public.checklist_task_definitions(checklist_definition_id, sort_order, title, input_type, input_config, sop_section_id)
  values
    (v_opening, 1, 'Hand wash + PPE', 'checkbox', '{}'::jsonb, '07'),
    (v_opening, 2, 'Thermometer calibration', 'numeric_photo', '{"min":30,"max":34}'::jsonb, '07'),
    (v_opening, 3, 'Equipment verification', 'checkbox', '{}'::jsonb, '07'),
    (v_opening, 4, 'Cold storage pull + date check', 'checkbox', '{}'::jsonb, '07'),
    (v_opening, 5, 'Oven preheat + chicken', 'checkbox', '{}'::jsonb, '07'),
    (v_opening, 6, 'Protein reheat (Keema + Chole)', 'dual_numeric', '{"min":165}'::jsonb, '07'),
    (v_opening, 7, 'Sauce reheat (BM + Palak)', 'dual_numeric', '{"min":165}'::jsonb, '07'),
    (v_opening, 8, 'Final verification', 'multi_checkbox', '{"required":5}'::jsonb, '07'),
    (v_midday, 1, 'Probe every hot hold item', 'temp_workflow', '{}'::jsonb, '08'),
    (v_midday, 2, 'Visual quality check', 'quality_check', '{}'::jsonb, '09'),
    (v_midday, 3, 'Smell check', 'yes_no', '{}'::jsonb, '08'),
    (v_midday, 4, 'Inventory check', 'checkbox', '{}'::jsonb, '08'),
    (v_midday, 5, '3:30 PM hot hold rotation', 'rotation', '{}'::jsonb, '08'),
    (v_closing, 1, 'Final temp log', 'temp_workflow', '{}'::jsonb, '13')
  on conflict (checklist_definition_id, sort_order) do nothing;

  insert into public.temp_items(name, item_type, min_safe_temp, max_safe_temp, sort_order, location_id)
  values
    ('Walk-in Refrigerator', 'cold', null, 40, 1, v_loc),
    ('Freezer', 'cold', null, 0, 2, v_loc),
    ('Hot Hold - Butter Chicken', 'hot', 140, null, 3, v_loc),
    ('Hot Hold - Keema', 'hot', 140, null, 4, v_loc),
    ('Hot Hold - Chole', 'hot', 140, null, 5, v_loc),
    ('Hot Hold - Paneer', 'hot', 140, null, 6, v_loc),
    ('Hot Hold - Butter Masala', 'hot', 140, null, 7, v_loc),
    ('Hot Hold - Palak Sauce', 'hot', 140, null, 8, v_loc),
    ('Hot Hold - Basmati Rice', 'hot', 140, null, 9, v_loc)
  on conflict (location_id, name) do nothing;
end $$;
