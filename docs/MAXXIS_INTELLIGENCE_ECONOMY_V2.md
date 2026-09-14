# Maxxis Intelligence Economy v2

## Princípio comercial

O usuário não paga para revelar dados escondidos. A oferta é de maior profundidade analítica: **Use the intelligence you need when you need it, or upgrade your plan for ongoing access.** A cobrança deve ocorrer futuramente pela geração de inteligência, nunca por perguntas, releitura ou conversa sobre uma análise já adquirida.

## Catálogo de capacidades

| Capability | Escopo | Unlock avulso modelado | Relatório |
|---|---|---:|---|
| PROPERTY_RELEASE | Card, fotos existentes, localização e informações cadastradas | 0 Nuggets | Free Export |
| MAXXIS_ANALYSIS | Executive Summary, alinhamento ao perfil, riscos, limitações e próximos passos | 3 Nuggets | Pro Report |
| DEAL_INTELLIGENCE | Maxxis Analysis, comparáveis, valuation evidence, ARV, KPIs, confidence e Investor Report | 5 Nuggets | Enterprise Report |

Os valores são parte do catálogo comercial. A execução de unlock e o débito permanecem desativados.

## Matriz de assinatura

| Plano | Incluído | Unlock opcional modelado |
|---|---|---|
| FREE | Property Release | Maxxis Analysis; Deal Intelligence |
| PRO | Property Release; Maxxis Analysis | Deal Intelligence |
| ENTERPRISE | Todos os níveis | Nenhum |

## UX de upgrade

- FREE vê que já possui Property Release e pode comparar as ofertas de 3 e 5 Nuggets, além dos planos de acesso contínuo.
- PRO vê Maxxis Analysis como incluído e Deal Intelligence por 5 Nuggets ou Enterprise.
- ENTERPRISE entra diretamente, sem oferta.
- A interface mostra escopo e custo, mas não concede entitlement nem executa transação.

## Entitlements e uso

`IntelligenceUsageEvent` modela `userId`, capability, source, timestamp e entitlement type (`SUBSCRIPTION_INCLUDED` ou `ONE_TIME_UNLOCK`). Nesta fase ele é somente um contrato imutável: não persiste, não cobra e não concede acesso.

O runtime só libera premium quando recebe entitlement server-side já válido. Uma intenção ou oferta de unlock não é entitlement. Releituras de conteúdo adquirido têm custo zero.

## Integrações futuras

- Assinaturas: FREE, PRO e ENTERPRISE.
- SKUs futuros: `MAXXIS_ANALYSIS_UNLOCK` e `DEAL_INTELLIGENCE_UNLOCK`.
- O fluxo futuro deverá ser confirmação explícita → débito atômico server-side → entitlement persistente → geração → usage event.
- Falha em qualquer etapa deverá ser fail-closed e idempotente.

## Estado de segurança desta versão

`oneTimeUnlockExecutionEnabled`, `nuggetDebitEnabled` e `stripeEnabled` estão todos `false`. Não há chamada a Stripe, mutação de saldo, criação de entitlement, RentCast ou alteração de motores. Não houve migration nem deploy.
