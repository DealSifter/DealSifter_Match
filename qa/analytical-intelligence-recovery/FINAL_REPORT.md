# Entrega 1 — recuperação analítica, revisão local

**BASELINE:** HEAD original `a9b6730a4fff53abf984296f8eb2d306660896e0`, com rascunhos preservados. Implementação isolada sobre a produção `b989d7bf4de5550d006663ae67c3fc22f7b3fd06`; não sobre a antiga `6cefdb1`.

**PRODUCTION SHA:** `b989d7b`, deployment `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW`, confirmado por consulta somente de metadata. **Sem deploy/migration/RLS nesta entrega.**

**LOCAL CHANGES REUSED:** reaproveitados seletivamente recibo SOLD, motivos de falha de aluguel, conflitos físicos, preparação do perfil e CTA existentes. Branch `fix/analytical-intelligence-delivery1`, commit final `fef0ce4f7d3f63ac2f412a9b93d4093b17e3bc70`, na worktree `.tmp-codex/analytical-intelligence-20261019`. Os rascunhos originais, ajustes analíticos não selecionados e instrumentação de desempenho não foram sobrescritos nem publicados.

## SOLD COMPS / ARV

**Classificação E/F:** existia busca; perdia-se sua rastreabilidade no consumidor. Caminho: GET RentCast `/v1/properties`, localização/raio/tipo/`saleDateRange` → `property_sold_record_pool` → normalização/seleção estrutural → revisão de condição → motor ARV existente → snapshot → Maxxis/schema/view model/PDF. O serviço residencial exige subject AVM compatível em cache; essa pré-condição falhar não significa inexistência de vendas.

Corrigido também `Boolean('UNKNOWN')`: isso marcava condição-alvo desconhecida como confirmada. O recibo mantém retornados, normalizados, estruturais, elegíveis, apoio, exclusões e motivos por candidato, sem endereço/identificador privado no diagnóstico de rejeição. Falha de leitura da revisão não vira zero vendas elegíveis. Não foram alterados filtros, pesos, metodologia ou distinções SOLD/FOR SALE/AVM/ARV.

**4724:** consulta executada, retornados e elegíveis **não comprovados** pelos artefatos históricos disponíveis. O PDF A é reconstrução explícita, sem número de ARV fabricado. No teste de integração, cinco candidatos sintéticos passam pelo motor existente e chegam à mesma coleção da tabela/mapa L3. Perguntas SOLD/ARV usam o formatador determinístico e leitura autorizada de cache, sem compra automática nessa explicação.

## MARKET RENT

**Classificação E/F:** leitura do imóvel/revisão e exceções do serviço perdiam o motivo técnico; política de relatório convertia conflito crítico em READY; aquisição genérica podia preceder o serviço controlado. Reutilizada a correção: um único serviço de Market Rent, fingerprint/cache primeiro, autorização/Usage Guard/kill switch preservados. Sem provider no renderer, bootstrap, cards ou modal.

**4724:** estado histórico SUBJECT_UNAVAILABLE, causa original não registrada; não atribuído a um campo por suposição. Agora razões de leitura, cache, autorização e execução atravessam preparação e PDF. Revisão informa tipo/quartos/banheiros/área construída efetivamente conflitantes e orienta **Editar imóvel → página 2 → campo**, usando o fluxo existente. Conflito isolado de lote não bloqueia aluguel; ausência opcional permite lookup; decisão persistida inválida não é adotada. Perguntar qual campo bloqueia não compra uma consulta.

**L2:** somente estimativa mensal autorizada. **L3:** valor/faixa/barra, fonte/atualidade, indicadores unitários, até cinco aluguéis e mapa/tabela correspondentes preservados. Honolulu é fixture identificada: US$ 7.820/mês, faixa US$ 5.230–10.410, cinco comps. Serviço/cache reais em memória, provider simulado: uma chamada, segunda leitura HIT, zero rede. Maxxis distingue estimativa de contrato e informa referência temporal quando disponível.

## INVESTMENT PROFILE

**Classificação E/F:** score chegava sem o perfil que o fundamentava. Origem inspecionada: `professional_profiles.profile_payload`, filtrado pelo usuário autenticado → normalização atual/legacy existente → `calculatePropertyMatch` → snapshot/preparação. Critérios e origem agora acompanham o resultado; pesos não mudaram. Sem perfil autorizado, score histórico sem base e breakdown artificial são ocultados; critérios não avaliados não viram 0%. Reutilizado CTA de configuração. Consulta do próprio perfil usa a ferramenta autorizada existente, sem Gemini.

Nos controles C, perfil é **sintético**, não o perfil real do usuário: 100% segundo os critérios avaliáveis do motor; sem perfil, nenhum score. A origem histórica dos 29% permanece não comprovada. Nenhuma leitura de perfil de outra conta foi adicionada.

## Validação e limites

**MAXXIS/PDF PARITY:** PASS nos contratos offline de resultados/formatadores; **BLOCKED na sessão real**. Não é PASS de produção nem teste autenticado do endpoint.

**PERFORMANCE REGRESSION:** nenhuma nova aquisição/IO no PDF ou instrumentação; caches/coalescing mantidos. Responsividade real não medida nesta entrega.

**DESIGN REGRESSION:** nenhuma alteração intencional de geometria, cores, tipografia, mapas, galeria ou gráficos. Diagnóstico inserido nas observações existentes. Controles rasterizados/inspecionados; 17 testes de layout aprovados. Contagens 6/6/3/3 pertencem às fixtures, não são promessa de paginação para outros inputs.

**TARGETED TESTS:** 86 contratos de aluguel + 18 integrações + 17 layouts aprovados; rechecagens limitadas aos últimos trechos alterados. Zero chamadas live.

**BUILD:** Vite produção aprovado; checagens incrementais finais dos módulos afetados com esbuild aprovadas. Avisos existentes de chunks/importação compartilhada mantidos. **TYPECHECK:** relatórios (`tsc`) e cinco módulos analíticos backend focados aprovados. Checagem ampliada `maxxis-chat`: FAIL, mesmos **36 diagnósticos** reproduzidos na baseline publicada, sem novos códigos/locais de erro identificados; tipagens alheias não foram corrigidas.

**CHANGED FILES (22, na worktree):** frontend `MaxxisCapabilities.jsx`, `maxxisReportSchema.js`, `reportIntegrityViewModel.ts`, `referenceReportPdf.ts`, builders Analysis/Deal Intelligence, `MaxxisDealIntelligenceExperience.jsx`; backend `canonicalEvidenceTool.ts`, `financialEvidenceAnswer.ts`, `getDealInsightContext.ts`, `marketReferenceIntent.ts`, `marketReferenceAnswer.ts`, `reportMarketReferences.ts`, `reportMarketRentPolicy.ts`, `toolRegistry.ts`, `toolResultForGemini.ts`, `marketRentService.ts`, `rentAvmSubject.ts`, `maxxis-chat/index.ts`; testes `analyticalDeliveryRecovery.test.js`, `referenceReportLayout.test.js`, `marketRent.vitest.test.ts`. Removido apenas argumento redundante na chamada do mapa para compatibilizar a tipagem já publicada, sem alterar seu desenho.

**CONTROL PDF PATHS:** [A — 4724, histórico/bloqueio](A-4724-L3-blocker.pdf); [B — Honolulu, fixture de aluguel](B-Honolulu-L3-rent-fixture.pdf); [C — com perfil sintético](C-profile-L2.pdf); [C — sem perfil](C-no-profile-L2.pdf).

**UNRESOLVED BLOCKERS:** consulta/contagens/causa histórica real de 4724 e perfil do solicitante não verificáveis pelos PDFs/caches locais; typecheck ampliado com dívida preexistente. Para comprovação real, após revisão e autorização de publicação seletiva, é necessária **uma preparação L3 autenticada de 4724**, reutilizando cache e registrando o recibo. Em cache miss, qualquer aquisição RentCast pelos serviços existentes exige autorização prévia; não foi executada. Não considero as capacidades comprovadas em produção.
