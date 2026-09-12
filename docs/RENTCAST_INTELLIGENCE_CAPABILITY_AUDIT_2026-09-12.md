# DealSifter / Maxxis — Auditoria de Capacidades de Inteligência da RentCast

**Data da auditoria:** 2026-09-12
**Modo:** somente descoberta; 0 chamadas reais à RentCast.

## Conclusão executiva

A RentCast é suficiente como provedor primário de evidências para a próxima fase do DealSifter, especialmente porque `GET /v1/avm/value` retorna, em uma única requisição bem-sucedida faturável, uma estimativa de valor do provedor, uma faixa com 85% de confiança e comparáveis classificados. A RentCast, isoladamente, **não** é suficiente para produzir um ARV defensável do DealSifter sem uma camada determinística separada de qualidade dos comparáveis. As principais lacunas são a qualidade/condição da reforma, a identificação confiável de transações arm's-length/distressed e as premissas de rehab específicas do investidor.

### Próxima fase recomendada

**SALE COMPARABLES + VALUATION EVIDENCE v1**

Adicionar `/v1/avm/value` por meio da abstração de provider existente, armazenar em cache separadamente as evidências de valuation/comparáveis, normalizar os candidatos a comparáveis, criar a fundação de um Comp Engine determinístico do DealSifter e validar uma propriedade real com, no máximo, uma chamada AVM real. **Parar antes do ARV final do DealSifter.**

## Capacidades RentCast de alto valor

| Capacidade | Endpoint | Papel |
| --- | --- | --- |
| Property Records | `/v1/properties` | Fundação de evidências já existente |
| Value AVM + sale comps | `/v1/avm/value` | **Próxima prioridade** |
| Rent AVM + rental comps | `/v1/avm/rent/long-term` | Inteligência de aluguel |
| Sale listings | `/v1/listings/sale` | Contexto/fallback de listings |
| Rental listings | `/v1/listings/rental/long-term` | Contexto de aluguel |
| Estatísticas de mercado por ZIP | `/v1/markets` | Contexto de mercado/relatório |
| Busca de registros vendidos | `/v1/properties?address=...&radius=...&saleDateRange=...` | Validação condicional/conjunto alternativo de comps |

## Semântica crítica de ARV

- RentCast AVM = evidência **ESTIMATED** fornecida pelo provider.
- A RentCast informa que `/v1/avm/value` pode representar valor atual de mercado ou ARV, mas os inputs documentados não incluem qualidade/condição da reforma.
- O ARV do DealSifter deve permanecer um resultado analítico separado, determinístico e baseado em evidências.
- A correlação do provider deve permanecer um sinal de similaridade do provider, e não o DealSifter Comp Score.
- Tax Assessment ≠ Market Value; AVM ≠ Appraisal; Comparable Sale ≠ Subject Value; ARV ≠ As-Is Value.

## Prontidão dos dados para o Comp Engine

**Disponíveis/deriváveis:** distância, recência, tipo de imóvel, quartos, banheiros, living sqft, lot size, year built, preço de venda/listing (com ressalvas de cobertura), $/sqft e correlação do provider.
**Não disponíveis de forma confiável:** qualidade/condição da reforma, classificação arm's-length/distressed e qualidade jurídica/título.

## Planejamento da quantidade de requisições

| Pacote | Requisições ao provider com cache frio | Pior caso com limite de 45 requisições |
| --- | ---: | ---: |
| Minimum — Property Record + Value AVM/comps | 2 | ~22 análises |
| Standard — + estatísticas de mercado por ZIP | 3 | 15 análises |
| Advanced — + Rent AVM + mercado + validação condicional de registros vendidos | 4–5 | ~9–11 análises |

Se o Property Record já estiver em cache, a próxima fase de sale comps pode exigir apenas **1 nova requisição** para `/v1/avm/value`.

## Responsabilidade pelos KPIs

A RentCast fornece fatos, registros e estimativas. O DealSifter deve calcular ARV, MAO, NOI, Cap Rate, ROI, Cash-on-Cash, Cash Flow, DSCR, Flip Profit e Spread de forma determinística, a partir de inputs explícitos. O Maxxis interpreta e explica; ele não deve inventar valores financeiros.

## Prontidão para o Maxxis Deal Intelligence Report

As evidências da propriedade já estão disponíveis hoje. Valuation, sale comps, rental intelligence e market statistics estão disponíveis na RentCast, mas ainda não foram integrados. O ARV final do DealSifter e os KPIs financeiros exigem engines determinísticos.

## Principais riscos

1. A qualidade/condição da reforma é a maior lacuna para um ARV pós-reforma.
2. Estados non-disclosure podem enfraquecer a evidência de preços de venda.
3. A correlação do provider é útil, mas sua metodologia é opaca.
4. A classificação arm's-length/distressed pode exigir uma fonte adicional futuramente.
5. Dados de mercado por ZIP fornecem contexto, não valuation do imóvel específico.

## Fontes oficiais

- https://developers.rentcast.io/reference/property-data-schema
- https://developers.rentcast.io/reference/property-records
- https://developers.rentcast.io/reference/property-data
- https://developers.rentcast.io/reference/value-estimate
- https://developers.rentcast.io/reference/property-valuation
- https://developers.rentcast.io/reference/property-valuation-schema
- https://developers.rentcast.io/reference/rent-estimate-long-term
- https://developers.rentcast.io/reference/property-listings
- https://developers.rentcast.io/reference/sale-listings
- https://developers.rentcast.io/reference/rental-listings-long-term
- https://developers.rentcast.io/reference/search-queries
- https://developers.rentcast.io/reference/market-statistics
- https://developers.rentcast.io/reference/market-data
- https://developers.rentcast.io/reference/billing-and-pricing
- https://developers.rentcast.io/reference/rate-limits
- https://developers.rentcast.io/reference/introduction
