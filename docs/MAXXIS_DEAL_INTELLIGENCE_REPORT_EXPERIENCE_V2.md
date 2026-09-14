# Maxxis Deal Intelligence Report Experience v2

## Objetivo e princípio

A v2 apresenta a inteligência existente como relatório SaaS premium para investidores. A linguagem de produto é **evidence-based investment intelligence**. O relatório não é appraisal, aconselhamento financeiro, recomendação de compra/venda ou garantia de retorno.

Arquitetura: **engines calculate; Maxxis explains**. ARV Engine, Comp Engine, Match Score, Deal Metrics, Property Evidence, RentCast Provider e Entitlement Engine permanecem inalterados.

## Níveis e permissões

| Nível | Relatório | Conteúdo | Acesso incluído |
| --- | --- | --- | --- |
| 1 | Property Release | Uma página com dados existentes do Property Card | Free, Pro e Enterprise |
| 2 | Maxxis Analysis | Property Release + interpretação, profile fit, riscos, limitações e verificação | Pro e Enterprise ou entitlement pontual existente |
| 3 | Deal Intelligence | Experiência completa de seis páginas | Enterprise ou entitlement premium existente |

O frontend só recebe o schema após a decisão de acesso. Se a decisão faltar, for negada ou não corresponder ao tipo solicitado, a construção autorizada falha fechada e retorna relatório `null`. Não há conteúdo premium oculto em níveis inferiores.

## Layout

O componente usa cabeçalho azul-escuro, identidade DealSifter Match, cards brancos, teal, badges, indicadores, tabela, gráficos e áreas de localização. O layout é responsivo e permanece dentro da experiência atual do chat.

### Página 1 — Property Overview

- imagem principal e fotos exclusivamente de `property_images` já entregues pelo backend;
- tipo, status, localização e preço;
- cards compactos de proprietário, características e terreno;
- contatos somente quando explicitamente incluídos em `allowedContacts`;
- mapa de contexto. Sem coordenadas, declara `LOCATION_CONTEXT_ONLY` e não simula precisão geográfica;
- notas existentes.

### Página 2 — Comparative Market Analysis

- subject property e grupos `USED`, `SUPPORT` e `EXCLUDED`;
- visão relativa por distância, explicitamente não geográfica quando não há coordenadas;
- tabela com endereço, venda, data, beds/baths, sqft, distância, similaridade, status e justificativa;
- nenhuma imagem Zillow, Redfin ou de outro provedor. Campos ausentes permanecem `UNKNOWN`.

### Página 3 — Valuation Intelligence

- faixa ARV, status, confiança, quantidade de comps, metodologia e warnings existentes;
- Potential Spread e Projected ROI como cenários `LOW`, `EXPECTED` e `HIGH`;
- Rental Intelligence mostra somente dados existentes. Estimated rent, yield e NOI permanecem `UNKNOWN` quando ausentes;
- Price Analysis consome Deal Metrics existentes;
- gráfico de distribuição usa somente a faixa ARV existente.

### Página 4 — Investment Fit & Risk Analysis

- estratégia, mercado, faixa e tipo do perfil;
- Match Score rotulado como `Profile Compatibility`;
- mensagem obrigatória: “Match Score represents profile compatibility, not investment quality.”;
- riscos `DATA_RISK`, `MARKET_RISK`, `VALUATION_RISK` e `EXECUTION_RISK` quando presentes;
- contagem de proveniência e conflitos.

### Página 5 — Key Insights & Verification

Sinais positivos, informações ausentes, considerações e etapas recomendadas de verificação. O conteúdo deriva apenas das observações, limitações e checklists já estruturados.

### Página 6 — Maxxis AI Analysis

Resumo executivo, conclusão segmentada, tópicos, perguntas e ações recomendadas, encerrados pelo disclaimer obrigatório. Não usa `BUY`, `SELL`, `GOOD DEAL` ou promessas.

## KPIs de cenário

Os KPIs são uma projeção de apresentação determinística, não um novo motor de avaliação. Só ficam disponíveis quando existem purchase price, rehab e faixa ARV válida.

- custo-base = preço + rehab;
- spread de cenário = ARV do cenário − custo-base;
- ROI de cenário = spread ÷ custo-base;
- cenário esperado usa a referência central existente; se ela faltar, usa somente o ponto médio matemático da faixa existente;
- valores monetários são arredondados a milhares e percentuais a uma casa;
- todos carregam `sourceType: CALCULATED`, `scenarioBased: true`, `rounded: true` e disclaimer de não garantia.

Se qualquer entrada obrigatória faltar ou o status for `ARV_UNAVAILABLE`, spread e ROI são `null`; não existe `$0`, AVM substituto ou número inventado.

## Proveniência, imagens e limites

Fontes válidas: `VERIFIED_RECORD`, `USER_PROVIDED`, `CALCULATED`, `ESTIMATED` e `UNKNOWN`. `UNKNOWN` nunca vira hipótese. Campos de property, owner e comparáveis são allowlisted. Imagens de comparáveis não fazem parte do contrato.

PDF, e-mail e compartilhamento continuam em `PREPARED_NOT_RENDERED`. Esta fase não chama RentCast, não cobra Stripe, não define preço nem debita Nuggets.
