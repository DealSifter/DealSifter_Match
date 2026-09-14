# Maxxis Investor Report QA + Production Readiness v1

## Resultado executivo

**PRODUCTION READINESS: NOT READY para ativação comercial.**

Os relatórios, schemas, filtros de payload, entitlement no frontend, proteção de Property Intelligence no backend e fundações de exportação estão consistentes. O bloqueio remanescente é arquitetural: o contrato backend dos níveis `PROPERTY_RELEASE`, `MAXXIS_ANALYSIS` e `DEAL_INTELLIGENCE` existe em `_shared/maxxis/intelligenceAccess.ts`, mas não está conectado ao runtime de `maxxis-chat`. Assim, a proteção comercial por plano ainda depende do frontend, embora evidência Property Intelligence/ARV continue protegida separadamente por RPC, entitlement e RLS.

## Report Integrity Validator

Antes da preparação de PDF, valida:

- schema reconhecido;
- property persistente e informação básica;
- provenance;
- entitlement correspondente a report type e canal;
- contexto Maxxis para Level 2;
- evidence, valuation e comparables explicitamente tratados para Level 3.

O renderer falha fechado com `VALIDATION_FAILED` e documento nulo.

## Intelligence Consistency Validator

- ARV indisponível exige range e referência central nulos.
- ARV exibido exige faixa válida, comparáveis e confidence do motor.
- USED exige venda registrada; grupos PRIMARY/USED, SUPPORTING/SUPPORT e EXCLUDED permanecem separados.
- KPI somente é aceito com preço, reforma e faixa ARV; insuficiência permanece explícita e nula.
- Property Release não admite conteúdo premium; Maxxis Analysis não admite evidence/comps/valuation.
- Limites: Free 1 página, Pro até 3 e Enterprise até 6.
- Linguagem de garantia, lucro certo, ausência de risco ou compra imediata é rejeitada.

## Segurança

Confirmado no código:

- tabelas de Property Intelligence possuem RLS;
- RPC de entitlement usa usuário autenticado;
- ARV/cache exige entitlement antes da leitura;
- schemas filtram payload conforme o nível;
- frontend verifica plano antes de projetar relatório premium;
- exportação exige entitlement correspondente ao canal e tipo.

Bloqueio:

- `maxxis-chat` ainda não importa nem aplica o resolver backend de report-level entitlement. Antes de monetizar, plano e unlock de relatório devem ser carregados server-side, validados antes da execução da capability e filtrados novamente antes da resposta.

## Maxxis Cost Audit

Esta auditoria realizou zero chamadas externas. Deal Intelligence depende de artefatos já existentes e reutilizáveis:

- Property Intelligence cache;
- recorded sold evidence cache;
- ARV evaluation;
- seleção de comparáveis;
- report schema.

Telemetria real de cache hit e custo por relatório ainda deve ser agregada antes de definir preços ou Nuggets. `ONE_TIME_REPORT_UNLOCK` é apenas candidato futuro, sem valor ou débito.

## Readiness por categoria

| Categoria | Estado |
| --- | --- |
| Architecture | PASS |
| Security | BLOCKED — report-level enforcement não conectado ao runtime backend |
| Data Quality | PASS nos validadores determinísticos |
| Report Quality | PASS |
| Cost Control | PASS para esta fase sem chamadas; telemetria comercial ainda necessária |
| Monetization Readiness | BLOCKED |

## Próximos gates obrigatórios

1. Conectar entitlement dos níveis de relatório ao backend `maxxis-chat`, sem confiar em plan enviado pelo cliente.
2. Carregar plano/entitlements de fonte server-authoritative.
3. Bloquear a capability antes de montar payload premium e filtrar a resposta novamente.
4. Criar testes backend de manipulação de report type/plano e de ausência de payload premium.
5. Medir cache hits, provider calls e custo por relatório em staging.
6. Reexecutar esta auditoria; somente `READY` autoriza discutir ativação comercial.

Nenhum engine, provider, pagamento, Nugget ou deploy foi alterado nesta fase.
