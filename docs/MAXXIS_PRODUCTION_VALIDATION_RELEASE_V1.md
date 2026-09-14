# Maxxis Deal AI — Production Validation Release v1

Data: 2026-09-14  
Branch: `fix/production-real-defects`

## Resultado

A release foi promovida e validada em produção. O fluxo comercial de Property Intelligence/Maxxis usa entitlement server-side, saldo canônico de Nuggets e ownership persistente por usuário + property + capability.

## Release e infraestrutura

- Milestone: `ca8244b release(maxxis): production validation milestone`
- Compatibilidade de plano legado: `3d86494 fix(maxxis): preserve legacy plan entitlement`
- Idempotência da RPC: `d042a5b fix(maxxis): make report unlock conflict-safe`
- Vercel production: `dpl_3ihUsY9QmPa5PHYEW5J464cKi3Cd`
- URL canônica: https://dealsiftermatch.vercel.app
- Supabase project: `cyeipfskwwisbbayyaca`
- Edge Function `maxxis-chat`: publicada com o runtime entitlement atualizado.
- Migrations local/remoto: sincronizadas até `20260914110000`.
- Stash protegido `wip-maxxis-matches-pre-property-intelligence-deploy`: preservado e não aplicado.

## Defeitos P0 encontrados e corrigidos

1. A conta PRO de produção usa `users.plan_id`, mas não possuía linha ativa em `subscriptions`. O runtime a classificaria como FREE. O fallback server-side para a fonte legada foi adicionado sem alterar Stripe ou planos.
2. A RPC `ds_unlock_maxxis_report` retornava PostgreSQL `42702` por colisão entre a coluna `capability` e o output homônimo no `ON CONFLICT`. O conflito agora referencia explicitamente a constraint única.

Os dois problemas foram detectados antes do primeiro débito.

## Smoke comercial autenticado

Property controlada: `07343e87-1ef8-4ca5-a88e-be49d95431a7`.

| Cenário | Resultado |
| --- | --- |
| Plano efetivo | PRO |
| Saldo inicial | 98 Nuggets |
| Maxxis Analysis, primeira aquisição | `SUBSCRIPTION_INCLUDED`, débito 0 |
| Maxxis Analysis, repetição | `already_owned=true`, débito 0 |
| Deal Intelligence, primeira aquisição | `ONE_TIME_UNLOCK`, débito 5 |
| Deal Intelligence, repetição | `already_owned=true`, débito 0 |
| Saldo final | 93 Nuggets |
| Entitlements únicos | 2 |
| Reports únicos | 2 |
| Eventos de unlock | 2, total debitado 5 |

Matriz de contrato validada por testes:

- FREE: Maxxis Analysis 3; Deal Intelligence 5.
- PRO: Maxxis Analysis incluída; Deal Intelligence 5.
- Enterprise/Admin: ambas incluídas.

## Relatórios, histórico e export

- Maxxis Analysis real: gerada e persistida.
- Deal Intelligence real: gerada e persistida.
- Ambos retornaram resposta estruturada `deal_insight`.
- Nova sessão sem reutilizar o access token anterior restaurou 2/2 reports com payload.
- Reabertura não gerou novo débito.
- A fundação de export PDF/email/share permanece condicionada ao entitlement do report e é coberta pela suíte automatizada.
- Nenhum conteúdo fictício foi inserido: os payloads persistidos são respostas reais do Maxxis sobre os fatos armazenados.

## Segurança e isolamento

- RLS: usuário autenticado visualizou zero ownerships de outros usuários.
- Insert direto em `maxxis_report_entitlements`: bloqueado.
- Insert direto em `maxxis_reports`: bloqueado.
- Save de payload para property sem ownership correspondente: bloqueado.
- Unicidade por `user_id + property_id + capability`: confirmada pelo comportamento idempotente e constraint.
- Frontend não concede entitlement; aquisição e débito passam pela RPC server-side.
- `npm audit --omit=dev`: zero vulnerabilidades de produção.

## Provedores e integrações preservadas

- RentCast usage antes/depois do smoke: 5 → 5; zero chamadas novas.
- Stripe: nenhuma configuração, preço, webhook ou fluxo alterado.
- Wallet/Nuggets: nenhuma tabela paralela criada; `users.nuggets` continuou como saldo canônico.

## Gates técnicos

- Testes: PASS — 138 arquivos, 995 testes.
- Teste dirigido da ownership RPC: PASS — 6 testes.
- ESLint: PASS, zero warnings.
- TypeScript/contracts + Deno backend: PASS.
- Build local: PASS — 922 módulos.
- Build Vercel: PASS — 925 módulos no deploy do runtime.
- HTTP produção: PASS — 200 no domínio canônico.
- Dependências de produção: PASS — 0 vulnerabilidades.

## Observações

- O instalador completo reporta vulnerabilidades apenas no conjunto de desenvolvimento; o audit das dependências efetivamente embarcadas em produção retornou zero.
- Alguns avisos de source map do Sentry ocorreram para chunks sem mapa detectável, mas o upload do release foi concluído.
- O deploy Vercel aponta para `3d86494`; `d042a5b` altera somente migration e teste. A migration correspondente já está aplicada no Supabase de produção.

## Status final

PROPERTY RELEASE: PASS  
MAXXIS ANALYSIS: PASS  
DEAL INTELLIGENCE: PASS  
RUNTIME ENTITLEMENT: PASS  
NUGGET UNLOCK: PASS  
REPORT OWNERSHIP: PASS  
REPORT HISTORY: PASS  
EXPORT FOUNDATION: PASS  
SECURITY: PASS  
PRODUCTION READINESS: PASS
