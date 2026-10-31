# Matriz de requisitos de dados — Maxxis / DealSifter

Escopo: R-2.0/P3, leitura offline do código e fixtures R-4.2; contrato v0.6 como alvo. Nenhuma aquisição externa, alteração de motor, premissa automática ou implementação de computeCoverage. As divergências descritas são achados, não autorização para alterar cobrança ou aquisição.

## P3.1 — Campos, aplicabilidade e fontes

Cada linha é uma obrigação de entrega. O endereço normalizado, a galeria e cada pool são campos compostos: não se multiplica o denominador por componentes ou quantidade de fotos. Zero explícito e confirmado conta; ausente, conflitante, bloqueado, indisponível ou sem origem não conta. Ausência de dados não torna um campo inaplicável. Somente fatos confirmados sobre tipo/estratégia justificam exclusão. O escopo residencial com dívida/renda usado nesta comparação tem 9 campos L1, 21 L2 e 34 L3; não é um denominador universal para terrenos ou estratégias de revenda.

Classe app = apurado pelo app; calculation = derivado por cálculo. Cache retém a origem primária e sua data; não é uma nova prova. A ordem descrita é a ordem-alvo por campo. Usuário não pode fornecer uma "venda verificada" ou substituir registro externo por um número privado.

| ID | Rótulo | Nível mínimo | Aplicabilidade | Ordem de fontes | Classe |
|---|---|---|---|---|---|
| address | Endereço completo normalizado | L1 | Todos; rua/cidade/estado/ZIP formam um campo atômico | DB → cache → ArcGIS → RentCast | app |
| price | Preço pedido | L1 | Todos; não confundir com valor de mercado | DB | app |
| type | Tipo de imóvel | L1 | Todos | DB → cache → ArcGIS → RentCast | app |
| beds | Quartos | L1 | Imóvel residencial construído; não terreno | DB → cache → RentCast | app |
| baths | Banheiros | L1 | Imóvel residencial construído; não terreno | DB → cache → RentCast | app |
| sqft | Área construída | L1 | Imóvel construído; não terreno | DB → cache → ArcGIS → RentCast | app |
| photos | Fotos do imóvel | L1 | Todos; pelo menos uma imagem válida | DB | app |
| notes | Notas/descrição | L1 | Todos | DB | app |
| objective | Objetivo/estratégia publicada | L1 | Todos | DB | app |
| lot | Área do terreno | L2 | Todos com parcela; condomínio quando houver área aplicável | DB → cache → ArcGIS → RentCast | app |
| apn | APN/identificador da parcela | L2 | Todos com parcela | DB → cache → ArcGIS → RentCast | app |
| zoning | Zoneamento | L2 | Todos com informação parcelária aplicável | DB → cache → ArcGIS → RentCast | app |
| county | Condado | L2 | Todos | DB → cache → ArcGIS → RentCast | app |
| tax | Imposto anual | L2 | Todos tributáveis; isenção explícita vale zero | DB → cache → ArcGIS → RentCast | app |
| year | Ano de construção | L2 | Imóvel construído | DB → cache → ArcGIS → RentCast | app |
| fit | Aderência ao perfil | L2 | Perfil necessário; perfil ausente é lacuna, não exclusão | DB → cálculo → usuário confirmado | calculation |
| criteria | Critérios de compatibilidade | L2 | Mesma aplicabilidade de fit | DB → cálculo → usuário confirmado | calculation |
| risk | Riscos fundamentados | L2 | Todos; lista vazia não comprova ausência de risco | DB → evidências → cálculo | calculation |
| rent | Aluguel de mercado estimado | L2 | Residencial locável; terreno excluído | cache → RentCast | app |
| sold | Pool de 3–5 vendas fechadas elegíveis | L2 | Imóvel avaliável; 3 é o mínimo de preenchimento deste campo composto | cache → RentCast → seleção determinística | app |
| saleListings | Três anúncios à venda de suporte | L2 | Mercado com anúncios comparáveis; não elegíveis ao ARV | cache → RentCast | app |
| avm | Estimativa automatizada de valor | L3 | Tipos cobertos; não substitui ARV | cache → RentCast | app |
| saleCoords | Coordenadas das vendas utilizadas | L3 | Ao menos duas vendas utilizáveis, todas com coordenadas válidas | cache → RentCast | app |
| arv | ARV ou faixa preliminar rotulada | L3 | Residencial avaliável; terreno usa análise específica, não ARV residencial | cache → RentCast → cálculo | calculation |
| lastSale | Última venda (valor e data) | L3 | Todos com registro de transação | DB → cache → ArcGIS → RentCast | app |
| hoa | HOA cadastral/documentada | L3 | Residencial; ausência de associação deve ser confirmada explicitamente | DB → cache → ArcGIS → RentCast | app |
| spread | Spread preço pedido × ARV | L3 | Preço e valor comparável; pode ser faixa preliminar rotulada | DB → evidências → cálculo | calculation |
| relativePsf | Preço/sqft relativo aos comps | L3 | Imóvel construído com comparáveis de área conhecida | DB → evidências → cálculo | calculation |
| grossYield | Rendimento bruto | L3 | Estratégia de renda residencial, inclusive Subject-to locativo | DB → evidências → cálculo | calculation |
| noi | NOI do cenário | L3 | Estratégia de renda; entradas faltantes não removem o indicador do denominador | DB → evidências → usuário confirmado → cálculo | calculation |
| cap | Cap Rate do cenário | L3 | Estratégia de renda; entradas faltantes mantêm pendência | DB → evidências → usuário confirmado → cálculo | calculation |
| roi | ROI do cenário | L3 | Estratégia de investimento definida; entradas faltantes mantêm pendência | DB → evidências → usuário confirmado → cálculo | calculation |
| cashOnCash | Cash-on-cash | L3 | Estratégia de renda com capital próprio investido | DB → usuário confirmado → cálculo | calculation |
| dscr | DSCR | L3 | Estratégia de renda com financiamento; sem dívida apenas se confirmado | DB → usuário confirmado → cálculo | calculation |

Campos complementares existentes no schema, sem obrigação independente na tabela-base: título, identificação interna, coordenadas do imóvel, área em acres (conversão da mesma área), avaliação tributária/ano de avaliação, ano fiscal, descrição legal, subdivisão, confirmação de ocupação, presença de dados de proprietário, valor/data das fontes, faixa/confiança do aluguel/ARV, diagnóstico dos comps e cenário ativo. Podem enriquecer a entrega; conversões, metadados e presença de proprietário não inflam cobertura. Contatos e nomes ficam fora do PDF por padrão. DSCR/cash-on-cash e vários outputs são requisitos-alvo: não se presume que já sejam publicados por todos os caminhos do renderer.

### Entradas exclusivas do investidor (separadas)

| ID | Entrada | Aplicabilidade | Origem/classe |
|---|---|---|---|
| rehab | Reforma, escopo e condição confirmada | Reforma/flip/BRRRR ou saída reformada | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| insurance | Seguro anual | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| vacancy | Vacância percentual | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| management | Administração (% ou valor e periodicidade) | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| maintenance | Manutenção (% ou valor e periodicidade) | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| utilities | Utilidades pagas pelo proprietário | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| otherExpenses | Outras despesas operacionais | Cenário de renda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| contractRent | Aluguel contratual efetivo (não estimativa) | Imóvel locado | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| debtBalance | Saldo devedor | Subject-to/financiamento | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| debtRate | Taxa de juros | Subject-to/financiamento | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| debtPayment | Prestação e periodicidade | Subject-to/financiamento | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| debtTerm | Prazo restante | Subject-to/financiamento | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| cashInvested | Capital próprio investido/entrada | Cash-on-cash/ROI | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| sellingCosts | Custos de venda | Saída por revenda | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |
| holdingCosts | Prazo e custos de carregamento | Revenda/reforma | USER_PROVIDED confirmado, datado, cenário privado / exclusivo do investidor |

HOA público/documentado e despesa HOA do cenário são campos distintos. Aluguel de mercado, aluguel contratual e hipótese privada também são distintos. Não aplicar estimativa de aluguel automaticamente como aluguel efetivo. Seguro, vacância, manutenção e demais despesas não recebem valores padrão.

### Divergências verificadas no código

- L1 usa PROPERTY_RELEASE e apenas propertySummary/provenance. O renderer limita-se ao card; não há aquisição paga de relatório L1.
- L2 usa MAXXIS_ANALYSIS: providerEvidencePlan permite leitura de cache, mas não compra AVM, registro, pool vendido ou anúncios. A exceção explícita é o aluguel, adquirido separadamente por toolRegistry → reportMarketRentPolicy → MarketRentService, com entitlement, endereço e orçamento. **L2 atual não adquire pool de vendas nem anúncios.** O schema L2 também não publica as seções comparableEvidence/valuationEvidence. Portanto o alvo de 3–5 vendidos + 3 anúncios ainda não está implementado.
- L3 usa DEAL_INTELLIGENCE e o plano depende da estratégia: renda pede mercado/rental comps; flip inclui anúncios; Subject-to não exige anúncios nesse plano. O conjunto fixo de quatro data_types da validação não equivale ao plano atual. Não recortar o plano por alteração funcional nesta fase.
- A integração parcelária do relatório consome receipt assinado já existente; reportEvidence não consulta GIS e só projeta APN factual. O contexto financeiro pode consumir outros fatos parcelários autorizados pelo consenso. Não há prova de uma etapa automática de consulta ArcGIS antes de todo RentCast no orquestrador.
- O snapshot atual transporta valuation/financial/readiness/inputs e razões, mas não implementa este denominador de cobertura. O selo R-4.2 é heurístico e relativo ao nível. A regra percentual abaixo é **especificação**, não foi instalada nesta rodada.
- Um conjunto de inputs não implica outputs já calculados: na fixture partial o readiness continua incompleto apesar de existirem alguns valores privados; não conta como NOI calculado.

## P3.2 — Cobertura das nove fixtures

Inventário feito sobre os inputs R-4.2 e os valores efetivos do view model L3, restritos ao conjunto de campos de cada nível. É cobertura da evidência disponível no snapshot, não garantia de visibilidade no PDF L2 atual. Fotos são as mesmas duas imagens fictícias utilizadas na geração QA. Os inputs privados confirmados não contam como automáticos; os outputs NOI/Cap Rate da fixture rich contam apenas na cobertura final porque dependem desses inputs. Não se calculam novos spreads/retornos apenas para melhorar o percentual. Os pools de 2 vendas permitem ARV preliminar, mas não satisfazem o campo de 3–5 vendidos. Critérios/perfil calculados a partir do cadastro contam como automáticos.

| Fixture | Automática | Final | Selo-alvo por cobertura (não selo atual) |
|---|---|---|---|
| rich-L1 | 9/9 (100.0%) | 9/9 (100.0%) | Completo |
| rich-L2 | 20/21 (95.2%) | 20/21 (95.2%) | Completo |
| rich-L3 | 22/34 (64.7%) | 24/34 (70.6%) | Parcial |
| partial-L1 | 9/9 (100.0%) | 9/9 (100.0%) | Completo |
| partial-L2 | 19/21 (90.5%) | 19/21 (90.5%) | Completo |
| partial-L3 | 21/34 (61.8%) | 21/34 (61.8%) | Preliminar |
| sparse-L1 | 8/9 (88.9%) | 8/9 (88.9%) | Completo |
| sparse-L2 | 8/21 (38.1%) | 8/21 (38.1%) | Preliminar |
| sparse-L3 | 8/34 (23.5%) | 8/34 (23.5%) | Preliminar |

| Fixture | Campos app/derivados ainda ausentes na cobertura final |
|---|---|
| rich-L1 | nenhum |
| rich-L2 | saleListings |
| rich-L3 | saleListings, avm, lastSale, hoa, spread, relativePsf, grossYield, roi, cashOnCash, dscr |
| partial-L1 | nenhum |
| partial-L2 | sold, saleListings |
| partial-L3 | sold, saleListings, avm, lastSale, hoa, spread, relativePsf, grossYield, noi, cap, roi, cashOnCash, dscr |
| sparse-L1 | notes |
| sparse-L2 | notes, lot, apn, zoning, county, tax, year, fit, criteria, risk, rent, sold, saleListings |
| sparse-L3 | notes, lot, apn, zoning, county, tax, year, fit, criteria, risk, rent, sold, saleListings, avm, saleCoords, arv, lastSale, hoa, spread, relativePsf, grossYield, noi, cap, roi, cashOnCash, dscr |

As fixtures rich/partial antecedem o contrato v0.6 e não são uma amostra com todos os campos futuros: não trazem AVM separado, três anúncios, última venda documentada, HOA cadastral, DSCR/cash-on-cash nem vários outputs derivados. O nome rich é relativo às fixtures existentes, não prova de >95% de cobertura do novo contrato. O campo notes está ausente em sparse. Os selos do renderer e os selos percentuais propostos não devem ser confundidos.

## P3.3 — Caso real esparso, sem provedor

PDF local de exemplo inspecionado em memória (7 páginas; 17 ocorrências monetárias). Texto, endereço e dados de proprietários não foram exportados. A presença de rótulos não comprova a existência de valores: a estimativa abaixo não promove campos com "Unavailable".

Caso identificado apenas por atributos: Subject-to, SFR, 4 quartos, 2 banheiros, preço 231000, ZIP 33880. Sem reproduzir endereço ou proprietário. São conhecidos 6/9 campos atômicos L1 (endereço na granularidade fornecida pelo relatório, preço, tipo, quartos, banheiros e objetivo); área, fotos e notas precisam de confirmação no snapshot original. Faixa estimada: L1 6–9/9 = 66,7–100%; L2 6–9/21 = 28,6–42,9%; L3 6–9/34 = 17,6–26,5%. Se o endereço completo também não estiver validado, reduzir cada numerador em um. Perfil/riscos não podem ser contados só pela existência de títulos no PDF. Sem novo snapshot auditado, não há percentual pontual comprovado. Cobertura final não supera a automática sem respostas confirmadas registradas.

## P3.4 — Perguntas e metas

Mínimos inteiros deste recorte: L1 5/9; L2 18/21; L3 33/34. Logo, faltam para a meta: rich 0/0/9 campos; partial 0/0/12; sparse 0/10/25 (L1/L2/L3). Isso é **quantidade de campos**, não quantidade de mensagens: uma resposta pode desbloquear vários outputs e uma pergunta pode exigir confirmação. No caso real, L1 já supera a meta pela faixa conhecida; L2 falta 9–12 campos e L3 24–27. Não existe número universal de respostas capaz de atingir essas metas: vendas verificadas, estimativas do provedor e coordenadas não se tornam comprovadas por texto do usuário.

Entradas exclusivamente privadas exigidas pelo cenário: L1 nenhuma; L2 nenhuma obrigação financeira privada para o escopo-base; L3 conforme estratégia. Para renda há pelo menos seguro, vacância, administração, manutenção, utilidades, outras despesas e capital investido quando o indicador o exigir; aluguel contratual só se houver locação. Subject-to acrescenta saldo, taxa, prestação e prazo, sem inferi-los pelo nome da estratégia. Confirmações explícitas de zero/"não aplicável" são respostas válidas; "não sei" mantém a lacuna. Reforma/condição/custos de revenda e carregamento entram quando a estratégia exigir. O conjunto contém 15 famílias de entrada; não deve virar um questionário obrigatório de 15 perguntas para qualquer imóvel. Priorizar até três perguntas por rodada conforme os indicadores desbloqueados.

## P3.5 — computeCoverage (somente especificação)

1. Receber AnalysisSnapshot, nível e versão desta matriz; fixar os campos requeridos antes de consultar presença de valores.
2. Aplicar somente regras de aplicabilidade comprovadas por tipo/estratégia; justificativa registrada para toda exclusão. Desconhecido permanece aplicável/pendente.
3. Para cada campo, validar valor, unidade, data/origem, status aceito e ausência de conflito bloqueante. Coleções satisfazem seu mínimo; ARV com duas vendas elegíveis conta quando faixa preliminar/baixa confiança estiver explicitamente rotulada. Anúncios nunca promovem elegibilidade.
4. Automática: DB/cache/ArcGIS/RentCast/cálculo cujas dependências não sejam respostas privadas. Final: automática + USER_PROVIDED confirmado e cálculos dependentes, sempre no cenário privado. Não fundir origens nem sobrescrever registro.
5. Retornar numeratorAutomatic, numeratorFinal, denominator, excludedWithReason, missingWithReason, investorInputsSeparate, matrixVersion e badge. Campo sem motivo de ausência é erro de integridade; classificar pelos motivos do contrato, não como preenchido.
6. Badge-alvo: L1 Completo >=50%; L2 Completo >85%; L3 Completo >95%; Parcial >=70% da meta e abaixo de Completo; Preliminar abaixo. Preservar o operador estrito > de L2/L3 nas fronteiras exatas. Exibir denominador e faltas; cobertura não mede exatidão. Nenhuma implementação desse algoritmo foi acrescentada ao app nesta fase.

## P3.6 — Custo de provedor com cache frio

ArcGIS é tentativa pública conforme cobertura/licença, não garantia de registro completo. Cache válido reduz custo a zero por família. Uma resposta de AVM com comparáveis não equivale a pool independente de vendas fechadas.

| Nível/cenário-alvo | RentCast (sem retries) | Pro 8 chamadas/mês | Enterprise 10 | Global 45 |
|---|---:|---:|---:|---:|
| L1 (card) | 0 | sem limite derivável por chamadas | idem | idem |
| L2: aluguel + vendidos + anúncios, registro já disponível | 3 | 2 gerações frias | 3 | 15 |
| L2 + registro ausente no ArcGIS/cache | 4 | 2 | 2 | 11 |
| L3: anteriores + AVM, registro já disponível | 4 | 2 | 2 | 11 |
| L3 + registro ausente no ArcGIS/cache | 5 | 1 | 2 | 9 |

São pisos matemáticos de orçamento/custo, não cotas comerciais de geração: orçamento é por usuário, teto global é compartilhado, outras funcionalidades e chamadas billable podem consumi-lo. L2 atual compra apenas aluguel (até 1 nova chamada nesse caminho), podendo usar evidência já em cache; L3 atual pode pedir famílias adicionais de mercado/aluguéis conforme estratégia. Não prometer que o plano atual custa exatamente quatro. Defaults de código: Pro total10/20% chat => relatório8; Enterprise total20/50% => relatório10. **Valor efetivo Production não foi reconsultado nesta fase offline**; 8/10 são decisões vigentes do usuário e defaults coincidentes, não prova de secrets remotos.

## Inventário estático para os gates da Parte 4

Registry local: seis fontes habilitadas por productionSourceAllowed. Nenhuma fonte FL passa esse gate no inventário atual; alcance estadual declarado não é validação de todo endereço. Serviços de parcela FeatureServer/MapServer; não é o geocoder Esri de créditos. Mapas de campos diferem por condado; ano de construção/venda não estão no normalizeParcel atual e não podem ser prometidos por esses adaptadores.

| Cobertura ativa local | FIPS/alcance validado | Serviço | Campos parcelários mapeados (sem identidade pessoal) |
|---|---|---|---|
| UT: Salt Lake | 49035 | FeatureServer | apn, assessorAcres, taxCode, subdivision |
| MA: Middlesex | 25017, 25025 | FeatureServer | apn, parcelId, assessedValue, assessedYear, zoning |
| NJ: Mercer | 34021, 34003 | FeatureServer | apn, parcelId, gisAcres, assessedValue, propertyTax, legalDescription |
| NC: Wake | 37183, 37063 | MapServer | apn, parcelId, gisAcres, legalDescription, subdivision |
| AR: Pulaski | 75 condados do Arkansas | FeatureServer | apn, parcelId, assessedValue, legalDescription, subdivision, taxCode |
| GA: Fulton (Johns Creek subset) | 13121 | FeatureServer | apn, parcelId, assessorAcres, assessedValue, assessedYear, zoning |

Cache em memória ParcelRequestCache: fresco24h + stale7dias; metadata do ArcGIS1h; receipt assinado no máximo7dias. Timeout HTTP7500ms, resposta limitada a5MB; sem retry automático no adaptador. Cache por processo não prova cache entre isolates. UpstreamBudget é limitação própria por autoridade, não Usage Guard RentCast. A integração de receipt/reportEvidence não grava tentativa ArcGIS no external_provider_usage com report_id/origin; rastreabilidade completa da cadeia não está demonstrada. O mapa do PDF usa reportMapAssets (tiles OSM quando fetch autorizado) e atribuição; nesta fase offline foram usados apenas rasters locais já existentes. Não foi verificada geração real de tiles em Production.

### A5 — Cobrança e aquisição (leitura local; Production não consultada)

| Plano | Geração paga no código atual? | Aquisição antes do débito? | Ao esgotar orçamento |
|---|---|---|---|
| Free L1 | grátis | não há aquisição de relatório L1 | card/DB |
| Free L2/L3 | unlock único3/5; não por geração | UI desbloqueia antes; plano de provedor continua restrito | cache/DB autorizado ou lacuna; não compra além do budget |
| Pro L2 | incluso | aluguel autorizado sem débito de nuggets | erro de orçamento vira pendência; evidência disponível permanece |
| Pro L3 | unlock único5 | débito antes do pedido de relatório quando não adquirido | entrega parcial/razão registrada; sem reembolso automático |
| Enterprise L2/L3 | incluso | não há débito de nuggets | entrega parcial/cache, sem exceder budget |

ds_unlock_maxxis_report usa unicidade (user_id,property_id,capability), sem janela/expiração. Segunda geração/abertura não cobra novamente enquanto entitlement existir; report_version não faz parte dessa unicidade. Usa lock de saldo/transação e app_events maxxis_report_unlocked, sem reserva/captura nem reembolso automático por conteúdo vazio. App.jsx confirma explicitamente cobrança única; maxxisReportService retorna expires:null. **Diverge da decisão cobrança por geração; nenhuma alteração aplicada.** Não há cotação detalhada de completude antes do débito: confirmação de custo e sampler não garantem conteúdo real.

Acesso a ArcGIS vem do módulo público/flag e suas licenças; não há nesta integração uma cobrança de nuggets para receipt já adquirido. Isso não autoriza o plano Free a consumir RentCast: providerEvidencePlan/propertyEvidenceAccess e budget Free zero continuam restritivos; possuir unlock de relatório não prova entitlement property_record. Chat e geração podem compartilhar caches quando fingerprint/TTL/entitlement coincidem; chat pode usar caminho cache-only. Não foi comprovado cache hit real nesta rodada offline.

## Referências locais verificadas

- src/domain/maxxis/maxxisReportSchema.js (LEVEL_SECTIONS, PROPERTY_ALLOWED_FIELDS).
- src/features/maxxis/export/reportIntegrityViewModel.ts, reportReadingPlan.ts, reportContentPlan.ts (valores, origem, ordem e completude atual).
- scripts/report-r4-fixtures.mjs, report-r41-fixtures.mjs, report-r42-fixtures.mjs; qa/report-r42/metrics.md (inputs e entrega QA).
- supabase/functions/_shared/maxxis/getDealInsightContext.ts, providerEvidencePlan.ts, propertyEvidenceAccess.ts, toolRegistry.ts, reportMarketRentPolicy.ts (aquisição efetiva).
- supabase/functions/_shared/property-data/providerBudget.ts, propertyEvidenceService.ts, valuationEvidenceService.ts, soldEvidenceService.ts, marketRentService.ts (budget/cache).
- supabase/functions/_shared/public-parcel/registry.ts, sources.ts, strategicSources.ts, arcgis.ts, cache.ts, evidenceReceipt.ts, reportEvidence.ts, upstreamBudget.ts (inventário e limites públicos).
- supabase/migrations/20260914110000_maxxis_report_unlock_conflict_fix.sql; src/services/maxxisReportService.js; src/App.jsx handleRequestIntelligenceUnlock (RPC e UI atuais; não alterados).

LIVE CALLS: 0. Nenhum segredo, endereço completo real, contato ou nome de proprietário foi incluído nesta matriz.
