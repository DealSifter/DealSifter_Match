# Maxxis Deal Intelligence Experience v1

## Objetivo

Esta camada apresenta o contexto premium já calculado pelos componentes existentes. O contrato permanece: **engines calculate; Maxxis explains**. A experiência não calcula valores, escolhe comparáveis, consulta providers nem recomenda compra ou preço de oferta.

## Fluxo

```text
Property selecionada
  -> verificação de acesso DEAL_INTELLIGENCE
  -> contexto estruturado existente
  -> projeção MaxxisDealIntelligenceReport
  -> MaxxisDealIntelligenceExperience no chat
```

O acesso é verificado antes da solicitação conhecida. Se o backend devolver `deal_insight` para outra formulação, o frontend aplica uma segunda verificação fail-closed antes de apresentar qualquer conteúdo premium.

## Componentes

- `maxxisDealIntelligenceReport.js`: projeção pura, allowlisted e pronta para export futuro.
- `MaxxisDealIntelligenceExperience.jsx`: visão answer-first com evidências expansíveis.
- `MaxxisAssistant.jsx`: aplicação do gate e seleção da experiência.
- `MaxxisCapabilities.jsx`: renderização do resultado estruturado no chat.

## Fontes autorizadas

| Seção | Autoridade |
| --- | --- |
| Property Evidence | Property Intelligence existente |
| Comparable Evidence | Comp Engine existente |
| ARV | ARV Engine existente |
| Investment Fit | Investment Profile e Match Engine existentes |
| Deal Metrics | Deal Metrics existentes |
| Risks | Risk Context existente |

Distância, função do comparável, similaridade, condição e qualidade da transação são apenas copiados do resultado existente. Nenhum valor é recalculado pela camada de experiência.

## Estrutura do relatório

`MaxxisDealIntelligenceReport` contém:

- `executiveDealOverview`;
- `whyThisPropertyStandsOut`, sempre com proveniência;
- `investmentFit`, explicitamente `PROFILE_FIT_ONLY`;
- `valuationIntelligence`;
- comparáveis separados em `used`, `supporting` e `excluded`;
- `riskAnalysis`;
- `limitations` com `UNKNOWN` preservado;
- `nextVerificationSteps`;
- `provenance` e `exportCompatibility`.

O contrato é compatível com um relatório futuro, mas esta versão não gera PDF nem email.

## Acesso

- **Free:** bloqueado, salvo entitlement ativo de Nugget Unlock.
- **Pro:** bloqueado sem entitlement completo; apresenta fluxo de upgrade por Nuggets.
- **Enterprise/Admin:** incluído.
- **Nugget Unlock:** aceito quando já representado por entitlement ativo.

O preço e a compra do unlock permanecem desabilitados enquanto a configuração econômica estiver indefinida. Esta fase não debita Nuggets e não chama Stripe.

## Comportamento do Maxxis

O Maxxis abre com uma visão executiva, separa compatibilidade de perfil de qualidade do investimento, apresenta o ARV exatamente como retornado pelo engine, explica evidências e riscos e termina com diligências verificáveis. Valores ausentes permanecem `UNKNOWN` ou `Unavailable`. Frases de recomendação ou garantia são rejeitadas na projeção.

## Limitações

- A experiência depende de contexto e entitlement já existentes.
- ARV indisponível permanece sem faixa ou referência central.
- Comparáveis ausentes não são substituídos por exemplos ou dados fictícios.
- Esta versão não cria novos providers, buscas, cálculos, PDF, email ou cobrança.
