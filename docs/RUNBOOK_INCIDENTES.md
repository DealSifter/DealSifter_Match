# Runbook De Incidentes DealSifter

Este runbook cobre os incidentes operacionais minimos para o soft launch/producao. Use sempre o principio: Stripe e Supabase sao fontes de verdade; frontend/localStorage nunca deve ser usado para reconciliacao financeira.

## 1. Usuario comprou e nao recebeu nuggets

### Sintomas

- Usuario concluiu Stripe Checkout.
- Saldo no app nao aumentou depois de alguns minutos.
- AdminDashboard pode mostrar evento Stripe pendente, ignorado ou falho.

### Verificar no Stripe

1. Abra Stripe Dashboard > Payments ou Checkout Sessions.
2. Localize pelo email do cliente, valor ou horario informado.
3. Confirme que a sessao esta `paid`/`complete`.
4. Copie:
   - `checkout.session.id`
   - `payment_intent.id`
   - `customer.id`
   - metadata `user_id` e `pack_id`

### Verificar no Supabase

No SQL Editor:

```sql
select *
from stripe_events_log
where event_type = 'checkout.session.completed'
order by received_at desc
limit 20;
```

```sql
select *
from nugget_purchases
where stripe_checkout_session_id = '<checkout.session.id>'
   or stripe_payment_id = '<payment_intent.id>';
```

```sql
select id, email, nuggets, plan
from users
where id = '<user_id>';
```

### Reprocessar

1. No AdminDashboard, confira o badge de fila Stripe.
2. Clique em `Reprocessar fila Stripe`.
3. Aguarde alguns segundos e atualize o saldo do usuario.
4. Se nao houver evento na fila, confira se o webhook do Stripe foi entregue.

### Reconciliacao manual

Use somente se:

- Stripe confirma pagamento completo.
- `nugget_purchases` nao tem registro.
- O webhook nao pode ser reprocessado.

Passos:

1. Inserir o registro em `nugget_purchases` com o identificador correto.
2. Creditar via RPC de banco, nunca pelo frontend:

```sql
select credit_nuggets('<user_id>', <quantidade_total>);
```

3. Registrar a acao no log administrativo/release note do incidente.

## 2. Webhook Stripe com eventos stuck

### Identificar eventos stuck

```sql
select *
from stripe_event_reprocess_queue
where status in ('pending', 'processing', 'failed')
order by scheduled_for asc, updated_at asc;
```

```sql
select *
from stripe_events_processed
where status in ('claimed', 'queued', 'failed')
order by updated_at desc;
```

```sql
select *
from stripe_events_log
where processed = false
order by received_at desc
limit 50;
```

### Acionar reprocessamento

1. AdminDashboard > botao `Reprocessar fila Stripe`.
2. Confirmar retorno com `processed`, `retried`, `failed` e `skipped`.
3. Reconsultar `stripe_event_reprocess_queue`.

### Se continuar stuck

1. Abrir o evento no Stripe Dashboard.
2. Confirmar se o payload possui metadata esperada (`user_id`, `plan_id`, `pack_id`).
3. Verificar `skip_reason` em `stripe_events_log`.
4. Se for evento fora de ordem:
   - aguarde a chegada do evento anterior;
   - rode o reprocessamento novamente;
   - se o `created/updated` nunca chegar, ignore o delete enfileirado ou reconcilie assinatura manualmente.

### Reconciliacao manual de assinatura

```sql
select *
from subscriptions
where user_id = '<user_id>'
order by updated_at desc;
```

Depois de confirmar no Stripe:

- Se ativa: ajustar `subscriptions.status`, `plan_id`, `current_period_start`, `current_period_end` e `users.plan`.
- Se cancelada: marcar `subscriptions.status = 'canceled'` e `users.plan = 'free'`.

## 3. Usuario nao consegue confirmar email

### Verificar configuracao Auth

No Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://dealsiftermatch.vercel.app`
- Redirect URLs:
  - `https://dealsiftermatch.vercel.app`
  - `https://dealsiftermatch.vercel.app/**`

No template de confirmacao de email:

- O link deve usar `{{ .ConfirmationURL }}`.

### Verificar logs

Supabase Dashboard > Authentication > Logs:

1. Filtrar pelo email do usuario.
2. Confirmar se o email foi enviado.
3. Conferir erro de redirect, token expirado ou link ja usado.

### Diagnostico de URL

O usuario deve chegar em:

- `https://dealsiftermatch.vercel.app/...`
- com `code` na query string ou token/hash de auth conforme Supabase.

Se cair em 404:

- conferir Redirect URLs;
- conferir se o dominio usado no email e exatamente o dominio de producao;
- pedir novo email de confirmacao, pois links antigos podem expirar.

### Casos comuns

- Link expirado: pedir novo signup/login magic link ou reenviar confirmacao.
- Link ja usado: orientar login normal.
- Email ja cadastrado: orientar login/recuperacao de senha, nao novo signup.

## 4. Erro 500 em Edge Function

### Onde ver logs

Supabase Dashboard > Edge Functions > selecione a function > Logs.

Functions criticas:

- `stripe-webhook`
- `stripe-reprocess-queue`
- `create-checkout-session`
- `create-portal-session`
- functions de account/delete se em uso

### Checklist tecnico

1. Verificar se a function recebeu request.
2. Verificar status e mensagem.
3. Conferir secrets:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
   - `ANON_KEY` quando aplicavel
4. Conferir CORS se o erro veio do navegador.
5. Conferir migrations pendentes se o erro for coluna/tabela/RPC inexistente.

### Rollback de function

1. Identificar ultimo commit funcional.
2. Reverter a alteracao da function no Git.
3. Deploy somente da function afetada:

```powershell
supabase functions deploy <nome-da-function>
```

4. Testar endpoint com fluxo real ou payload controlado.
5. Registrar no incidente o commit revertido e a causa.

## 5. Build quebrado na Vercel

### Checklist rapido

1. Abrir Vercel > Project > Deployments > deployment falho.
2. Conferir se falhou em install, build ou runtime.
3. Confirmar branch usada (`main` para producao, `dev` para desenvolvimento se configurado).
4. Confirmar autor do commit/email do GitHub se o deploy foi bloqueado por permissao.

### Variaveis de ambiente obrigatorias

No Vercel > Settings > Environment Variables > Production:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_STRIPE_PRICE_P5`
- `VITE_STRIPE_PRICE_P15`
- `VITE_STRIPE_PRICE_P40`
- `VITE_STRIPE_PRICE_P100`
- `VITE_STRIPE_PRICE_PLAN_PRO`
- `VITE_STRIPE_PRICE_PLAN_ENTERPRISE`
- `VITE_SENTRY_DSN` quando Sentry estiver ativo

### Preview vs producao

- Preview pode usar variaveis diferentes ou ausentes.
- Validar sempre o ambiente exibido no deployment.
- Se variavel foi alterada, fazer novo deploy; deployments antigos nao recebem env nova automaticamente.

### Se o build local passa e Vercel falha

1. Conferir versao Node configurada na Vercel.
2. Conferir se `package-lock.json` foi commitado.
3. Conferir imports case-sensitive: Windows aceita alguns caminhos que Linux da Vercel rejeita.
4. Conferir logs completos antes de alterar codigo.

## 6. Observabilidade

### Sentry frontend

O frontend usa `VITE_SENTRY_DSN`. Sem essa variavel, a integracao fica inativa.

Captura esperada:

- Erros globais de runtime.
- Erros de chunk loading.
- Rejections nao tratadas.
- Erros reportados pelo ErrorBoundary.
- Erros de checkout Stripe.
- Erros de unlock/exclusividade com contexto tecnico: `user_id`, `action`, `nugget_cost`.

Nao capturar:

- senhas;
- tokens;
- chaves Stripe/Supabase;
- email, telefone, nome, avatar, foto ou endereco.

### Logs Stripe

`stripe-webhook` deve emitir log JSON com:

- `event_id`
- `event_type`
- `status`
- `duration_ms`
- `skip_reason` quando aplicavel

Falhas tambem devem aparecer em `stripe_events_log.skip_reason` com stack trace truncado.
