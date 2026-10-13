# Fluxos UX (24) e capacidades WOW

Classificação se refere ao contrato observado no código/diagnóstico offline, não a uma sessão autenticada completa. Mobile/desktop atuais não foram abertos; UNKNOWN não significa bug. Arquivos em `src/features/maxxis/` têm prefixo `features/` abaixo.

| # / fluxo | Status | Evidência e efeito para usuário |
|---|---|---|
| 1 Property → Maxxis analysis | FRICTION | App::handleMaxxisSurfaceContextChange → context/maxxisPropertyContext::resolveMaxxisPropertyContext → maxxisService → maxxis-chat. Seleção explícita/UUID/label único; flat/canonical type divergem em conflito (P01) |
| 2 Property → Export | FRICTION | access/ReportExperienceSelector e export entitlements → reportSchema. Dados enriched só se passados; não busca toda família provider no renderer |
| 3 Basic → PDF | FRICTION | Schema1 página, export/maxxisReportPdf; fotos/notes com limites; layout-safe não full-data (P04) |
| 4 Basic → Email | FRICTION | export/MaxxisReportExportActions::runAction: arquivo local+mailto; sem envio/anexo automático |
| 5 Basic → Maxxis upgrade | UNKNOWN | access/MaxxisIntelligenceUpgradeModal e runtimeEntitlement; FREE3/5Nuggets; não foi feita compra/teste de saldo |
| 6 Maxxis Analysis | FRICTION | intelligence/maxxisAnalysisReport: shared structured ou fallback; planner L2 cache-only limita análise sem evidência anterior |
| 7 Deal Intelligence | FRICTION | intelligence/maxxisDealIntelligenceReport, entitlement/L3 provider planner; condição obrigatória bloqueia ARV mesmo com comps; desempenho real UNKNOWN |
| 8 Gap Resolver | UNKNOWN | MaxxisAnalysisGapResolution/analysisGapAnswer + Assistant::handleResolveAnalysisGaps → maxxis-analysis-inputs → cache-only recompute; avanço real de submit está implementado; não atestados loops/multi-topic live |
| 9 Quick Actions | REDUNDANT | Assistant controlledIntent deal_gaps/current_deal_followup/deal_snapshot e smartActions coexistem com ações gap/nextInteraction; não dead-end por mera duplicação |
| 10 Scenario creation | FRICTION | scenarioEngine::resolveDealScenario fornece source/status/unresolvedInputs; extras desconhecidos podem virar0 e parecer completo |
| 11 Scenario mutation | FRICTION | assumptions current user→history→stored→canonical, relative parsing; histórico últimas5 user msgs, regex de números/idioma limita precisão |
| 12 Scenario comparison | GOOD | compareScenarioOutputs calcula diferenças numéricas/ranges determinísticas; null denominador não vira percent infinito; não representa conselho de melhor estratégia |
| 13 Solve-For zero-interest | BROKEN | solveScenarioTarget usa required(annualInterestRate)>0; teste diagnóstico reproduziu SCENARIO_INTEREST_RATE_REQUIRED em0%; cálculo base aceita0 |
| 14 Scenario save | UNKNOWN | Assistant linha968+saveMaxxisAnalysisInputs(activeScenario confirmed) por UUID; context table persistente; não testado write real |
| 15 Proactive insight | GOOD | proactive/maxxisProactiveTriggerEngine inputs snapshot/decision/scenario; sinais/action/version sem call; não promessa de disponibilidade da ação downstream |
| 16 Speech bubble → chat | UNKNOWN | avatar/MaxxisCommunicationBadge + attention controller/orchestrator + Assistant accepted signal; anchor e suppress chat-open no código, visual atual não validado |
| 17 Chat → report | FRICTION | shared structuredAnalysis usada quando presente; builders fallback ativos, tradução pode adquirir texto; parity não universal |
| 18 My Reports → viewer → PDF/email | FRICTION | reports/MyMaxxisReports + savedReportAccess + reportService; payload salvo, soft-delete; email ainda rascunho; ownership comercial não testado real |
| 19 Portfolio → analysis | UNKNOWN | Onboarding/usePortfolioSync/App handoff; contagem/hydration real de propriedades não consultada; não concluir limite5 apenas de screenshot antigo |
| 20 Matches → analysis | UNKNOWN | MatchesPage/App context; same ownership unlock resolver, imóvel atual vs conversa anterior requer browser test |
| 21 Feed → analysis | UNKNOWN | Dashboard/App screen handoff; row sanitization pode cortar Notes upstream; UI source translation preserva original |
| 22 Mobile versions | UNKNOWN | Layouts responsivos/drag/reducedMotion/viewport guards existem; sem navegador/dispositivo nesta auditoria; histórico screenshot não valida HEAD |
| 23 Map unlock filter/popups | UNKNOWN | MapView + unlockAccessState + mapInventory + PortfolioPinCarousel; sem slides → null/compact popup; unificação real no HEAD, sem conta real current |
| 24 Language across UI/notes/report | FRICTION | catalogs/translations, chatTranslation + presentation-translate + report locale; vários defaults/strings inglesas e fallback original, não canonical locale único |

## Gap e progressão: prova positiva e fronteiras

Backend `analysisGapResolver::buildEvidenceCompletenessGate` classifica AVAILABLE/PROVIDER_RESOLVABLE/USER_RESOLVABLE e demais; `dealDecisionContext::buildGaps` usa requirement source/inputField/unlocks e ordena por criticality+code. Assistant guarda activeAnalysisGapRef, salva inputs, recalcula em cache-only; declinar também tem caminho. Há consumo/state version de ações em smartActions/nextInteraction/proactive. Generic Why/Missing/Snapshot continuam ativos. Router verifica report request primeiro, depois parse pending gap, depois help/general: segurança contra hijack depende do parser, não apenas intentlabels. Hijack/loop reais UNKNOWN; não transformar risco em defeito confirmado.

Assumptions salvas em property_arv_review_contexts são consumidas por getDealInsightContext/dealDecisionContext/scenario. Input de zoning reportado como user-provided não vira validação municipal. Gap novo tem de trazer inputField consumível; provider-resolvable sem aquisição autorizada fica pendente por arquitetura comercial.

## Contexto de propriedade

`resolveMaxxisPropertyContext` ordem real: USER_MESSAGE (UUID/endereço único), MAXXIS_SELECTION, APP_SCREEN, ACTIVE_CONVERSATION, RECENT_CONTEXT. Reconcilia ID a card por UUID; não faz fallback por nome arbitrário. Contexto persistente facilita followup mas seleção antiga pode prevalecer sobre screen nova: caso desktop/mobile entre Matches/Feed/Portfolio requer execução controlada. Sem propriedade → SELECTION_REQUIRED. Server valida auth/lookup; presença de ID no cliente não autoriza acesso.

## Avatar/bubble

States IDLE/OBSERVING/NOTICED/PROCESSING/WAITING/SUCCESS; prioridade0/10/20/30/40/50. Assets oficiais em avatar/maxxisAvatarAssets/AssetResolver; renderer preloading/ref de estado; animations e stateMachine/timeline limitam transições; reduced-motion matchMedia. Size normalizado1–2.5/default1, mobileSafetyLimit; preferência não deve recortar asset. `MaxxisCommunicationBadge`/placement/attentionEnvironment gerem bubble/anchor/modal/typing/chat-open; dismissal/dedupe evita repetir signal version. Código atual não muda estado só por redefinir módulo como promessa de animação; visual de piscadas/corte/proporção não foi revalidado.

Proactive triggers hash estável de evidence em id(account/property/type/version); freshness15min. P0/P1/P2, P3 descartado; HIGH incluiP2, LOW sóP0/strong. Inclui missing input estratégia, scenario delta, seller financing comparison, flip margin/solve, wholesale assignment e evidência de valor. Attention modelo mantém cooldown default90s, sensitive surfaces e busy/modal/maxxisOpen suppression, consumed/dismissed sessão. Plan restriction decorre do contexto/entitlements na execução, não cobrança por construir trigger. Ação accepted pode usar Gemini/provider conforme rota.

## WOW implementado versus desejado

| Recurso | Estado | Evidência |
|---|---|---|
| Scenario Intelligence | ACTUAL | scenarioEngine + handler retorna scenario/actions; cálculo/projection reais |
| Solve-For | PARTIAL | targets específicos; bug0% e domínios/custos ausentes |
| Comparison | ACTUAL | compareScenarioOutputs e ação no handler |
| Proactive Trigger Engine | ACTUAL | buildMaxxisProactiveTriggers/evaluate attention |
| Conversational Avatar | ACTUAL | renderer/assets/stateMachine/timeline consumidos pelo Assistant |
| Speech Bubble | ACTUAL | MaxxisCommunicationBadge/placement/attention + Assistant |
| Gap progression | PARTIAL | save/recompute code; loops e unrelated routing não comprovados live |
| Provider-degraded continuation | ACTUAL | cacheFreshness retained + degradedEvidenceContinuation; availability/budget fallback |
| Localized free text | PARTIAL | chatTranslation/presentation-translate aplicado, miss/failure retorna original |
| New Construction benchmark | PARTIAL | cálculo real, referência UNSOURCED/LOW; sem calibração local |
| LAND development | PARTIAL | dual-family comps, proposed-home inputs/costcoverage; zoning/providerreal não validado |

ACTUAL significa integrado no runtime, não demonstrado financeiramente confiável em produção; não foram encontrados recursos que precisassem ser rotulados TEST_ONLY nesta amostra.
