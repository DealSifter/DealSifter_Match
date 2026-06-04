create or replace function public.ds_text_is_db_safe(value text, max_bytes integer default 4096)
returns boolean
language sql
immutable
as $$
  select value is null
    or (
      value !~* '^data:(image|video|audio|application)/'
      and octet_length(value) <= max_bytes
    );
$$;

create or replace function public.ds_text_array_is_db_safe(value text[], max_bytes integer default 4096)
returns boolean
language sql
immutable
as $$
  select value is null
    or not exists (
      select 1
      from unnest(value) as item
      where not public.ds_text_is_db_safe(item, max_bytes)
    );
$$;

create or replace function public.ds_redact_inline_media_jsonb(value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  item jsonb;
  key text;
  item_value jsonb;
  scalar_text text;
begin
  if value is null then
    return null;
  end if;

  if jsonb_typeof(value) = 'string' then
    scalar_text := value #>> '{}';
    if scalar_text ~* '^data:(image|video|audio|application)/' then
      return to_jsonb(''::text);
    end if;
    return value;
  end if;

  if jsonb_typeof(value) = 'array' then
    result := '[]'::jsonb;
    for item in select jsonb_array_elements(value)
    loop
      result := result || jsonb_build_array(public.ds_redact_inline_media_jsonb(item));
    end loop;
    return result;
  end if;

  if jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for key, item_value in select * from jsonb_each(value)
    loop
      result := result || jsonb_build_object(key, public.ds_redact_inline_media_jsonb(item_value));
    end loop;
    return result;
  end if;

  return value;
end;
$$;
