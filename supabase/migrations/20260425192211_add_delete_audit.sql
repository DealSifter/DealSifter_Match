-- Capture deleted critical records for disaster recovery.
create table if not exists public.deleted_records_audit (
  id bigserial primary key,
  table_name text not null,
  record_id text,
  owner_ref text,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  row_data jsonb not null
);

create index if not exists idx_deleted_records_audit_table_record
  on public.deleted_records_audit(table_name, record_id, deleted_at desc);

create index if not exists idx_deleted_records_audit_owner
  on public.deleted_records_audit(owner_ref, deleted_at desc);

revoke all on table public.deleted_records_audit from anon;
revoke all on table public.deleted_records_audit from authenticated;

create or replace function public.capture_deleted_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb;
  owner_ref_value text;
  actor uuid;
begin
  row_json := to_jsonb(old);
  owner_ref_value := coalesce(row_json ->> 'owner_id', row_json ->> 'user_id', row_json ->> 'buyer_id', row_json ->> 'seller_id');

  begin
    actor := auth.uid();
  exception when others then
    actor := null;
  end;

  insert into public.deleted_records_audit (
    table_name,
    record_id,
    owner_ref,
    deleted_by,
    row_data
  ) values (
    tg_table_schema || '.' || tg_table_name,
    row_json ->> 'id',
    owner_ref_value,
    actor,
    row_json
  );

  return old;
end;
$$;

drop trigger if exists trg_capture_deleted_properties on public.properties;
create trigger trg_capture_deleted_properties
before delete on public.properties
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_property_images on public.property_images;
create trigger trg_capture_deleted_property_images
before delete on public.property_images
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_services on public.services;
create trigger trg_capture_deleted_services
before delete on public.services
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_user_profiles on public.user_profiles;
create trigger trg_capture_deleted_user_profiles
before delete on public.user_profiles
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_professional_profiles on public.professional_profiles;
create trigger trg_capture_deleted_professional_profiles
before delete on public.professional_profiles
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_matches on public.matches;
create trigger trg_capture_deleted_matches
before delete on public.matches
for each row execute function public.capture_deleted_row();

drop trigger if exists trg_capture_deleted_unlocks on public.unlocks;
create trigger trg_capture_deleted_unlocks
before delete on public.unlocks
for each row execute function public.capture_deleted_row();
