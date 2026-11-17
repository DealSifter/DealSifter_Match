# R-3 — complementação conversacional e relatórios

Base de implementação: `2477cd8`, preservando o runtime publicado `6048598`. Produção intocável nesta entrega. Em 9 de novembro de 2026 foram autorizadas a migration CAS, as duas funções e o Preview somente em staging, além de duas contas/imóveis fictícios de QA. Push e chamadas pagas continuam proibidos.

**Resumo atual — STAGING VALIDATED:** CAS corrigido com PT409, histórico da migration registrado e chamadas QA presas encerradas. Concorrência real 200/409, isolamento A/B, confirmação incremental, OPEX e bloqueio Free passaram. Os dois fluxos autenticados no navegador passaram, inclusive reload, retomada e persistência do relatório. PDFs L1/L2/L3 sem overflow. Revisão visual humana e liberação de Production continuam separadas desta validação. As seções anteriores ao fechamento abaixo preservam o histórico dos bloqueios já resolvidos.

Preview atual: https://dealsiftermatch-nggvjp408-deal-sifter-match-s-projects.vercel.app (acesso sujeito ao login Vercel). PDFs fictícios atuais: `qa/report-r3-completion/staging-authenticated/`. Evidências operacionais e credenciais de QA permanecem locais e ignoradas pelo Git.

## Reconciliação mínima antes das alterações

| Componente | Existe | Integrado | Gap comprovado |
|---|---|---|---|
| Report Preflight | Não localizado na base atual | Não | Pedidos explícitos contornam a interceptação inline de gaps |
| Conversational Input Capture | Parcial | Condição-alvo/reforma | Parser não captura renda/despesas financeiras confirmadas |
| Financial Gap Resolver | Parcial | Formulário inline existente | Gate não cobre gaps financeiros residuais nem OPEX agregado |
| Scenario Persistence | Parcial | `maxxis-analysis-inputs` / `property_arv_review_contexts` | Upsert sem CAS; aceita resultados de cenário fornecidos pelo cliente |
| ScenarioEngine | Sim | Cálculos determinísticos existentes | Falta integração da metodologia agregada explicitamente confirmada |
| Report Resume | Parcial | `continueGatedAnalysis` | Solicitação não recuperável após reload |
| PDF Snapshot Consumption | Sim | `activeScenario` confirmado e projeção existente | Falta garantir versão única entre complementação e geração |

Reutilizados: MaxxisAssistant, MaxxisAnalysisGapResolution, maxxis-chat, maxxis-analysis-inputs, FinancialReadiness, ScenarioEngine, normalização financeira, entitlement runtime, cache-only e projeções canônicas dos PDFs. Não foram encontrados contratos de implementação v2.1/v2.2 ou RPC de CAS de cenário nesta base; o CAS de perfil existente não é CAS de cenário.

Status inicial: R-3 NOT RUN end-to-end. Testes locais não serão apresentados como homologação autenticada. O roteiro desta entrega exige autorização específica para publicar em staging ou aplicar qualquer migration remota; o candidato será preparado antes dessa solicitação.

## Implementação local — IMPLEMENTED / LOCALLY TESTED

### Continuidade dos dois fluxos

**Report → Maxxis → Report:** a solicitação explícita mantém imóvel, conta, nível, idioma, opções, identificador e revisão. `maxxis-analysis-inputs` executa PREFLIGHT sobre contexto autorizado/cache. Lacunas necessárias aparecem no formulário inline existente, até três por rodada. A confirmação grava o contexto privado, refaz o Preflight e retoma o mesmo relatório. Pendência obrigatória não permite gerar completo; limitações externas ou métricas opcionais admitem entrega parcial explicitamente aceita. L1 permanece no caminho de exportação direta; não exige complemento financeiro.

**Maxxis → Report:** `conversationalCompletion.js` captura declarações numéricas conservadoras. Perguntas, hipóteses e periodicidade ambígua não autorizam gravação. O usuário vê o valor interpretado e confirma antes da persistência. Pedidos seguintes reaproveitam o contexto confirmado; perguntas diretas sobre métricas disponíveis usam o mesmo cenário, sem Gemini. Valores projetados são apresentados como projeções privadas, nunca como renda contratual ou registros oficiais.

`reportCompletion.ts` centraliza estado dos campos, lacunas, origem, unidades, cadência, confirmação e revisão. `ScenarioEngine` continua sendo a autoridade das fórmulas. O adaptador financeiro consome os campos confirmados; orçamento percentual é parâmetro do motor, não outra despesa. `getDealInsightContext` e `refreshReportFinancialEvidence` recompõem o cenário após carregar evidências disponíveis. `maxxisReportSchema`, `reportSavedScenarioProjection` e `reportIntegrityViewModel` projetam esse cenário no renderer aprovado, sem uma segunda fórmula de KPI.

### Persistência, concorrência e isolamento

- Contexto existente: `property_arv_review_contexts`, por imóvel e usuário autenticado. Inputs em `deal_assumptions.r3Completion`, com valor, origem, confirmação, data, interação, moeda/unidade/cadência e versão. Não altera cadastro do imóvel ou perfil.
- Migration candidata única: `20261105230000_maxxis_analysis_context_cas.sql`. Coluna aditiva `analysis_revision`, trigger de incremento e RPC security invoker `ds_save_analysis_context_cas`. Lock por usuário/imóvel e comparação de revisão; conflito retorna HTTP 409. Identidade vem da sessão; políticas existentes permanecem autoritativas.
- Resultados financeiros enviados pelo cliente são recalculados pelo motor no servidor. Cenários de outro imóvel/usuário são recusados. Cenários confirmados anteriores, incluindo LAND, são preservados.
- Browser guarda somente metadados da solicitação, sem valores financeiros. Recuperação após reload mantém escopo da conta/imóvel/nível; múltiplos pedidos não selecionam imóvel arbitrariamente. Respostas assíncronas da conta anterior são descartadas.
- Trava local da solicitação evita repetição concorrente; CAS impede sobrescrita silenciosa. RPCs de cobrança e monetização não foram alteradas. A garantia de cobrança em sessões reais permanece parte da homologação autenticada, não inferida dos mocks.

### OPEX e premissas

Nenhuma premissa é aplicada automaticamente. O usuário escolhe ITEMIZED ou AGGREGATE_EGI e confirma valores. O percentual de 30% é uma proposta editável somente após escolha explícita do método agregado.

Exemplo testado: aluguel mensal 2.000, vacância 5% → EGI anual 22.800. Orçamento de OPEX de 30% → 6.840. Imposto 2.200 + seguro 1.600 já integram esse orçamento; reserva residual 3.040; NOI 15.960. Despesas conhecidas acima do orçamento geram conflito e impedem NOI até revisão. Método discriminado soma somente valores confirmados; não adiciona 30%. Vacância reduz receita; dívida fica fora do NOI. Ausência de dívida/capital impede métricas dependentes, sem presumir zero.

Aluguel estimado do provedor aparece como candidato de premissa e exige confirmação. Aluguel real continua separado. Preço pedido pode ser referência rotulada do cenário; não confirma aquisição. Mantidos os sete estados de condição-alvo, >=3 vendas elegíveis para ARV principal, duas para preliminar e menos de duas sem ARV. AVM/anúncios não substituem vendas elegíveis.

### Custos e aquisição

Preparação R-3 usa DB, contexto privado e cache. `cacheOnly: true`, `marketRentAcquisition: false`; nenhuma aquisição externa ou fallback generativo foi introduzido. Lacuna externa permanece explícita. Consentimento, entitlement e Usage Guard continuam necessários para aquisição paga em outro fluxo autorizado. Não foi implementada nova autorização de compra de dados neste ciclo.

Chamadas RentCast/Gemini/ArcGIS/tiles nesta implementação e nos testes: **0**. Rede usada somente para metadados administrativos read-only do staging e backups das funções atuais. Não houve consultas a dados de usuários de Production.

## Evidências locais

Regressão dirigida final: **636/636 PASS**, incluindo exportação, previews, motor, inputs, formulário, recuperação de falhas, endpoint real com dependências substituídas e componente real com transportes mockados. Inclui precedência da nova confirmação privada sobre o cenário antigo. Não equivale à suíte inteira do repositório nem a E2E autenticado.

| Casos | Evidência local | Estado autenticado |
|---|---|---|
| R3-01/02/03 | L1 sem gate financeiro; L3 interceptado; somente seguro residual | NOT RUN |
| R3-04/05 | OPEX agregado, conflito, reconciliação e discriminado sem duplicidade | NOT RUN |
| R3-06/07/08 | Reuso, hipóteses não gravadas, edição com recálculo | NOT RUN |
| R3-09 | Desmontagem/remontagem do componente com recuperação do pedido | NOT RUN |
| R3-10 | Handler real com adaptador CAS: concorrência 200/409; SQL real não executado | NOT RUN |
| R3-11 | Conta/escopo privados; resposta atrasada de A descartada após login B | NOT RUN; RLS real pendente |
| R3-12/13 | Condição explícita; ausência de vendas não vira ARV por AVM | NOT RUN |
| R3-14/15 | Preparação cache-only, zero fallback de provider/LLM | NOT RUN |
| R3-16 | Componente real: Generate → reload → seguro → confirmação → mesmo L3 | NOT RUN |
| R3-17/18 | Inputs persistidos no adaptador → mesma revisão/NOI → PDF real | NOT RUN |
| R3-19/20 | Parcial exige aceite; obrigatório não contornado; entitlement verificado | NOT RUN |
| R3-21 | Trava local e gravações concorrentes testadas; cobrança real não acionada | NOT RUN |
| R3-22/23 | Seguro confirmado sem alerta antigo; renda projetada separada de atual | NOT RUN |
| R3-24 | Regressão do renderer, exportações e amostras L1/L2/L3 | NOT RUN em Preview |

Arquivos de testes: `reportCompletion.test.ts`, `reportCompletionEndpoint.test.ts`, `reportCompletionFlow.test.jsx`, `MaxxisReportCompletion.integration.test.jsx`, além das suítes existentes. PDF real com seguro confirmado e NOI do motor: `.tmp-codex/r3-completion/R3-private-L3.pdf`; teste verifica até seis páginas e ausência de overflow.

TypeScript do escopo de relatório e build isolado: PASS. Fingerprint do candidato final: `761ab64bdfeb848179cfa9d72875cf09825f4026e6f408e92828d40211a0501c`. Backend Deno cached-only: 36 erros preexistentes na entrada conjunta das duas funções, 36 atuais, nenhum novo diagnóstico; os 31 conhecidos do grafo compartilhado não foram reparados fora do escopo. ESLint dos JS/JSX alterados: PASS.

Amostras fictícias regeneradas pelo renderer real em `qa/report-r3-completion/`: L1 1 página, L2 3, L3 6; dez PNGs. Mesmos formatos no botão “i” e chat, via assets existentes. Layout aprovado preservado; avisos passam a refletir as métricas efetivamente disponíveis. PDFs de QA não entram no source control. Fingerprint/manifest das amostras atualizados.

## Staging e rollback — metadados verificados, publicação NOT RUN

Target confirmado: `oqdcnjupquhybwdbeeew`, `maxxis-migration-validation`, ACTIVE_HEALTHY. Não se presumiu paridade com Production.

| Dependência | Resultado read-only |
|---|---|
| Tabela de contexto e colunas existentes | Presentes |
| `analysis_revision` | Ausente; requer migration candidata |
| `ds_save_analysis_context_cas` | Ausente; requer migration candidata |
| Políticas INSERT/SELECT/UPDATE | Três políticas com usuário autenticado e gate de acesso ao contexto |
| `maxxis-chat` atual | Versão 63, ACTIVE, JWT habilitado |
| `maxxis-analysis-inputs` atual | Versão 2, ACTIVE, JWT habilitado |

Inspeção de políticas não certifica RLS ponta a ponta. Antes do deploy será necessário dry-run transacional da migration exata e teste real de acesso/CAS. Não há PostgreSQL/Docker local disponível; nenhum dry-run SQL foi alegado.

Backups das versões atuais das duas funções obtidos pelo Management API, hash SHA-256 e extração de fontes verificados: 42 arquivos do chat e 34 do endpoint. Evidência e fontes em `.tmp-codex/r3-completion/rollback/` e `rollback-receipt.json`. Candidato frontend isolado em `.tmp-codex/r3-completion/candidate/`, configurado para staging e origem local; não deve ser publicado sem configurar a origem real do Preview autorizado.

Rollback mínimo: retirar o Preview candidato e republicar as fontes exatas dos backups das duas funções com suas configurações JWT; manter coluna/revisões/histórico aditivos, sem exclusão de dados. Não requer restaurar stash ou alterar Production. O rollback remoto também depende da autorização do gate de publicação.

## Estado local antes da autorização remota

| Item | Estado |
|---|---|
| Complementação determinística e retomada local | IMPLEMENTED / LOCALLY TESTED |
| Metadados e rollback de staging | VERIFIED read-only; não STAGING VALIDATED funcional |
| Migration candidata | IMPLEMENTED; aplicação e dry-run remoto NOT RUN |
| Functions/Preview R-3 | NOT RUN; BLOCKED aguardando autorização específica |
| Testes com sessões reais A/B, SQL CAS e cobrança | NOT RUN |
| E2E ACCEPTED | NÃO |
| Gemini generativo | Não exercitado/não certificado; zero chamadas |
| Production, pricing, RLS, Matching, stash | Preservados |
| Commit / push / deploy | NÃO |

Próximas autorizações, conforme seção 14 do roteiro: (1) dry-run e aplicação somente da migration CAS no staging; (2) publicação somente das duas funções e frontend Preview apontado ao staging, com CORS da origem exata apenas nesse ambiente; (3) fixtures fictícias e duas sessões autenticadas de QA no staging, sem chamadas pagas. Só então homologar concorrência, isolamento, retomada, entrega/cobrança e paridade dos PDFs, e fornecer a URL direta para conferência visual. Não há URL nova publicada nesta entrega local.

Evidências locais concentradas em `.tmp-codex/r3-completion/` (`tests.json`, `types-comparison.json`, `build.json`, `candidate.json`, metadados e rollback). Pasta ignorada contém artefatos operacionais e não deve ser commitada. Stash protegido preservado: 34 entradas, topo `e6871a826f822fa3b42a2c904d901e212c52c89a`. Nenhum stash aplicado.

## Continuação autorizada — 9 de novembro de 2026

O quadro anterior registra a entrega local; as autorizações remotas foram concedidas posteriormente. Resultados iniciais, antes da correção PT409:

| Operação autorizada | Resultado |
|---|---|
| Target Supabase | VERIFIED: `oqdcnjupquhybwdbeeew`, `maxxis-migration-validation`, ACTIVE_HEALTHY |
| Migration CAS original | Dry-run com ROLLBACK PASS; aplicação PASS; RLS habilitado antes/depois |
| `maxxis-analysis-inputs` | Publicada versão 3, ACTIVE, JWT habilitado |
| `maxxis-chat` | Publicada versão 64, ACTIVE, JWT habilitado |
| Frontend Preview | Publicado e READY: https://dealsiftermatch-qve962yi1-deal-sifter-match-s-projects.vercel.app |
| CORS | Ambas as funções aceitam a origem exata do Preview; alterada somente `MAXXIS_PREVIEW_ALLOWED_ORIGINS` no staging |
| Vercel Production | Mesmo deployment `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`; nenhuma promoção |
| Fixtures | Duas contas fictícias autenticadas e dois imóveis fictícios criados no staging; nenhum email real enviado |
| Leitura autenticada / confirmação | PASS: leitura 200, candidato sem confirmação 400, persistência confirmada 200 |
| Lacuna incremental | PASS: Preflight L3 real solicita somente seguro quando os demais inputs estão confirmados |
| CAS real concorrente | FAIL: SQLSTATE 40001 provoca retry interno do PostgREST e timeout; correção remota pendente de nova autorização |
| Isolamento RLS A/B e entrega completa no navegador | Ainda NOT RUN após o bloqueio de concorrência; não homologados |
| E2E ACCEPTED | NÃO |

O primeiro Preflight retornou contexto indisponível porque os imóveis fictícios estavam fora da vitrine; a RPC existente `ds_get_public_property_details` exige publicação. Ajustadas somente as duas fixtures, sem alterar RPC ou permissões. A repetição passou.

### Defeito encontrado no CAS real

A migration original usou SQLSTATE `40001` para conflito de revisão. No PostgREST do ambiente, esse código é interpretado como falha transitória, gerando retries internos e timeout. O problema é documentado pelo [Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Os testes com mocks não revelaram o comportamento do middleware.

Correção local preparada na mesma migration: `PT409`, preservando comparação de versão, lock, RLS e mensagem `ANALYSIS_REVISION_CONFLICT`. O endpoint já reconhece essa mensagem. Não aplicada remotamente: a revisão automática rejeitou a troca posterior do SQLSTATE e o cancelamento das requisições de QA, por considerar que excediam a autorização da migration original. Duas autorizações específicas foram solicitadas. Não foi usada execução indireta para contornar a rejeição.

Requisições de QA remotas podem continuar sendo repetidas pelo PostgREST; não houve nova gravação CAS de teste depois da identificação do defeito. Cancelamento pendente deve reconfirmar PIDs e operação antes de interromper exclusivamente as chamadas desta execução. Fixtures mantidas para retomar a homologação, sem limpeza enquanto houver chamadas presas.

O Preview tem proteção de login Vercel. A revisão automática também rejeitou extrair/salvar uma chave de bypass; essa ação não ocorreu. A CLI autenticada acessou o Preview com HTTP 200 sem extração ou gravação dessa chave. A validação normal por navegador continua sujeita ao acesso Vercel do revisor; não foi desabilitada a proteção do projeto.

Evidências desta continuação: `staging-migration.json`, `staging-functions.json`, `preview.json`, `preview-cors.json`, `authenticated-api.json`, `db-waits.json`, em `.tmp-codex/r3-completion/`. Credenciais fictícias e sessões ficam somente em arquivos locais ignorados; não entram em logs, relatório, commit ou frontend. O fingerprint publicado é o candidato local `761ab64bdfeb848179cfa9d72875cf09825f4026e6f408e92828d40211a0501c`; a correção SQL PT409 posterior ainda não compõe o banco homologado.

O ensaio de abertura do navegador com transporte pela CLI falhou antes de carregar o app (`net::ERR_FAILED`, zero assets); não foi contado como validação funcional ou visual. Nenhuma chamada às funções foi feita por esse ensaio. Evidência: `preview-browser-readonly.json`.

Próximo gate: autorizar correção PT409 e cancelamento das chamadas QA presas; repetir CAS real e então concluir A/B, reload, retomada, geração L1/L2/L3 e paridade de snapshots/PDF. Sem aceite E2E, sem push e sem deploy em Production. Fechamento read-only em `closing-gates.json`: ledger de provedores 2 antes / 2 depois, delta **0**; deployment de Production inalterado. Gemini não invocado pelo roteiro.

## Correção PT409 autorizada e testes autenticados concluídos

As duas autorizações específicas foram recebidas: alteração somente da função CAS no staging e cancelamento somente das chamadas desta QA, após reconferência. A função foi substituída com `PT409` após dry-run transacional. Uma chamada QA ainda presa foi cancelada na aplicação final; a consulta posterior não mostrou operações CAS ativas. A tentativa operacional anterior encontrou um terminador ausente na definição extraída de `pg_get_functiondef`; o dry-run recusou o SQL e não aplicou alteração. O terminador foi corrigido antes da aplicação bem-sucedida.

Receita em `cas-pt409.json`: PASS, `PT409`, mesmo target, mesmos locks/revisão/RLS; SHA-256 da função aplicada `a5e465601b228f0bea1a93979f306c26a7e5826762a0b69a44f3e26744e97bd0`. Não houve deploy adicional de frontend ou funções Edge; o ajuste foi somente na função SQL autorizada e na migration local correspondente.

### STAGING VALIDATED — backend determinístico

`authenticated-api.json`: **11/11 verificações PASS**, com sessões reais e transportes reais:

- Leitura autorizada; valor sem confirmação recusado; gravação confirmada.
- L3 pede apenas o seguro residual.
- Duas gravações da mesma revisão retornam **200 / 409**, sem o timeout anterior.
- B não lê o contexto privado de A, inclusive com tentativa de informar o usuário A no corpo; RLS também retorna zero linhas para leitura direta cruzada.
- Revisão de A não é aplicada por B.
- Seguro confirmado elimina a lacuna; NOI do cenário = 17.800.
- Preparação repetida reaproveita a mesma revisão; ledger de provedores 2 → 2.

`additional-authenticated.json`: **14/14 verificações PASS**, incluindo as gravações/preparações das etapas:

- OPEX agregado de 30% sobre EGI 22.800: orçamento 6.840, despesas conhecidas 3.800, reserva 3.040, NOI 15.960.
- Orçamento insuficiente: conflito, geração completa bloqueada e NOI nulo.
- Discriminado: NOI 17.800, sem adicionar percentual agregado.
- Seguro alterado para 1.800: NOI 17.600; confirmação do aluguel preservada.
- Conta fictícia temporariamente Free: L3 recusado com HTTP 403; estado Enterprise da fixture restaurado. Não foram alteradas regras, preços, Stripe ou contas reais.

### STAGING VALIDATED — snapshots, persistência e renderer

`authenticated-pdfs.json`: PASS. Snapshots reais das fixtures, preparados pelas funções publicadas, projetados pelos módulos do app e renderizados offline:

| Relatório | Páginas | Overflow | NOI privado | Persistência repetida |
|---|---:|---:|---:|---|
| L1 / Property Release | 1 | 0 | Fora do escopo | Exportação direta |
| L2 / Maxxis Analysis | 3 | 0 | 17.800 | HTTP 200/200, mesmo ID |
| L3 / Deal Intelligence | 3 | 0 | 17.800 | HTTP 200/200, mesmo ID |

PDFs em `qa/report-r3-completion/staging-authenticated/`. Esses arquivos contêm somente dados fictícios da QA. A persistência usou a RPC existente e sessões normais; saldo Enterprise inalterado. Renderer sem rede. Não se trata de cobrança Free/Pro real nem de certificação de Gemini.

As fixtures receberam metadados explícitos de coordenadas manuais fictícias (`R3_QA_OFFLINE_FIXTURE`), sem geocoder, para satisfazer o contrato já existente de publicação. O app exige origem e data de geocodificação mesmo com coordenadas manuais; nenhuma validação foi afrouxada. A sincronização normal do app reclassifica `source` para `supabase`; a identificação operacional das fixtures usa os UUIDs e donos criados nesta execução, não esse campo mutável.

### Navegador e limite do aceite

`preview-browser-readonly.json`: app compilado autenticado e chat montados, sem erros JavaScript. O HTML vem do Preview real pela CLI autenticada; os assets vêm de cache SHA-256 dos mesmos arquivos publicados. A função de leitura `feature-flags` foi permitida; `presentation-translate` e destinos externos foram bloqueados para impedir chamadas generativas/pagas. A proteção Vercel não foi alterada, e nenhuma chave de bypass foi extraída ou salva.

O ensaio anterior que bloqueava todas as funções impedia a hidratação de feature flags e não era evidência de defeito do produto. O curl local também não suporta `--compressed`; removida somente essa opção do script de QA. Banner de consentimento/cookies foi tratado somente na conta fictícia.

Naquele checkpoint, o fluxo interativo ainda estava em conferência. O fechamento abaixo substitui esse status; a revisão visual humana permanece separada da validação automatizada.

## Fechamento autorizado — 9 de novembro de 2026

### Migration e banco

Após a autorização específica final, foi registrado somente o histórico da versão `20261105230000`, nome `maxxis_analysis_context_cas`, com o SQL já aplicado no staging `oqdcnjupquhybwdbeeew`. Reconferência PASS em `migration-history.json`; nenhuma nova versão criada, nenhuma outra migration alterada. SHA-256 do arquivo SQL: `5596bb5ee5cc9853753c97097482c865a81ee122b5163c570cc6f041fb884c79`. Não há autorização pendente para as ações desta etapa. A falha e as solicitações anteriores acima são histórico, não bloqueios atuais.

### Dois fluxos no navegador — PASS

Evidência: `preview-browser-flow.json`, sessões reais das fixtures, funções publicadas e persistência real no staging. O HTML foi obtido do Preview pela CLI autenticada e os assets foram servidos de cache com hashes dos arquivos publicados; portanto esta prova tem esse limite de transporte e não equivale a teste de acesso público sem login. A proteção Vercel permaneceu ativa. Consentimentos foram tratados apenas na conta fictícia e a interação usou o teclado.

- **Relatório → complemento → relatório:** solicitação L3, somente lacuna de seguro, reload, retomada do mesmo pedido, confirmação e aceitação explícita da entrega parcial. Persistência HTTP 200, mesmo imóvel/identificador e NOI 17.800.
- **Chat → confirmação → relatório:** declaração de seguro anual 1.700; nenhuma gravação antes da confirmação. Após confirmar, o aluguel manteve sua confirmação anterior e o novo relatório consumiu seguro 1.700 e NOI 17.700. Persistência HTTP 200, sem linha duplicada.
- Nenhum erro JavaScript, nenhuma chamada ao fallback `maxxis-chat` e nenhuma chamada a Gemini/provedor. Tradução de apresentação e outros destinos externos foram bloqueados pelo roteiro.

A prova real encontrou uma falha de retomada: o app consumia o pedido pendente enquanto o plano ainda estava no valor inicial Free, antes de carregar Enterprise. A retomada agora espera o entitlement do nível solicitado e só então marca o pedido como tratado. Teste do componente cobre Free → Enterprise. O fingerprint do frontend final publicado somente em Preview é `497b8fca77df2d5737edd7574a3eadd71a907839dd5d4c176743d88130447221`.

Algumas tentativas do roteiro encerraram antes da resposta assíncrona de persistência ou selecionaram o formulário parcial anterior. O roteiro final passou a aguardar o HTTP da gravação, o novo candidato e o Preflight correspondente; essas tentativas anteriores não foram contadas como aprovação.

### Verificação final e alcance

Regressão anterior: **636/636 PASS**. Após a correção de hidratação: **21/21 direcionados PASS**, incluindo componente real; conjuntos sobrepostos, não somados. Lint dos arquivos JS/JSX corrigidos, TypeScript do relatório e build do candidato: PASS. Grafo TypeScript do backend: 36 erros antes/depois, sem novos erros; não se declara aprovação integral desse grafo.

PDFs autenticados atuais ficam em `qa/report-r3-completion/staging-authenticated/`, separados das amostras rich anteriores. L1 não exige entradas financeiras; L2/L3 reutilizam o cenário confirmado. Os testes de renderização bloqueiam rede. Fixtures ficam disponíveis para revisão; a limpeza deve usar somente seus UUIDs e donos criados por esta QA.

**Aceite desta execução:** fluxos determinísticos autenticados no staging PASS; revisão visual humana pendente; Gemini, chamadas pagas e lançamento de Production fora desta homologação. Não houve commit, push, promoção ou deploy em Production. Stash preservado. Preços, nuggets, Stripe e políticas RLS existentes preservados.
