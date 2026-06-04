create or replace function public.ds_enforce_db_soft_quota()
returns trigger
language plpgsql
as $$
declare
  soft_quota_bytes bigint := 450 * 1024 * 1024;
  current_bytes bigint;
begin
  current_bytes := pg_database_size(current_database());

  if current_bytes > soft_quota_bytes then
    raise exception 'DealSifter database soft quota reached (% bytes). Cleanup is required before saving more data.', current_bytes
      using errcode = '54000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_db_soft_quota on public.user_profiles;
create trigger trg_user_profiles_db_soft_quota
before insert or update on public.user_profiles
for each row execute function public.ds_enforce_db_soft_quota();

drop trigger if exists trg_professional_profiles_db_soft_quota on public.professional_profiles;
create trigger trg_professional_profiles_db_soft_quota
before insert or update on public.professional_profiles
for each row execute function public.ds_enforce_db_soft_quota();

drop trigger if exists trg_properties_db_soft_quota on public.properties;
create trigger trg_properties_db_soft_quota
before insert or update on public.properties
for each row execute function public.ds_enforce_db_soft_quota();

drop trigger if exists trg_property_images_db_soft_quota on public.property_images;
create trigger trg_property_images_db_soft_quota
before insert or update on public.property_images
for each row execute function public.ds_enforce_db_soft_quota();

drop trigger if exists trg_services_db_soft_quota on public.services;
create trigger trg_services_db_soft_quota
before insert or update on public.services
for each row execute function public.ds_enforce_db_soft_quota();
