# QA manual - ds_get_unlocked_contact_cards

Objetivo: validar diretamente no Supabase que a RPC retorna o mesmo resultado para o mesmo `user_id`, sem depender de device, cache, `localStorage` ou payload antigo do frontend.

Como o SQL Editor nao roda automaticamente com a sessao de um usuario final, cada teste abaixo simula o JWT do usuario com `set_config`. Substitua os UUIDs encontrados nas CTEs quando quiser testar um caso especifico.

## 1. Usuario com unlock simples de contato

Resultado esperado:
- Retorna pelo menos um objeto.
- `owner_id` = `seller_id` do unlock.
- `unlock_scope` = `contact`.
- `contact.email`, `contact.phone_primary` e/ou `contact.whatsapp` aparecem se existirem no cadastro do owner.

```sql
begin;

with sample as (
  select buyer_id, seller_id
  from public.unlocks
  where buyer_id is not null
    and seller_id is not null
    and buyer_id is distinct from seller_id
  order by created_at desc
  limit 1
)
select
  set_config('request.jwt.claim.sub', buyer_id::text, true),
  set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', buyer_id::text)::text, true)
from sample;

with sample as (
  select buyer_id, seller_id
  from public.unlocks
  where buyer_id is not null
    and seller_id is not null
    and buyer_id is distinct from seller_id
  order by created_at desc
  limit 1
)
select jsonb_pretty(public.ds_get_unlocked_contact_cards(sample.buyer_id)) as unlocked_cards
from sample;

rollback;
```

## 2. Usuario com unlock de propriedade

Resultado esperado:
- Retorna o owner da propriedade desbloqueada.
- `unlock_scope` = `property` para unlock normal ou `exclusive` para exclusividade.
- `unlocked_property_ids` contem o `property_id`.
- `portfolio` inclui a propriedade, com `is_unlocked = true`.
- `contact` do owner e incluido, salvo se houver `exclusive_status = active_other`.

```sql
begin;

with sample as (
  select buyer_id, owner_id, property_id
  from public.property_unlocks
  where buyer_id is not null
    and owner_id is not null
    and buyer_id is distinct from owner_id
    and coalesce(status, 'active') = 'active'
  order by created_at desc
  limit 1
)
select
  set_config('request.jwt.claim.sub', buyer_id::text, true),
  set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', buyer_id::text)::text, true)
from sample;

with sample as (
  select buyer_id, owner_id, property_id
  from public.property_unlocks
  where buyer_id is not null
    and owner_id is not null
    and buyer_id is distinct from owner_id
    and coalesce(status, 'active') = 'active'
  order by created_at desc
  limit 1
)
select
  sample.property_id,
  jsonb_pretty(public.ds_get_unlocked_contact_cards(sample.buyer_id)) as unlocked_cards
from sample;

rollback;
```

## 3. Usuario que nao tem unlock

Resultado esperado:
- Retorna `[]`.
- Nenhum contato sensivel aparece.

```sql
begin;

with sample as (
  select u.id as user_id
  from public.users u
  where not exists (
    select 1 from public.unlocks x where x.buyer_id = u.id
  )
  and not exists (
    select 1 from public.property_unlocks px where px.buyer_id = u.id
  )
  and not exists (
    select 1
    from public.property_unlocks rx
    where rx.owner_id = u.id
      and rx.mode in ('total', 'partial')
      and coalesce(rx.status, 'active') = 'active'
      and rx.expires_at > now()
  )
  order by u.created_at desc
  limit 1
)
select
  set_config('request.jwt.claim.sub', user_id::text, true),
  set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', user_id::text)::text, true)
from sample;

with sample as (
  select u.id as user_id
  from public.users u
  where not exists (
    select 1 from public.unlocks x where x.buyer_id = u.id
  )
  and not exists (
    select 1 from public.property_unlocks px where px.buyer_id = u.id
  )
  and not exists (
    select 1
    from public.property_unlocks rx
    where rx.owner_id = u.id
      and rx.mode in ('total', 'partial')
      and coalesce(rx.status, 'active') = 'active'
      and rx.expires_at > now()
  )
  order by u.created_at desc
  limit 1
)
select jsonb_pretty(public.ds_get_unlocked_contact_cards(sample.user_id)) as unlocked_cards
from sample;

rollback;
```

## Checagem extra de seguranca

Resultado esperado: erro `unauthorized`.

```sql
begin;

select
  set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true),
  set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', '00000000-0000-0000-0000-000000000001')::text, true);

select public.ds_get_unlocked_contact_cards(u.id)
from public.users u
where u.id::text <> '00000000-0000-0000-0000-000000000001'
limit 1;

rollback;
```
