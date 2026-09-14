# Maxxis Report Confidence + Investor Persona Adaptation v1

## Escopo

Esta é uma camada de apresentação exclusiva do **Maxxis Deal Intelligence Report**. Ela consome resultados estruturados já produzidos pelo DealSifter e não altera ARV Engine, seleção de comparáveis, Match Score, Deal Metrics, Property Evidence ou integração RentCast.

## Maxxis Analysis Confidence

O percentual responde somente: **quão completa e confiável é a análise disponível?** Não mede qualidade do imóvel, retorno, atratividade do negócio nem constitui recomendação.

Componentes independentes:

- Evidence Completeness: proporção entre dados verificados, informados pelo usuário e desconhecidos.
- Comparable Strength: quantidade, similaridade estrutural, distância e qualidade de transação dos comparáveis já selecionados.
- Valuation Confidence: status, confiança e alertas já emitidos pelo ARV Engine.
- Data Freshness: presença e recência das datas dos comparáveis disponíveis.
- Missing Information Impact: impacto de condição, reforma, locação, custos, título, impostos e propriedade ausentes.

O resultado é classificado como `HIGH`, `MODERATE` ou `LIMITED`, acompanhado de contribuições positivas e limitações. Entradas indisponíveis permanecem `UNKNOWN`; não são preenchidas nem convertidas em zero factual.

## Investor Persona Adaptation

A persona deriva apenas de informações fornecidas no perfil e altera somente ordem, destaque e explicação narrativa:

- `WHOLESALER`: ARV, spread, confiança da avaliação e verificação.
- `FLIPPER`: condição, reforma, ARV e risco de revenda.
- `BUY_AND_HOLD`: locação, NOI, cap rate e fatores de longo prazo.
- `TAX_DEED_INVESTOR`: propriedade, impostos, título e verificação jurídica.
- `GENERAL_INVESTOR`: fallback narrativo seguro quando o perfil não informa uma das estratégias suportadas.

A persona nunca altera cálculo, comparável, avaliação, Match Score ou métrica financeira.

## Maxxis Executive Summary

O resumo usa de cinco a oito linhas factuais para apresentar confiança da análise, compatibilidade com o perfil, suporte de evidências, suporte da avaliação, principal incerteza, perspectiva da persona e próxima verificação. Ele aparece na primeira página e é reiterado na página final do relatório premium.

## Controle de acesso

- Property Release: sem confidence layer.
- Maxxis Analysis: mantém apenas o resumo básico existente.
- Deal Intelligence: confidence layer, persona e executive summary completos, sujeitos ao entitlement já existente.

## Regras de segurança e limitações

- Match Score permanece exclusivamente compatibilidade com o perfil, nunca Investment Score.
- Não há recomendação de compra ou venda, lucro/ROI garantido ou classificação `GOOD DEAL`/`BAD DEAL`.
- Dados `UNKNOWN` permanecem explícitos.
- A camada não executa rede, RentCast, Nuggets ou Stripe.
- A confiança depende somente dos inputs estruturados disponíveis e não substitui avaliação oficial, inspeção, análise jurídica ou aconselhamento financeiro.
