begin;
-- Relax only optional inputs. Existing rows/defaulted zero values are NOT rewritten.
alter table public.properties alter column rehab drop not null;
alter table public.properties alter column rehab drop default;
alter table public.properties alter column beds drop not null;
alter table public.properties alter column beds drop default;
alter table public.properties alter column baths drop not null;
alter table public.properties alter column baths drop default;

create table public.property_fact_reviews (
 property_id uuid not null references public.properties(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 1 check(revision>0),
 state jsonb not null check(jsonb_typeof(state)='object' and pg_column_size(state)<=1048576),
 public_facts jsonb not null default '{}' check(jsonb_typeof(public_facts)='object' and pg_column_size(public_facts)<=32768),
 updated_at timestamptz not null default now(), primary key(property_id,owner_id)
);
create table public.property_fact_review_history (
 property_id uuid not null,owner_id uuid not null,revision bigint not null,
 state jsonb not null,created_at timestamptz not null default now(),
 primary key(property_id,owner_id,revision),
 foreign key(property_id,owner_id) references public.property_fact_reviews(property_id,owner_id) on delete cascade
);
create index property_fact_reviews_owner on public.property_fact_reviews(owner_id,updated_at desc);
alter table public.property_fact_reviews enable row level security;
alter table public.property_fact_review_history enable row level security;
create policy property_fact_reviews_read_owner on public.property_fact_reviews for select to authenticated using (
 owner_id=auth.uid() and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
create policy property_fact_history_read_owner on public.property_fact_review_history for select to authenticated using (
 owner_id=auth.uid() and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
revoke all on public.property_fact_reviews,public.property_fact_review_history from anon,authenticated;
grant select on public.property_fact_reviews,public.property_fact_review_history to authenticated;
grant all on public.property_fact_reviews,public.property_fact_review_history to service_role;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
 check(type in ('unlock','exclusive','spotlight_expired','support','property_data'));
create unique index property_fact_notification_dedup on public.notifications(user_id,(payload->>'property_id'),(payload->>'evidence_hash')) where type='property_data';

-- Backend-computed snapshots only. Ownership + revision are rechecked atomically.
create function public.ds_store_property_fact_review(p_property_id uuid,p_owner_id uuid,p_expected_revision bigint,p_state jsonb,p_public_facts jsonb,p_notify boolean default false)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_revision bigint;v_existing bigint;v_owner uuid;v_updated_at timestamptz;v_field text;v_fact jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
  and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception 'BACKEND_ONLY';end if;
 select owner_id,updated_at into v_owner,v_updated_at from public.properties where id=p_property_id for update;
 if v_owner is null or v_owner<>p_owner_id then raise exception 'PROPERTY_OWNER_REQUIRED';end if;
 if p_state->>'publisherUpdatedAt' is not null and (p_state->>'publisherUpdatedAt')::timestamptz is distinct from v_updated_at then raise exception 'PROPERTY_FACTS_CHANGED';end if;
 if jsonb_typeof(p_state) is distinct from 'object' or p_state->>'propertyId' is distinct from p_property_id::text
  or coalesce(p_state->>'evidenceHash','')!~'^[a-f0-9]{64}$' then raise exception 'INVALID_FACT_STATE';end if;
 -- Public facts cannot contain candidate payloads, actor/decision metadata or private fields.
 if jsonb_typeof(p_public_facts) is distinct from 'object' then raise exception 'INVALID_PUBLIC_FACTS';end if;
 for v_field,v_fact in select * from jsonb_each(p_public_facts) loop
  if v_field not in ('lotArea','apn','owner','assessedValue','propertyTax','zoning','propertyType','buildingArea','yearBuilt','beds','baths','subdivision','legalDescription')
   or jsonb_typeof(v_fact)<>'object' or coalesce(jsonb_typeof(v_fact->'value'),'missing') not in ('number','string','null')
   or coalesce(v_fact->>'state','') not in ('AVAILABLE','CONFLICTED','UNAVAILABLE','NOT_APPLICABLE')
   or exists(select 1 from jsonb_object_keys(v_fact) k where k not in ('value','unit','state','sourceType','status','freshness','year'))
   or exists(select 1 from jsonb_each(v_fact) f where f.key<>'value' and jsonb_typeof(f.value) not in ('string','number','null'))
   then raise exception 'INVALID_PUBLIC_FACTS';end if;
 end loop;
 select revision into v_existing from public.property_fact_reviews where property_id=p_property_id and owner_id=p_owner_id for update;
 if coalesce(v_existing,0)<>p_expected_revision then raise exception 'FACT_REVIEW_STALE';end if;
 v_revision:=coalesce(v_existing,0)+1;
 insert into public.property_fact_reviews(property_id,owner_id,revision,state,public_facts) values(p_property_id,p_owner_id,v_revision,p_state,p_public_facts)
 on conflict(property_id,owner_id) do update set revision=excluded.revision,state=excluded.state,public_facts=excluded.public_facts,updated_at=now();
 insert into public.property_fact_review_history(property_id,owner_id,revision,state) values(p_property_id,p_owner_id,v_revision,p_state);
 if p_notify and not exists(select 1 from public.property_fact_review_history h where h.property_id=p_property_id and h.owner_id=p_owner_id and h.revision<v_revision and h.state->>'evidenceHash'=p_state->>'evidenceHash') then
  insert into public.notifications(user_id,type,payload) values(p_owner_id,'property_data',jsonb_build_object('property_id',p_property_id,'evidence_hash',p_state->>'evidenceHash','complements',p_state->'summary'->'complements','conflicts',p_state->'summary'->'conflicts','field',coalesce((select key from jsonb_each(p_state->'rows') where value->>'state'='REVIEW_REQUIRED' limit 1),'apn')))
  on conflict do nothing;
 end if;
 return v_revision;
end $$;
revoke all on function public.ds_store_property_fact_review(uuid,uuid,bigint,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ds_store_property_fact_review(uuid,uuid,bigint,jsonb,jsonb,boolean) to service_role;

-- Sanitized PUBLIC projection; never returns the private state, evidence sets or decisions.
create function public.ds_public_effective_property_facts(p_property_ids uuid[])
returns table(property_id uuid,facts jsonb) language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,case when not coalesce(p.hide_street_address_on_card,false) or p.owner_id=auth.uid() or public.ds_is_current_user_admin()
  then r.public_facts else r.public_facts-array['apn','owner','legalDescription','subdivision']::text[] end
 from public.properties p join public.property_fact_reviews r on r.property_id=p.id and r.owner_id=p.owner_id
 where p.id=any(p_property_ids) and cardinality(p_property_ids)<=128 and p.is_active and p.publish_to_showcase and not coalesce(p.deal_closed,false);
$$;
revoke all on function public.ds_public_effective_property_facts(uuid[]) from public;
grant execute on function public.ds_public_effective_property_facts(uuid[]) to anon,authenticated,service_role;
commit;
