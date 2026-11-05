# Post-smoke PDF QA e aceite R-3

Atualização de entrega: o proprietário autorizou posteriormente commit, limpeza e deploy das correções. O estado dessa operação está em [REPORTS_RELEASE_CURRENT.md](docs/REPORTS_RELEASE_CURRENT.md). As conclusões de aceite funcional abaixo permanecem vigentes; o deploy não transforma R-3 em PASS.

Data da validação local: 4 de novembro de 2026. Identificação do Preview e índice de artefatos atualizados em 5 de novembro de 2026. Base local: `26dc8ff58100af7b1ffa912bf5e7c46c7d427a93`, com as correções desta rodada ainda sem commit. Referência única dos arquivos desta rodada: [qa/README.md](qa/README.md).

## Decisão

**PDFs: correções locais validadas. R-3 funcional: NÃO ACEITO nesta rodada.** O funcionamento local parcial do resolvedor e a emissão de PDFs com selo Partial não comprovam a experiência Report Preflight → chat → persistência → relatório.

**Publicação: nenhuma.** Não houve promoção do frontend, deploy de funções, push, migration, alteração de flag, pricing, Nuggets, Stripe ou motor financeiro. RentCast, Gemini, ArcGIS e OpenStreetMap live: **0**. A leitura remota limitou-se a SELECT dos registros/caches existentes, após verificar o target `cyeipfskwwisbbayyaca`.

## Evidências e escopo

- Cinco smoke tests: **PASS informado pelo proprietário**; não repetidos.
- Suíte de 3.057 testes e build anteriores: aprovação informada pelo proprietário; não tratados como uma nova execução desta rodada.
- PDFs examinados: três arquivos de Honolulu em Downloads, com identificação por SHA-256 no recibo de QA. O L3 fornecido tem sete páginas; a última contém praticamente só a ressalva.
- Regeneração: renderer real, registro e caches do imóvel controlado `e86dd292-429d-4b51-9b02-bc60a3e9068f`, imagens recuperadas do PDF e critérios de perfil documentados no PDF fornecido. Nome e contato autorizado já presentes foram preservados, sem transcrevê-los neste documento.
- Trata-se de **replay offline**, não de nova leitura autenticada do perfil nem de execução do Report Preflight no Preview. Os comparáveis são referências de apoio: nenhuma condição-alvo foi inventada para promover vendas à elegibilidade de ARV.
- O mapa de localização foi recuperado do PDF. Sem adquirir tiles, os comparativos usam o fallback existente, identificado como esquema fora de escala; não foi certificada uma nova aquisição de base cartográfica.

## PDFs

| Nível | QA local | Páginas finais | Evidência principal |
|---|---|---:|---|
| L1 | PASS | 1 | Notas, dados, imagens, contato autorizado e fontes preservados; continuação em final de frase. |
| L2 | PASS | 3 | 0,2524 acre não aparece simultaneamente como dado desconhecido; origem declarada do Cap Rate permanece explícita. |
| L3 | PASS | 6 | Aluguel separado de valor imobiliário; Cap Rate declarado identificado; ressalva integrada à última página com conteúdo. |

Arquivos: [L1](qa/post-smoke-pdf-r3/L1.pdf), [L2](qa/post-smoke-pdf-r3/L2.pdf), [L3](qa/post-smoke-pdf-r3/L3.pdf). PNGs de todas as páginas estão em `qa/post-smoke-pdf-r3/`.

Recibo consolidado: [validation-summary.json](qa/post-smoke-pdf-r3/validation-summary.json). No mesmo snapshot, a última página do L3 passou de 17,4% para 99,4% de ocupação vertical do corpo; as notas, os números e as fontes/datas permaneceram iguais. Foram revisadas visualmente as dez páginas finais, sem overflow de texto ou do corpo. Os contatos foram ocultados somente nas cópias privadas usadas para visualização de QA, não nos arquivos entregues.

### A1 — Área contraditória

O contexto de análise monta `lotSizeAcres` a partir do valor direto do cadastro, enquanto a projeção do relatório já pode ter a conversão de uma área válida em sqft. O aviso histórico de risco chegava ao PDF sem ser reconciliado com essa projeção final.

A apresentação agora reconcilia especificamente a lista histórica de campos desconhecidos com os valores efetivamente disponíveis. A conversão de área continua sendo um cálculo qualificado, não uma confirmação independente de registro. O contrato preserva os marcadores de conversão e impede uma dimensão derivada de recriar circularmente sua própria dependência ausente. Nenhuma fórmula financeira ou provedor foi alterado.

### A2 — Aluguel versus valuation

A faixa US$ 4.910–10.880 pertence à estimativa mensal de aluguel de US$ 7.890. O renderer anteriormente selecionava a primeira faixa disponível para o gráfico chamado “Value range references”. Agora prioriza ARV/AVM para esse gráfico. Se só houver aluguel, o gráfico e as notas dizem explicitamente “Monthly rent range” e “Monthly rental reference notes”. O visual existente foi mantido.

No controle, a referência automatizada de valor é exibida separadamente, com sua própria faixa e a advertência de que não é ARV. Aluguel e anúncios não foram usados para liberar ARV.

### A3 — Paginação e continuidade

A comparação entre renderizadores usa o **mesmo schema de replay**, com publicador, contato, perfil, vendas, anúncios e metadados. Valores numéricos, notas e fontes/datas são comparados antes/depois. Não houve retirada de conteúdo para obter seis páginas.

As continuações de descrição, risco e perfil priorizam finais de frase. Os painéis inferiores aproveitam as colunas que têm conteúdo, preservando gráficos, ícones, bordas, tipografia e cores. A página final do L3 deixou de ser uma página só de ressalva.

### A4 — Cap Rate

O Cap Rate de 5% mantém a identificação **“reported by the publisher”**. O conjunto é chamado “Publisher-reported indicators” quando contém apenas declarações, evitando apresentá-lo como dashboard validado do ScenarioEngine. Nenhum NOI ou ROI foi criado a partir dessa taxa.

### A5 — Fontes e datas

Os metadados existentes foram reutilizados sem renovar timestamps, atribuir provedor a uma fonte ausente ou criar datas. A comparação antes/depois preserva as fontes/datas do mesmo snapshot reconstruído. Isso não afirma identidade integral com um snapshot autenticado original que não foi disponibilizado como objeto estruturado.

## R-3: resultados separados por critério

| Critério | Evidência nesta rodada | Resultado |
|---|---|---|
| Gaps residuais relevantes | O gate local cobre principalmente condição-alvo; com essa condição preenchida retorna READY mesmo sem as entradas financeiras residuais. | FAIL no checkout; Preview NOT RUN. |
| Não repetir inputs confirmados | Testes e diagnóstico local retiram `target_condition` após confirmação; serviço transmite contexto e declínios. | PASS offline para esse caso; continuidade autenticada NOT RUN. |
| Relatório → chat → relatório | A interceptação inline de gaps exclui pedidos explícitos de relatório (`!requestedReportType`). Não foi encontrado um componente Report Preflight nesta base. | Não comprovado; não aprovar geração silenciosa de conteúdo incompleto. |
| ARV sem condição/vendas elegíveis | Contrato e projeção mantêm ARV indisponível; aluguel e AVM permanecem referências distintas. | PASS nos controles offline. |
| NOI/ROI sem entradas suficientes | Os controles mantêm indisponibilidade; a origem declarada da taxa não é promovida a resultado calculado. | PASS offline; cenário conversacional completo NOT RUN. |
| OPEX agregado de 30% | O parser de gaps atual não interpreta a resposta financeira; o contrato rejeita `operatingExpensePercent`/`operatingExpenses` como entradas operacionais. Não existe reconciliação comprovada do percentual total com despesas conhecidas. | FAIL para o aceite exigido. Não adicionar premissa ou fórmula nesta rodada. |
| Versão, origem e estado | Endpoint usa `property_arv_review_contexts`, grava origem USER_PROVIDED e audita revisão do snapshot; testes verificam confirmação e transmissão do contexto. | PARTIAL; controle integral de versão e round-trip autenticado não comprovados. |
| Chat → relatório e paridade PDF | Testes de paridade canônica e projeção de cenário salvo passam; antes/depois do replay mantém os dados. | PASS offline; percurso no Preview NOT RUN. |
| Recuperação após reload | Existem READ persistente e recarga das premissas no backend. Não houve sessão autenticada no Preview para comprovar reload e continuidade. | NOT RUN end-to-end. |
| Entitlements e custo | Nenhum componente de cobrança foi alterado; nenhum desbloqueio/débito foi executado. | Preservados no escopo; não houve nova recertificação de cobrança. |

O diagnóstico reproduzível está em `qa/post-smoke-pdf-r3/r3-assessment.json`. A aceitação **não** se baseia apenas no selo Partial ou na existência de um PDF.

## Bloqueios e flag

**Preview: identidade localizada; fluxo funcional NOT RUN.** Após a consulta inicial retornar 403, a sessão existente da Vercel CLI foi validada e a consulta somente leitura passou. O Preview mais recente localizado no projeto é [release/maxxis-report-v1](https://dealsiftermatch-kuj9heeat-deal-sifter-match-s-projects.vercel.app), deployment `dpl_4hwiUxZ2rG6fFpTphPW3VaseHX94`, de 3 de novembro. O acesso protegido retornou HTTP 200 e o bundle confere com `maxxis-reconciled-fe9aff373fc4d2e3`. O recibo local associa a origem a `d5bca41775080dbac581eff4fe487bb9a24bcc16`; a API não informa SHA Git nesse deployment. Evidência segura: [preview-identification.json](qa/post-smoke-pdf-r3/preview-identification.json).

Esse Preview antecede os PDFs fornecidos de 4 de novembro e não contém o candidato POST-SMOKE local. Não foi comprovado que seja o deployment dos cinco smoke tests aprovados. Os bundles de entrada inspecionados não apresentam marcadores textuais de Report Preflight; isso, isoladamente, não prova ausência de código em chunks nem substitui sessão autenticada do app. Não houve execução do percurso chat/persistência/reload: o acesso à proteção da Vercel não autentica um usuário no Supabase. Não é necessário que o proprietário procure os arquivos antigos para estabelecer estas identidades. Se o fluxo exigir Gemini, permanece NOT RUN sem chamada para forçar sua execução.

**Flag: OFF informado pelo proprietário, preservado.** Não houve edição nem nova auditoria remota de flags. As cinco funções publicadas e os smoke tests aprovados são contexto fornecido, não uma certificação remota adicional nesta rodada.

Gaps impeditivos reais: condição-alvo e vendas elegíveis para ARV; renda e despesas com cadência/origem adequadas para NOI; base de investimento e saída para ROI; significado aceito do OPEX agregado, com prevenção de duplicidade; identificação da versão correta de Preview para verificar continuidade e reload.

Foi removida do texto do relatório a promessa “Maxxis will ask in chat”, pois a continuidade conversacional ainda não está homologada neste aceite.

## Validação e decisão de release

- Testes direcionados: **179/179**, nos componentes alterados, contratos afetados e controles offline de gaps/continuidade. A suíte completa anterior não foi repetida.
- Typecheck direcionado: **PASS**. Build isolado do escopo final: **PASS**. Nenhum desses comandos publicou o frontend.
- Inspeção visual: todas as páginas de L1/L2/L3, mantendo o design atual. Artefatos e recibos em `qa/post-smoke-pdf-r3/`.
- **Release técnico local:** PASS para as correções e o replay dos PDFs; homologação do candidato corrigido no Preview ainda pendente. Funções publicadas e recuperação autenticada não foram recertificadas.
- **Release funcional R-3:** NÃO ACEITO. Há lacunas locais concretas e percursos end-to-end ainda NOT RUN.

**Próxima operação autorizável:** preparar um candidato de Preview explicitamente identificado com estas correções, incluindo a conferência dos exemplos derivados do renderer, sem promover Production ou alterar a flag. O Preview histórico localizado não deve ser confundido com esse candidato. Um release limitado pode incluir somente geração/exportação e apresentação já homologadas, depois da conferência do candidato corrigido. Não deve anunciar complementação conversacional R-3 enquanto os critérios acima não forem atendidos.

Sem commit, push ou deploy nesta rodada. Trabalho não relacionado e stash preservados. PDFs e PNGs de QA são arquivos locais de conferência e devem permanecer fora de commits e publicações.
