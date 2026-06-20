-- Production identity cleanup:
-- 1) Account deletion must remove every user-owned operational row added after
--    the original LGPD function, otherwise same-email re-signups can hydrate
--    stale matches/favorites/unlocks.
-- 2) Demo seed showcase rows were useful for production-flow testing, but must
--    not appear as real feed inventory.
-- 3) Showcase read policies must include published services so service-only
--    connection cards can hydrate real owner identity without fake fallbacks.

create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := target_user_id;
begin
  if auth.uid() is null or auth.uid() <> v_user_id then
    raise exception 'Unauthorized';
  end if;

  delete from public.user_feed_actions
  where user_id = v_user_id;

  delete from public.card_spotlights
  where user_id = v_user_id
     or owner_id = v_user_id;

  delete from public.property_unlocks
  where buyer_id = v_user_id
     or owner_id = v_user_id;

  delete from public.property_images
  where property_id in (
    select p.id from public.properties p where p.owner_id = v_user_id
  );

  delete from public.properties where owner_id = v_user_id;
  delete from public.services where owner_id = v_user_id;
  delete from public.matches where buyer_id = v_user_id or seller_id = v_user_id;
  delete from public.unlocks where buyer_id = v_user_id or seller_id = v_user_id;

  delete from public.subscriptions where user_id = v_user_id;
  delete from public.nugget_purchases where user_id = v_user_id;
  delete from public.admin_nugget_grants where target_user_id = v_user_id;
  delete from public.app_events where user_id = v_user_id;

  delete from public.professional_profiles where user_id = v_user_id;
  delete from public.user_profiles where user_id = v_user_id;

  update public.consent_records
  set user_id = null,
      anonymous_id = 'deleted-' || v_user_id::text,
      revoked_at = now()
  where user_id = v_user_id;

  delete from public.users where id = v_user_id;
end;
$$;

grant execute on function public.delete_user_account(uuid) to authenticated;

drop policy if exists users_select_showcase on public.users;
create policy users_select_showcase on public.users
for select using (
  exists (
    select 1 from public.properties p
    where p.owner_id = id
      and p.is_active = true
      and p.publish_to_showcase = true
  )
  or exists (
    select 1 from public.services s
    where s.owner_id = id
      and s.publish_to_connections = true
  )
);

drop policy if exists professional_profile_select_showcase on public.professional_profiles;
create policy professional_profile_select_showcase on public.professional_profiles
for select using (
  exists (
    select 1 from public.properties p
    where p.owner_id = user_id
      and p.is_active = true
      and p.publish_to_showcase = true
  )
  or exists (
    select 1 from public.services s
    where s.owner_id = user_id
      and s.publish_to_connections = true
  )
);

delete from public.property_images
where property_id in (
  select id from public.properties where source = 'demo_seed_mock'
);

delete from public.property_unlocks
where property_id in (
  select id from public.properties where source = 'demo_seed_mock'
);

delete from public.properties
where source = 'demo_seed_mock';
