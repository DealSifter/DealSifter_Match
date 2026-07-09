# DealSifter - Nova Varredura de Gaps Persistentes

Data da auditoria: 2026-07-09  
Base analisada: codigo atual em `src/`, migrations em `supabase/migrations/`, relatorios QA em `docs/`.

## Resumo Executivo

O app avancou nas refatoracoes criticas: ja existem services para tema, feed state, MapView, contatos desbloqueados, plano/uso, chat realtime, notificacoes persistentes e suporte real. Tambem ja existem migrations para entitlement, limpeza de payload sensivel, plan grants, webhook Stripe, suporte e auditoria LGPD.

Mesmo assim, ainda ha gaps persistentes que podem gerar regressao em producao. O padrao principal encontrado e este: varios services canonicos foram criados, mas componentes grandes ainda montam dados paralelos antes ou depois desses services. Isso vale principalmente para `MapView.jsx`, `Dashboard.jsx`, `MatchesPage.jsx` e `App.jsx`.

Classificacao atual: apto para soft launch controlado, mas ainda nao recomendo producao aberta sem fechar os P0 abaixo e executar os checklists mobile/financeiro/entitlement.

## P0 - Bloqueadores De Confiabilidade

### P0.1 MapView ainda nao usa inventario unico como fonte primaria

Risco:
- Pins, Spotlight Cards, My PINs e filtros podem divergir porque `MapView.jsx` ainda monta `points` manualmente e so depois passa a colecao para `buildMapInventory()`.
- O service `mapInventoryService` existe, mas hoje atua mais como filtro/deduplicador tardio do que como camada canonica de inventario.
- Bugs como "My PINs nao mostra propriedades", "Spotlight aparece na barra mas nao no mapa" e "cluster com contagem errada" podem voltar.

Evidencias:
- `src/pages/MapView.jsx` ainda contem funcoes internas extensas como `addPublishedPeople`, `addPublishedServicePeople`, `addLocalProfilePeople` e `addPublishedProperties`.
- `buildMapInventory()` so e chamado depois que `points` ja foi montado.
- `realUserPoints` ainda e uma fonte paralela usada para autofit/fallback.

Acao recomendada:
1. Mover a montagem de pins para `mapInventoryService`.
2. `MapView.jsx` deve apenas chamar `buildMapInventory(normalizedCards, currentUserId, filters)`.
3. Eliminar `realUserPoints` como fonte paralela; ele deve derivar de `inventory.myPins`.
4. Criar testes unitarios para `buildMapInventory` cobrindo People, Deals, My PINs, Spotlight e deduplicacao.

Definition of done:
- Todos os pins do mapa, cards da aba Spotlight e My PINs derivam da mesma lista.
- Alterar um card no feed global altera simultaneamente mapa e sidebar.
- My PINs + Deals mostra propriedades proprias; My PINs + People mostra perfis/servicos proprios.

### P0.2 Dados de contato ainda podem passar por caminhos paralelos em Matches

Risco:
- O mesmo contato desbloqueado pode aparecer com dados em um device e sem dados em outro.
- `unlockedContactService` existe, mas `MatchesPage.jsx` ainda usa `ownerPreview`, `activeOwner`, `allPropertiesSource`, `matched`, `interested` e reconstrucoes locais em varios pontos.
- O entitlement canonico compete com estado visual herdado.

Evidencias:
- `src/pages/MatchesPage.jsx` ainda referencia `ownerPreview` em dezenas de pontos.
- Ainda existe fallback em `resolveCanonicalContactCard()` que retorna objeto sem contato quando a RPC nao trouxe dados.
- `activeOwner` e propriedades vinculadas continuam sendo resolvidos por composicao visual.

Acao recomendada:
1. Separar `MatchesPage` em containers menores: `MatchesPeopleList`, `MatchesInterestsList`, `MatchConversationPanel`, `MatchPortfolioPanel`.
2. Toda decisao de contato deve ser: `unlockedContactMap -> getContactByOwnerId(ownerId) -> PortfolioContactPanel`.
3. Remover `ownerPreview` como fonte de contato em Matches; ele pode ser apenas preview visual bloqueado.
4. Adicionar teste unitario/integracao para: owner desbloqueado, propriedade desbloqueada, propriedade de owner desbloqueado e exclusividade de terceiro.

Definition of done:
- Desktop, mobile, modal preview e refresh exibem os mesmos contatos.
- Nenhum contato pago depende de `matched`, `interested`, `ownerPreview` ou `localStorage`.

### P0.3 Feed/Dashboard ainda monta cards publicos com campos sensiveis antes da sanitizacao

Risco:
- A sanitizacao em `normalizeCard()` protege o retorno final, mas `Dashboard.jsx` ainda monta objetos publicos incluindo `email`, `primaryPhone` e `contactMethods`.
- Se alguem renderizar o objeto antes de passar por `normalizeCard()`, ou adicionar novo caminho paralelo, o vazamento pode voltar.

Evidencias:
- `src/pages/Dashboard.jsx` monta cards com `email: ownerPreview?.email`, `primaryPhone: ownerPreview?.primaryPhone` e `contactMethods`.
- `normalizeFeedCard.js` remove esses campos no final, mas a regra de seguranca ainda depende de todos lembrarem de passar pelo normalizador.

Acao recomendada:
1. Remover campos sensiveis ja na origem dos builders publicos do `Dashboard`.
2. Criar helper `sanitizePublicCardInput()` compartilhado para qualquer montagem de card publico.
3. Adicionar teste garantindo que `Dashboard`/feed nao passa props de contato para cards bloqueados.

Definition of done:
- Nenhum builder publico cria objeto com email/telefone.
- Dados de contato so nascem em `unlockedContactService` ou RPC de entitlement.

### P0.4 Suite de testes atual nao e confiavel como trava de regressao

Risco:
- Mudancas visuais e de entitlement podem quebrar sem serem detectadas antes do deploy.
- A suite atual falha por configuracao/teste incompleto.

Evidencias:
- Rodada de `vitest` em 2026-07-09:
  - `src/components/matches/PortfolioContactPanel.test.jsx` falha porque importa `@testing-library/react`, que nao esta instalado.
  - `src/lib/orderFeedDeck.test.js` falha como "No test suite found", apesar de imprimir mensagem manual.
- Existem apenas quatro arquivos de teste em `src/`.

Acao recomendada:
1. Corrigir `orderFeedDeck.test.js` para usar `describe/it/expect`.
2. Ou instalar `@testing-library/react`, ou reescrever `PortfolioContactPanel.test.jsx` com `react-dom/server`, como ja foi feito em `ContactButtons.test.jsx`.
3. Criar script `test` em `package.json`.
4. Tornar `npm run lint && npm run test && npm run build` requisito de PR.

Definition of done:
- `npx vitest run` passa inteiro.
- Todo componente critico de entitlement tem teste automatizado minimo.

## P1 - Alto Risco Para Soft Launch

### P1.1 `App.jsx` ainda centraliza regra demais

Risco:
- Correcoes em feed, unlock, plano ou notificacoes podem gerar efeito colateral cruzado.

Evidencias:
- `App.jsx` ainda contem sincronizacao de `user_feed_actions`, hidratacao de unlock, persistencia local, notificacoes, routing interno e reconciliacao de estado.
- `fetchRemoteUnlockState()` ainda atualiza `unlocked`, `purchases`, `matched`, `interested` e `propertyUnlocks` ao mesmo tempo.

Acao recomendada:
1. Extrair `feedActionService` para ler/escrever `user_feed_actions`.
2. Extrair `unlockHydrationService` para transformar RPC canonica em estado de UI.
3. Deixar `App.jsx` apenas como orquestrador de pagina/estado.

### P1.2 LocalStorage ainda guarda estados com impacto de negocio

Risco:
- `ds_nuggets`, `ds_unlocked`, `ds_matched`, `ds_purchases`, `ds_subscription_mock` e `ds_system_notifications` ainda aparecem em fluxo runtime.
- Mesmo que alguns sejam cache/fallback, a presenca deles em `App.jsx` aumenta risco de um componente tratar cache como verdade.

Evidencias:
- `src/App.jsx` le e grava `ds_nuggets`, `ds_unlocked`, `ds_matched`, `ds_purchases`, `ds_subscription_mock`.
- `src/lib/localStoragePolicy.js` classifica chaves proibidas, mas o uso legado ainda nao foi totalmente removido.

Acao recomendada:
1. Aplicar `clearSensitiveCache(userId)` em login/troca de usuario e tambem apos unlock/compra.
2. Remover leitura inicial de chaves proibidas quando Supabase estiver configurado.
3. Migrar `ds_system_notifications` para tabela `notifications`.

### P1.3 Geocoding client-side ainda e fragil no MapView

Risco:
- CORS/rate limit de provedores externos pode voltar a derrubar carregamento do mapa.
- Mesmo com flags DEV, o codigo de geocoding e fallback ainda e grande e esta no componente.

Evidencias:
- `MapView.jsx` contem URLs de Nominatim, Census, Photon e ArcGIS.
- Ja houve erro recorrente de CORS no console em producao.

Acao recomendada:
1. Mover geocoding para Edge Function ou job backend.
2. No frontend, renderizar apenas coordenadas ja persistidas ou estado "pending geocode".
3. MapView nunca deve fazer fetch direto em provedor externo em producao.

### P1.4 Plano/uso melhorou, mas precisa travar UI em tempo real por fonte unica

Risco:
- Upgrade concedido por admin ou Stripe pode nao refletir imediatamente em chat/swipes/features.

Evidencias:
- `planUsageService` existe e consulta DB/RPC, mas ainda ha estados de `subscription`, `nuggets` e mocks locais em `App.jsx`.
- Plano concedido por admin depende de realtime em `users`, mas UI ainda pode manter cache visual.

Acao recomendada:
1. Todo componente que decide feature deve chamar `canPerformAction(userId, action)` ou receber resultado dele.
2. Invalidaçao de cache ao receber realtime de `users`/`subscriptions`.
3. Remover `ds_subscription_mock` de producao.

### P1.5 Backups `.bak` dentro de `src/pages`

Risco:
- Arquivos antigos com strings em portugues, campos legados e placeholders podem confundir auditoria, busca e futuras refatoracoes.

Evidencias:
- `src/pages/Onboarding.jsx.pre-portfolio.bak`
- `src/pages/Onboarding.jsx.pre-images.bak`
- `src/pages/Onboarding.jsx.before-restore.bak`

Acao recomendada:
- Mover backups para fora de `src/` ou remover se o historico Git ja cobre.

## P2 - Divida Tecnica E Operabilidade

### P2.1 README ainda e template generico

Risco:
- Onboarding de dev/QA fica disperso em varios docs.

Acao recomendada:
- Transformar README em guia DealSifter: setup, envs, build, deploy, QA obrigatorio, Supabase/Stripe, runbooks.

### P2.2 i18n ainda tem fallback hardcoded em componentes grandes

Risco:
- Strings em ingles/portugues podem aparecer fora do idioma ativo.

Evidencias:
- `MatchesPage.jsx`, `MapView.jsx`, `Settings.jsx` ainda usam `|| 'texto'` em varios pontos.

Acao recomendada:
- Auditoria incremental por arquivo, priorizando mensagens sistemicas, erros, chat, unlock, exclusividade, modais e Settings.

### P2.3 Observabilidade de frontend depende de uso consistente

Risco:
- Sentry existe, mas eventos relevantes podem nao ser capturados se componentes ignorarem helpers.

Acao recomendada:
- Padronizar helpers: `captureRpcError`, `captureEntitlementAlert`, `captureCheckoutError`, `captureMapError`.
- AdminDashboard deve exibir alerta operacional para eventos recentes de entitlement, Stripe stuck e RPCs criticas.

### P2.4 QA manual existe, mas falta registro de execucao

Risco:
- Checklists existem, mas se nao forem preenchidos por build, regressao visual/mobile volta.

Acao recomendada:
- Criar `docs/QA_EXECUCOES/` e salvar uma copia por build testado.
- Toda PR visual deve anexar `QA_DEPLOY_MOBILE`.

## Validacoes Executadas Nesta Varredura

- `git status --short`: arvore limpa antes da auditoria.
- `npx eslint src/services/unlockedContactService.js src/services/mapInventoryService.js src/services/feedStateService.js src/pages/MatchesPage.jsx src/pages/MapView.jsx src/pages/Dashboard.jsx`
  - Resultado: 0 erros, 2 warnings em `Dashboard.jsx` sobre dependencias de hooks.
- `npx vitest run src/lib/normalizeFeedCard.test.js src/lib/orderFeedDeck.test.js src/components/ContactButtons.test.jsx src/components/matches/PortfolioContactPanel.test.jsx`
  - Resultado: 2 arquivos passaram, 2 falharam por problema de suite/dependencia.

## Ordem Recomendada De Proximas Correcoes

1. Corrigir a suite de testes para voltar a ser executavel.
2. Refatorar MapView para inventario canonico real no service.
3. Remover contatos sensiveis dos builders publicos do Dashboard.
4. Quebrar MatchesPage em paineis menores e eliminar `ownerPreview` como fonte de entitlement.
5. Extrair `feedActionService`/`unlockHydrationService` de `App.jsx`.
6. Remover leitura de caches proibidos em producao.
7. Executar e registrar `QA_UNLOCKED_CONTACTS_E2E`, `QA_MAPVIEW_V2`, `QA_DEPLOY_MOBILE` e `QA_E2E_FLUXOS_FINANCEIROS`.

