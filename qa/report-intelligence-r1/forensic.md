# R-1 — auditoria de produção e correções locais

DB TARGET: VERIFIED — `cyeipfskwwisbbayyaca`, Production. O bundle público de
`dealsiftermatch.vercel.app` usa esse project ref; a API de gestão confirmou
`ACTIVE_HEALTHY`, região `us-east-1`. SELECT confirmou o banco `postgres`.
Observação do ledger: 2026-10-30, a partir de 20:51 UTC. A primeira consulta
teve timeout; a repetição de leitura teve sucesso. Nenhuma escrita remota.

## A1 — ledger, últimos 14 dias

| Provider | Operação / endpoint | Tipo | Status | HTTP | Billable | Quantidade |
|---|---|---|---|---|---|---|
| rentcast | property_lookup / properties | property_record | succeeded | 2xx | sim | 5 |
| rentcast | property_value_avm / avm/value | property_value_avm | succeeded | 2xx | sim | 4 |

Total: 9 sucessos, 0 falhas, 0 reservas pendentes nesse intervalo. Agrupamento
feito no servidor, sem ler payloads. Operação é a coluna do ledger; endpoint
e tipo acima são a correspondência explícita do código.

## A2 — imóvel do PDF

Property ID: `089fee38-d90e-4e2d-a582-8d577be72ed4`.

| Tentativa | Status | HTTP | Billable | Classificação | Início UTC | Término UTC |
|---|---|---|---|---|---|---|
| property_lookup | succeeded | 200 | sim | ADDRESS_MISMATCH | 2026-10-04 19:16:59.400081 | 2026-10-04 19:17:07.416773 |
| property_lookup | failed | 404 | não | PROPERTY_NOT_FOUND | 2026-10-04 19:45:21.648797 | 2026-10-04 19:45:22.439321 |

São as duas linhas existentes para esse imóvel; ficam fora da janela de 14
dias. Não há linhas de cache para nenhum data_type. Não há tentativas de
aluguel, estimativa de valor ou busca de vendas registradas nesse imóvel.
O sucesso do primeiro HTTP significa consumo billable; os dados foram
rejeitados por identidade, como registra o error_code.

## A3/A4 — configuração efetiva e acesso

Valores não secretos confirmados por correspondência SHA-256 com os digests
das configurações de Production, sem recuperar ou exibir credenciais:

| Configuração | Valor efetivo |
|---|---|
| PROPERTY_DATA_MODE | live |
| MAXXIS_ENTERPRISE_PROVIDER_BUDGET | 20 |
| MAXXIS_ENTERPRISE_CHAT_PERCENT | 50 |
| Orçamento Enterprise de relatórios | 10 |
| Orçamento Enterprise de chat | 10 |
| MAXXIS_PRO_PROVIDER_BUDGET | 10 |
| MAXXIS_PRO_CHAT_PERCENT | 20 |
| Orçamento Pro de relatórios | 8 |

`RENTCAST_MONTHLY_HARD_LIMIT` não está configurado no servidor; aplica-se o
teto do código de 45. No mês UTC: **31 sucessos billable / 45**, sem reservas
pendentes. Para o acesso associado ao exemplo: **9 / 10** chamadas billable
do orçamento Enterprise de relatórios, 0 reservas e 14 falhas não billable.
Portanto, os limites observados ainda não estão esgotados; isso não comprova
qual era a disponibilidade na geração anterior nem garante saldo para todas
as famílias de um novo relatório.

Existe habilitação `DEAL_INTELLIGENCE`, origem `ONE_TIME_UNLOCK`, de
2026-09-28. O plano base é Free; isso não equivale a ausência de habilitação
do relatório. O código promove o acesso adquirido ao orçamento Enterprise
durante a execução autorizada de L3, e o ledger de orçamento confirma uso
Enterprise nesse acesso. L3 permite aquisição autorizada; L2 prioriza cache,
com política própria para consulta explícita de aluguel. A leitura adicional
do arquivo da função publicada não terminou e foi interrompida; não foi
executada nenhuma função de negócio para conferir o gate.

## Causa raiz

**INDETERMINATE para a geração exata do PDF.** Há evidência histórica direta
de **IDENTITY_MISMATCH** (200 rejeitado) seguida de **NO_COVERAGE** (404), e
ausência de cache. O código anterior também condicionava as outras consultas
ao sucesso do cadastro externo e podia substituir a contagem real por zero.

Faltam identificador de execução do relatório ligado às reservas do ledger,
motivo final por família, fase de transporte e contexto efetivo de acesso
retidos junto à geração do PDF. Datas e consumo atuais não substituem esses
registros. Não é possível atribuir honestamente o erro de aluguel anterior
a quota, credenciais, preparação ou persistência com a telemetria antiga.

## B — mudanças locais

- B1: oito motivos canônicos; preservação no snapshot, schema e view model;
  mensagens no PDF e motivo em cada valor ausente do view model.
- B2: observador de transporte por execução em cadastro, valor, vendas e
  aluguel; preserva chamadas após HTTP,
  inclusive em falhas de persistência. Execução não observada permanece
  desconhecida, sem inventar zero.
- B3: 1.473 ZIP Codes da Florida em tabela estática GeoNames, snapshot de
  2026-10-30. Validação de cidade/estado/ZIP antes da reserva em todas as
  famílias. Divergências e aliases desconhecidos exigem revisão do cadastro;
  a tabela não afirma validar logradouro nem entrega postal.
- B4: consultas de valor e vendas independem da cobertura do cadastro externo;
  vendas usam identidade e características do publicador com proveniência
  USER_PROVIDED quando não existe estimativa compatível. Nenhum valor ou
  coordenada é inventado. Direitos, orçamento e coerência continuam exigidos.
- B5: modo disabled impede aquisição; mock é bloqueado fora de teste isolado,
  inclusive no projeto de Production. Fingerprint divergente é cache miss.
- B6: mensagens localizadas com motivo e próxima ação, sem códigos internos
  ou linguagem de implementação nos avisos de indisponibilidade.

Tabela postal: [GeoNames](https://download.geonames.org/export/zip/),
[licença CC BY 4.0](https://download.geonames.org/export/zip/readme.txt).
Recorte: apenas código postal e nome da localidade da Florida.

Sem migrations. Sem acesso ao stash. Sem commit, push ou deploy.
LIVE CALLS RENTCAST/GEMINI: **0**.

## Validação offline

327/327 testes direcionados em 14 arquivos; setup bloqueia fetch e os
transportes HTTP/HTTPS reais. Inclui motivos por indicador, propagação ao
PDF, falhas antes/depois do HTTP, 404, persistência, divergência postal,
reserva de quota, identidade do cache e bloqueio de mock em Production.

TypeScript do relatório: PASS. Deno check dos módulos alterados, com
`--cached-only`: PASS. A checagem ampla de toolRegistry continua com 31
erros preexistentes; uma cópia isolada do HEAD anterior reproduziu os
mesmos 31 erros. Esses erros não foram corrigidos fora do escopo R-1.

PDFs e previews regenerados sem rede pelo renderizador real: 1/5/10
páginas, 16 PNGs. Testes de paridade e fingerprint: PASS.

Build completo da revisão final: PASS (`npm run build`, 7m57s), com rede
bloqueada e upload de observabilidade desativado. Os avisos de tamanho de
chunk e importação estática/dinâmica não impediram a compilação.
B1/B2/B3/B4/B5/B6: DONE localmente. Produção não foi alterada.
