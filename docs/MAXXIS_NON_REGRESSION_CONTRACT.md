# Contrato de não regressão do Maxxis

## Finalidade

Este contrato congela a experiência funcional e visual existente no início da Fase 6. As fases 6A–6G podem evoluir a presença contextual do Maxxis, mas não recebem autorização implícita para alterar o restante do DealSifter.

A referência Git da baseline é `a36ddf7d47f88efaf7dc46f9856ab4279f142017` (`main`) e a referência visual automatizada está em `e2e/tests/baseline/__screenshots__`.

## Alterações permitidas nas fases 6A–6G

Somente quando a fase autorizar explicitamente:

- componentes próprios do Maxxis;
- FAB/avatar, painel, cabeçalho e mensagens do Maxxis;
- cards, balões e insights contextuais do Maxxis;
- estados de loading, erro e confirmação do Maxxis;
- integrações Maxxis com Property Context, Deal Copilot, providers e workflow;
- pontos de interação Maxxis identificados em `MAXXIS_SURFACE_MAP.md`.

Mesmo nesses pontos, a alteração deve preservar contratos de dados, segurança, confirmação humana, responsividade, acessibilidade e independência do chat humano.

## Superfícies protegidas

Sem aprovação explícita, as fases 6A–6G não podem alterar:

- layout global, header, menu, rotas ou navegação;
- identidade visual, paleta, tipografia, ícones ou espaçamentos globais;
- Dashboard, Feed, Matches, Profile, Preferences, Onboarding ou MapView;
- cards compartilhados, pilhas, tabs, modais ou breakpoints;
- chat humano, contatos, regras de `locked/unlocked` ou mensageria;
- Stripe, planos, Nuggets, unlocks, entitlements ou feature flags;
- properties, services, workflow ou componentes compartilhados sem necessidade direta;
- conteúdo ou estado da página sob o overlay do Maxxis.

Código antigo, longo, duplicado ou pouco elegante que esteja funcional e fora do escopo deve ser registrado como backlog, não refatorado oportunisticamente.

## Contratos funcionais do Maxxis

- O usuário abre e fecha o painel deliberadamente; `Escape` continua fechando-o.
- Fechar e reabrir preserva a conversa da sessão.
- O FAB permanece disponível, arrastável e limitado à viewport; sua posição persistida continua respeitada.
- Loading, erro e resposta devem ser distinguíveis e não podem bloquear o app.
- Property Context deve permanecer factual e vinculado à propriedade selecionada.
- Deal Copilot, providers e Deal Progress continuam respostas estruturadas, não HTML arbitrário.
- Unlock e envio de mensagem exigem os fluxos de preparação/confirmação já existentes.
- Maxxis não substitui, intercepta nem mistura seu histórico com o chat humano.
- Maxxis não se torna agente autônomo. Ele sugere; o usuário decide e confirma.

## Contrato de animação

Toda animação futura do Maxxis deve:

- respeitar `prefers-reduced-motion`;
- nunca deslocar layout, bloquear conteúdo ou impedir clique;
- nunca capturar foco sem ação do usuário;
- nunca repetir agressivamente nem usar áudio automático;
- permitir dismiss/ignore quando contextual;
- ser discreta por padrão e interrompida quando o painel ou contexto for fechado;
- manter hit targets, nomes acessíveis e navegação por teclado.

## Princípios de interação proativa

Maxxis deve ser contextual, útil, discreto, fácil de ignorar, não infantil, não invasivo e não persistentemente irritante. Ele pode sugerir presença; não pode exigir atenção. Não deve reaparecer em loop, perseguir o cursor, interromper digitação, sobrepor CTA crítico ou simular urgência inexistente.

## Reservas de configuração futura

Dois pontos estão reservados, sem UI nova nesta fase:

1. cabeçalho do painel em `src/components/maxxis/MaxxisAssistant.jsx`;
2. menu/hamburger e Preferences, hoje em `src/components/layout/Navbar.jsx` e `src/pages/Settings.jsx`.

Qualquer controle futuro deve usar esses pontos somente após autorização expressa e sem alterar a estrutura global do menu.

## Hierarquia dos guards

1. Assertions estruturais determinísticas em `npm run audit:ui-structural`.
2. Testes funcionais Vitest e Playwright existentes.
3. Baseline visual em `npm run test:e2e:visual` e conjunto completo em `npm run audit:ui-regression`.
4. Accessibility, mobile, performance, architecture e quality gates.

Falha estrutural ou funcional bloqueia a fase. Pixel diff é analisado com tolerância limitada e máscaras somente para conteúdo realmente dinâmico.

## Aprovação de mudanças

Uma mudança deliberada de baseline exige:

- autorização explícita do escopo visual/funcional;
- revisão das imagens antes de `--update-snapshots`;
- atualização deste contrato e do mapa de superfícies quando aplicável;
- execução de todos os gates da Fase 6.0;
- registro claro do motivo no commit.

Atualizar snapshots apenas para “fazer o teste passar” viola este contrato.
