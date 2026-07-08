# QA Pre-Deploy Mobile

Checklist obrigatorio para toda mudanca visual antes de merge em `main`.

Como executar:
- Ambiente: preview Vercel ou producao, conforme a PR.
- Registrar no body da PR: build testado, data, dispositivos usados e itens falhos.
- Cada item deve ser marcado como passou ou falhou. Se falhar, anexar screenshot/video curto.

## Tema

Executar em Safari iOS e Chrome Android.

- [ ] Refresh em tema claro: fundo nunca pisca escuro.
- [ ] Refresh em tema escuro: fundo nunca pisca claro.
- [ ] Toggle de tema na navbar desktop: muda imediatamente.
- [ ] Toggle de tema no hamburger mobile: muda imediatamente.
- [ ] Logo mobile em tema claro: asset correto.
- [ ] Logo mobile em tema escuro: asset correto.

## Feed

Executar em iPhone SE 2 e iPhone 14.

- [ ] Cards aparecem sem corte lateral.
- [ ] Modal de unlock abre sem transbordar a tela.
- [ ] Filtros acessiveis com teclado aberto.
- [ ] Swipe de card funciona.

## Matches

- [ ] Coluna de contatos rolavel em mobile.
- [ ] Chat nao esconde input atras do teclado.
- [ ] `PortfolioContactPanel` mostra dados corretos em `variant="mobile"`.
- [ ] Modal preview nao extrapola viewport.

## MapView

- [ ] Mapa carrega e mostra pins.
- [ ] Cluster toca e expande corretamente.
- [ ] Sidebar acessivel em mobile; botao de toggle funciona.

## PWA

- [ ] Botao "Adicionar a tela inicial" aparece no hamburger.
- [ ] iOS mostra instrucao manual; sem prompt nativo.
- [ ] Android mostra prompt nativo se disponivel.
- [ ] App em modo standalone, apos instalar, nao mostra barra do browser.

## Resultado Da Execucao

Preencher antes do merge:

| Campo | Valor |
| --- | --- |
| Build/commit testado |  |
| Data |  |
| Responsavel |  |
| iPhone SE 2 | Passou / Falhou / Nao testado |
| iPhone 14 | Passou / Falhou / Nao testado |
| Chrome Android | Passou / Falhou / Nao testado |
| Falhas abertas |  |

