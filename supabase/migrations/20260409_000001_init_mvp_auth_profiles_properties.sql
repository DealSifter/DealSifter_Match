-- DealSifter MVP schema (Auth + profiles + properties/services)
-- Run in Supabase SQL Editor or via supabase migration tooling.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  account_type text not null default 'professional' check (account_type in ('professional', 'fsbo_owner')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text,
  photo_url text,
  bio text,
  visibility text not null default 'hidden' check (visibility in ('hidden', 'public', 'network')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  category text,
  subcategory text,
  markets text[] not null default '{}',
  skills text[] not null default '{}',
  services text[] not null default '{}',
  pitch text,
  primary_category text,
  category_b text,
  primary_category_b text,
  photo_b_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  address text,
  city text,
  state text,
  zip text,
  price numeric(15,2) not null default 0,
  beds integer not null default 0,
  baths integer not null default 0,
  sqft text,
  improvement text,
  lot text,
  deal_tag text,
  objective text,
  rehab numeric(12,2) not null default 0,
  cap_rate numeric(6,2),
  description text,
  markets text[] not null default '{}',
  is_active boolean not null default true,
  publish_to_showcase boolean not null default true,
  include_in_preview boolean not null default true,
  source text,
  owner_account_type text,
  primary_profile text not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_owner_id on public.properties(owner_id);
create index if not exists idx_properties_city_state on public.properties(city, state);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_images_property_id on public.property_images(property_id);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  category text,
  description text,
  price numeric(12,2),
  media_images text[] not null default '{}',
  publish_to_connections boolean not null default true,
  markets text[] not null default '{}',
  primary_profile text not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_owner_id on public.services(owner_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'matched' check (status in ('matched', 'interested', 'unlocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, seller_id)
);

create table if not exists public.unlocks (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  nuggets_spent integer not null default 0,
  created_at timestamptz not null default now(),
  unique (buyer_id, seller_id)
);

alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.services enable row level security;
alter table public.matches enable row level security;
alter table public.unlocks enable row level security;

-- Own data policies
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select using (id = auth.uid());
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update using (id = auth.uid());

drop policy if exists profile_select_own on public.user_profiles;
create policy profile_select_own on public.user_profiles for select using (user_id = auth.uid());
drop policy if exists profile_insert_own on public.user_profiles;
create policy profile_insert_own on public.user_profiles for insert with check (user_id = auth.uid());
drop policy if exists profile_update_own on public.user_profiles;
create policy profile_update_own on public.user_profiles for update using (user_id = auth.uid());

drop policy if exists professional_profile_select_own on public.professional_profiles;
create policy professional_profile_select_own on public.professional_profiles for select using (user_id = auth.uid());
drop policy if exists professional_profile_insert_own on public.professional_profiles;
create policy professional_profile_insert_own on public.professional_profiles for insert with check (user_id = auth.uid());
drop policy if exists professional_profile_update_own on public.professional_profiles;
create policy professional_profile_update_own on public.professional_profiles for update using (user_id = auth.uid());

drop policy if exists properties_select_own on public.properties;
create policy properties_select_own on public.properties for select using (owner_id = auth.uid());
drop policy if exists properties_insert_own on public.properties;
create policy properties_insert_own on public.properties for insert with check (owner_id = auth.uid());
drop policy if exists properties_update_own on public.properties;
create policy properties_update_own on public.properties for update using (owner_id = auth.uid());
drop policy if exists properties_delete_own on public.properties;
create policy properties_delete_own on public.properties for delete using (owner_id = auth.uid());

drop policy if exists property_images_select_own on public.property_images;
create policy property_images_select_own on public.property_images
for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
drop policy if exists property_images_insert_own on public.property_images;
create policy property_images_insert_own on public.property_images
for insert with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
drop policy if exists property_images_delete_own on public.property_images;
create policy property_images_delete_own on public.property_images
for delete using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);

drop policy if exists services_select_own on public.services;
create policy services_select_own on public.services for select using (owner_id = auth.uid());
drop policy if exists services_insert_own on public.services;
create policy services_insert_own on public.services for insert with check (owner_id = auth.uid());
drop policy if exists services_update_own on public.services;
create policy services_update_own on public.services for update using (owner_id = auth.uid());
drop policy if exists services_delete_own on public.services;
create policy services_delete_own on public.services for delete using (owner_id = auth.uid());

drop policy if exists matches_select_own on public.matches;
create policy matches_select_own on public.matches for select using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists matches_insert_own on public.matches;
create policy matches_insert_own on public.matches for insert with check (buyer_id = auth.uid());
drop policy if exists matches_update_own on public.matches;
create policy matches_update_own on public.matches for update using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists unlocks_select_own on public.unlocks;
create policy unlocks_select_own on public.unlocks for select using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists unlocks_insert_own on public.unlocks;
create policy unlocks_insert_own on public.unlocks for insert with check (buyer_id = auth.uid());

-- Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_professional_profiles_updated_at on public.professional_profiles;
create trigger trg_professional_profiles_updated_at before update on public.professional_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at before update on public.properties
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at before update on public.matches
for each row execute function public.set_updated_at();

-- Mirror auth.users inserts into public.users
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
