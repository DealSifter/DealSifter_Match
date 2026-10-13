# Production baseline reconciliation — 2026-10-11

## Escopo e conclusão

Somente leitura de produção; sem implementação, deploy, migração, reparo de testes ou alteração de configuração persistente. Únicas escritas autorizadas: este relatório, cópias isoladas de evidência e outputs locais de build/testes. O prompt atual suspende a instrução anterior de commit/push/deploy automático.

Frontend: SHA de produção **comprovado** pela API de deployment da Vercel, igual ao HEAD local. Migrações: **134/134 versões coincidentes**, sem versões ausentes em nenhum lado. Código Supabase: comparação de bundles ainda não concluída; números de versão e datas não substituem fingerprints de fonte. Não iniciar correção P0 enquanto essa lacuna permanecer.

## 1. Estado local e remoto Git

- Branch: `fix/production-real-defects`.
- HEAD: `d9ea801ffd1c57a85e418acddb0c198be744a02c`.
- Upstream: `origin/fix/production-real-defects`.
- Ahead/behind contra tracking local: `0/0`.
- `git ls-remote origin refs/heads/fix/production-real-defects` confirmou o mesmo SHA remoto, sem fetch e sem alterar refs locais.
- `git status --short`: somente `?? qa/current-state-audit/`; documentos da auditoria anterior e desta reconciliação. `git diff --stat` e `git diff --cached --stat` vazios.
- Última mudança em `supabase/functions`: `2695d4f0583b1459034ad4a2ac42acb0db65187c`. Isso identifica a revisão local dos arquivos, **não** a revisão dos bundles remotos.
- 34 stashes preservados. Relevantes: `stash@{0}` — `wip-maxxis-matches-pre-property-intelligence-deploy`; `stash@{1}` — `backup pre maxxis release workspace 2026-08-11`; demais 32 são backups automáticos lint-staged. Nenhum aplicado, descartado ou reordenado. Worktrees existentes não alterados.

Últimos 15 commits, mais recente primeiro:

| SHA curto | Data local | Assunto |
|---|---|---|
| d9ea801 | 2026-10-11 14:55:11 -03:00 | fix: unify map and Matches unlock state and compact profile popups |
| 3df76a0 | 2026-10-10 00:21:34 -03:00 | fix: widen pin portfolio carousel and preserve complete Maxxis avatar |
| 2695d4f | 2026-10-09 22:52:45 -03:00 | feat: add scoped map pin previews and dual-comp land development intelligence |
| fa8440d | 2026-10-09 21:13:47 -03:00 | fix(maxxis): stabilize conversational avatar and unify chat typography |
| 84c2563 | 2026-10-09 17:12:12 -03:00 | Localize profile narrative subtitles while preserving card summaries |
| aed14b6 | 2026-10-09 17:03:37 -03:00 | Reuse identity-safe retained evidence and localize card narratives without changing source data |
| 408454d | 2026-10-09 14:56:51 -03:00 | Anchor Maxxis conversational speech badge to official avatar |
| b6a570b | 2026-10-09 14:17:19 -03:00 | Exclude temporary production deployment worktree |
| b5d6cc0 | 2026-10-08 01:09:59 -03:00 | exclusão dos relatoros obsoletos |
| fd67d25 | 2026-10-08 01:03:08 -03:00 | Add deterministic contextual Maxxis insights |
| d22787b | 2026-10-08 00:05:18 -03:00 | Tighten Maxxis property photo spacing |
| 466d702 | 2026-10-07 21:58:27 -03:00 | Contain Maxxis report preview text |
| d230b47 | 2026-10-07 21:32:32 -03:00 | Add Maxxis PDF text containment audit |
| 56dabd8 | 2026-10-04 21:26:05 -03:00 | Gap resolver/action |
| b132fca | 2026-10-04 15:02:54 -03:00 | feat(maxxis): add deterministic scenario intelligence |

## 2. Vercel: prova da revisão publicada

Consulta inicial `vercel inspect https://dealsiftermatch.vercel.app --format=json` retornou status e ID, mas não os campos Git. A alternativa somente leitura resolveu essa lacuna:

```
vercel api /v13/deployments/dpl_EG1XKN1h5WicdkkdqcEKi6UQBtmj?teamId=team_O4RRFlfO8m7MEZI0xY5BVVYi --method GET --raw
```

Somente campos de deployment/revisão foram extraídos; nenhum valor de segredo foi incluído neste relatório.

| Campo | Evidência atual |
|---|---|
| Deployment ID | `dpl_EG1XKN1h5WicdkkdqcEKi6UQBtmj` |
| Created at | `1791741519950`, **2026-10-11T17:58:39.950Z** / 14:58:39.950 -03:00 |
| URL imutável | `https://dealsiftermatch-r3v31pkj3-deal-sifter-match-s-projects.vercel.app` |
| Alias consultado | `https://dealsiftermatch.vercel.app` |
| Target / readyState | `production` / `READY` |
| Source | `cli` |
| `meta.gitCommitSha` | **`d9ea801ffd1c57a85e418acddb0c198be744a02c`** |
| `meta.gitCommitRef` | `HEAD`; nome de branch remoto **UNVERIFIED**, não substituir por suposição |
| `meta.gitCommitMessage` | `fix: unify map and Matches unlock state and compact profile popups` |
| `meta.actor` | `codex` |

Conclusão: igualdade de revisão Git frontend **YES**, respaldada por metadados do deployment, não por HTTP 200. Trata-se da atribuição de revisão fornecida pela plataforma; não é atestado criptográfico de árvore limpa ou prova byte-a-byte de todos os assets. Node Vercel registrado em `.vercel/project.json`: `24.x`; runtime local Node: `22.17.0`; comparação de outputs deve considerar esse desvio ambiental.

Leitura do HTML público confirmou entrypoint `/assets/index-B_4L2COk.js`, CSS `/assets/index-CmeNbUsH.css` e polyfills `/assets/polyfills-i8vDiOm5.js`. Esses nomes corroboram o artefato servido, mas **não foram usados para inferir o SHA**.

## 3. Supabase: inventário remoto e limite de paridade

Projeto de produção ligado: `cyeipfskwwisbbayyaca`, confirmado em `supabase/.temp/project-ref` e no comando com `--project-ref` explícito. Comandos somente leitura: `supabase functions list --output json` e `supabase migration list --linked`. CLI instalado `2.30.4`. A opção JSON dessa versão retorna tabela; foram lidos os campos da tabela sem assumir que era JSON.

**24 funções ACTIVE**. Nenhum endpoint de negócio foi invocado. Inventário relevante:

| Função | Versão publicada | Updated at UTC | Responsabilidade |
|---|---|---|---|
| maxxis-chat | 76 | 2026-10-10 01:51:47 | Chat, relatórios, evidências, cenários e orquestração contextual |
| maxxis-analysis-inputs | 7 | 2026-10-10 01:51:49 | Resolução e persistência de lacunas |
| property-intelligence | 8 | 2026-10-10 01:51:53 | Aquisição/cache/projeção de evidência e valuation |
| arv-visual-comp-review | 8 | 2026-10-10 01:51:55 | Revisão e promoção de comparáveis |
| presentation-translate | 1 | 2026-10-09 20:05:38 | Tradução de apresentação |
| maxxis-deal-workflow | 11 | 2026-08-21 04:16:21 | Workflow operacional |
| maxxis-action-cancel | 11 | 2026-08-21 04:16:14 | Cancelamento de ações |
| maxxis-action-confirm | 11 | 2026-08-21 04:16:16 | Confirmação de ações |
| maxxis-provider-message-draft | 13 | 2026-08-21 13:31:56 | Rascunho de comunicação |
| maxxis-provider-message-prepare | 12 | 2026-08-21 13:31:58 | Preparação de mensagem |
| maxxis-provider-message-confirm | 12 | 2026-08-21 13:31:59 | Confirmação de mensagem |
| maxxis-provider-message-cancel | 12 | 2026-08-21 13:32:01 | Cancelamento de mensagem |
| maxxis-provider-conversation-analysis | 12 | 2026-08-21 13:32:03 | Análise de conversa |
| maxxis-provider-unlock-prepare | 12 | 2026-08-21 13:31:52 | Preparação de desbloqueio |
| maxxis-provider-unlock-confirm | 12 | 2026-08-21 13:31:53 | Confirmação de desbloqueio |
| maxxis-provider-unlock-cancel | 12 | 2026-08-21 13:31:55 | Cancelamento de desbloqueio |
| feature-flags | 12 | 2026-09-08 16:58:38 | Flags de produto |
| send-support-email | 19 | 2026-08-21 04:16:39 | Email de suporte, não entrega de relatório |

As outras seis funções ACTIVE são `create-checkout-session` v46, `stripe-webhook` v42, `delete-account` v18, `stripe-reprocess-queue` v17, `geocode-address` v16 e `create-portal-session` v11. Apenas inventariadas; não invocadas.

Não existem deployments separados chamados scenario, proactive ou report-export nesse inventário. Cenários, provider evidence e reports usam a árvore compartilhada empacotada nas funções acima; export/preview PDF e seleção proativa também têm consumidores frontend. O código local `maxxis-deal-workflow/index.ts` importa `_shared/maxxis/dealWorkflow.ts`; verificar só `index.ts` seria insuficiente. Datas antigas são risco de drift, **não prova de diferença de bytes**.

Tentativas de comparação sem modificar fontes:

1. `npx --no-install supabase ...`: wrapper npm indisponível para Windows por pacote binário opcional ausente. Consultas refeitas com o `supabase.exe` já instalado, com sucesso.
2. Download de `maxxis-chat` com `--workdir qa/current-state-audit/production-source` e project ref explícito: falhou porque Docker daemon não está disponível. Não foi iniciado Docker nem instalada infraestrutura.
3. Download `--legacy-bundle` para a mesma pasta isolada: leitor ESZIP v0.30.0 falhou `InvalidV2`. Essa falha não demonstra defeito na função publicada; é incompatibilidade do leitor.
4. Alternativa temporária com CLI oficial v2.120.0 e pacote Windows: não concluiu nem a consulta `functions download --help` após vários minutos. O log npm confirmou GET do pacote binário; tentativa direta do executável extraído também não retornou ajuda. Processos exclusivos desta tentativa foram interrompidos após validar PID/caminho/comando (npx 22412; ajuda supabase 22176/7660). Não instalada no projeto, nenhum bundle obtido. Motivo interno desse bloqueio de inicialização não comprovado. Não substituir ausência de fonte por suposição de paridade.

Nenhum download foi apontado à árvore `supabase/functions` do projeto. Nenhum bundle remoto foi executado. Sem comparação efetiva dos entrypoints **e de suas dependências compartilhadas**, `SUPABASE CODE DRIFT = UNKNOWN`.

## 4. Migrações

`supabase migration list --linked` retornou **134 pares Local/Remote**, todos iguais. O diretório local contém 134 arquivos. Não há versão presente apenas em um dos lados.

- Latest repository: `20261009150000_land_development_sold_families.sql`.
- Latest applied production version: `20261009150000` (time/version exibido: 2026-10-09 15:00:00 UTC).
- Missing locally: nenhuma versão.
- Missing production: nenhuma versão.
- Drift do ledger de versões: **NO**.
- Igualdade de SQL/checksum, data real da aplicação e alterações manuais no schema: **UNVERIFIED**; a coluna Time não foi tratada como momento de aplicação. Não foram executados dump, migration repair, db push ou consultas de dados de usuários.

## 5. Build e verificações atuais

| Verificação | Resultado fresco | Escopo / limite |
|---|---|---|
| `npm run build` | PASS, exit0 | 11m43s, 2706 módulos. `VITE_APP_RELEASE=local` apenas no processo desativou Sentry release/sourcemap upload; nenhum `.env` modificado. Vite 7.3.6; warnings de chunks maiores que 500 KB, não corrigidos |
| `tsc -p tsconfig.contracts.json --pretty false` | PASS | Contratos TypeScript, não todo JSX |
| `npm run audit:types` | PASS | Snapshot 12 contratos, dangerous-any 3, tsc e checks oficiais property-intelligence/manualValidation/arv-review + entitlement |
| `eslint src/ --max-warnings=0` | PASS | Comando de lint sem `--fix` |
| `node --test scripts/check-build-env.test.mjs` | PASS 6/6 | 12.44 s; nenhum endpoint remoto |
| Vitest selecionado | PASS 38/38 em 3 arquivos | 69.95 s; unlockAccessState, scenarioEngine, cacheDegradedIntelligence |
| Vitest completo | INCONCLUSIVE | Tentativa com timer de 180 s, encerrou exit1 sem resultados de testes; não tratar como assertion FAIL ou PASS |
| Deno cached-only: property-data/index, manualValidation, scenarioEngine, intelligenceEconomy, runtimeEntitlement | PASS | Cinco roots, não executa handlers |
| Deno agregado: maxxis-chat, property-intelligence, arv-visual-comp-review, maxxis-analysis-inputs | FAIL, 38 erros | Baseline legacy analisado separadamente abaixo |

Vitest usou guard inline via `--import data:text/javascript,...`, sem arquivo de implementação: TCP rejeitado em `net.Socket.prototype.connect`, IPC local permitido, `syncBuiltinESMExports()` aplicado; timer unref. Suites selecionadas verificadas como puras/mocks. Full configurado `--pool=threads --maxWorkers=1 --testTimeout=10000 --hookTimeout=10000`; não houve resultado conclusivo. Não rodados e2e autenticado/integration/gemini-real nem handlers de produção. O timer/guard e o ambiente podem interferir na inicialização; causa do full inconclusivo não determinada.

## 6. Baseline Deno legacy

Mesmo HEAD e mesmo comando agregado do documento 14:

```
deno check --cached-only supabase/functions/maxxis-chat/index.ts supabase/functions/property-intelligence/index.ts supabase/functions/arv-visual-comp-review/index.ts supabase/functions/maxxis-analysis-inputs/index.ts
```

- Contagem anterior conhecida: **38**.
- Contagem atual informada pelo compilador: **38**.
- Variação líquida: **0**; nenhum novo erro observado por contagem.
- Novos/removidos por identidade individual: **UNVERIFIED**. O documento 14 não preservou um ledger completo dos 38 diagnósticos anteriores; igualdade de contagem não prova ausência de substituição de erros. Não fabricar `new=0, removed=0` como comparação histórica exata.
- A saída contém também TS2785 explicativo associado ao TS2783 de `toolRegistry.ts:106`; não somar esse subdiagnóstico como 39º erro independente.
- Não corrigidos tipos, casts, dependências, configurações ou warnings.

Ledger atual dos 38 erros independentes:

| Arquivo em `supabase/functions/` | Linha:coluna | Código |
|---|---|---|
| _shared/maxxis/dealCopilotContext.ts | 134:77 | TS2345 |
| _shared/maxxis/dealWorkflow.ts | 108:40, 109:40, 110:43 | TS2339 ×3 |
| _shared/maxxis/getPropertyDetails.ts | 31:65, 108:68 | TS2345 ×2 |
| _shared/maxxis/getPropertyDetails.ts | 62:11, 94:7 | TS2322 ×2 |
| _shared/maxxis/getUserPropertyBehavior.ts | 36:71, 46:119, 48:33, 55:29, 58:24, 59:25, 60:25, 61:24, 62:29 | TS2339 ×9 |
| _shared/maxxis/getUserPropertyBehavior.ts | 40:41, 82:53 | TS2345 ×2 |
| _shared/maxxis/searchMatchedProperties.ts | 27:65 | TS2345 |
| _shared/maxxis/searchServices.ts | 75:80, 132:60 | TS2345 ×2 |
| _shared/maxxis/searchServices.ts | 77:20 | TS2769 |
| _shared/maxxis/searchServices.ts | 78:18, 78:36 | TS2339 ×2 |
| _shared/maxxis/searchServices.ts | 127:62 | TS7006 |
| _shared/maxxis/toolRegistry.ts | 106:43 | TS2783 |
| _shared/maxxis/toolRegistry.ts | 116:15 | TS2589 |
| _shared/maxxis/toolRegistry.ts | 124:73, 146:88, 156:90 | TS2345 ×3 |
| _shared/maxxisExecutionBudget.ts | 56:14, 58:9 | TS18046 ×2 |
| maxxis-chat/index.ts | 860:54, 860:80, 1251:72 | TS2322 ×3 |
| maxxis-chat/index.ts | 1048:66, 1048:108 | TS2339 ×2 |

## 7. Production vs local matrix

| SURFACE | LOCAL REVISION | PRODUCTION REVISION | MATCH? | EVIDENCE | RISK |
|---|---|---|---|---|---|
| Frontend | HEAD d9ea801ffd1c57a85e418acddb0c198be744a02c | Mesmo `meta.gitCommitSha` | YES — revisão declarada | Vercel deployment GET, target production, READY, alias/ID | Não certifica árvore limpa, ambiente idêntico ou UI funcional |
| Supabase migrations | 134 versões, latest 20261009150000 | Mesmas 134 versões/latest | YES — versões | migration list --linked | Checksums/schema manual desconhecidos |
| maxxis-chat | HEAD, última mudança da árvore backend 2695d4f | v76, 2026-10-10 01:51:47Z; SHA/hash desconhecido | UNKNOWN | functions list; download bloqueado | Canonical facts, cenários, reports e tools podem ter dependências diferentes |
| maxxis-analysis-inputs | HEAD/2695d4f árvore | v7, 2026-10-10 01:51:49Z | UNKNOWN | functions list | Correção de lacunas depende de bundle compartilhado |
| property/provider functions | HEAD/2695d4f árvore | property-intelligence v8 e arv-review v8; demais versões no inventário | UNKNOWN | functions list | Cache, provider budgets, comparáveis e promoção não byte-certificados |
| Report-related backend | HEAD: maxxis-chat + _shared/maxxis + RPC migrations | Chat v76; ledger SQL coincidente; hashes desconhecidos | UNKNOWN | código local e inventário remoto | Não há função export/email de relatório independente |
| Scenario/proactive flows | HEAD: cenário compartilhado/backend e trigger/frontend | Frontend d9ea801 comprovado; cenário empacotado não certificado | PARTIAL | metadata frontend + inventário | Não confundir paridade frontend com matemática backend |
| Workflow/actions/messages | HEAD: entrypoints + _shared atual | workflow/action v11 e provider messaging v12/v13 de agosto | UNKNOWN | inventário remoto | Maior idade; entrypoint igual não prova shared igual |
| Presentation translation | HEAD | v1, 2026-10-09 20:05:38Z | UNKNOWN | inventário remoto | Shared config/Gemini modules não comparados |

## 8. Base segura

**D. BASELINE_CANNOT_BE_PROVEN**, enquanto a comparação de fontes Supabase estiver indisponível. Isso não desmente a revisão frontend comprovada nem afirma drift backend. Não escolher `MIXED_FRONTEND_BACKEND_BASELINE` por diferença de datas sem prova de diferença de fontes. Não fazer checkout, aplicar stash, implementar P0 ou redeploy para “forçar” paridade.

## 9. P0 source mapping — sem correção

Numeração conforme o prompt de reconciliação: P0-2 agrega nulidade/defaults; P0-3 é perda de conteúdo. No audit anterior, nulidade era P03 e perda estava em P04/P05; essa mudança de numeração é explícita.

### P0-1 — LAND versus SINGLE FAMILY: precedência divergente

- Root: `supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts:95` — `factFor`; `:115` — `buildCanonicalPropertyFacts`; `:129` — `mergeVerifiedPropertyEvidenceIntoFacts`; registry `propertyType` e `propertyTypeFamily`/`resolvedStrategy`.
- Frontend projection: `src/domain/maxxis/maxxisReportSchema.js:91` — `mergeMaxxisReportProperty`; `:168` — `buildPropertyOverviewModel`; `CANONICAL_TO_OVERVIEW['physical.propertyType']`.
- Upstream: app `properties.type` / `PropertyContext.fields.propertyType` após normalização de registro do provedor; dado retido pode contradizer a publicação.
- Downstream: flat `type`, `resolvedAnalysisPropertyType/Strategy`, grouped `canonicalPropertyFacts.physical.propertyType`, schema L1/L2/L3, preview/PDF e seleção de inteligência LAND/residencial.
- Evidência offline já reproduzida no audit 14: app LAND + provider Single Family deixa flat LAND e grouped Single Family; overview pode sobrescrever `type`, mantendo strategy LAND. Risco de reintroduzir área residencial após excluir campos LAND.
- Correction boundary futura: contrato único de resolução de tipo/conflito/aplicabilidade antes da projeção; consumidores não podem reeleger uma fonte por conta própria. Preservar conflito/evidência e distinguir tipo cadastral de classificação analítica. Sem patch neste turno.

### P0-2 — UNKNOWN/UNAVAILABLE/NOT_APPLICABLE não equivalem a zero

- Roots: `supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts:74` — `finite` / `factFor` confidence; `src/features/maxxis/intelligence/canonicalInvestmentAnalysis.js:5` — `finite`, `buildCanonicalInvestmentAnalysis` profileFit score em `:149`.
- Factory: `src/lib/propertyFactory.js:29` — `createProfessionalProperty`, `Number(input.*)` e fallbacks `beds/baths/rehab/capRate=0`.
- Math: `supabase/functions/_shared/maxxis/scenarioEngine.ts:21` — `nonNegative(..., fallback=0)`; `:29` — `calculateBuyAndHoldScenario`; também Flip/SubTo/Wholesale/LAND e target solver.
- Export consumer adicional: `src/features/maxxis/export/maxxisReportPdf.js:243` — filtro de métricas com `Number.isFinite(Number(outputs[key]))`, que inclui null como zero numérico elegível; exige revisão futura de display, não assumir que toda métrica foi exibida assim.
- Upstream: fatos nullable/status explícito, despesas/juros/vacância ainda não informados, match não calculável.
- Downstream: confidence/fit display, somatórios de custo, NOI/cap rate/cash flow e indicadores de completude/exportação.
- Evidência reproduzida: confidence null→0; fit score null→0; BuyHold com preço 100000/rent1000 e despesas ausentes retorna despesas0, NOI12000, cap12%. Não significa que despesas reais sejam zero. `scenarioEngine.finite` já protege null, mas `nonNegative` posteriormente aplica fallback0: fronteiras diferentes, não corrigir tudo com uma troca de formatter.
- Correction boundary futura: contrato nullable com applicability/availability separado de valor; zero explicitamente informado versus unknown/assumed-zero; cálculo parcial sinalizado e indicadores suprimidos quando pré-requisitos faltarem. Resolver antes da matemática, factory e adapters de apresentação.

### P0-3 — conteúdo disponível removido por projeções/reducers

- Report projection: `src/domain/maxxis/maxxisReportSchema.js:91` — `mergeMaxxisReportProperty`, `PROPERTY_KEYS`, `images.slice(0,8)` em `:127`, owner whitelist em `:137`, `buildPropertyOverviewModel` owner whitelist. `owner.notes/description` não sobrevivem ao merge.
- Narrative entry: `supabase/functions/_shared/maxxis/propertyDetails.ts:45` — `cleanPublicNarrative`; descrição limitada a 2000 chars em `:117`.
- PDF root: `src/features/maxxis/export/maxxisReportPdf.js:323` — `reduceReportContent`; `wrapContainedLines`/`evaluateContainedText` e `renderContainedBulletList` em `:483`; budgets, redução de unidades semânticas, limites de linhas e itens. Gallery `images.slice(0,5)` em `:818`, comparáveis `all.slice(0,8)` em `:1137`, executive slices em `:1281/:1335`. Original pode permanecer em payload, mas não há garantia de export integral por esses caminhos.
- Ownership projection: `supabase/functions/_shared/property-data/rentcast/rentcastMapper.ts:45/:55/:88` — `mapRentCastProperty` produz `ownership.ownerNames`; `CANONICAL_PROPERTY_FIELD_REGISTRY.ownerName` em propertyEvidenceProjection não possui evidenceKey correspondente e usa nome do responsável do app. Não misturar titularidade de registro e publicador; restrições de contato/privacy continuam obrigatórias.
- Scenario projection: `scenarioEngine.ts` cálculo usa conjunto estratégico explícito de assumptions; fatos adicionais não são automaticamente exportados como assumptions. Nem toda exclusão é perda: campos não aplicáveis e FIPS INTERNAL_ONLY têm política declarada. Os limites de report citados acima são perdas identificáveis, enquanto perda adicional por cenário exige teste de contrato específico.
- Upstream: fatos canônicos, narrativas completas, fotos da publicação, metadados cadastrais e assumptions disponíveis/autorizados.
- Downstream: schema de relatório, overview, tabela/gallery, notas e PDF final; user pode ter JSON completo e export resumido sem saber.
- Correction boundary futura: distinguir summary de full-data export; projeção canônica sem perda de campos autorizados, paginação/continuação/appendix para conteúdo completo e assertions de cobertura. Não resolver removendo containment geométrico nem expondo contatos não autorizados. Não alterar fórmulas para corrigir perda de apresentação.

## 10. Segurança e decisão final

Fontes rastreadas modificadas: **0**. Deploy: **0**. Migrações executadas: **0**. Escritas de dados/schema em produção: **0**. RentCast/Gemini/Stripe: **0 chamadas de negócio**. Leituras remotas foram metadata Vercel/Supabase, ledger de migrações, Git refs e assets públicos. Instalação temporária de CLI/dependências não é deploy nem alteração de package.json/lockfile.

Resultado global **RECONCILIATION: PARTIAL**. Base selecionada: **D. BASELINE_CANNOT_BE_PROVEN**. Bloqueio exato: fonte dos bundles Supabase e respectivas dependências compartilhadas não obtida/comparada; CLI instalado depende de Docker inexistente e leitor legado rejeitou ESZIP (`InvalidV2`); alternativa temporária não concluiu. Além disso, a comparação histórica por identidade dos 38 erros Deno não pode ser certificada sem o ledger anterior completo. Build/typecheck oficial/lint PASS; full tests INCONCLUSIVE. Não usar o SHA frontend como se também assinasse funções Supabase. P0 mapeado, **não implementado**.

Evidência necessária para eliminar o bloqueio, sem ampliar autorização de escrita: export dos bundles publicados por ferramenta compatível com ESZIP atual (isolado da árvore de código) e comparação dos arquivos locais/importados; preservar version metadata e hashes por função. Verificação exata dos erros novos/removidos requer a saída completa anterior dos 38 diagnósticos. Nenhuma dessas limitações justifica redeploy, correção ou criação de baseline artificial. Commit/push/deploy: **NO**. STOP.
