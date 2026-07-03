# QA Mobile: iPhone Safari e PWA

Este roteiro valida a primeira impressao mobile do DealSifter antes de producao, com foco em iPhone/Safari, responsividade, teclado, modais e instalacao na tela inicial.

## Escopo

- Ambiente alvo: `https://dealsiftermatch.vercel.app`
- Navegadores: Safari iOS/iPadOS e Chrome Android
- Resultado esperado geral: nenhum corte lateral, nenhum modal preso fora da tela, nenhum teclado cobrindo input ativo, nenhum fluxo financeiro bloqueado por popup.

## Matriz de Dispositivos

| Dispositivo | Viewport alvo | Navegador | Prioridade | Observacao |
| --- | --- | --- | --- | --- |
| iPhone SE 2 | 375 x 667 CSS px | Safari | Critica | Menor viewport suportado. Deve ser o teste de corte e teclado. |
| iPhone 13/14/15 | 390 x 844 CSS px ou similar | Safari | Critica | Referencia iPhone moderna. |
| iPad recente | 768 x 1024 CSS px ou superior | Safari | Alta | Tablet deve manter layout sem cair em desktop quebrado. |
| Android Chrome | 360 x 800 CSS px ou similar | Chrome | Alta | Referencia comparativa, ja aparenta estar mais estavel. |

## Roteiro Por Dispositivo

Execute os cenarios abaixo em cada dispositivo da matriz. Marque `OK`, `Falhou` ou `Nao aplicavel` e anexe screenshot quando falhar.

| Area | Passos | Resultado esperado | Onde confirmar |
| --- | --- | --- | --- |
| Feed: swipe de cards | Abrir Feed, alternar entre Connections, Spotlight e Showcase, fazer swipe/touch nos cards. | Swipe responde no corpo inteiro do card; cards proprios podem ser visualizados, mas nao selecionados como match; pilha nao corta laterais. | Feed mobile/tablet. |
| Feed: modal de unlock | Abrir card de outro usuario, tocar no botao de unlock/check, abrir modal de custo snapshot. | Modal cabe na tela, permite rolagem se necessario, mostra custo correto e fecha pelo botao. | Feed e saldo de nuggets. |
| Feed: filtros | Usar filtros de categoria, estado e tipo de perfil. | Filtros nao deslocam layout horizontalmente; retorno ao Feed preserva posicao visual/deck quando aplicavel. | Barra de filtros e pilha. |
| MapView: zoom/clusters | Abrir MapView, testar zoom in/out e tocar clusters com multiplos pins. | Cluster deve expandir para todos os pins correspondentes visiveis, sem pins duplicados vazios. | MapView. |
| MapView: sidebar | Abrir/fechar filtros laterais no mobile e tablet. | Sidebar nao cobre permanentemente o mapa; botoes continuam acessiveis; nao ha erro recorrente de carregamento. | MapView mobile. |
| MapView: pin tap | Tocar pin de pessoa e propriedade, abrir popup, tocar `View in Feed ->`. | Popup mostra portfolio correto; link leva ao Feed com o card clicado no topo da pilha correta. | MapView e Feed. |
| Matches: coluna de contatos | Abrir Matches, alternar People/Interests, abrir contato desbloqueado. | Colunas cabem no viewport; textos longos truncam corretamente; avatar corresponde ao perfil correto. | Matches. |
| Matches: chat | Abrir chat de contato permitido, focar input e enviar mensagem. | Teclado nao cobre o input; mensagens aparecem sem refresh; badge de nao lidas limpa ao abrir. | Matches/chat. |
| Onboarding: upload de avatar | Criar/editar perfil, subir avatar pelo seletor do Safari/Chrome. | Preview aparece, upload persiste e o avatar correto hidrata Feed, Matches e MapView. | Onboarding, Feed, MapView. |
| Onboarding: formulario com teclado | Preencher campos de nome, email, telefone, descricao e endereco. | Campo focado fica visivel acima do teclado; nenhum botao principal fica inacessivel sem rolagem. | Onboarding. |
| Pricing: checkout | Abrir Pricing, escolher pack/plano e continuar para Stripe. | Checkout abre por acao direta do usuario. No iOS Safari, confirmar se nao houve bloqueio de popup; se bloquear, registrar screenshot. | Pricing e Stripe Checkout. |
| Modal generico | Abrir modais de preview, confirmacao, erro e menu hamburger. | Modal nao sai da tela, fecha por botao/overlay quando previsto e permite scroll em toda a area util. | Feed, MyCards, Preview to Feed, Navbar. |
| Tema claro/escuro | Alternar tema no hamburger. | Transicao sem piscar forte, logo correto por tema, contraste legivel e sem layout shift. | Navbar e Feed. |

## Checklist PWA

### Auditoria Estatica Atual

| Item | Status atual | Resultado | Arquivo |
| --- | --- | --- | --- |
| Manifest linkado no HTML | `index.html` aponta para `/site.webmanifest` | OK | `index.html` |
| Nome do app | `DealSifter` | OK | `public/site.webmanifest` |
| Short name | `DealSifter` | OK | `public/site.webmanifest` |
| Start URL | `/` | OK | `public/site.webmanifest` |
| Display standalone | `standalone` | OK | `public/site.webmanifest` |
| Icone 192x192 | Declarado como `/logo.png`; arquivo real tem 512x512 | OK funcional, melhorar asset dedicado | `public/site.webmanifest`, `public/logo.png` |
| Icone 512x512 | Declarado como `/logo.png`; arquivo real tem 512x512 | OK | `public/site.webmanifest`, `public/logo.png` |
| Apple touch icon | `/apple-touch-icon.png`; arquivo real tem 512x512 | OK funcional, melhorar asset 180x180 dedicado | `index.html`, `public/apple-touch-icon.png` |
| Viewport | `width=device-width, initial-scale=1.0, viewport-fit=cover` | OK | `index.html` |
| Theme color | `#6366f1` | OK tecnico, revisar se deve seguir cor da marca | `index.html`, `public/site.webmanifest` |
| Apple web app capable | `yes` | OK | `index.html` |
| Estado ja instalado | Usa `display-mode: standalone` e `navigator.standalone` | OK | `src/App.jsx` |
| Android install prompt | Usa `beforeinstallprompt` e `prompt()` | OK | `src/App.jsx` |
| iOS install instruction | Sem prompt nativo; mostra toast manual | OK funcional, texto precisa i18n | `src/App.jsx` |
| Botao no hamburger | Renderiza quando `showInstallAppButton` esta ativo | OK | `src/components/layout/Navbar.jsx` |

### Teste Manual Do Botao "Adicionar a Tela Inicial"

| Plataforma | Passos | Resultado esperado |
| --- | --- | --- |
| iPhone Safari | Abrir app no Safari, abrir hamburger, tocar `Adicionar a tela principal`. | Deve aparecer instrucao manual: Compartilhar > Adicionar a Tela de Inicio. Safari nao mostra prompt nativo. |
| iPhone instalado | Abrir pelo icone da tela inicial. | Botao nao deve aparecer; app deve abrir em modo standalone sem barra do Safari. |
| Android Chrome | Abrir app no Chrome, abrir hamburger, tocar `Adicionar a tela principal`. | Deve abrir prompt nativo de instalacao. Se ja instalado, botao some. |
| Android instalado | Abrir pelo icone instalado. | `display-mode: standalone` ativo; botao nao aparece. |

## Problemas Encontrados Na Auditoria PWA

| Prioridade | Problema | Impacto | Arquivo responsavel | Acao recomendada |
| --- | --- | --- | --- | --- |
| Critico | Validacao real em iPhone SE 2 ainda precisa ser executada em aparelho fisico ou BrowserStack. | Risco de layout cortado passar para producao sem evidencia. | `src/` | Executar matriz completa no SE 2 antes de liberar producao. |
| Alta | Checkout no iOS Safari precisa ser validado como acao direta do usuario. | Safari pode bloquear nova aba se o checkout for aberto fora do gesto do clique. | `src/` e funcoes Stripe | Testar pack e plano no iPhone; se bloquear, trocar para redirect na mesma aba no iOS. |
| Alta | Texto do toast de instalacao iOS esta hardcoded no `App.jsx` e nao passa pelo i18n. | Usuario americano/espanhol pode ver texto em portugues; tambem ha risco de encoding visual. | `src/App.jsx` | Mover titulo/mensagem para `translations.js`. |
| Cosmetico | O arquivo esperado pelo checklist chama-se `manifest.json`, mas o projeto usa `site.webmanifest`. | Nao quebra o app porque o HTML aponta corretamente; pode confundir QA/documentacao. | `index.html`, `public/site.webmanifest` | Manter como esta ou renomear para `manifest.json` em uma limpeza futura. |
| Cosmetico | Manifest declara o mesmo `/logo.png` para 192x192 e 512x512. | Funciona porque o arquivo tem 512x512, mas o ideal e ter asset dedicado 192x192. | `public/site.webmanifest` | Criar `icon-192.png` e `icon-512.png` explicitos. |
| Cosmetico | `apple-touch-icon.png` tem 512x512; iOS aceita redimensionar, mas o ideal e 180x180 dedicado. | Pode gerar crop/redimensionamento diferente em alguns iPhones. | `index.html`, `public/apple-touch-icon.png` | Criar `apple-touch-icon.png` 180x180 ou adicionar variante dedicada. |
| Cosmetico | `theme-color` atual e `#6366f1`, diferente da identidade principal turquesa/laranja. | Barra do navegador/PWA pode parecer menos alinhada a marca. | `index.html`, `public/site.webmanifest` | Revisar cor de tema final da marca antes da producao. |

## Evidencia Minima Para Aprovar

Antes de producao, anexar ao ticket/release:

- 1 screenshot do Feed em cada dispositivo.
- 1 screenshot do MapView com popup de pin em cada dispositivo.
- 1 screenshot do Matches com teclado aberto no chat em iPhone SE 2.
- 1 video curto do fluxo de instalar/adicionar a tela inicial no iPhone e no Android.
- 1 comprovacao de que checkout Stripe abriu corretamente no iPhone Safari.

## Criterio De Bloqueio

Bloquear producao se qualquer um destes itens falhar:

- iPhone SE 2 corta botao principal, modal de unlock ou input de chat.
- Checkout Stripe nao abre no Safari iOS.
- Upload de avatar nao persiste ou hidrata imagem de outro perfil.
- MapView mostra popup vazio, pin duplicado sem dados ou link `View in Feed ->` levando ao card errado.
- Botao de instalacao aparece quando o app ja esta em modo standalone.
