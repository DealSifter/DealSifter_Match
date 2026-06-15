# DealSifter Dev/Production Workflow

Este fluxo separa producao e desenvolvimento sem depender de cliques manuais.

## Branches

- `main`: producao no Vercel.
- `dev`: desenvolvimento/preview no Vercel.
- `safe-push`: branch local historica usada para enviar hotfixes para `main`.

## Estado inicial ja configurado

- A branch `dev` foi criada a partir de `origin/main`.
- A branch `dev` foi publicada em `origin/dev`.
- O projeto Vercel ja esta vinculado em `.vercel/project.json`.
- O Supabase local esta vinculado ao projeto `cyeipfskwwisbbayyaca`.

## Trabalhar em desenvolvimento

Use quando a mudanca for refatoracao, layout responsivo, otimizacao, nova feature ou qualquer coisa que nao deve ir direto para producao.

```powershell
.\scripts\workflow-dev-start.ps1
```

Depois de editar:

```powershell
npm run build
git add <arquivos>
git commit -m "Descricao curta da mudanca"
git push origin dev
```

O Vercel deve gerar um Preview Deployment da branch `dev`.

## Hotfix seguro de producao

Use somente para correcao pequena e urgente que precisa ir para usuarios reais.

```powershell
.\scripts\workflow-prod-hotfix-start.ps1
```

Depois de editar:

```powershell
npm run build
git add <arquivos>
git commit -m "Descricao curta do hotfix"
git push origin safe-push:main
```

## Promover dev para producao

Use apenas depois de testar o Preview da branch `dev`.

```powershell
.\scripts\workflow-promote-dev-to-main.ps1
```

O script faz merge de `dev` em `safe-push` e envia para `main`.

## Vercel via CLI

Ver deployments:

```powershell
npx -y vercel ls
```

Ver variaveis:

```powershell
npx -y vercel env ls
```

Adicionar variavel somente no Preview:

```powershell
"valor" | npx -y vercel env add NOME_DA_VARIAVEL preview
```

Adicionar variavel somente em Producao:

```powershell
"valor" | npx -y vercel env add NOME_DA_VARIAVEL production
```

## Supabase

Por seguranca, nao rode migracoes no Supabase automaticamente durante refatoracoes visuais.

Checar projeto vinculado:

```powershell
Get-Content supabase\.temp\project-ref
```

Listar migracoes aplicadas:

```powershell
supabase migration list --password "SUA_SENHA_POSTGRES"
```

Aplicar migracoes no projeto vinculado:

```powershell
supabase db push --password "SUA_SENHA_POSTGRES"
```

## Regra de seguranca

- Mudanca visual/codigo comum: `dev`.
- Hotfix pequeno aprovado: `safe-push -> main`.
- Migracao Supabase: somente quando a mudanca depender de DB e apos confirmar impacto.
- Novo Supabase separado para dev: recomendado no futuro, mas nao criado automaticamente para evitar custo e risco de limite.

