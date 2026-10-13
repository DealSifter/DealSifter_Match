# Arquitetura e paridade dos relatórios

## Níveis e acesso comercial

Fonte: backend `intelligenceEconomy.ts::MAXXIS_CAPABILITY_CATALOG/CAPABILITY_ENTITLEMENT_MATRIX`; frontend `src/domain/intelligenceEconomy.js`; schema `maxxisReportSchema.js::pagesFor/buildMaxxisReportSchema`. PUBLICAÇÃO efetiva não certificada em banco real.

| Capability / páginas padrão | FREE | PRO | ENTERPRISE | Fonte/análise |
|---|---|---|---|---|
| PROPERTY_RELEASE /1 | Incluído | Incluído | Incluído | Card/app/overview; dados enriched se fornecidos; não análise LLM nova |
| MAXXIS_ANALYSIS /3 | Unlock3 Nuggets | Incluído | Incluído | Snapshot/Decision/structuredAnalysis + builder L2, canônico ou fallback |
| DEAL_INTELLIGENCE /6 | Unlock5 Nuggets | Unlock5 Nuggets | Incluído | L2 + comps/valuation/scenario/evidence + builder L3 |

Não somar3+5 como preço obrigatório de L3: SKU independente5. Page count é template fixo, não prova export integral de conteúdo arbitrário. Free export PROPERTY_RELEASE não significa bypass de contato privado/unlock imóvel. `INTELLIGENCE_ECONOMY_RUNTIME.stripeEnabled=false` refere-se ao one-time unlock por Nuggets, NÃO ao sistema Stripe de assinaturas/topups do app.

## Construção e evidência

`buildPropertyOverviewModel` é shared L1–L3; `mergeMaxxisReportProperty` complementa snapshot server com app autorizado (photos/owner/notes), retém canonicalPropertyFacts e aplica appAuthoritative para identidade/tipo/notes. Depois overview reusa canonical facts que pode sobrescrever type com provider. Resultado: contrato compartilhado existe, mas não tem precedência uniforme. Dados de L1 app-only não ganham automaticamente provider fields disponíveis em outro cache; a montagem não busca cache nem DB por si.

L2 `buildMaxxisAnalysisReport` e L3 `buildMaxxisDealIntelligenceReport` recebem structuredAnalysis quando type=maxxis_structured_analysis; ausência ativa composição determinística própria. `maxxisStructuredReportFallback.js` é alcançável no frontend. Não há prova de um segundo call Gemini exclusivo para cada export: esses builders/schema/PDF usam dados existentes. Request de relatório via chat pode adquirir contexto/provider/explicação antes; preview/export chama prepareReportNarrativePresentation que pode invocar presentation-translate/Gemini em miss. Promessa “PDF zero Gemini” só vale sem tradução a adquirir.

Sources de valuation: askingPrice cadastrado; assessedValue fiscal; providerEstimate AVM_UNVALIDATED; recentSalesMarketEstimate mediana de vendas sem ajuste de condição; ARV exige reviewed condition; projected exit é cenário/user/recent finished-home assumption. Nenhum é sinônimo. `maxxisReportPdf::renderValuation` dá destaque a recent-sales quando AVAILABLE; label ARV fallback não converte AVM em ARV. Land projection evita beds/baths/rehab residencial e usa landDevelopment template quando presente; conflito type é risco antes dessa decisão.

Scenario integration: activeScenario salvo em property_arv_review_contexts via maxxis-analysis-inputs; snapshot/contexto traz seller/deal assumptions; L3 kpiScenarios/presentation e desenvolvimento incorporam scenario. `scenarioSnapshot` resume métricas (default3). Todos os parâmetros não têm export integral demonstrado. FocusMap usa requisitos/evidências/confirmed seller terms, não “score de bom negócio”.

## Persistência, ownership, repeat reads

`src/services/maxxisReportService.js`: fetch entitlements/list artifacts; `ds_unlock_maxxis_report`; `ds_save_maxxis_report_payload`; `ds_delete_maxxis_report_artifact`. Migrations implementam unique(user_id,property_id,capability), repetição sem novo débito, débito de saldo sob autoridade SQL, entitlement independente de artefato. Soft-delete reports.deleted_at não elimina direito adquirido; included plan persistence patch preserva relatórios incluídos. Guards de owner/access em `reports/savedReportAccess.js` / `MyMaxxisReports.jsx`. Atual schema aplicado, funcionamento de concurrent unlock/real saldo e acesso após downgrade no ambiente remoto UNVERIFIED; código não é substituto de prova comercial.

My Reports abre payload salvo; não é regeneração obrigatória nem direito de acessar relatório de outro usuário. Mudança de dados depois de salvar não transforma artefato histórico em snapshot fresh. É importante exibir revision/source/age e separar leitura vs regeneração.

## PDF / preview / email

`maxxisReportRenderer.js` cria plano de páginas; `maxxisReportPdf.js::renderMaxxisReportPdfCached` produz PDF com jsPDF/NotoSans e cache/inflight; download usa binário. `MaxxisCanonicalReportPreview.jsx` só inicia após activated, PDF.js worker e canvases de páginas em sequência (nextPageToRender), mas apresentação é rolagem vertical; não carrossel horizontal. Fila de canvases não equivale a novo request Gemini a cada página. Effect usa schema/locale/entitlementKey/retry; referências instáveis são risco de reiniciar, mas loop infinito não foi reproduzido nesta auditoria.

`MaxxisReportExportActions.jsx::runAction('EMAIL')`: baixa PDF, abre `mailto` por `openEmailDraft/buildReportMailtoUrl`, status emailReady. Não anexa automaticamente PDF no mailto, não recebe deliveryId nem confirma entrega. `maxxisReportDeliveryContracts::createReportEmailRequest` declara PREPARED_NOT_SENT/attachment:null. `MatchesPortfolio.jsx` tem caminho próprio Trello-style/mailto com to/cc/bcc. `send-support-email` Resend pertence ao suporte e não prova implementação de anexos de relatório. Tratar email Maxxis como FRiCTION/PARTIAL e rascunho, não “enviado”.

Classificação normalizada na matriz UX: FRICTION. O caminho de suporte e o export legado não substituem a entrega do PDF deste componente.

## Containment atual e perdas de completude

`maxxisReportVisualPolicy.js`: body10.5→10→9.5→min9pt, sectionGapY8; políticas por Notes/L2 executive/opportunity/L3 insight/conclusion/lists/valuation/comps. `maxxisReportPdf::renderContainedText` mede fonte NotoSans/jsPDF getTextWidth/splitTextToSize, quebra tokens largos, bounds geométricos/card/page safe bottom, audita linhas/sections. `assertContainedLine` lança erro se sair de bounds; `REPORT_SECTION_OVERFLOW` failsafe. Layout debug desenha limites quando habilitado; não prova todos os caminhos auditados.

Depois de não caber em todos os tiers, `reduceReportContent` remove unidades semânticas até budget; evaluateContainedText também remove últimas sentenças. `renderContainedBulletList` limita máximo de bullets e duas linhas por item; Notes tem budget500chars/7linhas; fotos merge limit8; propertyDetails description sanitizado max2.000; scenarioSnapshot default3 métricas. Assim geometria protegida não garante “toda informação exportada”. Perdas confirmadas ledger em06: DL1 photos>8 no merge; DL2 narrativas/bullets reduzidos; DL3 notes>2.000 antes de schema. Não há páginas de continuação universais provadas.

Ledger adicional: DL4 ownership.ownerNames normalizado não alimenta ownership.ownerName canônico (consome responsável do app; possível escolha de privacidade, não prova vazamento); DL5 owner.notes/owner.description presentes no app são retirados pelo whitelist do objeto owner no merge, embora reportNarrativePresentation tente traduzir esses campos. São cinco fronteiras de perda/omissão comprovadas, não cinco incidentes em imóveis reais. FIPS INTERNAL_ONLY e filtro de features relevantes são políticas explícitas, não novos incidents de data loss.

`text()` legado continua usado para headings/labels/tabelas/disclaimers; minSize default4.2 e maxLines, não usa auditoria geométrica compartilhada em todos os casos. Analytical list/paragraph cards passam por contained renderer; comparables table e header/value blocks continuam outro contrato. Não afirmar “todas as seções contidas” com base nos audits JSON antigos. Confiabilidade geométrica universal = PARTIAL; teste novo controlado por seção/idioma/tamanho necessário antes de freeze do renderer inteiro.

## Idioma e artifacts anteriores

Schema recebe `resolvedUserLocale`, renderer usa locale; `reportNarrativePresentation` traduz apresentação de notes/description/owner.notes sem salvar source alterado. UI/catálogos e determinísticos backend normalizam language separadamente; INCLUDED de export preview e fallback strings do L2/L3 permanecem ingleses na construção. Localização de tudo num único resolvedUserLocale não está demonstrada. Zero call de tradução pode manter source original se unavailable, não garantir saída monolíngue.

Artifacts existentes: qa/maxxis-control-reports/manifest.json generatedAt2026-10-03, providerCalls0 e PDFs droad/gable/bent-creek nos3níveis; qa/report-layout-audit.json mesma data; qa/report-visual-diffs/summary.json threshold.82; qa/report-template/*.pdf; qa-artifacts/maxxis-final-live-2026-09-15/*.pdf. São fixtures/histórico, anteriores ao HEAD/produção consultada e não vinculados nesta auditoria a build SHA atual. Não regenerados nem tratados como PASS fresh. Screenshots disponíveis nos diretórios QA não foram inspecionados visualmente um a um; visual runtime UNKNOWN.
