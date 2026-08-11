-- Phase 4B: minimal persistent operational checklist per authenticated user + property.
-- This is not a CRM, negotiation state, notification system, or action executor.

create table if not exists public.deal_workflow_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null check (code in (
    'property_reviewed',
    'provider_found',
    'provider_unlocked',
    'provider_contacted',
    'provider_replied',
    'inspection_completed',
    'survey_completed',
    'rehab_quote_received'
  )),
  status text not null default 'pending' check (status in ('pending', 'completed', 'not_applicable')),
  source text not null check (source in ('system', 'user')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint deal_workflow_items_unique_code unique (user_id, property_id, code),
  constraint deal_workflow_items_metadata_size check (octet_length(metadata::text) <= 2048),
  constraint deal_workflow_items_completed_at_check check (
    status = 'completed' or completed_at is null
  )
);

create index if not exists idx_deal_workflow_items_user_property
  on public.deal_workflow_items(user_id, property_id, created_at);

alter table public.deal_workflow_items enable row level security;

drop policy if exists deal_workflow_items_select_own on public.deal_workflow_items;
create policy deal_workflow_items_select_own
  on public.deal_workflow_items for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists deal_workflow_items_no_direct_insert on public.deal_workflow_items;
create policy deal_workflow_items_no_direct_insert
  on public.deal_workflow_items for insert
  to authenticated
  with check (false);

drop policy if exists deal_workflow_items_no_direct_update on public.deal_workflow_items;
create policy deal_workflow_items_no_direct_update
  on public.deal_workflow_items for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists deal_workflow_items_no_direct_delete on public.deal_workflow_items;
create policy deal_workflow_items_no_direct_delete
  on public.deal_workflow_items for delete
  to authenticated
  using (false);

drop trigger if exists trg_deal_workflow_items_updated_at on public.deal_workflow_items;
create trigger trg_deal_workflow_items_updated_at
before update on public.deal_workflow_items
for each row execute function public.set_updated_at();

create or replace function public.ds_set_manual_deal_workflow_item(
  p_property_id uuid,
  p_code text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := lower(trim(coalesce(p_code, '')));
  v_status text := lower(trim(coalesce(p_status, '')));
  v_item public.deal_workflow_items%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_property_id is null then
    raise exception 'property required' using errcode = '22023';
  end if;
  if v_code not in ('inspection_completed', 'survey_completed', 'rehab_quote_received') then
    raise exception 'manual workflow item not allowed' using errcode = '22023';
  end if;
  if v_status not in ('pending', 'completed') then
    raise exception 'manual workflow status not allowed' using errcode = '22023';
  end if;

  select * into v_item
  from public.deal_workflow_items dwi
  where dwi.user_id = v_user_id
    and dwi.property_id = p_property_id
    and dwi.code = v_code
    and dwi.source = 'user'
  for update;

  if v_item.id is null then
    return jsonb_build_object('success', false, 'status', 'not_found');
  end if;

  update public.deal_workflow_items
  set status = v_status,
      completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else null end
  where id = v_item.id
  returning * into v_item;

  return jsonb_build_object(
    'success', true,
    'status', v_item.status,
    'item', jsonb_build_object(
      'id', v_item.id,
      'propertyId', v_item.property_id,
      'code', v_item.code,
      'status', v_item.status,
      'source', v_item.source,
      'metadata', v_item.metadata,
      'createdAt', v_item.created_at,
      'updatedAt', v_item.updated_at,
      'completedAt', v_item.completed_at
    )
  );
end;
$$;

revoke all on public.deal_workflow_items from anon, authenticated;
grant select on public.deal_workflow_items to authenticated;
revoke all on function public.ds_set_manual_deal_workflow_item(uuid, text, text) from public;
grant execute on function public.ds_set_manual_deal_workflow_item(uuid, text, text) to authenticated;

-- Rollback:
-- revoke all on function public.ds_set_manual_deal_workflow_item(uuid, text, text) from public;
-- drop function if exists public.ds_set_manual_deal_workflow_item(uuid, text, text);
-- drop table if exists public.deal_workflow_items;
