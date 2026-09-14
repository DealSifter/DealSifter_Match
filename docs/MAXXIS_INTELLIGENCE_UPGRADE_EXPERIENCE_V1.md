# Maxxis Intelligence Upgrade Experience v1

## Objetivo

Apresentar progressivamente os níveis de inteligência disponíveis sem linguagem agressiva, preço inventado ou exposição de dados premium. A mensagem central é: **Unlock deeper investment intelligence when you need it.**

## Níveis e permissões

| Plano | Property Release | Maxxis Analysis | Maxxis Deal Intelligence |
| --- | --- | --- | --- |
| Free | Incluído | Disponível com upgrade | Disponível com upgrade |
| Pro | Incluído | Incluído | Disponível com upgrade |
| Enterprise | Incluído | Incluído | Incluído e aberto diretamente |

Um entitlement pontual ativo também permite acesso direto ao report correspondente. Toda decisão reutiliza o resolver canônico `resolveIntelligenceReportAccess` e falha fechada.

## Fluxos

- Export/Free: apresenta Property Release já disponível e as opções Maxxis Analysis e Deal Intelligence.
- Pro: informa que Maxxis Analysis já faz parte do plano e apresenta apenas o aprofundamento Deal Intelligence.
- Enterprise: abre o conteúdo autorizado diretamente, sem modal comercial.
- Chat: intenções premium são verificadas antes da chamada analítica. Sem acesso, a conversa recebe apenas o modelo seguro de upgrade.

## Conteúdo do preview

O preview informa apenas nomes de capacidades — Comparable Analysis, ARV Intelligence e Investment Scenarios. Nenhum valor, evidência, comparable, ARV ou cenário real é incluído antes da autorização.

## Fundação futura

O contrato reconhece `SUBSCRIPTION` e `ONE_TIME_UNLOCK`, mas não contém preço, cobrança, débito ou mutação. Integrações futuras com planos ou Nuggets exigirão implementação e autorização próprias.

## Segurança

- `premiumPayload` permanece `null` no modelo de upgrade.
- Nenhum payload premium é projetado antes da autorização.
- Não há chamada RentCast, Stripe, Nuggets ou rede.
- Não há modificação dos motores ARV, Comp, Match, Deal Metrics ou Property Evidence.
- Valores desconhecidos não são simulados.
