-- ============================================================================
-- CareLedger Production PostgreSQL Schema & Row-Level Security
-- ============================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('elder', 'caregiver')),
  full_name text not null,
  email text not null,
  phone text,
  emergency_contact_phone text,
  emergency_notes text,
  pin_hash text, -- Never store plaintext PINs
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. CARE RELATIONSHIPS TABLE
create table if not exists public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  relationship_type text not null default 'family',
  status text not null check (status in ('active', 'pending', 'revoked')) default 'active',
  invite_code text unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists care_relationships_active_unique on public.care_relationships (elder_id, caregiver_id) where status = 'active';

-- 3. MEDICATIONS TABLE
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  strength text not null,
  instructions text not null,
  prescribing_doctor text,
  rx_number text,
  warnings text,
  status text not null check (status in ('active', 'discontinued')) default 'active',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. MEDICATION SCHEDULES TABLE
create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  time_of_day text not null,
  exact_time time,
  days_of_week int[] default '{0,1,2,3,4,5,6}' not null,
  dose_amount text not null default '1 pill',
  active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 5. DOSE LOGS TABLE (Deterministic 7-State Engine)
create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  medication_id uuid not null references public.medications(id) on delete cascade,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('scheduled', 'reminded', 'taken', 'not_yet', 'unsure', 'unconfirmed', 'skipped')) default 'scheduled',
  reminded_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  actor_role text check (actor_role in ('elder', 'caregiver', 'system')),
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 6. CAREGIVER ALERTS TABLE
create table if not exists public.caregiver_alerts (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  dose_log_id uuid references public.dose_logs(id) on delete cascade,
  alert_type text not null check (alert_type in ('unconfirmed_dose', 'unsure_dose', 'missed_appointment')),
  urgency text not null check (urgency in ('medium', 'high', 'critical')) default 'high',
  status text not null check (status in ('open', 'claimed', 'resolved')) default 'open',
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz default now() not null
);

-- 7. APPOINTMENTS TABLE
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  doctor_name text not null,
  clinic_address text,
  scheduled_at timestamptz not null,
  companion_notes text,
  status text not null check (status in ('upcoming', 'completed', 'cancelled')) default 'upcoming',
  created_at timestamptz default now() not null
);

-- 8. AUDIT LOGS TABLE (Append-Only)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz default now() not null
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.care_relationships enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.dose_logs enable row level security;
alter table public.caregiver_alerts enable row level security;
alter table public.appointments enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES POLICIES
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Caregivers can view linked elder profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = profiles.id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

create policy "Elders can view linked caregiver profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.caregiver_id = profiles.id
        and care_relationships.elder_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- CARE RELATIONSHIPS POLICIES
create policy "Elders and caregivers can view their relationships"
  on public.care_relationships for select
  using (auth.uid() = elder_id or auth.uid() = caregiver_id);

create policy "Authenticated users can create relationship links"
  on public.care_relationships for insert
  with check (auth.uid() = elder_id or auth.uid() = caregiver_id);

create policy "Caregiver or elder can update relationship status"
  on public.care_relationships for update
  using (auth.uid() = elder_id or auth.uid() = caregiver_id);

-- MEDICATIONS POLICIES
create policy "Elder can view and manage own medications"
  on public.medications for all
  using (auth.uid() = elder_id);

create policy "Authorized caregiver can view elder medications"
  on public.medications for select
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = medications.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

create policy "Authorized caregiver can insert and update elder medications"
  on public.medications for all
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = medications.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

-- MEDICATION SCHEDULES POLICIES
create policy "Elder can view and manage schedules"
  on public.medication_schedules for all
  using (auth.uid() = elder_id);

create policy "Authorized caregiver can manage elder schedules"
  on public.medication_schedules for all
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = medication_schedules.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

-- DOSE LOGS POLICIES
create policy "Elder can view and update own doses"
  on public.dose_logs for all
  using (auth.uid() = elder_id);

create policy "Authorized caregiver can view and manage elder doses"
  on public.dose_logs for all
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = dose_logs.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

-- CAREGIVER ALERTS POLICIES
create policy "Elder can view own alerts"
  on public.caregiver_alerts for select
  using (auth.uid() = elder_id);

create policy "Authorized caregiver can view and resolve alerts"
  on public.caregiver_alerts for all
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = caregiver_alerts.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

-- APPOINTMENTS POLICIES
create policy "Elder can manage appointments"
  on public.appointments for all
  using (auth.uid() = elder_id);

create policy "Caregiver can manage elder appointments"
  on public.appointments for all
  using (
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = appointments.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

-- AUDIT LOGS POLICIES (Strictly Append-Only)
create policy "Elder and Caregiver can view audit logs"
  on public.audit_logs for select
  using (
    auth.uid() = elder_id or
    exists (
      select 1 from public.care_relationships
      where care_relationships.elder_id = audit_logs.elder_id
        and care_relationships.caregiver_id = auth.uid()
        and care_relationships.status = 'active'
    )
  );

create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  with check (auth.uid() is not null);

-- Disallow UPDATE and DELETE on audit logs completely
-- (No policies created for UPDATE or DELETE on public.audit_logs)
