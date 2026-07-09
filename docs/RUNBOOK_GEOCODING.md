# Runbook Geocoding

## Arquitetura

O MapView nao faz geocoding no navegador. Ele renderiza apenas pins que ja possuem `lat` e `lng` persistidos no banco, ou pins posicionados manualmente pelo usuario.

Geocoding acontece na Edge Function `geocode-address`, que tenta provedores em cascata:

1. Nominatim
2. US Census
3. Photon
4. ArcGIS

Os resultados sao cacheados em `geocode_cache(address_hash, lat, lng, provider_used, status, created_at)`.

## Fluxo De Publicacao

Ao salvar/publicar uma propriedade, o app chama `geocode-address` antes do upsert em `properties`.

Se o geocoding retornar sucesso, o registro recebe:

- `lat`
- `lng`
- `geocode_status = resolved`
- `geocode_source`
- `geocode_confidence`
- `geocode_input`
- `geocoded_at`

Se falhar, o salvamento continua e a propriedade fica sem pin ate uma correcao manual ou backfill.

## Backfill Manual

Use quando houver propriedades antigas sem coordenadas.

Pelo Supabase Dashboard:

1. Abra Edge Functions.
2. Selecione `geocode-address`.
3. Execute uma chamada `POST` autenticada como admin com:

```json
{
  "backfill": true,
  "limit": 10
}
```

Pelo terminal, com um token de usuario admin:

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/geocode-address" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"backfill\":true,\"limit\":10}"
```

## Diagnostico De Falhas

Verificar cache:

```sql
select normalized_address, status, provider_used, error, updated_at
from geocode_cache
order by updated_at desc
limit 50;
```

Ver propriedades pendentes:

```sql
select id, owner_id, address, city, state, zip, geocode_status
from properties
where lat is null
   or lng is null
   or geocode_status is null
   or geocode_status = 'pending'
order by updated_at desc
limit 50;
```

## Correcoes Manuais

Se muitos enderecos falharem:

1. Verifique se `address`, `city`, `state` e `zip` estao preenchidos corretamente.
2. Corrija dados malformados no cadastro do usuario ou via admin.
3. Rode o backfill novamente.
4. Se o endereco continuar falhando, use o fluxo de "Set pin on map" para gravar coordenadas manuais.

## Regras Operacionais

- Nao reintroduzir `fetch()` para Nominatim, Census, Photon ou ArcGIS em `MapView.jsx`.
- MapView deve tratar falta de coordenada como "Location pending".
- Pins pagos de spotlight continuam sendo subconjunto do inventario com coordenadas validas.
