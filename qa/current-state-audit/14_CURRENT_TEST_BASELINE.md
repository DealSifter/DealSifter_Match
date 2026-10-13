# Baseline de verificação — 2026-10-11 / d9ea801

Resultado global **PARTIAL**. Código da aplicação permaneceu inalterado. Nenhum teste e2e de provedor, canary autenticado, DB write, Gemini/RentCast/Stripe/email live foi executado. Testes unitários usaram transporte controlado; Node Socket.connect foi bloqueado para TCP, permitindo IPC local na execução que concluiu.

## Comandos e resultados frescos

| Escopo / comando | Resultado / quantidade / duração | Limite |
|---|---|---|
| `node --test scripts/check-build-env.test.mjs` sandbox | FAIL ambiental spawn EPERM;0/1 runner | Não é failure de assertion da aplicação; retry autorizado fora do sandbox abaixo |
| Mesmo comando com execução ampliada | PASS6/6;4.90s runner | Subprocessos de configuração isolados; não altera configuração persistente/produção |
| `node node_modules/typescript/bin/tsc -p tsconfig.contracts.json --pretty false` | PASS exit0 | src/types/contracts apenas; NÃO cobertura de todo JSX |
| `node node_modules/eslint/bin/eslint.js src/ --max-warnings=0` | PASS exit0 | Sem --fix; não certifica Supabase nem funcionamento UI |
| `npx --no-install deno check --cached-only supabase/functions/_shared/property-data/index.ts supabase/functions/_shared/maxxis/scenarioEngine.ts supabase/functions/_shared/maxxis/intelligenceEconomy.ts supabase/functions/_shared/maxxis/runtimeEntitlement.ts` | PASS exit0;4 roots | Check não executa handlers; dependências somente cached |
| `npx --no-install deno check --cached-only supabase/functions/maxxis-chat/index.ts supabase/functions/property-intelligence/index.ts supabase/functions/arv-visual-comp-review/index.ts supabase/functions/maxxis-analysis-inputs/index.ts` | FAIL38 type errors | Exemplo dealCopilotContext.ts:134 Supabase generic; dealWorkflow.ts:108–110 never fields; getPropertyDetails.ts:31 incompatible client; maxxis-chat.ts union/data/propertyIds; sem repair |
| Vitest targeted, command abaixo | PASS3 files/38 tests;15.81s | Execução offline com TCP blocked/IPC allowed; tests/mock somente |
| Vitest full sandbox primeira tentativa | INCONCLUSIVE;0 resultados finais | Ficou sem progresso; audit-owned PID15276 interrompido; sem contagem fabricada |
| Vitest full threads com block de toda conexão Socket | INCONCLUSIVE;wall guard180s | Guard também bloqueava IPC; não atribuir esse resultado ao produto |
| Vitest full com TCP blocked/IPC allowed | INCONCLUSIVE;wall guard240s | Só RUN, sem resultado de arquivos; não é PASS nem failure de assertion; não repetir indefinidamente |
| Production build | NOT_RUN por segurança/escopo | User exige docs-only, sem env changes/externals; Vite production pode publicar sourcemaps/release Sentry e gerar dist. Nenhum build atual certificado |

Vitest efetivamente selecionou os seguintes três arquivos:

```
node --import <audit-network-guard-data-uri> node_modules/vitest/vitest.mjs run \
  src/lib/unlockAccessState.test.js \
  supabase/functions/_shared/maxxis/scenarioEngine.test.ts \
  supabase/functions/_shared/property-data/cacheDegradedIntelligence.test.ts \
  --pool=threads --maxWorkers=1
```

Um quarto filtro informado na tentativa não correspondeu a suite existente; não contado como teste canônico. Guard inline (não salvo no repo) substituiu net.Socket.prototype.connect: rejeita argumentos TCP numéricos/port e preserva chamadas IPC por path; syncBuiltinESMExports aplica aos imports. Timer unref limita runtime. Full também usou --testTimeout=10000 --hookTimeout=10000. Esse bloqueio pode tornar testes que precisam TCP local inconclusivos, por isso não indica regressão por si. Não houve fetch live autorizado.

## Diagnósticos puros reproduzidos

Execução Node22 --experimental-strip-types/--import data URI, somente módulos matemáticos, sem banco:

1. `mergeVerifiedPropertyEvidenceIntoFacts({type:'LAND',price:100000},{fields:{propertyType:{value:'Single Family',status:'VERIFIED_RECORD',confidence:null}}})` → flatType LAND, canonicalType Single Family, confidence0. P01/P03.
2. `calculateBuyAndHoldScenario({purchasePrice:100000,rent:1000})` → gross/EGI12000, expenses0, NOI12000, capRate12, debt/DSCRnull. P02. Isso não prova que despesas reais sãozero.
3. `solveScenarioTarget('SELLER_FINANCING',{purchasePrice:100000,annualInterestRate:0,amortizationYears:30},{targetMonthlyPI:500})` → SCENARIO_INTEREST_RATE_REQUIRED. P07.
4. `buildCanonicalInvestmentAnalysis({matchContext:{score:null,calculable:false}}).profileFit` → score0, classification unavailable, calculablefalse. P03; não prova que todos os componentes exibam esse0.

Uma primeira tentativa de Deno eval falhou por quote stripping do PowerShell (SyntaxError), sem executar algoritmo; substituída pelos diagnósticos Node acima. Não tratar como bug Deno/source.

## Baselines anteriores e idade

Não há checkout anterior testado nesta auditoria para atribuir os38 erros a um release específico. Como HEAD/source não mudaram, são failures presentes no baseline auditado, não regressões introduzidas pela auditoria. Tipagens genéricas Supabase/never e união Maxxis têm raízes legacy ativas; manter o ledger, não resolver com cast durante audit.

Histórico disponível: PDFs/manifests/layout audit2026-10-03 e artifacts maxxis-final-live2026-09-15; testes referidos em mensagens de releases anteriores não foram reexecutados integralmente e não contam como PASS fresh. Worker startup/jsdom foi reportado em trabalho anterior; nesta execução full continua inconclusivo, causa exata UNKNOWN. Suite excludes Deno tests de dealInsightInput/propertyAnalysisIntent conforme vite.config, portanto vitest não certifica esses módulos.

## Safety final

READ-ONLY YES (exceto criação destes documentos autorizados). Application source edits0; production DB requests/writes0; RentCast/Gemini livecalls0; Stripe mutations0; deploy0. Consultas Vercel metadata foram GET/inspect somente; READY sem SHA provado. Arquivos de auditoria untracked/documentação-only; nenhum stash/worktree do usuário alterado. Logs de comando desta conversa são evidência de execução; não foram criados logs externos ao diretório permitido.
