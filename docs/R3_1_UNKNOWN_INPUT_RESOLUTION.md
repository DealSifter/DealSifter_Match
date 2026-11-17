# R-3.1 — “Não sei”, estimativas assistidas e continuidade L3

## Causa e correção

O handler novo de “Não sei” em `MaxxisAssistant.jsx` apenas acrescentava uma mensagem de erro. Não persistia UNKNOWN, não preparava alternativas e não retomava o pedido. O Preflight mantinha qualquer entrada financeira obrigatória ausente como impedimento absoluto, mesmo com aceitação de relatório parcial. Não havia composição de estimativas para esses custos. Era uma decisão explícita do contrato R-3, não uma falha do provedor.

Agora a escolha UNKNOWN é gravada no contexto privado pelo CAS existente. O Preflight relê cadastro, contexto confirmado e cache, preserva os campos ausentes e oferece continuidade parcial explícita. Estimativas possíveis aparecem para revisão e exigem uma segunda ação de confirmação. Sem base defensável, somente parcial, entrada manual ou fornecimento dos parâmetros faltantes. Nada é gravado como custo apenas por ser apresentado. Confirmações válidas não são perguntadas novamente.

## Metodologias efetivamente usadas

Não há pesquisa de mercado, percentuais universais, premissa automática ou novo motor de retorno. O módulo offline `unknownInputResolution.ts` compõe custos dos parâmetros privados confirmados; o ScenarioEngine existente permanece responsável pelos indicadores.

| Categoria | Base necessária e método | Limites |
|---|---|---|
| Manutenção até venda | Imposto, seguro, manutenção, serviços e outras despesas anuais / 12 × meses, mais HOA mensal × meses | Cada categoria e o prazo precisam de valor confirmado. Escopo explicitamente confirmado para a condição atual, separado de reforma, aquisição e financiamento. Sem OPEX agregado, administração de aluguel presumida ou despesas duplicadas. |
| Financiamento à vista | Modalidade CASH **e** ausência explícita de encargos financeiros | Só então custo financeiro não aplicável/zero no cenário; custos ordinários de aquisição/venda continuam separados. CASH sozinho ou UNKNOWN não bastam. |
| Financiamento com juros | Originação + principal × pontos / 100 + fechamento financeiro + outros encargos + principal × taxa anual / 100 × meses / 12 | Somente método interest-only explicitamente confirmado, principal constante, sem amortização. Todos os encargos, inclusive zero, explícitos; confirmação de que não duplicam aquisição/holding. Outros métodos seguem manuais ou parciais. |
| Venda | Preço privado de saída confirmado × percentual total da transação confirmado / 100 | Percentual fornecido/aprovado pelo usuário; deve representar o escopo pretendido de comissões e despesas. Não presume tarifas locais. Sem usar preço pedido/AVM como preço de saída ou inventar ARV. |

O formulário reutiliza os componentes inline existentes. A entrada de parâmetros oferece até três campos por rodada. Texto de unidade/periodicidade e modalidades usa descrições legíveis em vez de enums internos. Metodologia e limitações são apresentadas antes da confirmação e no PDF.

## Persistência, identidade e revisão

Tudo permanece em `property_arv_review_contexts.deal_assumptions.r3Completion`, isolado por imóvel/usuário. `unknown` guarda campo, status UNKNOWN, data e revisão. Não significa NOT_APPLICABLE. Inputs confirmados prevalecem sobre uma tentativa de marcá-los desconhecidos.

O endpoint recompõe as estimativas no servidor. Não aceita valores calculados enviados pelo cliente. A confirmação exige a revisão CAS atual; preserva autenticação, entitlement e RLS existentes. Cada estimativa aceita guarda campo, valor, fórmula, base com origem/data dos parâmetros, periodicidade, confirmação/data, ID e versão do cenário e versão-base. Origem SYSTEM_ASSUMPTION distingue a estimativa de USER_DECLARED; fatos verificados, estimativas de provedor, UNKNOWN e NOT_APPLICABLE mantêm seus conceitos próprios.

A primeira prova autenticada revelou o limite existente de **8 KiB** em `deal_assumptions`: três estimativas com cópias extensas de textos/proveniência foram recusadas pelo CHECK do banco. O schema não foi alterado. A persistência foi compactada: origem comum dos parâmetros e versão da metodologia são registradas uma vez; textos de limitações são recompostos pela versão, moeda já consta na unidade USD, e o identificador da interação é guardado uma vez por gravação. Valores, bases, datas, confirmação e revisões permanecem explícitos. A gravação compacta foi aceita pela RPC real.

Se uma base muda, a estimativa anterior fica STALE, sai das entradas do cálculo e exige nova revisão/confirmação. Revisão manual substitui a estimativa privada; não altera fatos oficiais. Não foi necessária migration.

## Retomada e métricas

Após confirmar, o fluxo existente reexecuta o Preflight e retoma o Report Request original, com imóvel, tipo, idioma, opções e identificador preservados. UNKNOWN e premissas confirmadas sobrevivem a reload; o pedido usa a persistência de metadados já implementada em R-3.

A prova de navegador do caminho parcial encontrou uma corrida adicional: um pedido iniciado no chat era confundido com pedido restaurado quando `loading` voltava a falso. Isso disparava um segundo Preflight e podia descartar a continuação durante essa preparação. Pedidos já ativos agora recebem o marcador de retomada nesta montagem; um reload continua restaurando normalmente. Ações de lacunas ficam desabilitadas enquanto a preparação está em andamento. Há teste do componente real verificando uma única preparação inicial e aceitação parcial chegando à persistência.

Relatório gerável não significa finanças completas. A aceitação explícita de parcial permite entradas faltantes, não conflitos de integridade. OPEX contraditório continua bloqueado; entitlement e autorização continuam necessários. Nenhum custo desconhecido é substituído por zero. ROI, lucro e retorno dependentes de entradas ausentes ficam nulos/omitidos; premissas conhecidas e limitações são preservadas. O selo não indica completo quando há entrega financeira parcial.

L1 continua sem gate financeiro; L2/L3 sem gaps mantêm o caminho normal. ARV continua dependendo das vendas elegíveis; estimativas de custo não alteram sua elegibilidade.

## Arquivos desta fase

- `supabase/functions/_shared/maxxis/unknownInputResolution.ts` e testes: composição offline, bases e UNKNOWN.
- `supabase/functions/_shared/maxxis/reportCompletion.ts` e testes: parâmetros, invalidação e entrega parcial explícita.
- `supabase/functions/maxxis-analysis-inputs/index.ts` e `reportCompletionEndpoint.test.ts`: persistência/aceitação pelo CAS e cálculo no servidor.
- `src/services/maxxisAnalysisInputsService.js`: operações de escolha UNKNOWN e confirmação de estimativas.
- `src/components/maxxis/MaxxisAssistant.jsx` e `MaxxisReportCompletion.integration.test.jsx`: handlers, retomada do pedido existente e regressão da preparação duplicada.
- `src/features/maxxis/intelligence/MaxxisAnalysisGapResolution.jsx` e `unknownInputResolution.test.jsx`: alternativas inline, revisão, unidade/periodicidade e testes de PDF.
- `src/features/maxxis/export/reportSavedScenarioProjection.ts` e `reportIntegrityViewModel.ts`: metodologia visível, ausências e selo, sem redesenhar o relatório.

## Validação e homologação

Implementação local primeiro. Suíte direcionada T1–T10 e regressão de retomada: 51/51 PASS; renderer real offline incluído. TypeScript do relatório PASS; backend cached-only: 36 erros preexistentes antes/depois, nenhum novo. Build e lint registrados nas evidências locais. A execução final usou um worker e timeout de renderização de 20 segundos: dois testes de PDF excederam o limite padrão de 5 segundos durante disputa de CPU com o build; a repetição passou.

O usuário autorizou atualizar somente as funções `maxxis-analysis-inputs` e `maxxis-chat` no staging `oqdcnjupquhybwdbeeew`, novo Preview/CORS exato e reutilizar as duas fixtures existentes. Sem migration, Production, push ou chamadas pagas. Backups e recibos desta fase: `.tmp-codex/r31-completion/`, ignorado pelo Git. Nenhum segredo ou sessão integra este documento.

Preview atual: https://dealsiftermatch-cvslvd1zj-deal-sifter-match-s-projects.vercel.app (proteção de login Vercel preservada).

Prova autenticada no staging: **16/16 PASS**. Inclui três candidatos defensáveis sem adoção automática, recusa de confirmação ausente, valores calculados no servidor, proveniência/revisão, conflito CAS 409, ausência de estimativa quando faltam bases, relatório parcial sem ROI/lucro e isolamento RLS A/B. Ledger de provedores: 2 antes / 2 depois, delta zero.

Navegador com a primeira conta fictícia: PASS para clique em “Não sei”, alternativas, reload, revisão sem escrita, confirmação HTTP 200 e retomada/gravação HTTP 200 do mesmo pedido. Custos confirmados: holding 3.300, financiamento 0 somente pela compra à vista/escopo confirmados, venda 18.000; lucro do motor 43.700. Nenhuma linha duplicada nem fallback ao chat generativo. Uma tentativa anterior excedeu a espera da interface; a repetição sem mudança funcional passou, aguardando as respostas reais.

O teste usa HTML do Preview real obtido pela CLI autenticada e cache de assets verificados por SHA-256 dos arquivos publicados. Funções, sessões, CAS e gravações são reais; destinos generativos/pagos foram bloqueados. Esse alcance não certifica acesso público sem login nem Gemini. Não se atribui aceite autenticado aos mocks locais. Revisão visual humana é separada da validação automatizada.

Navegador com a segunda conta fictícia no Preview final: **PASS**. Sem base suficiente, não ofereceu estimativa. Houve um Preflight inicial NEEDS_INPUT e um segundo com aceitação parcial explícita READY; ambos HTTP 200, sem preparação inicial duplicada. O relatório foi gravado com HTTP 200, mesmo pedido e uma única linha. Custos desconhecidos permaneceram ausentes; ROI e lucro nulos; cenário PARTIAL. Evidência: `browser-partial.json`.

Na inicialização de sessões novas, o roteiro aguarda a hidratação da conta antes de abrir o chat e antes de preencher um campo habilitado. Tentativas anteriores interagiam antes dessa conclusão e foram descartadas como prova funcional; não foram apresentadas como aprovação.

PDFs de snapshots autenticados em `qa/report-r31-completion/`: L1 1 página; L2 3; L3 com estimativas 4; L3 com UNKNOWN parcial 2. Overflow zero; metodologia das três estimativas efetivamente desenhada. As fixtures não possuem cobertura externa de ARV, por isso os L3 permanecem Preliminares. L1 é exportação do cadastro, sem Preflight financeiro. Renderer sem rede. Testes de regressão do motor e projeções: **88/88 PASS**, separados dos 51 direcionados.

Build offline final e TypeScript do relatório PASS; lint dos arquivos frontend alterados PASS. Fingerprint do candidato: `00eceebfbb4491e17615ca642ee41b818b86cc32fe90f9f4e4b2f7ef52e7c912`. As duas funções foram publicadas somente em staging, com JWT habilitado e backups anteriores preservados. A correção final de retomada mudou somente o frontend; hashes do backend foram reconferidos. A configuração CORS alterada foi somente `MAXXIS_PREVIEW_ALLOWED_ORIGINS` do staging para essa origem exata.

Fechamento read-only em `closing.json`: **PASS** para API autenticada, ambos os caminhos no navegador, PDFs e build; nenhum drift de fonte, delta zero no ledger de provedores, Production no mesmo deployment e stash preservado. Versões ativas finais no staging: `maxxis-analysis-inputs` 10 e `maxxis-chat` 71, ambas com JWT habilitado. Sem migration, commit, push ou deploy em Production. A conferência visual humana do Preview continua separada desse aceite automatizado.

## Limitações

Sem base confirmada suficiente, a estimativa não é oferecida. A composição de holding é discriminada; percentuais de manutenção/administração não são convertidos em custo automaticamente. Financiamento amortizante, tarifas jurisdicionais não configuradas e cotações de mercado não são inventados. O usuário pode informar valores próprios ou aceitar o relatório parcial, com dependências financeiras indisponíveis.

Production, Stripe, nuggets, preços e fórmulas financeiras existentes preservados. Sem commit/push nesta fase; stash não aplicado.
