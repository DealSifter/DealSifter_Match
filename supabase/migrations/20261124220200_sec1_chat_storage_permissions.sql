-- SEC-04: a recipient can acknowledge a message, never rewrite it.
revoke update on public.chat_messages from public, anon, authenticated;
do $$
declare v_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute where attrelid = 'public.chat_messages'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke update (%s) on public.chat_messages from public, anon, authenticated', v_columns);
end;
$$;
grant update (read_at) on public.chat_messages to authenticated;

-- SEC-05: remove the permissive OR alternative. Existing image URLs stay public.
drop policy if exists profile_images_owner_insert on storage.objects;
drop policy if exists property_images_owner_insert on storage.objects;

-- Staging predates the prefix policies already present in Production.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_images_insert') then
    create policy profile_images_insert on storage.objects for insert to authenticated
      with check (bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='property_images_insert') then
    create policy property_images_insert on storage.objects for insert to authenticated
      with check (bucket_id='property-images' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('authenticated','public.chat_messages','UPDATE')
    or has_any_column_privilege('anon','public.chat_messages','UPDATE')
    or exists (select 1 from pg_attribute a where a.attrelid='public.chat_messages'::regclass
      and a.attnum>0 and not a.attisdropped and a.attname<>'read_at'
      and has_column_privilege('authenticated',a.attrelid,a.attname,'UPDATE')) then
    raise exception 'SEC-1 chat permissions remain writable beyond read_at';
  end if;
end;
$$;
