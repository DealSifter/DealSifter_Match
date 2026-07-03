# QA MapView - Clusters e Pins

## Objetivo

Validar que o MapView mostra clusters com contagem correta, explode clusters em pins individuais no zoom esperado, recalcula clusters apos filtros e preserva identidade correta de pessoas, servicos e propriedades.

Fixture de referencia: `src/fixtures/mapPinsFixture.js`.

## Fixture

O fixture contem 11 pins:

| Grupo | Quantidade | Distancia esperada | Resultado esperado |
| --- | ---: | --- | --- |
| `100m-cluster` | 5 | Ate 100m | Deve clusterizar em zoom baixo/intermediario e explodir em 5 pins no zoom individual |
| `5km-city-cluster` | 4 adicionais em Austin | Ate 5km entre bairros | Deve formar cluster regional/cidade antes do breakout |
| `different-state` | 2 em Denver/CO | Estado diferente | Nao deve clusterizar com Austin em zoom de estado/cidade |
| Spotlight | 2 | Dentro de Austin | Sidebar Spotlight deve listar apenas esses 2 |
| Exclusividade | 1 propriedade | Dentro do grupo 100m | Badge/estado de exclusividade deve aparecer somente no pin/card correto |

Tipos cobertos:

- Perfil pessoal/profissional/FSBO.
- Servico publicado em Connections.
- Propriedade publicada em Showcase.

## Matriz Manual

### 1. Zoom nivel pais

Pre-condicoes:

- Carregar o MapView com todos os filtros limpos.
- Usar os dados do fixture ou dados reais equivalentes.

Passos:

1. Abrir MapView.
2. Reduzir zoom ate ver Austin/TX e Denver/CO no mesmo mapa.
3. Conferir clusters visiveis.

Resultado esperado:

- A contagem total dos clusters deve somar 11.
- Austin e Denver podem ficar em clusters separados dependendo do zoom/bounds, mas nenhum pin deve desaparecer.
- O breakdown `P:x B:y` deve somar corretamente pessoas/servicos como `P` e propriedades como `B`.

Onde confirmar:

- Visualmente nos badges de cluster.
- Sidebar `Cards` deve listar os mesmos itens visiveis quando um cluster e selecionado.

### 2. Zoom nivel estado

Passos:

1. Aproxime para Texas.
2. Deixe Austin visivel, Denver fora ou distante.
3. Observe clusters regionais.

Resultado esperado:

- Austin deve consolidar os 9 pins do fixture.
- Denver nao deve ser contado dentro de clusters de Austin.
- O cluster deve mostrar contagem compativel com os filtros ativos.

### 3. Zoom nivel cidade

Passos:

1. Clique no cluster de Austin.
2. Confirmar que o mapa enquadra os pins da cidade/bairros.
3. Verificar clusters de bairro ou pins agrupados.

Resultado esperado:

- Primeiro click deve ampliar ate nivel de cidade sem perder leaves.
- Grupo `100m-cluster` deve continuar representando 5 pins enquanto ainda estiver em zoom abaixo do breakout.
- Grupo `5km-city-cluster` deve se separar por bairros conforme o zoom aumenta.

### 4. Zoom pin individual

Passos:

1. Em zoom de cidade, clicar novamente no cluster de 5 pins.
2. Conferir os pins resultantes.

Resultado esperado:

- O cluster deve explodir em 5 pins individuais.
- Nenhum pin deve ficar totalmente sobreposto ao outro.
- Cada popup deve abrir o card correto.
- O caso de exatamente 2 pins tambem deve ser testado: reduzir o fixture/filtro para dois itens proximos e confirmar que os dois aparecem apos o click.

### 5. Zoom out

Passos:

1. Depois de explodir os pins, reduzir o zoom abaixo do nivel de cidade.
2. Observar recomposicao dos clusters.

Resultado esperado:

- Clusters devem se recompor.
- A contagem deve voltar a somar 11.
- Nao devem sobrar pins individuais "presos" se o zoom saiu do modo de breakout.

### 6. Filtro por categoria

Passos:

1. Ativar filtro People.
2. Conferir cluster/contagem.
3. Ativar filtro Deals.
4. Conferir cluster/contagem.
5. Ativar um filtro de categoria especifica, por exemplo servicos ou FSBO.

Resultado esperado:

- Clusters recalculam usando somente pins filtrados.
- People deve refletir perfis/servicos.
- Deals deve refletir propriedades.
- Nenhum cluster deve manter contagem antiga apos troca de filtro.

### 7. Sidebar Spotlight

Passos:

1. Abrir aba/sidebar `Spotlight Cards`.
2. Conferir itens listados.

Resultado esperado:

- Deve mostrar apenas os 2 itens com spotlight ativo do fixture.
- Nao deve listar todos os pins visiveis.
- Ao clicar em um item da sidebar, o mapa deve ir para o pin correto.

### 8. Click em pin

Passos:

1. Clicar em um pin de pessoa.
2. Clicar em um pin de servico.
3. Clicar em um pin de propriedade.
4. Usar o link `View in Feed ->`.

Resultado esperado:

- Popup deve mostrar nome/avatar/categoria do perfil correto.
- Propriedade deve mostrar endereco e dono corretos.
- Servico deve mostrar titulo e perfil dono correto.
- `View in Feed ->` deve abrir o Feed com o card clicado na frente da pilha, sem misturar perfis do mesmo usuario.

## Pontos de Codigo Auditados

Arquivo: `src/pages/MapView.jsx`.

- Configuracao do Supercluster:
  - `clusterIndex` usa `new Supercluster({ radius: 60, maxZoom: 16, map, reduce })`.
  - `map` calcula `peopleCount`, `propertiesCount` e `unlockedCount`.
  - `reduce` soma esses contadores para o cluster.

- Calculo de clusters renderizados:
  - `clusters` chama `clusterIndex.getClusters(viewport.bounds, roundedZoom)`.
  - Se `roundedZoom >= CLUSTER_BREAKOUT_ZOOM`, retorna `filteredPoints` diretamente.

- Render do icone de cluster:
  - `getClusterIcon(total, peopleCount, propertiesCount, useUnlockedPropertyStyle)`.
  - O total exibido vem de `feature.properties.point_count`.
  - O breakdown exibido vem de `feature.properties.peopleCount` e `feature.properties.propertiesCount`.

- Explode/abertura de cluster:
  - `openCluster(clusterFeature)` pega todos os leaves com `clusterIndex.getLeaves(clusterId, Infinity, 0)`.
  - Primeiro click enquadra bounds dos leaves com `flyToBounds(... maxZoom: CLUSTER_CITY_LEVEL_MAX_ZOOM)`.
  - Em zoom de cidade, segundo click usa `spreadCoincidentFeatures(rawLeaves, 0.00045)` e `flyToBounds(... maxZoom: CLUSTER_BREAKOUT_ZOOM + 1)`.

- Edge case de exatamente 2 pins:
  - Nao ha branch especial para 2 pins.
  - O mesmo caminho `getLeaves(..., Infinity, 0)` deve retornar 2 leaves.
  - O risco pratico e sobreposicao visual se as coordenadas forem identicas ou muito proximas; `spreadCoincidentFeatures` deve separar os markers.

## Problemas que devem bloquear producao

- Cluster mostra `3`, mas apos click aparecem menos de 3 pins.
- Cluster mostra pins de Austin misturados com Denver em zoom de cidade/estado.
- Filtro troca, mas cluster mantem contagem anterior.
- Sidebar Spotlight lista item sem spotlight pago.
- Popup abre identidade errada ou propriedade de outro perfil.
- Cluster com exatamente 2 pins nao explode em 2 pins individuais.
