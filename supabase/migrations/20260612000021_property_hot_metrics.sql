-- Real property engagement metrics for HOT feed badges.
-- Aggregates on demand to avoid storing large derived snapshots.

create index if not exists idx_app_events_property_entity_type
  on public.app_events(entity_id, event_type, created_at desc)
  where entity_type = 'property';

create or replace function public.ds_get_property_engagement_metrics(p_property_ids uuid[])
returns table (
  property_id uuid,
  unlock_count integer,
  normal_unlock_count integer,
  favorite_count integer,
  match_count integer,
  total_count integer,
  unlock_pct integer,
  favorite_pct integer,
  match_pct integer,
  hot_score integer,
  exclusivity_kind text,
  exclusivity_mode text,
  exclusive_cost integer,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_property_ids, '{}'::uuid[])) as property_id
    limit 150
  ),
  unlocks as (
    select
      pu.property_id,
      count(distinct pu.buyer_id)::integer as unlock_count,
      count(distinct pu.buyer_id) filter (where pu.mode = 'normal')::integer as normal_unlock_count
    from public.property_unlocks pu
    join requested r on r.property_id = pu.property_id
    where coalesce(pu.status, 'active') = 'active'
    group by pu.property_id
  ),
  active_exclusive as (
    select distinct on (pu.property_id)
      pu.property_id,
      pu.mode,
      pu.buyer_id,
      pu.expires_at
    from public.property_unlocks pu
    join requested r on r.property_id = pu.property_id
    where pu.mode in ('total', 'partial')
      and coalesce(pu.status, 'active') = 'active'
      and pu.expires_at > now()
    order by pu.property_id, pu.created_at desc
  ),
  favorites as (
    select
      r.property_id,
      count(distinct e.user_id)::integer as favorite_count
    from requested r
    join public.app_events e on e.entity_type = 'property'
      and e.entity_id = r.property_id::text
      and e.event_type in ('property_favorited', 'property_saved')
    group by r.property_id
  ),
  matches as (
    select
      r.property_id,
      count(distinct e.user_id)::integer as match_count
    from requested r
    join public.app_events e on e.entity_type = 'property'
      and e.entity_id = r.property_id::text
      and e.event_type in ('property_matched', 'property_match')
    group by r.property_id
  ),
  combined as (
    select
      r.property_id,
      coalesce(u.unlock_count, 0)::integer as unlock_count,
      coalesce(u.normal_unlock_count, 0)::integer as normal_unlock_count,
      coalesce(f.favorite_count, 0)::integer as favorite_count,
      coalesce(m.match_count, 0)::integer as match_count,
      ae.mode as exclusivity_mode,
      ae.buyer_id as exclusive_buyer_id,
      ae.expires_at
    from requested r
    left join unlocks u on u.property_id = r.property_id
    left join favorites f on f.property_id = r.property_id
    left join matches m on m.property_id = r.property_id
    left join active_exclusive ae on ae.property_id = r.property_id
  )
  select
    c.property_id,
    c.unlock_count,
    c.normal_unlock_count,
    c.favorite_count,
    c.match_count,
    (c.unlock_count + c.favorite_count + c.match_count)::integer as total_count,
    case when (c.unlock_count + c.favorite_count + c.match_count) > 0
      then round((c.unlock_count::numeric * 100) / (c.unlock_count + c.favorite_count + c.match_count))::integer
      else 0
    end as unlock_pct,
    case when (c.unlock_count + c.favorite_count + c.match_count) > 0
      then round((c.favorite_count::numeric * 100) / (c.unlock_count + c.favorite_count + c.match_count))::integer
      else 0
    end as favorite_pct,
    case when (c.unlock_count + c.favorite_count + c.match_count) > 0
      then round((c.match_count::numeric * 100) / (c.unlock_count + c.favorite_count + c.match_count))::integer
      else 0
    end as match_pct,
    least(100, (c.unlock_count * 25))::integer as hot_score,
    case
      when c.exclusivity_mode is not null and c.exclusive_buyer_id = auth.uid() then 'owned'
      when c.exclusivity_mode is not null then 'blocked'
      when c.normal_unlock_count = 0 then 'new'
      when c.normal_unlock_count <= 2 then 'partial'
      else 'regular'
    end as exclusivity_kind,
    c.exclusivity_mode,
    case
      when c.exclusivity_mode is not null then 0
      when c.normal_unlock_count = 0 then 20
      when c.normal_unlock_count <= 2 then 18
      else 0
    end as exclusive_cost,
    c.expires_at
  from combined c;
$$;

grant execute on function public.ds_get_property_engagement_metrics(uuid[]) to authenticated;
