# Mapa de superfícies do Maxxis

## Superfícies atuais

| Superfície | Componente | Rota/página | Comportamento atual | Mudança futura permitida | Não tocar sem aprovação |
|---|---|---|---|---|---|
| FAB/avatar flutuante | `MaxxisAssistant.jsx`, `MaxxisAssistant.css` | Área autenticada global | Abre o painel, pode ser arrastado, persiste posição e permanece dentro da viewport | Presença contextual e estados visuais autorizados do próprio Maxxis | Navegação, conteúdo subjacente, bottom nav e breakpoints globais |
| Painel/chat Maxxis | `MaxxisAssistant.jsx` | Área autenticada global | Dialog com header, histórico, loading, input, envio, suporte e fechamento por `Escape` | Balões, cards e estados Maxxis explicitamente autorizados | Chat humano, foco automático, layout da página e histórico externo |
| Mensagens/capabilities | `MaxxisCapabilities.jsx` | Dentro do painel | Renderiza respostas estruturadas, ações de navegação, propriedades, services e feedback | Novos cards Maxxis e interações contextuais da fase | HTML arbitrário, ações autônomas e componentes compartilhados |
| Property Context | `MatchesPortfolio.jsx`, `MatchesPage.jsx`, `App.jsx` | Matches > propriedade | Seleção fornece contexto e “Analyze with Maxxis”; resposta factual usa `propertyId` | Insight Maxxis ligado ao contexto selecionado | Property Detail, export, portfolio, unlock e chat humano |
| Property Details/Advisor | `MaxxisCapabilities.jsx`, `maxxisService.js` | Painel Maxxis | Exibe fatos, campos ausentes, métricas fornecidas/calculadas e limitações | Apresentação de insight autorizada | Dados persistidos, regras financeiras e UI da propriedade |
| Deal Copilot | `MaxxisCapabilities.jsx` | Painel Maxxis | Overview estruturado com resumo, needs, providers e workflow | Cards e transições internas do Copilot | Workflow real, propriedade e navegação global |
| Provider cards | `MaxxisCapabilities.jsx`, `maxxisService.js` | Painel Maxxis | Fit, acesso de contato, prepare/cancel/confirm unlock e draft | Feedback contextual do próprio provider card | Débito de Nuggets, entitlement, contato privado e confirmação humana |
| Provider messaging | `MaxxisAssistant.jsx`, `MaxxisCapabilities.jsx`, `maxxisService.js` | Painel Maxxis | Draft editável; prepare/confirm/cancel; análise de conversa | Ajuda de redação e feedback autorizados | Envio automático, chat humano e políticas de acesso |
| Deal Progress/workflow | `MaxxisCapabilities.jsx`, `maxxisService.js` | Painel Maxxis | Mostra itens; somente itens manuais permitidos são alternáveis | Microinterações dentro do card autorizadas | Estado do workflow sem confirmação ou regras do backend |
| Navegação sugerida | `MaxxisCapabilities.jsx`, `App.jsx` | Painel para páginas existentes | Links Maxxis chamam handlers de navegação conhecidos | Novas sugestões de destino autorizadas | Rotas, menu e guards de onboarding |
| Suporte | `MaxxisAssistant.jsx`, `Settings.jsx` | Painel > Settings/Communication | Abre o fluxo de suporte existente | Apenas CTA/contexto Maxxis autorizado | Canal, persistência e UI global de Settings |

## Zonas futuras compatíveis

Estas zonas são reservas, não implementações:

- overlay flutuante ancorado ao FAB, sem reflow;
- toast/bubble contextual dismissível próximo ao FAB;
- área interna do header do chat Maxxis;
- corpo de cards Maxxis já renderizados no painel;
- badge discreto no próprio FAB;
- insight inline somente em área Maxxis explicitamente reservada;
- indicador de contexto dentro do painel, sem modificar Property Detail;
- controles futuros no header Maxxis e em Preferences, conforme contrato.

## Zonas incompatíveis por padrão

- header/nav global, menu principal e bottom nav;
- pilha e controles dos cards do Feed;
- colunas, split panes e chat humano de Matches;
- canvas/sidebar do MapView;
- formulários do Onboarding/Profile;
- modais de Stripe, Nuggets e unlock;
- cards compartilhados de property/service/contact.

## Dependências e limites

- `App.jsx` é o ponto de composição e roteamento de contexto, não uma licença para refatoração geral.
- `maxxisService.js` é o cliente de funções; autorização, rate limit e integridade permanecem server-side.
- O chat humano usa `useChatRealtime.js` e `chat_messages`; Maxxis não deve criar uma segunda verdade nem mesclar históricos.
- Feature flags falham fechadas por `featureFlagService.js`; kill switches operacionais continuam independentes de rollout.
- Todas as extensões devem preservar os snapshots e assertions da Fase 6.0 ou atualizar a baseline somente com aprovação.
