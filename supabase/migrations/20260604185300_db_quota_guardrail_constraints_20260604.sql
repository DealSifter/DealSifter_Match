alter table public.user_profiles
  drop constraint if exists chk_user_profiles_photo_url_db_safe,
  add constraint chk_user_profiles_photo_url_db_safe
    check (public.ds_text_is_db_safe(photo_url, 4096));

alter table public.professional_profiles
  drop constraint if exists chk_professional_profiles_photo_b_url_db_safe,
  add constraint chk_professional_profiles_photo_b_url_db_safe
    check (public.ds_text_is_db_safe(photo_b_url, 4096));

alter table public.professional_profiles
  drop constraint if exists chk_professional_profiles_payload_db_safe,
  add constraint chk_professional_profiles_payload_db_safe
    check (
      profile_payload::text !~* 'data:(image|video|audio|application)/'
      and octet_length(coalesce(profile_payload::text, '')) <= 65536
    );

alter table public.properties
  drop constraint if exists chk_properties_video_db_safe,
  add constraint chk_properties_video_db_safe
    check (public.ds_text_is_db_safe(video, 4096));

alter table public.property_images
  drop constraint if exists chk_property_images_url_db_safe,
  add constraint chk_property_images_url_db_safe
    check (public.ds_text_is_db_safe(image_url, 4096));

alter table public.services
  drop constraint if exists chk_services_media_images_db_safe,
  add constraint chk_services_media_images_db_safe
    check (public.ds_text_array_is_db_safe(media_images, 4096));
