# Maxxis Report Ownership & History v1

## Regra comercial

- `MAXXIS_ANALYSIS`: 3 Nuggets quando não incluído no plano.
- `DEAL_INTELLIGENCE`: 5 Nuggets quando não incluído no plano.
- PRO inclui Maxxis Analysis; Enterprise inclui ambos.
- A cobrança ocorre uma única vez por usuário, property e capability.
- Reabrir ou reler um relatório adquirido não consome Nuggets.

## Fluxo

O cliente solicita `ds_unlock_maxxis_report`. A função autenticada valida o imóvel e o plano, bloqueia a linha da carteira canônica `users.nuggets`, verifica ownership, cria o entitlement, debita quando necessário, cria o registro versionado do relatório e registra o evento. A restrição única impede clique duplo, retry e concorrência de cobrarem novamente.

## Ownership e segurança

`maxxis_report_entitlements` guarda usuário, property, capability, origem e criação. `maxxis_reports` adiciona `report_id`, payload, data e `report_version`. RLS permite somente leitura pelo proprietário; criação e débito ocorrem apenas pela função server-side usando `auth.uid()`.

## Histórico e versionamento

O conteúdo estruturado produzido é persistido por `ds_save_maxxis_report_payload`, que exige ownership server-side. O histórico é recuperado de `maxxis_reports` e nunca altera saldo; quando encontrado, o Maxxis reabre o conteúdo armazenado sem nova chamada de geração. A versão inicial é `1`. A estrutura aceita versões futuras sem definir cobrança por regeneração nesta fase.

## Infraestrutura reutilizada

Não há nova wallet, Stripe específico ou ledger financeiro. O saldo oficial permanece `users.nuggets`; a auditoria usa `app_events`, como os demais desbloqueios.
