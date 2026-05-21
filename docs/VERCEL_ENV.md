# Variáveis de ambiente na Vercel (DealSifter Match)

O frontend é **Vite**: só variáveis expostas no build entram no app. Use sempre o prefixo **`VITE_`** na Vercel.

## Obrigatórias para login (Supabase)

| Variável | Exemplo |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://cyeipfskwwisbbayyaca.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | chave **anon** / **public** do Supabase |

> Também aceito no build: `SUPABASE_URL` e `SUPABASE_ANON_KEY` (sem prefixo), se você já tiver criado assim na Vercel.

## Recomendadas

| Variável | Uso |
|----------|-----|
| `VITE_APP_URL` | URL do deploy (`https://seu-projeto.vercel.app`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Checkout Stripe |
| `VITE_STRIPE_PRICE_*` | IDs de preço Stripe |

## Não colocar na Vercel (frontend)

- `STRIPE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Essas ficam no **Supabase** (Edge Functions / secrets).

## Supabase Auth — URLs permitidas

No [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**:

1. **Site URL**: sua URL da Vercel (ex. `https://deal-sifter-match.vercel.app`)
2. **Redirect URLs**: adicione a mesma URL e `https://*.vercel.app` se usar previews

## Depois de alterar variáveis

**Deployments** → último deploy → **Redeploy** (obrigatório: o Vite embute as variáveis no `npm run build`).
