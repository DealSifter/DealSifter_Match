update public.user_profiles
set photo_url = null
where not public.ds_text_is_db_safe(photo_url, 4096);

update public.professional_profiles
set photo_b_url = null
where not public.ds_text_is_db_safe(photo_b_url, 4096);

update public.properties
set video = null
where not public.ds_text_is_db_safe(video, 4096);

delete from public.property_images
where not public.ds_text_is_db_safe(image_url, 4096);

update public.services
set media_images = coalesce((
  select array_agg(trim(item) order by ordinality)
  from unnest(media_images) with ordinality as t(item, ordinality)
  where public.ds_text_is_db_safe(trim(item), 4096)
), '{}'::text[])
where not public.ds_text_array_is_db_safe(media_images, 4096);

update public.professional_profiles
set profile_payload = public.ds_redact_inline_media_jsonb(profile_payload)
where profile_payload::text ~* 'data:(image|video|audio|application)/';

update public.professional_profiles
set profile_payload = '{}'::jsonb
where octet_length(coalesce(profile_payload::text, '')) > 65536;

do $$
begin
  if to_regclass('public.deleted_records_audit') is not null then
    execute 'truncate table public.deleted_records_audit';
  end if;
end;
$$;
