create table if not exists public.property_intelligence_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unlock_type text not null default 'property_record',
  unlocked_at timestamptz not null default now(),
  transaction_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_intelligence_entitlements_unlock_type_check
    check (unlock_type in ('property_record')),
  constraint property_intelligence_entitlements_unique
    unique (user_id, property_id, unlock_type)
);

alter table public.property_intelligence_entitlements enable row level security;

create index if not exists idx_property_intelligence_entitlements_user_property
  on public.property_intelligence_entitlements(user_id, property_id);

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.property_intelligence_entitlements'::regclass
       and tgname = 'trg_property_intelligence_entitlements_updated_at'
       and not tgisinternal
  ) then
    create trigger trg_property_intelligence_entitlements_updated_at
    before update on public.property_intelligence_entitlements
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.property_intelligence_entitlements is
  'Server-authoritative grants for Property Intelligence. Distinct from contact and property exclusivity unlocks.';

create or replace function public.ds_has_property_intelligence_entitlement(
  p_property_id uuid,
  p_unlock_type text default 'property_record'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and p_property_id is not null
    and p_unlock_type = 'property_record'
    and exists (
      select 1
        from public.property_intelligence_entitlements entitlement
       where entitlement.user_id = auth.uid()
         and entitlement.property_id = p_property_id
         and entitlement.unlock_type = p_unlock_type
    );
$$;

revoke all on public.property_intelligence_entitlements from public, anon, authenticated;
grant select, insert on public.property_intelligence_entitlements to service_role;

revoke all on function public.ds_has_property_intelligence_entitlement(uuid, text)
  from public, anon;
grant execute on function public.ds_has_property_intelligence_entitlement(uuid, text)
  to authenticated, service_role;
