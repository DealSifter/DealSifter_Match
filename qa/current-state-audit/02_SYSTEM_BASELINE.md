# Baseline técnico — 2026-10-11

## Escopo e grau de prova

Auditoria de código/configuração/schema local, sem alterações de runtime, consultas ao banco, calls de provedores, cobrança ou deploy. `CONFIRMED` significa comprovado pelo código ou por diagnóstico offline; não significa validado com conta real em produção. `PARTIAL` indica implementação rastreada com validação incompleta; `UNKNOWN`/`UNVERIFIED` não devem ser reinterpretados como ausência de implementação. Matrizes classificam como PARTIAL recursos ativos que não tiveram validação autenticada nesta auditoria.

## Git e produção

| Evidência | Valor observado |
|---|---|
| Branch | `fix/production-real-defects` |
| HEAD | `d9ea801ffd1c57a85e418acddb0c198be744a02c` |
| Status inicial / untracked | Limpo / nenhum |
| Tracking | `origin/fix/production-real-defects` |
| HEAD além do tracking local | 0 (`git rev-list --count '@{upstream}..HEAD'`); sem fetch, não prova estado remoto atual |
| Stashes | 34; nenhum aplicado/removido |
| Protegidos explicitamente | `stash@{0}`: wip-maxxis-matches-pre-property-intelligence-deploy; `stash@{1}`: backup pre maxxis release workspace 2026-08-11 |
| Demais stashes | Preservados como trabalho do usuário; não classificados como descartáveis |
| Produção consultada | `vercel inspect https://dealsiftermatch.vercel.app --format=json` |
| Deploy / estado | `dpl_EG1XKN1h5WicdkkdqcEKi6UQBtmj`, READY, target production |
| URL técnica | `https://dealsiftermatch-r3v31pkj3-deal-sifter-match-s-projects.vercel.app` |
| Production SHA | UNVERIFIED: metadados consultados não devolveram campo de SHA |
| Drift local/produção | UNKNOWN; READY não prova equivalência de código nem correção funcional |

Commits recentes: d9ea801 (unlock Map/Matches); 3df76a0 (carrossel/recorte avatar); 2695d4f (popups/land dual-comp); fa8440d (avatar/tipografia); 84c2563 (subtítulos localizados). São histórico local, não certificado de implantação backend. Auditoria não criou commit/deploy; somente documentos neste diretório.

## Frontend

Node observado `v22.17.0`. `package.json`: engines >=22.17 <23; React 19.2, Vite 7.3.x, Supabase JS 2.x, jsPDF 4.2, Leaflet/react-leaflet/supercluster, localforage, framer-motion, Sentry. Versões declaradas não equivalem a versão remota instalada.

`src/App.jsx` contém navegação por estado/switch de superfícies, composição de Dashboard/MapView/Matches/Onboarding/Pricing/Settings/Admin e grande parte da sincronização de usuário. Não há evidência para descrever este app como um novo router independente do App. `useAuthSession` conserva sessão e limpa caches sensíveis; `usePortfolioSync` sincroniza portfólio. `src/theme/context.jsx` controla tema; `src/i18n/translations.js` reúne catálogos PT/EN/ES. App mantém mapa de contatos desbloqueados e encaminha contexto para Maxxis (`handleMaxxisSurfaceContextChange`).

Realtime é ativo: `createRealtimeLifecycle` / `createRealtimeTopic` em App assinam plano, ações de feed, perfis/portfólio e atualização global; callbacks têm debounce e descarte. Cache UI e state local não são a autoridade financeira. `src/services/unlockedContactService.js` lê `unlocks`/`property_unlocks`; `src/lib/unlockAccessState.js` centraliza interpretação compartilhada por Map/Matches. Escopo personal/professional/fsbo é parte da identidade, não apenas nome/avatar.

`src/components/maxxis/MaxxisAssistant.jsx` concentra chat, 20 mensagens de histórico, resolver de propriedade, Gap, ações, entitlement, relatórios, memória, avatar e proatividade. Módulos em `src/features/maxxis/` reduzem responsabilidades, mas a orquestração continua muito concentrada. `src/domain/maxxis/maxxisReportSchema.js` é o contrato dos três relatórios; `maxxisReportPdf.js` gera PDF; `MaxxisCanonicalReportPreview.jsx` usa PDF.js para exibir o próprio PDF em rolagem interna vertical, com renderização sequencial de canvases após ativação.

`vite.config.js`: React + legacy Safari/iOS >=11; manual chunks; merge de variáveis VITE_/legadas; plugin Sentry somente production + credenciais + release não local. Esse plugin pode publicar sourcemaps/release: build não executado nesta auditoria para não gerar arquivos fora do diretório permitido nem efeitos externos. `tsconfig.contracts.json` cobre contratos em `src/types`, não tipa integralmente o JSX. Vitest include src e shared Supabase; e2e excluído; dois testes Deno excluídos explicitamente. Não confundir tsc de contratos com frontend completamente type-safe.

## Backend e serviços externos

Supabase Auth/Postgres/RLS/Storage e Edge Functions. RLS e SECURITY DEFINER são verificáveis nas migrations, não foi certificada correspondência do banco remoto. `supabase/config.toml` usa verify_jwt=true para Maxxis/property/email/geocode; checkout/portal/delete-account/Stripe usam false e precisam validar identidade/assinatura no handler. Isto isoladamente não prova vulnerabilidade. Não houve auditoria de segurança integral.

Gemini: `supabase/functions/_shared/maxxis/geminiClient.ts`, prompts/toolRegistry, explicação e tradução de apresentação; não deve inventar/recalcular métricas determinísticas. RentCast: `_shared/property-data/rentcast/rentcastClient.ts`, adapters/normalizadores/cache/usage guard. Stripe: checkout, portal, webhook e fila de reprocessamento. Resend: `send-support-email/index.ts`. Geocoding: `geocode-address/index.ts`. Email de relatório Maxxis não é automaticamente Resend: seu botão atual baixa arquivo e abre mailto.

Frontend hospedado na Vercel; backend Supabase independente. Um push/frontend READY não comprova versão das funções, migrations, flags, segredo do provedor ou disponibilidade de assinatura. Todas essas equivalências remotas permanecem UNVERIFIED.

## Schema diretamente relevante

| Entidade / RPC | Uso comprovado e limite da prova |
|---|---|
| `properties`, `profiles` | Card/imóvel/identidade; `propertyRepository.ts` seleciona id/type/address/city/state/zip/price/beds/baths/sqft/lot/owner_id/description/lat/lng |
| `professional_profiles.profile_payload` | `getMyInvestmentProfile.ts::getMyInvestmentProfileWithClient` seleciona profile_payload pelo user_id; extractInvestmentProfile / normalizeInvestmentProfile extraem o perfil; dados reais não consultados |
| `property_intelligence_cache` | Payload JSONB tipado por data_type e fingerprint; RPCs ds_get_property_intelligence_cache, ds_get_retained_property_intelligence_cache, ds_upsert_property_intelligence_cache |
| `external_provider_usage` | Reserva/finalização global mensal; ds_reserve_external_provider_usage / ds_finalize_external_provider_usage |
| `maxxis_provider_budget_usage` | Alocação por usuário/mês/bucket; ds_reserve_maxxis_provider_budget / ds_finalize_maxxis_provider_budget |
| Lease de evidência | ds_acquire_property_evidence_lease / ds_release_property_evidence_lease; singleFlight.ts |
| `maxxis_report_entitlements`, `maxxis_reports` | Unlock por usuário/imóvel/capability; salvar payload; soft-delete de artefato |
| `property_arv_review_contexts` | Assumptions/condição/activeScenario; maxxis-analysis-inputs usa upsert autorizado; não há banco de cenário autônomo comprovado |
| `presentation_translation_cache` | user_id + source_hash + target_locale; PENDING/READY/FAILED; owner SELECT e writes service_role |
| `unlocks`, `property_unlocks` | Contatos, propriedades, entitlement de portfólio; unlockedContactService |
| `maxxis_pending_actions` | Preparar/confirmar/cancelar mudanças explícitas de perfil |
| Nuggets / compras | nugget_purchases e RPCs de débito/unlock; saldo não deve ser decidido por estado UI |
| Proactive/memória | Persistência cliente/session; schema dedicado remoto UNKNOWN |

Migrations de evidência: 20260909183000, 20260909190000, 20260912090000, 20260912093000; entitlement 20260914090000, 20260914110000, 20260914223000, 20260921195600; budget 20260916224000; tradução 20261009121000; land 20261009150000. Versões anteriores são redefinidas por migrations posteriores: ler só a primeira pode dar regra obsoleta.

## Inventário Edge relacionado

Todos os nomes abaixo correspondem a `supabase/functions/<nome>/index.ts`. JWT conforme config acima; validação por usuário e guards adicionais variam por handler. Service-role é usado em property-intelligence/arv/context para acesso protegido/cache; verificar handler antes de qualquer invocação real.

| Função | Propósito / integração / consumidores |
|---|---|
| maxxis-chat | Tool routing/contexto/entitlement/Gemini; MaxxisAssistant via maxxisService |
| property-intelligence | Registro do imóvel, cache e aquisição autorizada RentCast; propertyIntelligenceService |
| arv-visual-comp-review | Avaliação/revisão de condição/comps, cache e contexto; arvReview UI; não confundir chamada com revisão automaticamente concluída |
| maxxis-analysis-inputs | Ler/salvar assumptions/condição por imóvel; entitlement + auth.getUser; sem Gemini/RentCast no submit |
| maxxis-action-confirm / cancel | Ações pendentes de perfil confirmadas pelo usuário |
| maxxis-provider-unlock-prepare / confirm / cancel | Intenção comercial explícita e débito de contato; maxxisService; não é aquisição de dado RentCast |
| maxxis-provider-message-draft | Rascunho de contato com prestador; pode usar Gemini |
| maxxis-provider-message-prepare / confirm / cancel | Mensagem pendente/confirmada; writes em conversas por decisão explícita |
| maxxis-provider-conversation-analysis | Análise de conversa com prestador; Gemini; maxxisService |
| maxxis-deal-workflow | Workflow/checklist; caminho paralelo operacional |
| presentation-translate | Hash/cache/claim/service-role e Gemini em miss; chatTranslation/localizePresentationText |
| send-support-email | Resend, JWT e rate/validação; suporte; não comprova envio de relatórios |

Não existe função Edge dedicada de relatório no inventário: renderer/persistência/RPC estão no cliente/DB. Auth/service-role/entitlement efetivos de funções de mensagens/Workflow não foram exaustivamente certificados: PARTIAL.
