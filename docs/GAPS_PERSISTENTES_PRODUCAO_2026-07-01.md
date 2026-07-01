# DealSifter - Gaps Persistentes para Inicio de Producao

Data da auditoria: 2026-07-01

Base analisada:
- `docs/LOGICA_FLUXOS_FUNCIONALIDADES.md`
- Codigo atual em `src/`
- Edge Functions e migrations atuais em `supabase/`
- Estado local do repositorio apos os ajustes recentes

Observacao: este levantamento foi feito por auditoria estatica do codigo e das migrations. Ele nao substitui uma rodada final de testes ponta a ponta em producao com usuarios reais, Stripe live, Supabase Auth e dispositivos iOS/Android.

## 1. Resumo Executivo

O app esta muito mais perto de producao do que no relatorio anterior. Os principais bloqueadores conceituais foram enderecados: custo de unlock com snapshot/token, webhooks Stripe com idempotencia, normalizacao central de cards, delecao de conta com auditoria, realtime de chat/unlocks e melhor separacao inicial de responsabilidades.

Ainda assim, existem gaps persistentes importantes. O maior risco remanescente nao e uma funcionalidade isolada, mas a combinacao de:

- `App.jsx` ainda concentrando muita regra operacional.
- Muitos estados sensiveis ainda com fallback/localStorage.
- Falta de testes E2E automatizados para os fluxos criticos.
- Operacao de producao ainda sem runbook, monitoramento externo e rotina clara de reprocessamento/alerta.
- Necessidade de QA real em iPhone/Safari e fluxo Supabase Auth por email.

Minha classificacao atual: o app pode entrar em fase de pre-producao/soft launch controlado, mas ainda nao recomendo abrir para trafego amplo antes de fechar os gaps P0 e validar os P1 principais.

## 2. Pontos Ja Resolvidos ou Parcialmente Resolvidos

### 2.1 Custo de desbloqueio com snapshot

Status: resolvido na base principal, com ressalvas de UX.

Evidencias:
- `src/services/unlockService.js` centraliza chamadas RPC de unlock.
- `supabase/migrations/20260630000004_unlock_intent_tokens.sql` cria `unlock_intents`.
- `App.jsx` cria intent no clique de desbloqueio, guarda token e valida mudanca de custo antes da compra.
- Erros tipados existem: `InsufficientNuggets`, `InvalidToken`, `UnlockCostChanged`, `PlanLimitReached`.

Ressalva:
- `Dashboard.jsx`, `MapView.jsx` e `MatchesPage.jsx` ainda exibem alguns custos usando `getPortfolioUnlockCost()` local para labels e pre-visualizacoes. O modal final usa snapshot, mas a UI antes do modal ainda pode mostrar um valor local que diverge por alguns segundos.

Recomendacao:
- Manter a cobranca server-side como fonte de verdade.
- Em uma etapa curta, substituir labels sensiveis por "from X nuggets" ou buscar quote remoto quando o usuario iniciar acao de unlock.

### 2.2 Webhook Stripe com idempotencia e ordenacao

Status: resolvido para o nucleo do fluxo.

Evidencias:
- `supabase/functions/stripe-webhook/index.ts` usa `stripe_events_processed`, `stripe_events_log` e `stripe_event_reprocess_queue`.
- Eventos duplicados sao ignorados por chave unica.
- Eventos de assinatura com `current_period_start` antigo sao pulados.
- `customer.subscription.deleted` antes de `created` e enfileirado.
- AdminDashboard mostra alertas de eventos Stripe pulados.

Ressalva:
- A fila de reprocessamento e drenada quando outro webhook chega. Nao ha, pelo codigo atual, um job externo garantido a cada 30 segundos.

Recomendacao:
- Criar um reprocessador agendado ou uma Edge Function chamada por cron.
- Adicionar runbook: como identificar, reprocessar e reconciliar eventos Stripe.

### 2.3 Normalizacao central de cards

Status: parcialmente resolvido.

Evidencias:
- `src/lib/normalizeFeedCard.js` existe e centraliza identidade, escopo, badges, `isOwnCard` e filtro de nomes suspeitos.
- `App.jsx`, `Dashboard.jsx`, `MapView.jsx` e `MatchesPage.jsx` ja chamam `normalizeCard()`.

Ressalva:
- Ainda ha logica complementar de montagem, merge, ordenacao, custo e owner resolution espalhada nos modulos.
- Normalizar o card ajuda, mas ainda nao garante que feed, map e matches usem exatamente a mesma ordenacao e os mesmos filtros.

Recomendacao:
- Criar uma funcao pura adicional para ordenacao de feed/deck: input lista normalizada + contexto, output lista final.

### 2.4 Delecao de conta com auditoria

Status: resolvido no backend principal, pendente de validacao E2E.

Evidencias:
- `supabase/migrations/20260701000001_soft_delete_account_audit.sql` cria `account_deletions`.
- `supabase/functions/delete-account/index.ts` cancela assinatura Stripe ativa, chama RPC de delecao e anonimiza usuario Auth.
- Regra de soft-delete preserva rastros de KPI sem expor dados pessoais.

Ressalva:
- Precisa testar o ciclo completo: deletar conta, confirmar assinatura cancelada no Stripe, criar nova conta com mesmo email e confirmar que nenhum dado antigo reidrata.
- Midias publicas ja enviadas para Storage precisam ser verificadas: anonimizar registros nao necessariamente remove arquivos antigos se eles continuarem publicos.

Recomendacao:
- Adicionar checklist E2E de delecao e revisar politicas de Storage.

### 2.5 Realtime de chat e unlocks

Status: implementado, mas ainda com lacunas de operacao.

Evidencias:
- `src/hooks/useChatRealtime.js` hidrata mensagens e assina INSERT em `chat_messages`.
- `src/hooks/useUnlockNotifications.js` assina INSERT em `unlocks` e `property_unlocks`.
- `supabase/migrations/20260701000005_enable_realtime_for_unlock_notifications.sql` habilita realtime para tabelas de unlock.

Ressalva:
- Notificacoes de unlock sao realtime-only no hook. Se o usuario estiver offline ou fechar o app, o badge pode nao refletir eventos perdidos, salvo se outro fluxo hidratar depois.
- Chat hidrata ate 500 mensagens, sem paginacao historica, status de entrega, retry visual ou read receipts persistidos no servidor.

Recomendacao:
- Criar tabela/consulta de notificacoes persistentes ou hydratar unlocks recentes ao montar Matches.
- Adicionar paginacao e estado de falha para mensagens.

## 3. Gaps P0 - Bloqueadores Antes de Producao Aberta

### P0.1 Testes E2E dos fluxos financeiros e de unlock

Risco:
- Cobranca, saldo de nuggets, unlock, exclusividade e KPI financeiro precisam ser comprovados em conjunto.

Estado atual:
- A arquitetura melhorou, mas nao ha evidencia de suite automatizada cobrindo o fluxo inteiro.

Fluxos minimos:
- Comprar pack de nuggets no Stripe live.
- Receber webhook e creditar saldo apenas pelo backend.
- Abrir modal de unlock, receber snapshot, confirmar e debitar saldo correto.
- Forcar mudanca de portfolio entre abertura e confirmacao e verificar erro de novo valor.
- Comprar exclusividade e impedir unlock conflitante.

Arquivos envolvidos:
- `src/services/unlockService.js`
- `src/App.jsx`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-checkout-session/index.ts`
- Migrations de unlock, nuggets e Stripe

Acao recomendada:
- Criar roteiro manual formal agora.
- Depois automatizar com Playwright + fixtures Supabase/Stripe test mode.

### P0.2 Reprocessamento garantido de webhook Stripe enfileirado

Risco:
- Um `customer.subscription.deleted` enfileirado pode ficar pendente se nenhum novo webhook chegar para drenar a fila.

Estado atual:
- A fila existe e e drenada dentro do proprio webhook.
- Falta uma chamada agendada/operacional independente.

Acao recomendada:
- Criar Edge Function `stripe-reprocess-queue`.
- Agendar via cron externo ou Supabase Scheduler, se disponivel no plano.
- Expor no AdminDashboard um botao admin/manual para reprocessar pendencias.

### P0.3 Validacao real do signup/email confirmation em producao

Risco:
- Usuario novo receber link 404 ou cair em URL incorreta apos confirmar email.

Estado atual:
- Redirect URLs foram ajustadas manualmente no Supabase.
- Ainda falta validar ponta a ponta em ambiente real.

Fluxo minimo:
- Criar usuario novo com email real.
- Confirmar email no link recebido.
- Garantir retorno para `https://dealsiftermatch.vercel.app/`.
- Garantir que onboarding e perfil inicial nao sejam reidratados de outro usuario.

Acao recomendada:
- Rodar teste com dois emails novos antes de qualquer divulgacao.

### P0.4 Politica final de segredos e ambientes

Risco:
- Historico recente mostrou erro de chave Supabase/Stripe expirada, nome divergente de secrets e deploys com ambiente incorreto.

Estado atual:
- O codigo aceita `ANON_KEY`/`SERVICE_ROLE_KEY` em algumas Edge Functions e `SUPABASE_*` em outras.
- Vercel usa `VITE_SUPABASE_*` para frontend.
- Supabase Functions usam secrets proprios.

Acao recomendada:
- Criar `docs/ENV_PRODUCAO_CHECKLIST.md` com todos os nomes obrigatorios.
- Validar por script: Vercel env, Supabase secrets, Stripe webhook secret, price IDs live.
- Remover/rotacionar chaves antigas expostas durante troubleshooting.

## 4. Gaps P1 - Alto Risco, Mas Controlaveis em Soft Launch

### P1.1 `App.jsx` ainda e grande demais

Risco:
- `App.jsx` tem aproximadamente 5.956 linhas e ainda concentra feed, plano, consentimento, perfil, portfolio, session heartbeat, modais e parte do unlock.

Estado atual:
- Existem arquivos JSDoc de interface: `feedService.js`, `planUsageService.js`, `consentService.js`.
- Eles ainda sao documentacao, nao implementacao runtime.

Acao recomendada:
- Extrair primeiro `consentService`, pois tem menor risco de quebrar fluxo comercial.
- Depois extrair `planUsageService`.
- Por ultimo extrair `feedService`, que e mais sensivel.

### P1.2 Estado local ainda pode mascarar fonte de verdade

Risco:
- `localStorage` ainda guarda `ds_nuggets`, `ds_unlocked`, `ds_property_unlocks`, `ds_matched`, `ds_interested`, perfis, portfolio e caches.
- Se um fluxo remoto falhar, a UI pode parecer correta localmente e divergir do banco.

Estado atual:
- Ha limpezas por usuario e hidatacao remota, mas os fallbacks continuam extensos.

Acao recomendada:
- Classificar cada chave local como: UI-only, cache temporario ou proibida em producao.
- Para nuggets/unlocks/matches pagos, usar localStorage apenas como cache visual, sempre sobrescrito por RPC.

### P1.3 Notificacoes realtime nao sao duraveis

Risco:
- Notificacao de unlock pode ser perdida se o usuario estiver offline.

Estado atual:
- Hook assina eventos INSERT, mas nao busca backlog de notificacoes nao lidas.

Acao recomendada:
- Criar tabela `notifications` ou RPC `ds_get_unread_unlock_notifications`.
- Ao abrir Matches, buscar notificacoes recentes antes de assinar realtime.

### P1.4 Feed/deck ainda precisa de funcao pura de ordenacao

Risco:
- Regra "cards proprios por ultimo", randomizacao inicial, Hot/Trending e filtros podem divergir entre Dashboard, MapView e Matches.

Estado atual:
- Normalizacao esta centralizada, mas ordenacao e composicao ainda estao espalhadas.

Acao recomendada:
- Criar `src/lib/orderFeedDeck.js`.
- Testar: cards proprios nao selecionaveis, cards proprios por ultimo, filtros preservados, randomizacao controlada por seed.

### P1.5 iPhone/Safari precisa de matriz de QA

Risco:
- Mercado americano tem alta incidencia de iPhone. Ja houve relato de layout cortado no iPhone SE.

Estado atual:
- Houve ajustes responsivos e PWA, mas iOS tem limitacoes proprias de viewport e instalacao.

Acao recomendada:
- Testar no minimo:
  - iPhone SE 2 Safari
  - iPhone 13/14/15 Safari
  - Android Chrome
  - iPad recente Safari
- Validar Feed, Map, Matches, Onboarding, modais e teclado aberto.
- Documentar que iOS 9.3.6/iPad antigo nao e alvo suportado.

### P1.6 PWA/adicionar a tela inicial ainda depende do navegador

Risco:
- Em iOS nao existe prompt nativo igual Android; usuario pode achar que "nao funcionou".

Estado atual:
- Botao foi colocado no hamburger e usa instrucao manual quando `beforeinstallprompt` nao esta disponivel.

Acao recomendada:
- Garantir texto i18n completo.
- Adicionar estado "ja instalado" quando `display-mode: standalone`.
- Revisar manifest, apple touch icon e meta tags em build de producao.

### P1.7 AdminDashboard ainda e painel, nao monitoramento

Risco:
- Eventos Stripe pulados aparecem no admin, mas ninguem e avisado fora do app.

Estado atual:
- KPI e alertas internos existem.

Acao recomendada:
- Adicionar alerta externo minimo: email, Slack, Discord ou ferramenta como Sentry/Better Stack.
- Criar runbook de incidentes: Stripe, Supabase, Vercel e Auth.

## 5. Gaps P2 - Divida Tecnica e Maturidade

### P2.1 Chat precisa de recursos de producao

Risco:
- Experiencia de chat pode parecer instavel sem status de envio, paginacao e retry.

Estado atual:
- Realtime e persistencia basica existem.

Acao recomendada:
- Marcar mensagem otimista como "sending", "failed" ou "sent".
- Reenviar mensagens com falha.
- Paginar historico antigo.
- Definir read receipts no banco ou remover indicacao visual ate implementar.

### P2.2 MapView precisa de teste visual e funcional de clusters

Risco:
- Ja houve relato de cluster indicando 3 pins e, ao clicar, nao mostrar os 3 pins esperados.

Estado atual:
- Houve ajustes, mas mapa e cluster sao dificeis de validar apenas por inspecao estatica.

Acao recomendada:
- Criar fixture com pins proximos e distantes.
- Validar zoom por cidade/regiao, filtros e categorias.
- Adicionar teste manual com screenshots antes de release.

### P2.3 Textos e i18n ainda precisam de revisao profissional

Risco:
- Mesmo com chaves traduzidas, algumas mensagens podem soar artificiais em ingles ou espanhol.

Estado atual:
- Auditoria de hardcoded strings foi iniciada e varios fallbacks usam `t.key ||`.
- Ainda existem fallbacks e textos tecnicos em componentes.

Acao recomendada:
- Revisao linguistica por idioma.
- Remover strings tecnicas da UI final.
- Padronizar "nuggets", "unlock", "exclusive" e "match" nos tres idiomas.

### P2.4 Settings ainda contem areas mock/local

Risco:
- Historico de billing, suporte e privacidade podem parecer reais mas ainda dependem de localStorage em trechos.

Estado atual:
- `Settings.jsx` ainda usa `ds_billing_history_mock`, `ds_support_chat_thread`, `ds_privacy_controls` e registros locais de seguranca.

Acao recomendada:
- Separar claramente o que e funcional real do que e placeholder.
- Para producao, ocultar ou conectar ao backend.

### P2.5 Observabilidade de erro frontend

Risco:
- Falhas em dispositivos reais podem nao chegar ao time.

Estado atual:
- Existem logs locais e alguns toasts, mas nao ha evidencia de captura centralizada de erro frontend.

Acao recomendada:
- Adicionar Sentry, LogRocket ou alternativa leve.
- Capturar erros de chunk loading, Supabase RPC, checkout, realtime e responsividade critica.

## 6. Checklist de Producao Recomendada

Antes de abrir producao ampla:

- Rodar build limpo.
- Fazer login/signup com dois usuarios novos.
- Confirmar email por link real.
- Criar perfil pessoal/profissional/FSBO.
- Publicar servico e propriedade.
- Ver cards no feed de outro usuario.
- Garantir que card proprio aparece, mas nao e selecionavel.
- Comprar pack de nuggets Stripe live.
- Confirmar credito via webhook, nao via frontend.
- Desbloquear contato com custo maior que 1.
- Testar mudanca de custo entre abertura e confirmacao.
- Comprar exclusividade.
- Validar Matches, contato, chat realtime e unlock notification.
- Deletar conta e recriar com mesmo email.
- Testar iPhone Safari e Android Chrome.
- Testar botao de adicionar a tela inicial.
- Validar Vercel envs e Supabase secrets.
- Conferir Stripe webhook endpoint e signing secret.
- Conferir AdminDashboard sem eventos Stripe skipped pendentes.

## 7. Recomendacao de Sequencia

### Etapa 1 - Pre-producao tecnica

1. Criar checklist de env/secrets.
2. Criar roteiro manual E2E de producao.
3. Implementar reprocessador garantido de Stripe queue.
4. Validar Supabase Auth email confirmation.

### Etapa 2 - Soft launch controlado

1. Testar com 3 a 5 usuarios externos.
2. Monitorar Stripe, AdminDashboard, Supabase logs e Vercel logs.
3. Validar iPhone/Safari com usuarios reais.
4. Corrigir gaps de UX e responsividade.

### Etapa 3 - Hardening

1. Automatizar Playwright para fluxo financeiro/unlock.
2. Extrair services reais de App.jsx.
3. Persistir notificacoes realtime.
4. Adicionar observabilidade externa.

## 8. Conclusao

O DealSifter ja tem base funcional ampla e varias correcoes de alto risco foram implementadas. O ponto principal agora e transformar a aplicacao de "funciona no fluxo feliz" para "opera com seguranca quando Stripe atrasa, usuario troca de dispositivo, Safari se comporta diferente, a rede falha ou um webhook chega fora de ordem".

Minha recomendacao objetiva: nao criar novas funcionalidades grandes antes de fechar os P0. Depois disso, fazer soft launch controlado e usar os P1 como trilha de hardening antes de divulgacao ampla.
