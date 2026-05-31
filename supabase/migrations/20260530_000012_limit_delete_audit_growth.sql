-- Keep delete audit useful without allowing media/base64 payloads to exhaust the DB quota.
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
  original_bytes integer;
begin
  row_json := to_jsonb(old);
  owner_ref_value := coalesce(row_json ->> 'owner_id', row_json ->> 'user_id', row_json ->> 'buyer_id', row_json ->> 'seller_id');
  original_bytes := octet_length(row_json::text);

  -- Media fields may contain data URLs. Audit metadata, not the full blob payload.
  if row_json ? 'image_url' and length(coalesce(row_json ->> 'image_url', '')) > 512 then
    row_json := jsonb_set(row_json, '{image_url}', to_jsonb('[redacted-large-media-url]'::text), true);
  end if;

  if row_json ? 'video' and length(coalesce(row_json ->> 'video', '')) > 512 then
    row_json := jsonb_set(row_json, '{video}', to_jsonb('[redacted-large-media-url]'::text), true);
  end if;

  if row_json ? 'media_images' then
    row_json := row_json - 'media_images' || jsonb_build_object(
      'media_images_summary',
      jsonb_build_object(
        'redacted', true,
        'count', coalesce(jsonb_array_length(row_json -> 'media_images'), 0)
      )
    );
  end if;

  -- Profile payloads can include thumbnails/data URLs. Keep scalar columns and mark payload redacted.
  if row_json ? 'profile_payload' and octet_length(coalesce((row_json -> 'profile_payload')::text, '')) > 4096 then
    row_json := row_json - 'profile_payload' || jsonb_build_object(
      'profile_payload_summary',
      jsonb_build_object('redacted', true)
    );
  end if;

  if octet_length(row_json::text) > 20000 then
    row_json := jsonb_build_object(
      'id', row_json ->> 'id',
      'owner_id', row_json ->> 'owner_id',
      'user_id', row_json ->> 'user_id',
      'title', row_json ->> 'title',
      'category', row_json ->> 'category',
      'created_at', row_json ->> 'created_at',
      'updated_at', row_json ->> 'updated_at',
      '_audit_redacted', true,
      '_audit_original_bytes', original_bytes
    );
  else
    row_json := row_json || jsonb_build_object('_audit_original_bytes', original_bytes);
  end if;

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

  -- Free-plan guardrail: keep recent audit entries only.
  delete from public.deleted_records_audit
  where deleted_at < now() - interval '30 days';

  delete from public.deleted_records_audit
  where id in (
    select id
    from public.deleted_records_audit
    order by deleted_at desc, id desc
    offset 5000
  );

  return old;
end;
$$;
