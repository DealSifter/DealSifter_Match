-- LGPD consent records — proof of consent per Art. 7 & 8
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  anonymous_id text,
  consent_type text not null default 'data_processing',
  version text not null default '1.0',
  accepted_at timestamptz not null default now(),
  ip_hint text,
  user_agent text,
  revoked_at timestamptz
);

create index if not exists idx_consent_records_user_id on public.consent_records(user_id);

alter table public.consent_records enable row level security;

-- Users can read their own consent records
drop policy if exists consent_records_select_own on public.consent_records;
create policy consent_records_select_own on public.consent_records
for select using (user_id = auth.uid());

-- Allow insert for authenticated users (own records)
drop policy if exists consent_records_insert_own on public.consent_records;
create policy consent_records_insert_own on public.consent_records
for insert with check (user_id = auth.uid());

-- Allow anonymous consent inserts (before auth, user_id is null)
drop policy if exists consent_records_insert_anon on public.consent_records;
create policy consent_records_insert_anon on public.consent_records
for insert with check (user_id is null and anonymous_id is not null);

-- Function to delete all user data (LGPD Art. 17 — right to erasure)
-- Cascade deletes handle most tables; this also cleans consent records
create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id != auth.uid() then
    raise exception 'Forbidden: can only delete own account';
  end if;

  -- Delete from tables with foreign keys to users
  delete from public.consent_records where user_id = target_user_id;
  delete from public.unlocks where buyer_id = target_user_id or seller_id = target_user_id;
  delete from public.matches where buyer_id = target_user_id or seller_id = target_user_id;
  delete from public.services where owner_id = target_user_id;
  -- property_images cascade from properties
  delete from public.properties where owner_id = target_user_id;
  delete from public.professional_profiles where user_id = target_user_id;
  delete from public.user_profiles where user_id = target_user_id;
  delete from public.users where id = target_user_id;

  -- Note: auth.users row is NOT deleted here — that requires admin API or
  -- a Supabase Edge Function with service_role key. The public.users ON DELETE CASCADE
  -- will handle cleanup if auth.users is deleted via admin.
end;
$$;

-- Function to export all user data as JSON (LGPD Art. 18 — right to access / portability)
create or replace function public.export_user_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if target_user_id != auth.uid() then
    raise exception 'Forbidden: can only export own data';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'user', (select to_jsonb(u) from public.users u where u.id = target_user_id),
    'user_profile', (select to_jsonb(up) from public.user_profiles up where up.user_id = target_user_id),
    'professional_profile', (select to_jsonb(pp) from public.professional_profiles pp where pp.user_id = target_user_id),
    'properties', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.properties p where p.owner_id = target_user_id),
    'property_images', (select coalesce(jsonb_agg(to_jsonb(pi)), '[]'::jsonb) from public.property_images pi where pi.property_id in (select id from public.properties where owner_id = target_user_id)),
    'services', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.services s where s.owner_id = target_user_id),
    'matches', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.matches m where m.buyer_id = target_user_id or m.seller_id = target_user_id),
    'unlocks', (select coalesce(jsonb_agg(to_jsonb(ul)), '[]'::jsonb) from public.unlocks ul where ul.buyer_id = target_user_id or ul.seller_id = target_user_id),
    'consent_records', (select coalesce(jsonb_agg(to_jsonb(cr)), '[]'::jsonb) from public.consent_records cr where cr.user_id = target_user_id)
  ) into result;

  return result;
end;
$$;
