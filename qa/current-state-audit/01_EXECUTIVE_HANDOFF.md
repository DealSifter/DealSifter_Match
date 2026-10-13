# DealSifter / Maxxis — handoff técnico e produto do estado atual

**Auditoria 2026-10-11, somente leitura. Resultado PARTIAL, pacote pronto para revisão externa.** Não foram corrigidos bugs, alterados sources/migrations/configuração/banco, chamados Gemini/RentCast/Stripe ou feitos deploys. Evidência = implementação rastreada e diagnósticos offline, não validação de todas as contas/dispositivos. UNKNOWN deve continuar UNKNOWN. Documento principal para colar em outra conversa; os13 anexos neste diretório detalham fatos, fórmulas e fronteiras de prova.

## A. Baseline real e implantação

Branch `fix/production-real-defects`; HEAD `d9ea801ffd1c57a85e418acddb0c198be744a02c`; working tree inicialmente limpo; upstream `origin/fix/production-real-defects`, zero commits à frente do tracking local (sem fetch). 34 stashes preservados, incluindo wip-maxxis-matches-pre-property-intelligence-deploy e backup pre maxxis release workspace2026-08-11. Sem aplicar/dropar stash ou interferir em outros worktrees.

Vercel `inspect` do alias `https://dealsiftermatch.vercel.app` confirmou deploy `dpl_EG1XKN1h5WicdkkdqcEKi6UQBtmj` READY/production, URL técnica r3v31pkj3. Metadados não devolveram SHA: **PRODUCTION_SHA UNVERIFIED, DRIFT UNKNOWN**. Não inferir backend/schema/flags de frontend READY. Hosting separado Vercel (React/Vite) e Supabase (Auth/Postgres/RLS/Storage/Realtime/Edge). Runtime local Node22.17; versões/segredos remotos não certificados.

Verificação fresca:38 testes unitários/3arquivos e6 build-env tests passaram; tsc dos contratos, lint src e4 roots Deno passaram. Check de4 Edge roots encontrou38erros de tipagem; full Vitest não concluiu em240s com TCP bloqueado. Build production não rodado para respeitar docs-only e evitar plugin Sentry publicar release/sourcemaps. Não representar isso como PASS integral. Detalhes e comandos em14.

## B. Produto hoje

DealSifter tem perfis com escopos personal/professional/fsbo, cadastro/portfólio, feed de pessoas/propriedades/serviços, conexões/Matches, filtros e pins de mapa, unlocks por Nuggets, planos/Stripe, Settings/Admin, Realtime e apresentação multilíngue. A matriz03 inventaria40 features/subfeatures; marca PARTIAL quando caminho ativo foi comprovado mas funcionamento autenticado/desktop/mobile atual não foi certificado. Não classificar PRODUCTION apenas por arquivo existir.

Último HEAD unificou unlock Map/Matches em `src/lib/unlockAccessState.js`; perfil não deve ser deduplicado apenas por nome/avatar. Popups de pessoa usam `PortfolioPinCarousel` com imagens autorizadas e ficam compactos/sem carrossel quando não há slides. Histórico do usuário menciona duplicação/contagem portfólio/saldo: não reconsultamos os dados reais desses perfis nesta auditoria, portanto não declarar essas questões resolvidas nem novamente quebradas.

## C. Maxxis implementado

Maxxis mantém conversa de20 mensagens, contexto da superfície/propriedade, roteamento help/general/property/report, tool calls autenticados, perfil de investimento/match, métricas/evidência/comps/valuation, structured analysis, Gap Resolver com inputs persistidos, six-strategy scenarios/comparison/solve-for, memória/continuidade/proatividade, avatar/bubble, relatórios1/3/6páginas e My Reports. Assets oficiais/estados e drag/minimize/copy/typing existem no Assistant; sem prova visual atual de piscadas/proporção/scroll infinito.

A seleção de imóvel prefere mensagem explícita (UUID/endereço único), seleção Maxxis, tela, conversa ativa e recentes, nessa ordem; reconcilia card pelo ID. Critério por nome ambíguo não escolhe. Server valida usuário/entitlement/fatos autorizados. Contexto persistente pode prevalecer sobre tela; precisa regression test multi-topic/multi-surface. Gap route tenta resposta pendente antes de perguntas gerais; não reproduzimos hijack real, mas é fronteira sensível.

## D. Motores analíticos

Inventário05 contém31 motores/políticas, incluindo Match, behavior/drift, busca, métricas, compare, AVM, recent-sales, comp weighted, condição/ARV, rehab/newconstruction,6estratégias, solve/comparison, FocusMap, thesis/risk/readiness/Gap/proactive e LAND development. Não são um único modelo LLM. Matemática determinística é autoridade; Gemini explica/seleciona ferramentas em rotas permitidas, não deve inventar valor, recalcular score ou confirmar legislação.

Match é adequação de perfil, não qualidade/rentabilidade: market35/price25/type25/strategy15, renormaliza critérios conhecidos, todos desconhecidos=null. Behavior usa>=5ações, dominant60% e±10 ajuste, pesos4/3/2/1. Drift sugere mudança, não atualiza preferências automaticamente. Frontend canonicalInvestmentAnalysis entretanto converte null score em0: bug confirmado de contrato de apresentação, mesmo com calculable=false.

Vendas recentes usam mediana ponderada de $/sqft ou $/acre (LAND), min2/prefer3/max5, <=180dias/<=5mi, MAD3.5, pesos35/15/15/15/15/5. NÃO têm ajuste de condição. ARV exige comps de venda real, structural>=80/completeness>=65 e condition USER_PROVIDED compatível; min2/max5. Unreviewed permanece referência, superior/inferior apoio; AVM ou preço fiscal não substitui ARV indisponível. Vários comps estruturais podem não produzir nenhum ARV: isso por si não prova bug. Limiares e condição devem ser apresentados com ação concreta, não relaxados sem calibração.

Benchmark de reforma/construção é tabela state/2026 de USER_CURATED_REFERENCE/UNSOURCED/LOW. Produz estimativa de custo, não orçamento validado. Ajustes monetários de comps são FOUNDATION com productionValuationLogicEnabled=false; não estão sendo somados no ARV real. LAND Development v2 separa comps do terreno de vendas de casas futuras; modela unidades*área, hard costs, costs coverage e exit per-unit. Zoning/uso/acesso/permit não são aprovados por financial simulation.

## E. Provider/data: onde resultados ficam rasos

RentCast suporta no código8famílias: property record, valuation, AVM comps, recorded sold, sale listings, rent estimate, rental listings, market data. Todos têm adapters/normalização/cache. Canonical field registry contém fatos cadastrais/valuation refs; comparáveis/suplementais são partes do intelligenceSnapshot/providerMarketContext, não todos campos do registry. Listing/market entram resumidos na projeção para Gemini e relatórios; não confundir cache amplo com consumo integral.

Planner providerEvidencePlan só autoriza aquisição depth DEAL_INTELLIGENCE; L2 e chat nesse planner são cache-only. Outros tools/rotas de property evidence exigem guard próprio, então nem todo chat genericamente é zero-RentCast. Sem L3 previamente adquirido, evidência L2 pode ser rasa. Entitlement one-time promove plano efetivo da execução a PRO/ENTERPRISE para acesso/budget da capability no handler, sem mudar assinatura. Proatividade/scenario math/Gap submit não adquirem provider; aceitar ação pode fazê-lo na rota downstream.

Guard global RentCast default/clamp45reservas/billable por mês UTC (global, não45/usuário); alocação Maxxis defaults PRO10 (2chat/8report), Enterprise20 (10/10), por usuário/mês/bucket. Overrides remotos UNKNOWN. Retenção/caches e identidade são deliberados: property168h/AVM72h/sold720h/rent72h/listings24h/market168h; TTL decide refresh, staleUsable sem deadline artificial. Só retained válido em identidade/schema pode continuar; stale não vira fresh. Coalescing intra-isolate + lease DB e budget reservations não devem ser removidos como duplicação.

## F. Principal risco de facts e lineage

56fields rastreados em06, do app/DB/normalizador/cache aos consumers. Registro/provenance comum existe, mas não é totalmente canônico: `factFor` prefere evidence.propertyType conhecido, `mergeVerified...` conserva app.type, overview depois sobrescreve type com grouped fact. Diagnóstico puro reproduziu flat LAND versus grouped Single Family para o mesmo objeto. Isso pode selecionar applicability/overview incompatíveis. Também confidence:null virou0; e score:null/calculablefalse virou score0 no model frontend.

Cinco fronteiras confirmadas de perda/omissão: DL1 merge limita8fotos; DL2 PDF reducers/caps removem sentenças/bullets; DL3 description/Notes backend max2.000chars; DL4 provider ownerNames normalizado não alimenta ownerName canônico (pode ser privacidade/semântica responsável versus registry); DL5 owner.notes/description descartados pelo owner whitelist. Não significa5incidentes reais: dados presentes e propriedade afetada em produção não foram consultados. FIPS internal-only e Notes summary policies são decisões explícitas, mas precisam contrato claro para cumprir export completo.

## G. Cenários, Gap e proatividade

Scenario state tem assumptions, calculatedOutputs, source, unresolvedInputs/status, comparison. Mutation combina current/history/stored/canonical, com regex e últimas5mensagens do usuário; save grava activeScenario confirmed em property_arv_review_contexts. Não existe entidade de cenário autônoma comprovada. Gap salva inputs/autorização e recompõe cache-only; ações têm version/consumption e guards de submit concorrente. Bases reais para Coach, mas ainda sem certificação end-to-end de progressão/contexto multi-topic.

Risco reproduzido: BuyHold só preço100k/rent1k calculou expenses0/NOI12k/cap12%. Tax/insurance/maintenance/vacancy omitidos não significam zero. Factory também transforma missing/invalid beds/baths/rehab/cap em0. Solve seller0% falhou via required(rate)>0 apesar de calculadora base aceitar0; SubTo DSCR usa rent/PI versus NOI/debt no Hold. Coach deve depender de domínio/completeness, não só de fórmulas que rodam.

Triggers têm hash de evidência/state, dedupe/dismiss, freshness15min, prioridades/intensity, cooldown90s e suppress busy/modal/chat-open. Scenario delta usa>=max100USD/10%; flip margin<15% oferece solve15%; ação não faz compra silenciosa. Conversational Avatar/bubble/anchor/reduced-motion são runtime ACTUAL, não apenas tests, mas qualidade visual atual UNKNOWN. Local memory/session não é confirmação de persistência comercial.

## H. Relatórios/locale/delivery

L1 Property Release1página incluído emtodos; L2 Maxxis Analysis3páginas PRO/Enterprise ou3Nuggets; L3 Deal Intelligence6páginas Enterprise ou5Nuggets. Unique user/property/capability, SQL debit/entitlement, repeat-read/no second charge e soft-delete separado estão implementados. Execução real/concurrent balance não testada. StripeEnabled=false do catálogo Maxxis não desliga assinaturas/topups Stripe do produto.

Shared structured analysis → builders/schema → chat/report existe, mas ausência structuredAnalysis mantém builders fallback independentes/DealAdvisor. L1 app-only não lê todos caches só por renderizar. jsPDF contained renderer usa tiers10.5/10/9.5/9pt, medida real, bounds/auditor/overflow exception; text antigo continua em tabelas/labels/disclaimers e reducers cortam conteúdo. Não congelar renderer inteiro com base em PDFs fixture anteriores. Preview é próprio PDF com PDF.js e rolagem vertical, páginas/canvases sequenciais após ativação, não report-generation por página.

Email Maxxis atual baixa PDF e abre mailto; attachment:null/PREPARED_NOT_SENT no contrato. Não comprovadamente envia/anexa PDF. Resend pertence a send-support-email; export Trello-style do portfólio é mailto separado. Traduzir Notes preserva source via presentation-translate/cache por hash/usuário/locale,20claims/hora e original fallback. Locale passa para schema, mas helpers/catálogos/fallbacks usam defaults próprios; strings internas inglesas ainda existem. Não afirmar resolvedUserLocale universal/saída PT-BR perfeita.

## I. Prioridades e decisões para próxima fase

15findings em11:3P0(type precedence, missing→0, numeric nullable),8P1(completude/ownership/evidence depth/scenario domain/email/verification/locale/benchmark),4P2(legacy consolidation/deploy provenance/provider utilization/visual certification). Não abrir wishlist. Readiness READY_WITH_BLOCKERS: planejar próximos recursos sem reconstruir motores existentes, mas não promover confiança financeira antes dos P0/domain regressions.

Maior ROI: facts/precedência/null/parity; scenario+Gap completeness/domain; evidence/locale/delivery clarity. Fases recomendadas: integrity gates; decision readiness; WOW guided Coach/LAND/proactive sobre action model atual. Freeze candidates3 restritos: hierarquia report/catálogo; fórmula Matchfit (não apresentação nullable); seis estados/assets oficiais (não timing/corte). Commercial real/Stripe não congelado por falta de teste atual. Cache identity/guard/reservation e distinções valuation devem ser preservados, não reescritos por conveniência.

## J–P. Paths, schema, legacy e evidência para o próximo revisor

Entrada frontend: `src/App.jsx`, `src/components/maxxis/MaxxisAssistant.jsx`, `src/services/maxxisService.js`, `src/features/maxxis/context/`, `routing/`, `intelligence/`, `export/`, `reports/`, `proactive/`, `avatar/`. Core backend: `supabase/functions/maxxis-chat/index.ts`; `_shared/maxxis/getDealInsightContext.ts`, `propertyEvidenceProjection.ts`, `dealDecisionContext.ts`, `maxxisStructuredAnalysis.ts`, `scenarioEngine.ts`, `providerEvidencePlan.ts`; `_shared/property-data/` clients/cache/comp/recentSales/ARV. Preservar runtime como fonte de verdade se docs antigos contradizem.

DB/RPC essenciais: properties/profiles; professional_profiles.profile_payload (Investment Profile); property_intelligence_cache/get/retained/upsert; external_provider_usage/reserve/finalize; maxxis_provider_budget_usage; evidence leases; property_arv_review_contexts; presentation_translation_cache/claim; maxxis_report_entitlements/maxxis_reports/unlock/save/delete; unlocks/property_unlocks; maxxis_pending_actions. Backend remoto não consultado. Edge inventory completo relacionado em02 inclui maxxis-chat, property-intelligence, arv-visual-comp-review, analysis-inputs, profile actions, provider unlock/message/conversation/workflow, presentation-translate e suporte.

Legacy ativos contados3: DealAdvisor, report fallback composition, Trello-style mailto. Duplicações contadas3: facts precedence, text containment contracts, readiness composition. Não há prova para apagar os demais quick-actions/helpers como UNUSED nem prova de segundo client RentCast independente. Erros Deno legacy atuais permanecem38; fontes não alteradas, sem mascarar casts. QA PDFs/manifests/layout audit2026-10-03 e live-artifacts2026-09-15 são úteis como controles históricos, mas não certificam este SHA/produção e não foram regenerados.

Pacote01–14 pronto para revisão externa; todas as recomendações estão mapeadas a IDs/evidência. Nenhum commit/push/deploy realizado, pois este prompt explicitamente pede auditoria sem mudanças.
