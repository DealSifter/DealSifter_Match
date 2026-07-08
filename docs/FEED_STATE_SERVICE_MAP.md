# Feed State Service Map

Objetivo: registrar os blocos de feed encontrados em `src/App.jsx` antes da extracao para `src/services/feedStateService.js`.

## Blocos Localizados Em App.jsx

### Inventario Global

- Variaveis: `globalShowcaseProperties`, `setGlobalShowcaseProperties`, `globalConnectionServices`, `setGlobalConnectionServices`, `activeSpotlights`, `setActiveSpotlights`, `globalFeedRefreshTick`.
- Linhas aproximadas antes da extracao: `2600-2935`.
- Responsabilidade original: chamar RPC `ds_get_global_feed_inventory`, montar propriedades/servicos globais, normalizar cards e hidratar destaques.
- Dependencias React: `supabaseUserId`, `globalFeedRefreshTick`, setters de estado, `safeLogError`.
- Status: RPC e fallback por tabelas extraidos para `feedStateService.fetchGlobalInventory()` e `feedStateService.buildGlobalFeedState()`.

### Normalizacao De Cards

- Funcoes usadas originalmente: `normalizeCard()`, `mapDbPropertyToLocal()`, `mapDbServiceToLocal()`, `buildDbOwnerPreview()`.
- Linhas aproximadas antes da extracao: helpers `696-970`, uso `2673-2735` e `2887-2906`.
- Dependencias React: nenhuma direta; dependia apenas de `supabaseUserId` e dados da RPC.
- Status: duplicado e isolado em `feedStateService` para o caminho principal da RPC.

### Ordenacao / Deck

- Funcoes relacionadas: `orderDeck()` via `src/lib/orderFeedDeck.js`.
- Linhas aproximadas: antes nao havia deck global explicito em `App.jsx`; a ordenacao era feita em `Dashboard.jsx` e `MapView.jsx`.
- Dependencias React: filtros/session state ainda pertencem aos componentes.
- Status: `feedStateService.buildFeedDeck()` criado como funcao pura. `App.jsx` agora mantem `feedDeck`, `feedFilters` e `feedSessionSeed`.

### Posicao Do Deck Na Sessao

- Variaveis diretamente em `App.jsx`: nao havia controle canonico unico de posicao do deck.
- Dependencias React: atualmente controlado nos consumidores, principalmente Dashboard.
- Status: nao movido nesta etapa. Foi criado `getSessionSeed()` no service para estabilizar a randomizacao por sessao.

### Filtros De Categoria / Estado

- Variaveis no App: `categoryOrder`; filtros reais de feed seguem nos componentes consumidores.
- Dependencias React: estado visual do Dashboard/MapView.
- Status: `buildFeedDeck(rawCards, currentUserId, filters, sessionSeed)` aceita filtros, mas a migracao completa dos filtros de UI fica para etapa posterior.

### Primeira Abertura Randomizada

- Bloco relacionado: randomizacao existente em `orderDeck()` com seed.
- Dependencias React: nao direta.
- Status: `getSessionSeed()` gera uma vez por sessao usando `sessionStorage`.

## Interface Implementada

- `fetchGlobalInventory(supabaseClient): Promise<object>`
- `buildFeedDeck(rawCards, currentUserId, filters, sessionSeed): NormalizedCard[]`
- `getSessionSeed(): string | number`
- `buildGlobalFeedState(rawInventory, currentUserId, filters, sessionSeed): { showcaseProperties, connectionServices, activeSpotlights, deck }`

## Pendencias Intencionais

- Migrar filtros/posicao do deck do Dashboard para o service em uma etapa separada.
- Remover helpers historicos de portfolio do `App.jsx` apenas quando nenhum outro fluxo de portfolio/sync depender deles.
