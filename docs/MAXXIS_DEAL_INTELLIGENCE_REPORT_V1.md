# Maxxis Deal Intelligence Report v1

## Objetivo

O Maxxis Deal Intelligence Report é a base contratual para transformar a experiência analítica do chat em relatórios profissionais para investidores. O produto comunica **evidence-based investment intelligence**: não é appraisal, recomendação de compra ou venda, nem promessa de retorno.

Esta versão prepara dados e estrutura visual. Renderização final em PDF, envio por e-mail e compartilhamento permanecem inativos.

## Níveis

| Nível | Tipo | Conteúdo | Acesso incluído |
| --- | --- | --- | --- |
| 1 | `PROPERTY_RELEASE` | Dados cadastrados no Property Card: fotos, endereço, descrição, características e preço | Free, Pro e Enterprise |
| 2 | `MAXXIS_ANALYSIS` | Nível 1 + resumo, observações, aderência ao perfil, riscos, limitações e próximos passos | Pro e Enterprise |
| 3 | `DEAL_INTELLIGENCE` | Nível 2 + evidências, conflitos, comparáveis, ARV existente, metodologia, alertas e contexto do investidor | Enterprise ou entitlement ativo |

O Nível 1 não contém análise Maxxis, evidências, comparáveis, avaliação ou riscos. O Nível 2 não contém ARV, comparáveis ou valuation intelligence. A ausência de acesso é tratada de forma fail-closed: o relatório não é construído.

## MaxxisReportSchema

O contrato `MAXXIS_REPORT_SCHEMA_V1` contém:

- `reportType`: `PROPERTY_RELEASE`, `MAXXIS_ANALYSIS` ou `DEAL_INTELLIGENCE`;
- `sections`: `propertySummary`, `executiveSummary`, `investmentProfile`, `propertyEvidence`, `comparableEvidence`, `valuationEvidence`, `riskAssessment`, `limitations`, `verificationChecklist` e `provenance`;
- `pages`: fundação visual do relatório premium;
- `exportFoundation`: estados `PREPARED_NOT_RENDERED` para PDF, e-mail e compartilhamento.

Seções não autorizadas permanecem `{ available: false, sourceType: "UNKNOWN", data: null }`. Campos de Property Card e comparáveis usam allowlists para evitar vazamento de payload interno.

## Propriedade e proveniência

Os tipos de origem permitidos são:

- `USER_PROVIDED`;
- `VERIFIED_RECORD`;
- `CALCULATED`;
- `ESTIMATED`;
- `UNKNOWN`.

`UNKNOWN` nunca é convertido em hipótese. Match Score continua significando somente aderência ao Investment Profile e permanece separado de Investment Quality.

## Estrutura visual premium

1. Executive Investment Brief — propriedade, estratégia, resumo e confiança.
2. Property + Evidence Summary — dados, fontes, força da evidência e conflitos.
3. Comparable Analysis — comparáveis usados, de apoio e excluídos, com justificativas.
4. Valuation Intelligence — status, faixa, confiança, metodologia e alertas.
5. Investor Review — Profile Fit separado de Investment Quality.
6. Risks and Verification — riscos de dados, mercado, avaliação e execução, mais checklist.

Comparáveis continuam expansíveis na experiência atual. A estrutura de páginas é uma prévia contratual, não um PDF renderizado.

## ARV e comparáveis

O relatório apenas apresenta resultados existentes dos motores determinísticos. Não recalcula ARV nem seleciona comparáveis.

- `ARV_AVAILABLE`: mostra a faixa existente e sua evidência.
- `ARV_LIMITED`: mostra a faixa existente com limitações e alertas.
- `ARV_UNAVAILABLE`: mantém faixa e referência central como `null`; não mostra `$0`, não inventa número e não substitui o resultado por AVM.

Comparáveis expõem somente os campos contratuais necessários: identificação, endereço, venda registrada, distância, similaridade, condição, papel e justificativas de inclusão/exclusão.

## Controle de acesso e economia

- Free: Property Release.
- Pro: Property Release e Maxxis Analysis.
- Deal Intelligence: Enterprise ou entitlement/Nugget Unlock já existente.
- Enterprise: todos os níveis.

Esta fase não define preço, não debita Nuggets, não chama Stripe, não chama RentCast e não modifica Usage Guard. O unlock comercial permanece desabilitado até configuração posterior.

## Limitações e evolução futura

- O relatório depende da qualidade e atualidade das fontes existentes.
- Não constitui appraisal, parecer de corretagem, aconselhamento financeiro ou garantia.
- Exportação final exigirá um renderer separado que consuma somente `MaxxisReportSchema` após nova validação de acesso.
- E-mail e compartilhamento deverão usar o mesmo contrato sanitizado e trilha de proveniência.
- Ativação comercial futura deve definir preço, débito idempotente e entitlement sem alterar os motores analíticos.
