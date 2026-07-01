# Runbook Stripe - Webhooks e Reprocessamento de Fila

Objetivo: orientar a operacao quando eventos Stripe chegarem fora de ordem, ficarem pendentes na fila `stripe_event_reprocess_queue` ou precisarem de reconciliacao manual.

## 1. Quando Usar Este Runbook

Use este procedimento quando:

- AdminDashboard mostrar eventos pendentes na fila Stripe.
- O KPI `Stripe webhook skips` aumentar.
- Um usuario pagou no Stripe, mas o saldo/plano nao refletiu no app.
- Uma assinatura foi cancelada no Stripe, mas continua ativa no DealSifter.
- A tabela `stripe_event_reprocess_queue` tiver eventos `pending`, `processing` antigo ou `failed`.

## 2. Reprocessamento Manual Pelo AdminDashboard

Pre-condicoes:
- Usuario logado como admin.
- Supabase Functions publicadas.
- Edge Function `stripe-reprocess-queue` implantada.
- Secrets Stripe/Supabase corretos nas Edge Functions.

Passos:

1. Entrar no app com uma conta admin.
2. Abrir `AdminDashboard`.
3. Conferir o badge no botao `Reprocessar fila Stripe`.
4. Se o badge for maior que zero, clicar em `Reprocessar fila Stripe`.
5. Aguardar o resumo exibido na tela.
6. Clicar em `Refresh`.
7. Confirmar se a contagem de pendentes zerou ou diminuiu.

Resultado esperado:
- Eventos validos mudam para `processed`.
- Eventos ainda nao reconciliaveis voltam para `pending` com nova agenda, ate 3 tentativas.
- Eventos que falharem apos 3 tentativas mudam para `failed`.
- Erros sao registrados em `stripe_events_log`.

## 3. O Que a Edge Function Faz

Function: `supabase/functions/stripe-reprocess-queue/index.ts`

Fluxo:

1. Valida token do usuario.
2. Confirma permissao admin via `ds_is_current_user_admin`.
3. Chama o processador Stripe compartilhado.
4. Busca ate 10 eventos pendentes.
5. Usa `claim_stripe_reprocess_queue()` no banco, com `SELECT FOR UPDATE SKIP LOCKED`.
6. Reexecuta a mesma logica de processamento usada pelo webhook.
7. Marca evento como:
   - `processed`, se resolveu;
   - `pending`, se ainda deve tentar de novo;
   - `failed`, se completou 3 tentativas sem sucesso;
   - `skipped`, se o evento nao e suportado ou esta fora de ordem de forma definitiva.

## 4. Como Identificar Eventos Stuck

Consultar eventos pendentes vencidos:

```sql
select
  stripe_event_id,
  event_type,
  status,
  attempts,
  scheduled_for,
  last_error,
  updated_at
from public.stripe_event_reprocess_queue
where status = 'pending'
  and scheduled_for <= now()
order by scheduled_for asc;
```

Consultar eventos em processing por tempo demais:

```sql
select
  stripe_event_id,
  event_type,
  status,
  attempts,
  scheduled_for,
  last_error,
  updated_at
from public.stripe_event_reprocess_queue
where status = 'processing'
  and updated_at < now() - interval '10 minutes'
order by updated_at asc;
```

Consultar falhas recentes:

```sql
select
  stripe_event_id,
  event_type,
  status,
  attempts,
  last_error,
  updated_at
from public.stripe_event_reprocess_queue
where status = 'failed'
order by updated_at desc
limit 25;
```

Consultar logs Stripe nao processados:

```sql
select
  event_id,
  event_type,
  received_at,
  processed,
  skip_reason
from public.stripe_events_log
where processed = false
order by received_at desc
limit 50;
```

## 5. Como Destravar Evento em Processing Antigo

Se uma chamada falhou no meio e deixou evento em `processing` por mais de 10 minutos:

```sql
update public.stripe_event_reprocess_queue
set
  status = 'pending',
  scheduled_for = now(),
  available_at = now(),
  last_error = coalesce(last_error, 'Reset manually from stale processing state'),
  updated_at = now()
where status = 'processing'
  and updated_at < now() - interval '10 minutes';
```

Depois disso:

1. Voltar ao AdminDashboard.
2. Clicar em `Reprocessar fila Stripe`.
3. Confirmar se o evento passou para `processed` ou `failed`.

## 6. Reconciliacao Manual: Pagamento de Nuggets

Quando usar:
- Stripe mostra checkout/payment concluido.
- DealSifter nao creditou nuggets.
- Webhook/fila falhou definitivamente.

Passos:

1. No Stripe Dashboard, localizar o `checkout.session.completed`.
2. Confirmar:
   - `metadata.user_id`;
   - `metadata.pack_id`;
   - `payment_intent`;
   - valor pago.
3. No banco, verificar se ja existe compra:

```sql
select *
from public.nugget_purchases
where stripe_checkout_session_id = '<checkout_session_id>'
   or stripe_payment_id = '<payment_intent_id>';
```

4. Se nao existir, inserir compra e creditar nuggets usando a mesma quantidade do pack.
5. Registrar a acao em nota operacional/admin antes de comunicar o usuario.

Importante:
- Nunca creditar manualmente sem confirmar pagamento concluido no Stripe.
- Nunca duplicar credito se `nugget_purchases` ja tiver o mesmo checkout/payment.

## 7. Reconciliacao Manual: Assinatura

Quando usar:
- Stripe mostra assinatura ativa/cancelada.
- DealSifter mostra plano divergente.

Passos:

1. No Stripe Dashboard, localizar a subscription.
2. Confirmar:
   - `subscription.id`;
   - `customer`;
   - status;
   - `metadata.user_id`;
   - `metadata.plan_id`;
   - periodo atual.
3. No banco, consultar:

```sql
select *
from public.subscriptions
where stripe_sub_id = '<stripe_subscription_id>'
   or user_id = '<user_id>';
```

4. Ajustar `subscriptions` e `users.plan_id` apenas para refletir exatamente o Stripe.
5. Registrar observacao operacional.

## 8. Checklist Pos-Reprocessamento

Depois de reprocessar:

- AdminDashboard sem badge pendente.
- `stripe_event_reprocess_queue` sem `pending` vencido.
- `stripe_events_log` sem erro novo para o mesmo evento.
- Stripe Dashboard e banco concordam.
- Usuario afetado ve saldo/plano correto apos refresh/login novo.

## 9. Escalonamento

Escalar para correcao de codigo quando:

- O mesmo tipo de evento falha repetidamente.
- Eventos ficam em `processing` com frequencia.
- A fila volta a crescer apos reprocessamento.
- Reconciliacao manual seria necessaria para mais de um usuario.

Nesses casos, nao abrir producao ampla ate identificar a causa raiz.
