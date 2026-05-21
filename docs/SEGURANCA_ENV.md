# Proteção de chaves (passo a passo)

## O que fica onde

| Arquivo | Vai para o GitHub? | Conteúdo |
|---------|-------------------|----------|
| `.env.example` | Sim | Só placeholders (modelo) |
| `.env.local` | **Não** | Suas chaves reais para desenvolvimento |
| Vercel → Environment Variables | Não (painel) | `VITE_*` para produção |
| Supabase → Edge Functions → Secrets | Não (painel) | `STRIPE_SECRET_KEY`, `SERVICE_ROLE`, webhooks |

## Configurar na Vercel (produção)

1. https://vercel.com → seu projeto → **Settings** → **Environment Variables**
2. Cole cada variável **`VITE_`** do seu `.env.local` (não cole `STRIPE_SECRET_KEY` nem `SUPABASE_SERVICE_ROLE_KEY`).
3. **Redeploy** após salvar.

## Configurar no Supabase (funções / webhooks)

1. https://supabase.com/dashboard → seu projeto → **Edge Functions** → **Secrets**
2. Adicione: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (se o script pedir).

## Rotacionar chaves (obrigatório se vazaram no GitHub)

Chaves que já apareceram em `.env.example` no Git devem ser **trocadas**:

### Supabase
1. Dashboard → **Settings** → **API**
2. **Reset** na chave **service_role** (gera nova; atualize `.env.local` e secrets das Edge Functions)
3. A chave **anon** é pública no frontend; rotacione se quiser mais segurança

### Stripe
1. https://dashboard.stripe.com/apikeys
2. **Roll key** na Secret key (`sk_live_...`) → atualize Supabase secrets e `.env.local`
3. Crie novo **Webhook signing secret** se necessário → atualize `STRIPE_WEBHOOK_SECRET`

### Depois de rotacionar
- Atualize `.env.local`
- Atualize variáveis na **Vercel** e **Supabase**
- **Redeploy** na Vercel

## Copiar modelo local

```powershell
Copy-Item .env.example .env.local
# Edite .env.local e cole os valores reais (nunca commite .env.local)
```
