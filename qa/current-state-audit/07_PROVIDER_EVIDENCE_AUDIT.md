# Evidência de provedores — oito famílias

Inspeção sem invocações. Nenhum payload real atual foi adquirido. Endpoint suportado no cliente não prova assinatura/availability em produção. Cobertura abaixo significa caminho de código; consumo de campos individuais e presença real no cache permanecem distintos.

## Client e endpoints

`supabase/functions/_shared/property-data/rentcast/rentcastClient.ts::createRentCastClient`: base `https://api.rentcast.io/v1`, GET/X-Api-Key, timeout default8s limitado100ms–30s; valida object/array e marca HTTP200 inválido como billableSuccess. Erros auth/subscription/notfound/rate/network/timeout/upstream explícitos; providerAvailability memoriza falhas no isolate. Client só é construído com configuração e guard; `providers.ts::createPropertyDataProvider` tem disabled/mock/notconfigured/rentcast. Valor de modo/flags/chaves remotas UNKNOWN. Não houve consulta a documentação externa para afirmar campos suportados mas não modelados pelo código.

| Família | Endpoint/client | Normalização/cache | Canonical/chat/L1/L2/L3 (código) |
|---|---|---|---|
| Property Record | /properties lookupProperty | rentcastMapper::mapRentCastProperty; cache.ts property_record | YES factual fields; chat YES; L1–3 YES quando enriched snapshot disponível; app-only L1 não busca tudo |
| Valuation | /avm/value estimateValue | valuationMapper; valuationCache property_value_avm | canonical valuationReferences.providerEstimate; chat YES; L1 valor não garantido; L2 contextual; L3 evidence/range explícitos |
| Provider AVM comps | incluídos no /avm/value | valuationMapper/compEngine/valuationCache | snapshot/evidence não registry de fatos cadastrais; chat via tool projection; L1 NO como análise; L2 context parcial; L3 comps/evidence |
| Recorded Sold | /properties searchSoldProperties com filtros | soldMapper/soldSchema/soldCache property_sold_record_pool; soldCompEngine/recentSalesMarketEstimate | canonical reference recentSalesMarketEstimate + snapshot soldEvidence; chat YES; L1 não tabela analítica; L2 contexto; L3 comps/range |
| Sale Listings | /listings/sale searchSaleListings | supplementalEvidenceMapper/Cache sale_listing_evidence | providerMarketContext.saleListings summary; chat projection YES; L1 NO; L2/L3 indiretamente market/context, render integral de cada listing UNKNOWN |
| Rent Estimate | /avm/rent/long-term estimateRent | supplementalEvidenceMapper/Cache rent_estimate_evidence | providerMarketContext.rentEstimate; chat YES; L1 NO; L2/L3 por estratégia/cenário/readiness; não injeta automaticamente cada expense de Hold |
| Rental Listings | /listings/rental/long-term searchRentalListings | supplementalEvidenceMapper/Cache rental_listing_evidence | providerMarketContext.rentalListings summary; chat projection/context; L1 NO; L2/L3 consumption resumido; cada listing exportado NOT_PROVEN |
| Market Data | /markets getMarketData(zip) | supplementalEvidenceMapper/Cache market_evidence | providerMarketContext.market; chat projection market fields; L1 NO; L2/L3 decisão/contexto; todo raw market não exportado |

Todos CLIENT_SUPPORTED/NORMALIZED/CACHED = YES no código. CANONICALIZED tem dois sentidos: property field registry ou intelligenceSnapshot; apenas registro/valuation refs fazem parte do registry, suplementais/comps são canonical snapshot upstream. Não contar raw payload como informação automaticamente apresentada.

## Planner e custos

`_shared/maxxis/providerEvidencePlan.ts::buildProviderEvidencePlan`: required depende strategy; common property/valuation/recordedSold/market; BuyHold adiciona rent/rental, Seller/SubTo common, restantes adicionam AVMcomps/saleListings. LAND é tratado separadamente como category, mas segue desiredFamilies fallback de estratégia LAND (set genérico). Cache read exige plan!=FREE OU entitled. AcquisitionDepth somente reportLevel DEAL_INTELLIGENCE e !cacheOnly. Consequência: L2 e chat no planner não regeneram evidência; podem permanecer rasos se nunca houve aquisição L3, mesmo com client amplo. `getDealInsightContext.ts` converte cada family.permission em getCached/getProvider, incluindo famílias finished-home/land contextualizadas.

Não concluir que toda chamada de maxxis-chat é zero-RentCast: resolved capability/legacy tools/property-intelligence também determinam a rota. `maxxis-analysis-inputs` submit, scenario calculations, construção de triggers, schema e PDF math são zero-RentCast. L1 export não chama RentCast nesse renderer; presentation translation pode chamar Gemini. A aceitação de ação proativa chama outro fluxo e não herda promessa zero-call do trigger.

`providerBudget.ts::readProviderBudgetConfig`: FREE0; PRO default total10/chat20% (=2chat/8report), ENTERPRISE20/chat50% (=10/10); env pode mudar total1–45/%0–100. SQL `20260916224000_maxxis_provider_capability_budget.sql::ds_reserve_maxxis_provider_budget` reserva por usuário/bucket/mês UTC, advisory lock, inclui reserved/billable; property_id é atribuição, não reset do budget por imóvel. Overrides remotos UNKNOWN. One-time report entitlement não deve ser confundido com plano mensal provider FREE0.

Exceção de execução relevante: `maxxis-chat/index.ts` linhas1009–1023, guardMaxxisRuntimeEntitlement state=ENTITLED promove effectiveProviderPlan para PRO (L2) ou ENTERPRISE (L3), passando-o a executeMaxxisTool/getDealInsightContext. Isso permite acesso de evidência/budget correspondente à capability adquirida, sem modificar a assinatura do usuário. Avaliar somente runtimeAccess.plan=FREE ou propertyEvidenceAccess em isolamento daria conclusão errada. ReportRequested usa bucket report; perguntas fact/scenario e recompute são explicitamente cacheOnly no handler. Consumo mensal efetivo destas execuções não foi consultado.

`usageGuard.ts` default/clamp45. `ds_reserve_external_provider_usage` usa provider+mês UTC, conta globalmente reserved ou billable_success (não por usuário) e faz lock antes de insert. Falhas liberam/finalizam segundo status; malformed200 billable é contado. Este hard cap baixo limita volume total, ainda que vários usuários tenham entitlement. Nunca prometer 45 para cada usuário. Migrations posteriores expandem operações aceitas além de property_lookup; não usar primeira versão como enum atual. Não foram auditadas reservas órfãs do banco remoto.

## Cache, identidade e coalescing

`property_intelligence_cache` compartilha store por data_type: property_record TTL168h; AVM72h; sold720h; sale/rental listings24h; rent72h; market168h. TTL controls refresh, não retention. `cacheFreshness.ts::cacheFreshness`:

| Estado | Regra e comportamento |
|---|---|
| ABSENT | Sem entry |
| CORRUPT | Payload inválido pelo caller, timestamps inválidos/expiry<=retrieved ou retrieved>now+60s |
| IDENTITY_MISMATCH | Fingerprint/identity false; não emprestar evidência de outro imóvel |
| EXPIRED_UNUSABLE | invalidated explicitamente; não apenas passou TTL |
| FRESH | expiry>now |
| STALE_USABLE | Passou TTL, identidade/estrutura válidas; allowStale=true libera leitura; staleUntil=null (sem janela máxima inventada) |

Query/address fingerprints, aliases validados, schema serializers e legacyQueryFingerprint participam de leitura; soldCache aceita validatedAddressAlias + query compatibility. Alias não é matching somente por nome/CEP. Legacy stale caches só são admissíveis se identidade/schema compatíveis; não chamar todos retained de fresh.

`singleFlight.ts::InMemoryPropertySingleFlight` coalescing de promises e finally cleanup; `SupabasePropertySingleFlight` lease compartilhado cross-isolates via ds_acquire_property_evidence_lease / release; deadline40s/poll250ms, release error explícito, timeout PROPERTY_EVIDENCE_BUSY. Reserva de budget + lease + provider availability são guardas diferentes, não duplicações dispensáveis. Duração exata do lease no SQL remoto UNVERIFIED. BackendFactory injeta caches/usage/provider.

## Underutilization e causas de resultado raso

CONFIRMED AVAILABLE_BUT_NOT_USED: mapRentCastProperty normaliza ownership.ownerNames, porém field registry ownerName não tem evidenceKey e usa ownerName/owner.name do app; não transportar nome do responsável comercial como proprietário de registro sem distinguir semântica. Owner mailing address não é normalizado pelo mapper lido (UNKNOWN raw supported), não afirmar que provider retornou e foi descartado. Property tax/parcel/features são normalizados e muitos projetados; não os listar como ausentes indiscriminadamente.

Sale/rental/market são resumidos em getDealInsightContext/listingSummary/toolResultForGemini e não têm tabela integral nos relatórios: SUMMARY_ONLY, não evidência de ausência no backend. Condition de comps continua USER_PROVIDED; cache amplo não satisfaz inspeção. Benchmark construction/rehab é heurístico sem fonte retida. Efeito conjunto: cache-only L2 + condição não revisada + permissões familiares + campos opcionais→0 explicam lacunas/raso; limiares não devem ser afrouxados sem estudo local.

Sem chamadas reais, cobertura comercial/provider entitlement/freshness atual permanece UNVERIFIED. Os testes offline só confirmam regras/payloads controlados.
