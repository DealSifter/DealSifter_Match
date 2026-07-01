# Auth Email Confirmation Checklist

Objetivo: validar o fluxo de confirmacao de email do DealSifter em producao, do signup ate o retorno ao app, evitando erro 404, URL invalida, sessao presa ou reidratacao de dados de outro usuario.

Ambiente alvo:
- App: `https://dealsiftermatch.vercel.app`
- Supabase project: producao
- Fluxo: Supabase Auth email/password signup

## 1. Status da Auditoria no Codigo

### 1.1 URL usada no signup

Status: OK.

Evidencia:
- `src/App.jsx` define `authRedirectUrl` usando `VITE_APP_URL`, depois `window.location.origin`, e fallback `https://dealsiftermatch.vercel.app`.
- `src/hooks/useAuthSession.js` usa `emailRedirectTo: authRedirectUrl` em `supabase.auth.signUp()`.
- `src/App.jsx` usa o mesmo `authRedirectUrl` em `supabase.auth.resend({ type: 'signup' })`.

Comportamento esperado:
- Em producao, o link de confirmacao deve retornar para `https://dealsiftermatch.vercel.app`, sem path quebrado.

### 1.2 Tratamento do callback na URL

Status: OK, com ressalva de UX.

Evidencia:
- `src/lib/supabaseClient.js` usa `detectSessionInUrl: true`.
- `src/main.jsx` detecta callback por `code`, `error` ou hash com `access_token=`.
- `src/App.jsx` usa `isAuthCallbackSettling` para esperar o Supabase processar o callback antes de renderizar o fluxo normal.
- `src/App.jsx` limpa `code`, `type`, `error`, `error_code`, `error_description`, `state` e hash de token da URL depois do processamento.
- `src/hooks/useAuthSession.js` detecta `type=signup` ou `type=email` na query/hash.

Ressalva:
- O comportamento atual para confirmacao de email e forcar logout local e abrir o modal de login. Isso evita reidratacao indevida, mas nao leva o usuario diretamente para feed/onboarding no clique do email.
- Depois que o usuario faz login, `handleAuthenticatedNavigation()` leva para `dashboard`.

Decisao necessaria:
- Se a regra de produto for "confirmou email, depois faz login manual", o codigo atual esta coerente.
- Se a regra for "confirmou email e entra direto no feed/onboarding", o codigo precisa ser alterado.

### 1.3 Protecao contra reidratacao de outro usuario

Status: OK na base atual.

Evidencia:
- `src/hooks/useAuthSession.js` limpa sessao local em callback de confirmacao e chama `signOut`.
- `src/App.jsx` remove `authSession`, marca `ds_last_page` como `landing` e abre login.
- `src/App.jsx` possui efeito de troca de usuario que limpa dados user-scoped quando `supabaseUserId` muda.
- Em modo Supabase configurado, perfis e portfolio iniciam vazios e hidratam do banco pelo usuario autenticado.

Ponto de QA:
- Mesmo com essa protecao, o teste real deve verificar se abrir nova conta com mesmo email apos delete nao traz dados antigos.

## 2. Verificacao no Supabase Auth Dashboard

Esta parte precisa ser conferida no painel do Supabase, porque a CLI atual do projeto nao expõe template de email nem lista completa de Redirect URLs.

Caminho:

1. Acessar Supabase Dashboard.
2. Abrir o projeto de producao.
3. Ir em `Authentication`.
4. Abrir `URL Configuration`.

### 2.1 Site URL

Valor esperado:

```text
https://dealsiftermatch.vercel.app
```

Aceitavel com barra final:

```text
https://dealsiftermatch.vercel.app/
```

Nao recomendado:

```text
https://dealsifter-*.vercel.app
http://localhost:5173
https://algum-preview.vercel.app
```

Observacao:
- localhost pode ficar na allowlist para desenvolvimento, mas o `Site URL` principal de producao deve ser o dominio final.

### 2.2 Redirect URLs Permitidas

Devem existir pelo menos:

```text
https://dealsiftermatch.vercel.app
https://dealsiftermatch.vercel.app/**
```

Recomendado manter tambem, se o Supabase aceitar ambos:

```text
https://dealsiftermatch.vercel.app/
```

Motivo:
- O app usa `window.location.origin`, sem path.
- O wildcard cobre retornos futuros com path, query params ou rotas internas.

### 2.3 Template de Email de Confirmacao

Caminho:

1. `Authentication`.
2. `Email Templates`.
3. Abrir template `Confirm signup` ou `Confirm your signup`.

O link/botao principal deve usar:

```html
{{ .ConfirmationURL }}
```

Exemplo valido:

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

Evitar montar manualmente URLs como:

```html
https://dealsiftermatch.vercel.app/auth/confirm?token={{ .Token }}
```

Motivo:
- `{{ .ConfirmationURL }}` ja e montado pelo Supabase com token, redirect e parametros corretos.
- Montar URL manualmente e uma causa comum de 404 ou token invalido.

## 3. Teste Manual de Signup com Email Real em Producao

### Pre-condicoes

- Usar navegador em janela anonima.
- Usar email real novo, ainda nao cadastrado.
- Confirmar que nao existe sessao antiga no app.
- Ter acesso aos Auth logs do Supabase.

### Passos

1. Abrir `https://dealsiftermatch.vercel.app`.
2. Clicar em signup/criar conta.
3. Informar nome, email real novo e senha valida.
4. Enviar cadastro.
5. Confirmar que o app mostra mensagem para verificar email.
6. Abrir o inbox do email usado.
7. Clicar no botao/link de confirmacao.
8. Observar a URL aberta no navegador.
9. Aguardar o app terminar o processamento.
10. Fazer login, se o app abrir o modal de login.
11. Confirmar destino final apos login.

### Resultado Esperado

No comportamento atual do codigo:

- O link deve abrir `https://dealsiftermatch.vercel.app` com query/hash temporario do Supabase.
- O app nao deve cair em 404.
- O app deve limpar os parametros sensiveis da URL.
- O app deve mostrar login depois da confirmacao.
- Depois do login, o usuario deve ir para `dashboard/feed`.
- O usuario novo deve iniciar sem dados de outro usuario.

Se a regra de produto for entrada automatica:

- O comportamento esperado deve ser alterado para ir direto ao `dashboard/feed` ou `onboarding`.
- Nesse caso, o codigo atual deve ser considerado gap funcional.

## 4. O Que Verificar nos Supabase Auth Logs

Caminho:

1. Supabase Dashboard.
2. Projeto de producao.
3. `Authentication`.
4. `Logs`.

Filtrar por:

- email do usuario testado;
- horario do signup;
- eventos de signup;
- eventos de confirmation;
- erros de redirect;
- erros de token.

### Sinais de Sucesso

- Usuario criado em Auth.
- Email de confirmacao enviado.
- Evento de verificacao/confirmacao sem erro.
- Campo `email_confirmed_at` preenchido para o usuario.

### Sinais de Problema

- Redirect URL nao permitida.
- Token expired.
- Token already used.
- Usuario nao encontrado.
- Erro de template.
- Link enviado apontando para dominio antigo ou preview Vercel.
- Link enviado sem `ConfirmationURL`.

## 5. Como Identificar se o Usuario Chegou na URL Correta

Durante o teste, observar a barra do navegador logo apos clicar no email.

URLs aceitaveis:

```text
https://dealsiftermatch.vercel.app/?code=...
https://dealsiftermatch.vercel.app/#access_token=...
https://dealsiftermatch.vercel.app/?type=signup...
```

Depois do processamento, a URL deve voltar para:

```text
https://dealsiftermatch.vercel.app/
```

ou outra rota limpa do app, sem tokens visiveis.

Nao aceitavel:

```text
https://dealsiftermatch.vercel.app/auth/confirm
https://dealsiftermatch.vercel.app/confirm
https://deal-sifter-match.vercel.app/...
https://<preview-antigo>.vercel.app/...
http://localhost:5173/...
```

## 6. Casos de Edge

### 6.1 Link Expirado

Como testar:

1. Criar conta.
2. Esperar o tempo de expiracao configurado no Supabase.
3. Clicar no link antigo.

Resultado esperado:
- App nao deve quebrar.
- Supabase deve retornar erro de token expirado.
- Usuario deve conseguir solicitar novo email de confirmacao.

Onde verificar:
- Auth logs.
- Toast/mensagem no app.
- Estado do usuario em Auth ainda sem `email_confirmed_at`.

### 6.2 Link Ja Usado

Como testar:

1. Confirmar email uma vez.
2. Clicar no mesmo link novamente.

Resultado esperado:
- App nao deve cair em 404.
- Supabase pode indicar token usado/invalido.
- Usuario deve conseguir fazer login normalmente.

Onde verificar:
- Auth logs.
- Campo `email_confirmed_at` ja preenchido.

### 6.3 Email Ja Cadastrado

Como testar:

1. Tentar signup com email ja existente.

Resultado esperado:
- App deve mostrar erro claro ou instruir login.
- Nao deve criar novo usuario duplicado.
- Nao deve sobrescrever perfil/portfolio existente.

Onde verificar:
- Auth users no Supabase.
- Tabela `users`.
- Ausencia de novos registros duplicados para o mesmo email.

### 6.4 Conta Deletada e Recriada com Mesmo Email

Como testar:

1. Deletar uma conta pelo fluxo de account deletion.
2. Criar nova conta com o mesmo email.
3. Confirmar email.
4. Fazer login.

Resultado esperado:
- Novo usuario com novo `user_id`.
- Saldo zero.
- Sem historico anterior.
- Sem cards antigos no feed.
- Dados antigos permanecem apenas como auditoria anonimizada.

Onde verificar:
- `account_deletions`.
- `users`.
- perfis e portfolio.
- feed global.

## 7. Checklist Rapido de Aceite

- Site URL do Supabase Auth aponta para `https://dealsiftermatch.vercel.app`.
- Redirect URLs incluem `https://dealsiftermatch.vercel.app` e `https://dealsiftermatch.vercel.app/**`.
- Template de confirmacao usa `{{ .ConfirmationURL }}`.
- Signup com email real envia email.
- Link nao abre 404.
- URL volta limpa apos processamento.
- Usuario confirmado consegue login.
- Login leva para dashboard/feed ou onboarding conforme regra final de produto.
- Usuario novo nao reidrata dados de outro usuario.
- Link expirado e link ja usado falham de forma controlada.

## 8. Achado Principal

O codigo atual trata callbacks de email confirmation e protege contra reidratacao indevida. O ponto que precisa de decisao e o destino apos confirmacao:

- Atual: confirmar email -> app limpa sessao -> abre login -> login leva ao dashboard/feed.
- Requisito alternativo: confirmar email -> entrar direto no feed/onboarding.

Antes de producao, escolha uma regra e teste exatamente essa regra com email real.
