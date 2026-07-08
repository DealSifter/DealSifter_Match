# QA MapView V2

Objetivo: validar que MapView usa um unico inventario canonico para pins, Spotlight Cards, My PINs e filtros People/Deals.

## Arquitetura Esperada

- `normalizeCard()` remove cards invalidos antes do mapa.
- `buildMapInventory()` recebe os cards normalizados e monta:
  - `allPins`: todos os cards publicados com lat/lng validos.
  - `spotlightCards`: subconjunto de `allPins` com `isSpotlight = true`.
  - `myPins`: subconjunto de `allPins` com `isOwnCard = true`.
  - `clusterablePins`: `allPins` sem `myPins`.
- A aba `Spotlight Cards` renderiza apenas `inventory.spotlightCards`.
- O mapa principal renderiza `inventory.clusterablePins + inventory.myPins`.
- Os filtros People, Deals e My PINs filtram o mesmo inventario; nao devem disparar busca ou montagem paralela.

## Matriz De Testes

### 1. Carga Inicial

Pre-condicoes:
- Usuario logado.
- Existem cards de pessoas/servicos e propriedades publicados com coordenadas.

Passos:
1. Abrir Map View.
2. Confirmar que pins de pessoas e propriedades aparecem quando People e Deals estao ativos.
3. Abrir o console do navegador.

Resultado esperado:
- Mapa carrega sem erro de pagina.
- Console nao mostra erro nao tratado de MapView.
- Clusters exibem contagem coerente com os pins visiveis.

### 2. People

Passos:
1. Deixar apenas People ativo.
2. Observar o mapa.
3. Abrir a aba Spotlight Cards.

Resultado esperado:
- Mapa mostra apenas pins de pessoas/servicos.
- Spotlight Cards mostra apenas destaques de pessoas/servicos que tambem existem como pins.

### 3. Deals

Passos:
1. Deixar apenas Deals ativo.
2. Observar o mapa.
3. Abrir a aba Spotlight Cards.

Resultado esperado:
- Mapa mostra apenas propriedades publicadas.
- Spotlight Cards mostra apenas propriedades destacadas que tambem existem como pins.

### 4. People + Deals

Passos:
1. Ativar People e Deals.
2. Observar clusters e pins individuais.

Resultado esperado:
- Pessoas, servicos e propriedades aparecem juntos.
- Zoom in explode clusters em pins individuais.
- Zoom out recompõe clusters com contagem correta.

### 5. My PINs

Passos:
1. Ativar My PINs.
2. Testar com People ligado e Deals desligado.
3. Testar com Deals ligado e People desligado.
4. Testar com People e Deals ligados.

Resultado esperado:
- My PINs mostra apenas cards do usuario logado.
- People/Deals continuam filtrando dentro dos proprios pins.
- Propriedades proprias aparecem quando Deals esta ativo.
- Perfis/servicos proprios aparecem quando People esta ativo.

### 6. Spotlight Cards

Passos:
1. Comprar/ativar destaque para um card proprio.
2. Comprar/ativar destaque para card de outro usuario.
3. Abrir Map View.
4. Abrir aba Spotlight Cards.

Resultado esperado:
- Todos os destaques pagos aparecem na aba se tiverem coordenadas validas.
- Destaques proprios tambem aparecem.
- Os mesmos cards destacados existem como pins no mapa.
- A contagem da aba corresponde ao numero de `spotlightCards` visiveis apos filtros.

### 7. Filtro Por Estado/Cidade/ZIP

Passos:
1. Aplicar filtro por estado.
2. Repetir com People, Deals, My PINs e Spotlight Cards.

Resultado esperado:
- O filtro de localizacao atua sobre o inventario visivel atual.
- Spotlight Cards respeita People/Deals/My PINs.
- O mapa nao quebra quando a API externa de geocoding/boundary falha; deve usar fallback local.

### 8. Identidade Do Popup

Passos:
1. Clicar em pin de pessoa.
2. Clicar em pin de propriedade.
3. Clicar em card na aba Spotlight Cards.

Resultado esperado:
- Nome, avatar, categoria e estado pertencem ao perfil correto.
- Propriedade usa sua propria localizacao.
- Card pessoal usa o estado do formulario do perfil, nao a localizacao das propriedades vinculadas.

### 9. Regressao De Fonte Paralela

Passos:
1. Alterar um card no feed global para remover `isSpotlight`.
2. Recarregar Map View.

Resultado esperado:
- O card some simultaneamente da aba Spotlight Cards e do estado visual de destaque no mapa.
- Nao permanece card antigo vindo de outra lista separada.
