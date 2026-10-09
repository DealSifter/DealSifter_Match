create table if not exists public.presentation_translation_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_hash text not null check(source_hash ~ '^[0-9a-f]{64}$'),
  target_locale text not null check(target_locale in ('pt','en','es')),
  source_locale text not null check(source_locale in ('pt','en','es')),
  state text not null default 'PENDING' check(state in ('PENDING','READY','FAILED')),
  translated_text text,
  created_at timestamptz not null default now(),
  translated_at timestamptz,
  primary key(user_id,source_hash,target_locale)
);
alter table public.presentation_translation_cache enable row level security;
revoke all on public.presentation_translation_cache from anon, authenticated;
grant select on public.presentation_translation_cache to authenticated;
grant all on public.presentation_translation_cache to service_role;
create policy presentation_translation_owner_read on public.presentation_translation_cache
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.ds_claim_presentation_translation(p_user_id uuid, p_source_hash text, p_source_locale text, p_target_locale text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('presentation-translate:' || p_user_id::text, 0));
  if exists (select 1 from public.presentation_translation_cache where user_id = p_user_id and source_hash = p_source_hash and target_locale = p_target_locale)
    or (select count(*) from public.presentation_translation_cache where user_id = p_user_id and created_at > now() - interval '1 hour') >= 20 then
    return false;
  end if;
  insert into public.presentation_translation_cache(user_id, source_hash, source_locale, target_locale)
    values (p_user_id, p_source_hash, p_source_locale, p_target_locale);
  return true;
end;
$$;
revoke all on function public.ds_claim_presentation_translation(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.ds_claim_presentation_translation(uuid,text,text,text) to service_role;
