# DealSifter - Gaps Persistentes Atualizados para Producao

Data da auditoria: 2026-07-07

Base analisada:
- `docs/GAPS_PERSISTENTES_PRODUCAO_2026-07-01.md`
- Codigo atual em `src/App.jsx`, `src/pages/MatchesPage.jsx`, `src/pages/MapView.jsx`
- Services atuais em `src/services/`
- Migrations atuais de unlock, snapshots, notificacoes e suporte em `supabase/migrations/`

Observacao: o arquivo citado como `caps_persistentes_producao.md` nao existe com esse nome no repositorio. A auditoria usou o relatorio persistente real encontrado em `docs/GAPS_PERSISTENTES_PRODUCAO_2026-07-01.md`.

## 1. Resumo executivo

O app evoluiu bastante desde o relatorio de 2026-07-01: ha snapshot de custo de unlock, webhooks Stripe com idempotencia, notificacoes persistentes, suporte real, ajustes de MapView, chat realtime e melhorias de plano/feature flags.

Mesmo assim, o app ainda nao esta pronto para producao aberta. O principal bloqueador atual nao e uma tela isolada: e a falta de uma fonte unica de verdade para dados sensiveis de contato desbloqueado. A mesma entidade "perfil desbloqueado" pode chegar ao UI por caminhos diferentes:

- Snapshot canonico vindo da RPC de unlock.
- Payload antigo salvo em `user_feed_actions`.
- `ownerPreview` de propriedade ou servico.
- Card normalizado vindo do feed publico, ja redigido.
- Fallback local montado em `App.jsx`.
- Re-hidratacao complementar dentro de `MatchesPage.jsx`.

Isso explica o bug recorrente relatado: para alguns usuarios/devices os contatos aparecem, para outros somem, e em alguns casos a propriedade ligada a um contato desbloqueado volta a pedir unlock. O comportamento nao pode ser corrigido de forma confiavel com mais condicionais no componente. Precisa de refatoracao de dominio.

Classificacao atual: soft launch muito controlado apenas para testes internos. Nao recomendo trafego comercial amplo enquanto os P0 abaixo nao forem fechados.

## 2. O que melhorou desde 2026-07-01

### 2.1 Fluxos financeiros

Status: parcialmente estabilizado.

O app ja possui RPC/service de unlock, snapshot de custo, tokens de intencao, idempotencia de webhook Stripe, fila de reprocessamento e runbooks. O risco financeiro bruto diminuiu.

Gap persistente:
- Ainda falta uma suite E2E automatizada cobrindo compra de nuggets, webhook, unlock, exclusividade, alteracao de portfolio durante confirmacao e reprocessamento Stripe.

### 2.2 Notificacoes e chat

Status: melhorado.

Ha realtime no chat, suporte real e notificacoes persistentes. A experiencia ficou mais proxima de mensageria real.

Gap persistente:
- A notificacao nao deve ser usada como fonte de direito de acesso. Ela alerta; quem decide se o contato pode ser visto deve ser uma RPC canonica de entitlement.

### 2.3 MapView

Status: parcialmente recuperado.

Pins, spotlight cards e filtros foram ajustados diversas vezes.

Gap persistente:
- MapView ainda mistura inventario publico, filtros, cards pagos, cards proprios, spotlight e clusters em uma mesma camada visual. Isso aumenta risco de regressao quando se altera feed ou matches.

### 2.4 Tema e loading

Status: melhorado, mas fragil.

O tema passou a usar preferencia explicita `light`/`dark`, mas a inicializacao ainda existe em mais de um lugar (`index.html`, `src/main.jsx`, `src/theme/theme.jsx`). Isso reduz, mas nao elimina, a chance de flash de tema errado apos novas alteracoes.

## 3. P0 - Bloqueadores atuais

### P0.1 Contatos desbloqueados sem fonte unica de verdade

Risco:
- Usuario paga nuggets ou exclusividade e nao ve telefone/email.
- Outro usuario ve os mesmos dados corretamente.
- Desktop e mobile divergem porque renderizam caminhos diferentes.
- Um contato desbloqueado por propriedade pode aparecer como bloqueado ao abrir a propriedade ligada.

Evidencias no codigo:
- `src/App.jsx` monta matched/unlocked via `fetchRemoteUnlockState()`, mas tambem faz fallback com `buildUnlockedContactSnapshot()`.
- `buildUnlockedContactSnapshot()` usa `ownerPreview` de propriedades/servicos como fallback. Esse dado pode ser publico, incompleto ou redigido.
- `user_feed_actions` persiste payload de matched/interested. Esse payload pode ficar antigo e competir com snapshots atuais.
- `src/pages/MatchesPage.jsx` usa `ContactButtons` que apenas renderiza campos presentes no objeto recebido.
- `MatchesPage.jsx` ainda tenta enriquecer contato com `enrichContactFromPortfolio()`, usando propriedades/servicos como fonte auxiliar. Isso nao garante contato canonico.

Acao necessaria:
1. Criar uma camada unica `src/services/unlockedContactService.js`.
2. Criar/ajustar RPC canonica `ds_get_unlocked_contact_cards(p_user_id)` retornando:
   - `owner_id`
   - `primary_profile`
   - `unlock_scope`: contact, property, exclusive, reciprocal
   - `contact`: nome, avatar, categoria, local, metodos, telefones e email ja liberados
   - `portfolio`: propriedades e servicos ligados, com estado de unlock por item
   - `unlocked_property_ids`
   - `exclusive_status`
3. `App.jsx` deve armazenar apenas IDs de unlock e o mapa canonico retornado pelo service.
4. `MatchesPage.jsx` deve receber `unlockedContactsByOwnerId` e nunca tentar reconstruir telefone/email a partir de feed publico, propriedade ou localStorage.
5. `ContactButtons` deve receber exclusivamente um objeto `contact` canonico ou renderizar vazio. Sem fallback para dados publicos.

Definition of done:
- O mesmo contato desbloqueado mostra os mesmos contatos em desktop, mobile, tablet, refresh, nova aba e novo login.
- Uma propriedade de owner desbloqueado nao pede novo unlock para o mesmo owner quando o direito ja existe.
- Card publico bloqueado nunca revela telefone/email.
- Card desbloqueado sempre revela os canais liberados, desde que existam no DB.

### P0.2 Payload antigo em `user_feed_actions` compete com o backend

Risco:
- Um matched antigo salvo com payload incompleto pode sobrescrever um snapshot novo.
- Um contato pode aparecer sem email/telefone mesmo depois da RPC retornar corretamente.
- Estado difere entre usuarios porque cada um tem historico local/remoto diferente.

Evidencias:
- `buildFeedActionPayload()` ainda inclui `phone`, `primaryPhone`, `secondaryPhone`, `whatsapp`, `email` e `contactMethods`.
- `mergeFeedActionItems()` escolhe item por "richness score", nao por autoridade de dominio.
- `applyRemoteFeedActions()` reidrata listas de matched/interested a partir de `user_feed_actions`.

Acao necessaria:
1. Parar de persistir dados sensiveis de contato em `user_feed_actions`.
2. Persistir apenas:
   - action
   - entity_type
   - entity_id
   - owner_id
   - source_card_id
   - timestamps
3. Criar migration/script de limpeza para remover `email`, `phone`, `whatsapp` e afins de payloads antigos.
4. No login, buscar:
   - `user_feed_actions` para estado visual.
   - `ds_get_unlocked_contact_cards()` para direitos reais de contato.

Definition of done:
- Alterar ou limpar `user_feed_actions.payload` nao remove contato desbloqueado.
- Contato desbloqueado continua visivel apos refresh porque vem da RPC canonica.

### P0.3 Renderizacao de portfolio duplicada entre desktop/mobile/modal

Risco:
- Um device mostra contato, outro nao.
- O modal preview usa uma estrutura e a area Portfolio usa outra.
- Ajuste em um ponto nao corrige o outro.

Evidencias:
- `MatchesPage.jsx` chama `ContactButtons` em multiplos pontos: header desktop, header mobile, portfolio detail, preview modal e fallback de item ativo.
- `PortfolioDetail` recebe `item` e `owner`, e em alguns pontos usa `owner || item`.
- A selecao de `activeOwner` mistura `active`, `ownerPreview`, `allMatched`, `allPropertiesSource` e mocks DEV.

Acao necessaria:
1. Criar `src/components/matches/PortfolioContactPanel.jsx`.
2. O componente deve receber:
   - `canonicalContact`
   - `isUnlocked`
   - `variant`: desktop, mobile, modal
3. Ele deve ser o unico ponto que renderiza telefone/email/chat unlockado.
4. `PortfolioDetail`, preview modal e header de Matches devem usar o mesmo componente.

Definition of done:
- Uma alteracao visual nos contatos precisa tocar um unico componente.
- Mobile e desktop usam a mesma origem de dados.

### P0.4 Entitlement de propriedade vs owner ainda e ambiguo

Risco:
- Usuario desbloqueia owner, mas propriedade ligada pede novo unlock.
- Exclusividade libera ou bloqueia somente uma propriedade, mas o contato esta atrelado ao owner.
- Liberação cruzada de exclusividade fica incompleta.

Acao necessaria:
1. Formalizar regra no backend:
   - Unlock simples de owner libera contato do owner e portfolio vinculado para aquele comprador.
   - Unlock/exclusividade de propriedade libera o owner para conversa/contato dentro do escopo daquele comprador.
   - Exclusividade ativa bloqueia novos unlocks simples do owner e demais itens atrelados enquanto durar o timer, exceto para o comprador exclusivo.
2. A RPC canonica de contatos desbloqueados deve retornar tambem propriedades liberadas daquele owner.
3. `MatchesPage.jsx` deve decidir lock/unlock por `owner_id`, nao por objeto visual.

Definition of done:
- Ao clicar em qualquer propriedade de um owner ja desbloqueado, o UI abre portfolio/contato sem pedir novo pagamento indevido.
- Ao clicar em owner com exclusividade ativa de terceiro, aparece aviso de bloqueio temporario.

### P0.5 Tema/loading ainda pode regredir

Risco:
- Flash de tema escuro antes do claro.
- Toggle para de funcionar apos ajuste em outro modulo.
- Logo mobile usa asset errado por tema.

Evidencias:
- Ha inicializacao de tema em `index.html`, `src/main.jsx` e `src/theme/theme.jsx`.
- Navbar e loading dependem de estado de tema em momentos diferentes da montagem.

Acao necessaria:
1. Criar `src/services/themeService.js` sem React.
2. Centralizar:
   - leitura de preferencia
   - aplicacao em `document.documentElement`
   - meta `theme-color`
   - escolha de logo por tema e viewport
3. `index.html` deve chamar apenas um bootstrap minimo inline com a mesma chave/contrato do service.
4. Remover qualquer escrita de tema fora do provider/toggle.
5. Criar teste manual documentado: refresh em light/dark no desktop e mobile.

Definition of done:
- Refresh em tema claro nunca mostra fundo escuro.
- Toggle funciona na navbar desktop e hamburger mobile.
- Logo mobile claro/escuro sempre respeita tema ativo.

## 4. P1 - Alto risco para soft launch

### P1.1 MapView precisa de camada propria de inventario

Problema:
- O mapa ainda depende de dados que tambem alimentam feed/matches.
- Spotlight cards devem aparecer na aba de destaque, mas todos os pins publicados devem aparecer no mapa.
- My PINs, People, Deals e Spotlight precisam ser filtros sobre o mesmo inventario, nao fontes diferentes.

Acao recomendada:
- Criar `src/services/mapInventoryService.js`.
- Entrada: inventario normalizado de cards/pins.
- Saida:
  - `allPins`
  - `spotlightCards`
  - `myPins`
  - `clusterablePins`
- `MapView.jsx` passa a renderizar apenas esse resultado.

### P1.2 App.jsx continua grande e sensivel

Problema:
- `App.jsx` ainda orquestra sessao, feed, unlock, map, plano, consentimento, tema, portfolio e notificacoes.

Acao recomendada:
1. Extrair primeiro `unlockedContactService`.
2. Depois `feedStateService`.
3. Depois `mapInventoryService`.
4. Por ultimo reduzir `App.jsx` a sessao, rotas, providers e modais globais.

### P1.3 Falta teste automatizado para o bug mais caro

Teste necessario:
- Usuario A publica perfil com telefone/email.
- Usuario B desbloqueia A.
- Usuario B ve contatos em:
  - Matches > People
  - Matches > Portfolio
  - modal preview
  - propriedade ligada
  - desktop refresh
  - mobile refresh
- Usuario C nao desbloqueou A e nao ve contatos.

Sem esse teste, a regressao pode voltar a cada refatoracao.

### P1.4 i18n de mensagens sistemicas do chat

Problema:
- O chat ja tem mensagens sistemicas importantes, mas elas precisam obedecer idioma do remetente/destinatario e nao devem aparecer como texto fixo em ingles/portugues.

Acao recomendada:
- Criar catalogo unico para system chat notices em `translations.js`.
- Salvar no banco `message_code` + `params`, nao apenas texto final.

### P1.5 Observabilidade deve capturar contexto de entitlement

Problema:
- Sem log estruturado, o bug "contato desbloqueado sem telefone" vira tentativa manual.

Acao recomendada:
- Em ambiente de producao, logar erro/alerta sem PII quando:
  - contato esta marcado como unlocked mas `canonicalContact.contacts` vem vazio.
  - propriedade de owner unlocked tenta abrir paywall.
  - snapshot RPC falha e UI usa fallback.

## 5. P2 - Divida tecnica e polimento

### P2.1 `ContactButtons` deve deixar de ser "inteligente"

Hoje ele decide fallback de contato. Depois da refatoracao, ele deve apenas renderizar dados ja autorizados.

### P2.2 `normalizeFeedCard` deve continuar sem dados sensiveis

Feed publico nao deve carregar telefone/email. A normalizacao de feed deve garantir isso explicitamente.

### P2.3 `orderFeedDeck` e filtros precisam ser a unica entrada para Feed e Map

O deck e os filtros ja foram parcialmente centralizados, mas MapView ainda merece separacao propria.

### P2.4 QA iPhone/Safari deve virar rotina antes de deploy

Como houve bugs recorrentes de viewport, tema e logo mobile, todo deploy com mudanca visual deve passar por checklist minimo mobile.

## 6. Sequencia recomendada de refatoracao

### Fase 1 - Entitlement canonico de contatos desbloqueados

1. Criar RPC `ds_get_unlocked_contact_cards(p_user_id)`.
2. Criar `src/services/unlockedContactService.js`.
3. Popular `unlockedContactsByOwnerId` no `App.jsx`.
4. Remover telefone/email de `user_feed_actions`.
5. Atualizar `MatchesPage.jsx` para usar somente o mapa canonico.

Resultado esperado:
- O bug de contatos inconsistentes deixa de depender de device, cache ou origem visual.

### Fase 2 - UI unica de contatos e portfolio

1. Criar `PortfolioContactPanel`.
2. Substituir todos os usos duplicados de `ContactButtons`.
3. Separar `PortfolioDetail` em dados canonicos + apresentacao.

Resultado esperado:
- Desktop, mobile e modal exibem a mesma informacao.

### Fase 3 - Regras de propriedade/owner/exclusividade

1. Formalizar regra de owner unlock no backend.
2. Garantir que propriedade ligada nao pede novo unlock se owner ja esta liberado.
3. Garantir bloqueio temporario do owner quando ha exclusividade ativa de terceiro.

Resultado esperado:
- Paywall deixa de aparecer indevidamente em propriedade ja ligada a owner liberado.

### Fase 4 - Tema/loading isolado

1. Criar `themeService`.
2. Remover inicializacoes duplicadas.
3. Criar contrato unico para logo por tema/viewport.

Resultado esperado:
- Sem flash escuro, sem toggle invertido, sem logo errada apos novas features.

### Fase 5 - MapView inventory service

1. Criar `mapInventoryService`.
2. Garantir que mapa mostra todos os pins publicados.
3. Garantir que aba Spotlight mostra apenas cards pagos.
4. Garantir que filtros People/Deals/My PINs operam sobre o mesmo inventario.

Resultado esperado:
- Spotlight deixa de interferir na existencia geral dos pins.

## 7. Criterios minimos para liberar producao

- Contatos desbloqueados aparecem de forma identica em desktop e mobile.
- Contatos bloqueados nunca aparecem.
- Propriedade ligada a owner desbloqueado nao pede novo unlock indevido.
- Card desbloqueado sai do feed do comprador ou deixa de consumir swipe.
- Tema claro nao pisca tema escuro no refresh.
- Toggle de tema funciona em desktop e mobile.
- MapView mostra todos os pins publicados, e Spotlight Cards mostra apenas destaques pagos.
- Stripe nuggets dependem de webhook, nao de retorno do frontend.
- Signup/email confirmation foi testado em producao.
- Pelo menos um roteiro E2E manual esta documentado e executado antes do soft launch.

## 8. Conclusao

O problema atual dos contatos nao e falta de mais um fallback. E excesso de fallback. O app precisa parar de reconstruir contato desbloqueado a partir de varios objetos visuais e passar a consumir uma unica resposta canonica do backend.

Minha recomendacao objetiva: a proxima implementacao deve ser a Fase 1 inteira. So depois disso vale continuar ajustes finos de UI, porque qualquer melhoria visual feita sobre dados ambiguos tende a quebrar de novo em outro usuario, device ou fluxo.
