# Property Intelligence — Fase 1D-CORE

Data: 2026-09-10
Branch: `fix/production-real-defects`
Escopo: P0 hardening local, sem deploy, entitlement ou chamada RentCast.

## Decisões e controles

- Frontend feature exposure: `VITE_PROPERTY_INTELLIGENCE_ENABLED`. Default seguro: `false`. Ausente, vazio ou inválido fica OFF; somente `true` habilita a montagem da UI.
- Com `VITE_PROPERTY_INTELLIGENCE_ENABLED=false`, `PropertyIntelligenceGate` não monta `PropertyIntelligenceSection`; portanto a UI não origina entitlement/evidence/request para `property-intelligence`.
- `PROPERTY_INTELLIGENCE_EXPOSURE` permanece como controle backend/exposure existente e não substitui o kill switch frontend.
- Exposição da seção e entitlement são controles independentes. A seção pode ser pública no estado `LOCKED`; somente grant explícito alcança `UNLOCKED`.
- `PROPERTY_DATA_MODE` aceita efetivamente apenas `live` no endpoint de produção; qualquer outro valor opera como `disabled`. O modo `mock` também é recusado pela factory fora de `NODE_ENV=test`.
- Em `disabled`, o fluxo encerra antes do entitlement, criação do serviço, leitura de property/cache, reserva de uso ou provider.
- O cache passa a persistir o SHA-256 do endereço canônico. Entrada legada sem fingerprint ou entrada de outro endereço é cache miss.
- O miss usa lease no PostgreSQL por `property_id`. O vencedor consulta e preenche o cache; os demais aguardam, adquirem a lease e reutilizam o cache. Falha deixa a lease retida para impedir repetição automática de custo incerto e exige reconciliação operacional.
- A fixture `07343e87-1ef8-4ca5-a88e-be49d95431a7` fica protegida por filtro no repositório e constraint local que impede publicação acidental.

## Evidências

- P0-1 kill switch: testes `disabled access ignores a positive grant`, `disabled does zero repository/cache/provider work` e `mock mode is fail-closed`.
- P0-2 cache/address: teste de troca de endereço e verificação do fingerprint persistido.
- P0-3 concorrência: teste paralelo com quatro instâncias independentes comprova uma reserva e uma chamada simulada ao provider.
- P0-4 visibilidade: estado público `LOCKED` não contém evidência e não debita Nuggets; E2E mocked LOCKED/UNLOCKED 2/2.
- P0-5 privacidade, por consultas somente leitura em produção: fixture unpublished, Feed/MapView, Maxxis Search, public detail, other-user unlocked portfolio e anonymous base listing — 6/6 PASS.
- P1-6 tipos: `npm run typecheck:property-intelligence` verifica o barrel compartilhado, validação manual e entrypoint Edge com Deno; foi incorporado a `audit:types` e `audit:types:remote`.

## Gates

- Testes direcionados: 15 arquivos / 87 testes — PASS.
- E2E UI isolado: 2/2 — PASS.
- Type-check Deno do backend: PASS.
- Build local: PASS, 898 módulos.
- Suíte completa: 96 arquivos / 766 testes — PASS.
- `git diff --check`: PASS; apenas avisos de conversão LF/CRLF do Git.

## Restrições respeitadas

- RentCast live: ZERO chamadas.
- Deploy: ZERO.
- Entitlements: ZERO alterações.
- Migrations remotas: ZERO aplicações.
- Stash `wip-maxxis-matches-pre-property-intelligence-deploy`: não tocado.

As migrations de fingerprint, lease e proteção da fixture permanecem locais e deverão ser revisadas/aplicadas somente na fase autorizada seguinte.
