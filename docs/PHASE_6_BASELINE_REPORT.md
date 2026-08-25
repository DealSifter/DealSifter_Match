# Fase 6.0 — Baseline funcional e visual

## Estado inicial

- Workspace original: branch `release/maxxis-mvp`, HEAD `ee6c08f44df98372c44dc817622e313c9b391317`.
- Alterações locais preexistentes preservadas e não tocadas: `docs/MAXXIS_EVOLUTION_PLAN.md`, `package.json` e `package-lock.json`.
- Baseline operacional criada a partir da `main` limpa: HEAD `a36ddf7d47f88efaf7dc46f9856ab4279f142017`.
- Histórico inicial da `main`: `a36ddf7`, `0a3f346`, `83411cb`, `6927130`, `d54ec0d`, `1892dfd`, `ab90e62`, `ee6c08f`, `2a9551d`, `9371eaa`.

## Matriz funcional congelada

| Área | Evidência principal | Estado da baseline |
|---|---|---|
| Auth/Profile | `auth-profile.spec.js`, hydration e version conflict | Coberta |
| Onboarding | contrato estrutural, mobile e accessibility | Coberta |
| Dashboard/Feed | snapshots, paleta, feed stack e estabilidade geométrica | Coberta |
| Matches | overview, contacts/interests, chat e property | Coberta |
| Property Details | fixture pública protegida e detail panel | Coberta |
| Map | `ui-theme-map-panel.spec.js` e largura padrão responsiva | Coberta |
| Services | inventory e provider fit do Maxxis | Coberta |
| Chat humano | `chat_messages` determinístico e independência do Maxxis | Coberta |
| Maxxis | abrir/fechar, preservar sessão, loading e respostas | Coberta |
| Deal Copilot | overview estruturado com workflow/provider | Coberta |
| Workflow | Deal Progress e itens controlados | Coberta |
| Unlock | prepare/cancel sem débito e fluxo real de integração | Coberta |
| Messaging | draft/prepare/confirm/cancel e chat real de integração | Coberta |
| Stripe safe flow | gates unitários/integração e ausência de transação em mocks | Coberta |
| Feature flags | `featureFlagService.test.js` e `audit:feature-readiness` | Coberta |

## Baseline visual

Foram congeladas 22 telas com fixtures namespaced `phase-6-baseline`, sem usuários reais:

- Desktop (16): auth, dashboard light, feed, dashboard dark, settings, onboarding, map, matches, chat humano, property detail, Maxxis fechado, Maxxis aberto, property response, provider, workflow e Deal Copilot.
- Mobile (6): home, matches, property, Maxxis, onboarding e menu/navigation.

Arquivos: `e2e/tests/baseline/__screenshots__/desktop-baseline` e `e2e/tests/baseline/__screenshots__/mobile-baseline`.

Máscaras limitadas a tiles externos visíveis do mapa e timestamps de notificações. Timestamps Maxxis têm apenas o texto ocultado pelo harness, preservando sua geometria. Header, nav, cards, botões, containers, layout e FAB não são mascarados. Animações e caret são desativados somente pelo harness visual; `reducedMotion` é fixado.

## Guards

- `npm run audit:ui-structural`: assertions determinísticas de estrutura, paleta, geometria, estado e coexistência Maxxis/chat humano.
- `npm run audit:ui-regression`: guard completo (estrutural + 22 screenshots desktop/mobile).
- `npm run test:e2e:visual`: comparação dos 22 snapshots.
- `npm run test:e2e:visual:update`: atualização deliberada, condicionada à revisão e autorização.
- Quality CI executa o guard estrutural no job Chromium fixo.
- Pixel comparison fica em workflow dedicado Windows/Chromium para reduzir variação de OS/fontes.

## Baselines técnicas

- Clean install: PASS; 627 pacotes e 0 vulnerabilidades no `npm audit`.
- Lint: PASS.
- Vitest: PASS; 53 arquivos e 355 testes.
- Architecture: PASS; dois warnings de orçamento de tamanho existentes (`Onboarding.jsx` e `Dashboard.jsx`).
- Performance estática: PASS (28 checks); um warning existente sobre loop legado de compatibilidade.
- Build/bundle: PASS; 855 módulos e maior chunk com 380,3 KiB, abaixo do limite de 500 KiB.
- Feature readiness: PASS (23/23).
- Quality agregado: PASS, incluindo 20/20 Edge Functions, hosting, env estrito, observabilidade, tipos, build e bundle.
- Playwright mocked: PASS; nove jornadas (oito no ciclo agregado e a jornada longa de provider validada isoladamente após ajuste de timeout do harness).
- UI estrutural: PASS; 2/2 contratos determinísticos.
- Visual regression: PASS; 22/22 snapshots (16 desktop + 6 mobile) sem diff.
- Mobile: PASS; 1/1 jornada crítica.
- Accessibility/keyboard: PASS; 2/2 jornadas e nenhuma violação de alta severidade.
- Real staging `oqdcnjupquhybwdbeeew`: PASS; 11/11 jornadas em um ciclo consolidado, com fixtures namespaced e cleanup.

## Performance real observada no staging

O gate funcional permaneceu verde, mas classificou as leituras abaixo como `NEEDS_OPTIMIZATION`:

| Operação | Concorrência | p50 | p95 |
|---|---:|---:|---:|
| Property search | 6 | 10,32 s | 10,38 s |
| Property details | 6 | 6,54 s | 7,52 s |
| Global feed | 6 | 4,48 s | 6,11 s |
| Maxxis service search (warm) | sequencial | 1,15 s | 2,52 s |

Primeira observação do Maxxis service search: 2,29 s. Estes números são baseline de staging, não SLO de produção, e não motivaram alteração funcional nesta fase.

## Bugs existentes e backlog

- Dívida já conhecida: `Onboarding.jsx` e `Dashboard.jsx` permanecem acima do target de linhas do audit de arquitetura. Não foram refatorados nesta fase.
- Compatibilidade legada de injected search permanece sinalizada pelo audit de performance. Não foi alterada.
- As leituras reais de property search/details/feed no staging excederam a faixa desejável e devem ser tratadas em fase própria de performance.
- A jornada real de auth/profile leva aproximadamente 4,6 minutos neste ambiente. O timeout foi corrigido somente no teste para refletir a duração medida; o app não foi alterado.
- Pixel diff pode variar entre sistemas operacionais; por isso a referência está fixada em Windows/Chromium e não foi misturada ao job Linux principal.
- Nenhum bug funcional novo foi identificado durante a construção da baseline; os problemas encontrados eram limites insuficientes do harness diante da latência local/staging.

## Prova de não alteração

Nenhum arquivo em `src/`, `supabase/` ou lógica de produção foi modificado. As mudanças estão restritas a testes, fixtures sintéticas, tooling, CI e documentação.

`PRODUCTION UX BEFORE = FASE 6.0 UX AFTER`.

## Fase 6G — Acceptance Final Do Maxxis MVP+

A aceitacao final reutiliza os contratos e snapshots desta baseline. O fluxo integrado e:

```text
Context -> Intelligence -> Next Interaction -> Orchestrator -> Composer
-> Avatar/Bubble -> Smart Action -> Human Confirmation -> Result
-> Memory -> Continuity
```

| Jornada | Evidencia principal | Criterio |
|---|---|---|
| A. Deal Review | `maxxis-interactive-deal-intelligence.spec.js` e acceptance final | Analise coerente e uma proxima interacao util. |
| B. Provider Flow | `maxxis-smart-actions.spec.js` e acceptance final | Unlock e mensagem executam uma vez, somente apos confirmacao. |
| C. Memory Flow | `maxxis-deal-memory.spec.js` e acceptance final | Recall resumido, mudancas atuais e next step sem claim stale. |
| D. Proactive Flow | `maxxis-proactive-intelligence.spec.js` e acceptance final | NOTICED/bubble/contexto sem acao autonoma. |
| E. Cross-Surface | `maxxis-cross-surface-continuity.spec.js` e acceptance final | Property/provider/conversa continuam sem misturar Human Chat. |

O teste `maxxis-phase-6-acceptance.spec.js` atravessa as cinco jornadas em uma unica sessao mockada, incluindo reload para Memory. As suites especializadas permanecem autoridade para matrizes parametrizadas, estados impossiveis, account isolation, PII, settings, avatar, attention e idempotencia.

Definition of Done: os dez criterios WOW devem passar juntos; nenhum engine isolado pode competir com a experiencia dominante do Maxxis; toda mutacao protegida preserva `PREPARE -> CONFIRM -> EXECUTE_USER_CONFIRMED`; UI global, Human Chat, Stripe/Nuggets, RLS/entitlements e assets oficiais permanecem sob o contrato de nao regressao.

Inconsistencias residuais encontradas e corrigidas na acceptance:

- a mesma Smart Action de review podia permanecer acionavel em duas mensagens historicas para o mesmo provider/property; somente a ocorrencia mais recente agora permanece visivel;
- overrides DEV simultaneos de Proactivity e Deal Memory competiam entre si; agora sao mesclados somente em DEV/E2E, mantendo producao fail-closed;
- o mock de provider message foi alinhado ao contrato real `data.actionId` e confirma cada action id no maximo uma vez.

Evidencia local final: clean install com 0 vulnerabilidades; quality com 68 arquivos/616 testes; architecture, performance e feature-readiness PASS; acceptance A-E PASS; UI estrutural 2/2; visual 12/12 aplicaveis; mobile 2/2; accessibility 3/3. A suite mocked completa permanece agregada na Quality Gate da CI antes da promocao.
