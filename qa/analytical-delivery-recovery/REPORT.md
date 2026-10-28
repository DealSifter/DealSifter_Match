# Analytical delivery recovery — revisão local

BASELINE: `6cefdb1ac4b54b6b4734bbd401667043e226acf1` (produção). Nenhum deploy, migration ou alteração de RLS nesta rodada. A cópia local já continha rascunhos não publicados; foram preservados. Os resultados abaixo pertencem ao rascunho local, não comprovam funcionamento na sessão real.

## Rastreabilidade e causas

| Fluxo | Caminho existente e ponto de perda identificado |
| --- | --- |
| SOLD / ARV | RentCast `/v1/properties` com localização, raio, `saleDateRange` e tipo → cache `property_sold_record_pool` → `soldMapper` / `soldCompEngine` → revisão de condição / `arvEngine` → `getDealInsightContext` → projeção L3 → view model → PDF. As contagens estavam no `runtimeTrace`, mas não acompanhavam a preparação/PDF. O serviço também exige um subject AVM em cache para imóveis construídos; falhar essa pré-condição não significa inexistência de vendas. |
| Market Rent | `rentAvmSubject` / decisões atuais do publicador → fingerprint → `MarketRentService` → cache suplementar → aquisição autorizada em `/v1/avm/rent/long-term` → evidência financeira → Maxxis / preparação L2-L3 → view model → PDF. Erros de leitura do imóvel/revisão viravam `null`, apagando a etapa responsável. A política de relatório também transformava conflito crítico em `READY`, retirando os overrides. Havia outro caminho de aquisição genérica de aluguel antes desse fluxo. |
| Investment Profile | `professional_profiles.profile_payload`, filtrado pelo usuário autenticado → normalização → `calculatePropertyMatch` → contexto / snapshot → preparação → view model → PDF. O score chegava ao consumidor sem o perfil que fundamentava sua interpretação. Não foram alterados pesos nem fórmulas. |

ROOT CAUSE — SOLD COMPS: perda de rastreabilidade entre execução e consumidor. Agora a preparação preserva cache, execução, retornados, normalizados, filtros estruturais, elegíveis, apoio, exclusões e bloqueios do motor. Anúncios continuam separados de vendas e fora do ARV. Ausência de telemetria é `UNKNOWN_EXECUTION`, não uma busca inventada com zero resultados.

QUERY EXECUTED / SOLD RETURNED / SOLD ELIGIBLE — 4724: não comprovados pelos PDFs históricos. Não foram consultados sessão, banco ou provedor reais nesta tarefa. O controle A preserva essa incerteza; não representa uma nova avaliação do imóvel.

ARV RESULT OR EXACT BLOCKER: 4724 permanece sem ARV demonstrável: não há recibo histórico que estabeleça aquisição, vendas elegíveis e condição. No teste determinístico, cinco candidatos compatíveis atravessaram o motor ARV existente, a preparação e a tabela/mapa L3. Isso não prova disponibilidade de cinco vendas reais de 4724.

ROOT CAUSE — MARKET RENT: falha técnica sem etapa retida, exceção de conflito no caminho de relatório e aquisição duplicada potencial. Foram preservados motivos distintos de leitura do imóvel, imóvel ausente e revisão indisponível. A aquisição genérica duplicada foi retirada; o serviço com fingerprint permanece responsável pela compra autorizada.

STATUS — 4724: `SUBJECT_UNAVAILABLE` no documento histórico. A causa técnica original não foi registrada; não foi atribuída a um campo por suposição.

BLOCKING FIELD(S): o resolver agora retorna todos os conflitos críticos entre tipo, quartos, banheiros e área construída. Conflito isolado de lote não bloqueia AVM residencial. Atributos opcionais ausentes continuam permitindo descoberta pelo provedor; conflitos não são tratados como ausência. A orientação indica Editar imóvel → página 2 → campos específicos. Erro ao ler decisões não é convertido em autorização para escolher um vencedor.

CACHE/PROVIDER PATH: cache/fingerprint válido primeiro; aquisição somente na ação explícita autorizada, preservando entitlement, Usage Guard, single-flight e kill switch existentes. Nenhuma aquisição foi adicionada ao bootstrap, cards, Portfolio ou renderer PDF.

L2 RESULT: o controle de escopo existente verifica somente valor mensal, sem expor range/comparáveis Enterprise.

L3 RANGE / RENT COMP MAP / RENT COMP TABLE: controle Honolulu com fixture validada: US$ 7.820/mês, US$ 5.230–10.410, barra, indicadores unitários, atributos do subject, cinco aluguéis e os mesmos cinco marcadores numerados. Há fonte/data e qualificação de estimativa, não aluguel contratual. Foram usados um provedor simulado e o cache real em memória, sem chamada externa. O diagrama de coordenadas é o fallback existente, não um mapa cadastral nem uma captura atual do site.

Outra perda comprovada no PDF: a continuação deduplicava campos apenas pelo valor, eliminando banheiros/área do subject quando esses números apareciam em outro contexto. A comparação agora preserva rótulo + valor. Não mudou geometria, cores, branding, imagens, ícones ou desenho dos gráficos.

ROOT CAUSE — INVESTMENT PROFILE: score sem contexto de perfil na projeção. O rascunho transporta o perfil do snapshot atual autorizado; sem essa base, os relatórios e a experiência L3 não validam o score antigo. Critérios não avaliados de perfil parcial não viram zeros. Faixas usam os rótulos do cadastro existente.

PROFILE LOADED / PROFILE OWNER/CONTEXT VALID: caminho de produção filtrado por `user_id`; sem leitura de perfil de outro usuário adicionada. Nos controles, o perfil é explicitamente sintético. Não foi verificada a conta real que originou os 29%, nem autorizado um snapshot histórico de outra pessoa.

MATCH SCORE SOURCE: `calculatePropertyMatch` existente, sem alteração de pesos. Os controles com perfil produziram 100% segundo os critérios avaliáveis do motor; não é uma nota real de 4724 nem de qualidade do negócio.

REPORT PROFILE SUMMARY: mercados, faixa, tipos e estratégias reais do input do controle aparecem em L2/L3. NO-PROFILE BEHAVIOR: mensagem de perfil não configurado/indisponível, sem gauge/score ou critérios artificiais; CTA reaproveita o onboarding existente. A navegação autenticada desse CTA ainda depende da validação real.

MAXXIS / REPORT DATA PARITY: parcialmente verificada offline. Bloqueio do aluguel usa o mesmo formatador determinístico; Rental Comps tem rota explícita para a mesma evidência, sem cálculo Gemini. O recibo SOLD acompanha snapshot, preparação, contexto da IA e relatório. Não há PASS funcional em produção para as perguntas completas ou integrações autenticadas.

## Verificação direcionada

- 96 verificações dos contratos de aluguel/recuperação executadas; 15 testes finais de integração direcionada passaram. Testes automatizados: zero chamadas live.
- Geração dos seis PDFs: zero tentativas de rede, um retorno de provedor simulado e reutilização do cache na segunda leitura.
- Páginas geradas foram rasterizadas e inspecionadas: mapa/tabela do aluguel, range, atributos preservados, perfil com score e diagnóstico histórico SOLD. PNGs e texto extraído estão neste diretório.
- BUILD: `npm run build` concluiu; após os ajustes de apresentação, build integrado sem minificação também concluiu. Os últimos refinamentos de telemetria SOLD e consumo nas observações existentes tiveram recompilação dirigida com esbuild, testes, geração de PDFs e typecheck, sem repetir a otimização completa.
- TYPECHECK: `tsc -p tsconfig.report-integrity.json --noEmit` aprovado; Deno aprovou a checagem focada de evidência canônica, contexto analítico, resposta financeira e recibo SOLD. A checagem ampliada de `toolRegistry.ts`/dependências permanece REPROVADA: 31 erros, reproduzidos também na worktree da baseline publicada, nos mesmos pontos (tipos Supabase, workflows, serviços e registro; apenas deslocamento de linhas). Não foram ocultados nem corrigidos fora do escopo. Lint dirigido aprovado.
- Permanecem avisos de chunks grandes/importação dinâmica-estática do build. Nenhum foi apresentado como corrigido.

## PDFs para aprovação

- [A — 4724 L3, reconstrução com bloqueio explícito](A-4724-L3-blocker.pdf)
- [B — Honolulu L3, aluguel com fixture](B-Honolulu-L3-rent-fixture.pdf)
- C — com perfil sintético: [L2](C-profile-L2.pdf), [L3](C-profile-L3.pdf)
- C — sem perfil: [L2](C-no-profile-L2.pdf), [L3](C-no-profile-L3.pdf)

## Arquivos desta rodada

Frontend: `MaxxisCapabilities.jsx`; `maxxisReportSchema.js`; `reportIntegrityViewModel.ts`; `referenceReportPdf.ts` (retenção de campos por contexto e diagnóstico nas observações existentes); `MaxxisDealIntelligenceExperience.jsx`; `maxxisAnalysisReport.js`; `maxxisDealIntelligenceReport.js`.

Backend: `canonicalEvidenceTool.ts`; `financialEvidenceAnswer.ts`; `getDealInsightContext.ts`; `reportMarketReferences.ts`; `reportMarketRentPolicy.ts`; `toolRegistry.ts`; `toolResultForGemini.ts`; `rentAvmSubject.ts`; `marketRentService.ts`.

Validação: `marketRent.vitest.test.ts`; `analyticalDeliveryRecovery.test.js`; `scripts/analytical-delivery-recovery-qa.mjs`; controles e recibos deste diretório. Alterações anteriores não foram revertidas nem incluídas em um deploy.

Pendência para comprovar a entrega real: executar a preparação de 4724 com a sessão autorizada, obter o recibo novo, verificar as decisões atuais do publicador e o perfil do solicitante. Só isso poderá confirmar o motivo técnico original, a busca SOLD efetiva, quantidades elegíveis e o retorno atual de Market Rent. Nenhum resultado live foi inventado para preencher essas lacunas.
