-- ============================================================
-- Migration 013 — Atomic property images replace RPC
-- Prevents partial delete/insert data loss on property_images sync
-- ============================================================

create or replace function public.replace_property_images(
  p_property_id uuid,
  p_image_urls text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select owner_id
    into v_owner_id
  from public.properties
  where id = p_property_id;

  if v_owner_id is null then
    raise exception 'Property not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  v_count := coalesce(array_length(p_image_urls, 1), 0);
  if v_count > 10 then
    raise exception 'Max 10 images per property';
  end if;

  delete from public.property_images
  where property_id = p_property_id;

  if v_count > 0 then
    insert into public.property_images (property_id, image_url, sort_order)
    select
      p_property_id,
      trim(img_url),
      ordinality::integer - 1
    from unnest(p_image_urls) with ordinality as t(img_url, ordinality)
    where coalesce(trim(img_url), '') <> '';
  end if;
end;
$$;

revoke all on function public.replace_property_images(uuid, text[]) from public;
grant execute on function public.replace_property_images(uuid, text[]) to authenticated;
