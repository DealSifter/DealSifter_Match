# DealSifter Dev/Production Workflow

> **R0 authority:** for Repairs R1-R8, `docs/REPAIR_RELEASE_PROTOCOL.md` supersedes historical branch and target instructions in this document. The Supabase CLI is currently linked to staging (`oqdcnjupquhybwdbeeew`), not production. Every remote operation must provide an explicit target/project ref.

Este fluxo separa producao e desenvolvimento sem depender de cliques manuais.

## Branches

- `main`: producao no Vercel.
- `dev`: desenvolvimento/preview no Vercel.
- `safe-push`: branch local historica usada para enviar hotfixes para `main`.

## Estado inicial ja configurado

- A branch `dev` foi criada a partir de `origin/main`.
- A branch `dev` foi publicada em `origin/dev`.
- O projeto Vercel ja esta vinculado em `.vercel/project.json`.
- O Supabase CLI esta atualmente vinculado ao staging `oqdcnjupquhybwdbeeew`. Esse link nao e autoridade de release e nao deve ser alterado implicitamente para executar um Repair.

## Trabalhar em desenvolvimento

Use quando a mudanca for refatoracao, layout responsivo, otimizacao, nova feature ou qualquer coisa que nao deve ir direto para producao.

```powershell
.\scripts\workflow-dev-start.ps1
```

Depois de editar:

```powershell
npm run lint
npm run test
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
npm run lint
npm run test
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

## Supabase E Mudancas De Contrato

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

### Ordem Obrigatoria Para Mudancas De RPC/Entitlement

Quando o frontend passa a enviar um novo parametro de RPC ou depende de nova coluna/funcao, a ordem nao pode ser invertida:

1. Revisar a migration e o impacto de RLS.
2. Aplicar a migration no Supabase de producao.
3. Confirmar a RPC diretamente no SQL/Supabase Studio com dados de teste.
4. Rodar `npm run lint`, `npm run test` e `npm run build` no frontend.
5. Publicar a branch no Vercel.
6. Executar o QA funcional correspondente apos o deploy.

Regra especial de perfis e unlocks: a migration `20260729000001_profile_scoped_unlock_entitlements.sql` deve estar aplicada antes de publicar codigo que chama `ds_create_unlock_intent` ou `ds_purchase_contact_unlock` com `p_profile_scope`. Publicar o frontend primeiro quebra o fluxo de unlock por incompatibilidade de contrato.

### Validacao Minima Pos-Migration

Para uma conta com mais de um perfil, confirmar que:

- `ds_get_unlocked_contact_cards(p_user_id)` devolve registros separados por `owner_id` e `primary_profile`.
- O custo de unlock considera somente o portfolio do perfil selecionado.
- Um unlock de um perfil nao libera os outros perfis da mesma conta.
- Desktop e mobile mostram o mesmo entitlement apos refresh.

## Regra de seguranca

- Mudanca visual/codigo comum: `dev`.
- Hotfix pequeno aprovado: `safe-push -> main`.
- Migracao Supabase: somente quando a mudanca depender de DB e apos confirmar impacto.
- Mudanca de RPC: migracao primeiro, frontend depois; nunca fazer deploy parcial de contrato.
- Novo Supabase separado para dev: recomendado no futuro, mas nao criado automaticamente para evitar custo e risco de limite.

