# Maxxis Runtime Entitlement Enforcement v1

## Objetivo

O backend `maxxis-chat` é a autoridade final para acesso aos níveis de inteligência. Controles do frontend continuam sendo UX, mas não concedem acesso nem substituem a decisão do servidor.

## Fluxo

```text
requisição autenticada
  -> valida JWT e identifica user_id
  -> lê a assinatura do próprio usuário sob RLS
  -> infere a capability pelo pedido e pelo contexto confiável
  -> MaxxisRuntimeEntitlementGuard (ALLOW / DENY)
  -> somente em ALLOW: monta contexto, chama Gemini e/ou executa tool
```

Uma segunda checagem é executada imediatamente antes de tools premium. Assim, mesmo seleção inesperada do modelo ou manipulação do payload frontend não libera o motor de Deal Intelligence.

## Matriz server-side

| Plano | Property Release | Maxxis Analysis | Deal Intelligence |
|---|---:|---:|---:|
| FREE | ALLOW | DENY | DENY |
| PRO | ALLOW | ALLOW | DENY |
| ENTERPRISE | ALLOW | ALLOW | ALLOW |

Assinatura ausente é tratada como FREE. Erro ao ler a assinatura é `ENTITLEMENT_MISSING` e falha fechado. Somente assinaturas `active` ou `trialing` fornecem seu plano; qualquer outro estado é rebaixado a FREE.

## Respostas seguras

- `UNAUTHENTICATED`: identidade ausente ou inválida.
- `ENTITLEMENT_MISSING`: o backend não conseguiu verificar o acesso.
- `INSUFFICIENT_PLAN`: plano válido, mas abaixo da capability solicitada.
- `CAPABILITY_NOT_AVAILABLE`: capability inválida ou indisponível.
- `ACCESS_REQUIRED`: envelope HTTP de uma solicitação reconhecida e negada, contendo somente capability, nível atual e upgrade necessário.

Nenhuma resposta de negação inclui property payload, evidência, ARV, comparáveis, cenários, KPIs ou seções de Deal Intelligence.

## Segurança e observabilidade

Os logs registram apenas `user_id` interno, capability e resultado. Não registram endereço, dados imobiliários, conteúdo de relatório ou payload premium. O gate ocorre antes da construção do prompt e da primeira chamada Gemini; tools premium possuem uma defesa adicional antes de qualquer consulta de dados.

## One-time unlock futuro

O contrato aceita entitlements pontuais, mas esta versão fornece lista vazia no runtime. `ONE_TIME_UNLOCK` permanece apenas como ponto de extensão: não há preço, cobrança, débito de Nuggets, Stripe ou concessão automática ativados.

## Fora do escopo

Nenhuma alteração foi feita nos motores de ARV, comparáveis, Match Score, Deal Metrics, Property Evidence, RentCast ou schemas de relatório. Não houve migration nem deploy.
