# DealSifter - Logica, Fluxos e Funcionalidades

Ultima atualizacao: 2026-07-14

Este documento registra o funcionamento atual do DealSifter Match: dominios de produto, fontes de verdade, fluxos operacionais, regras de negocio, dependencias criticas e pontos de atencao para producao. Ele deve ser lido junto com:

- `docs/dealsifter_match_app_overview.md`
- `docs/MAXXIS_AI_DOCUMENTACAO.md`
- `docs/RUNBOOK_STRIPE.md`
- `docs/RUNBOOK_INCIDENTES.md`
- `docs/QA_DEPLOY_MOBILE.md`
- `docs/QA_UNLOCKED_CONTACTS_E2E.md`
- `docs/QA_MAPVIEW_V2.md`

## 1. Resumo Executivo

O DealSifter Match e um app de matchmaking imobiliario para investidores, wholesalers, FSBO owners, lenders, compradores, prestadores de servico e administradores. A experiencia principal e organizada em quatro pilares:

- Feed: descoberta por cards, swipes, favoritos, matches, unlocks, showcase e spotlight.
- MapView: descoberta geografica por pins, clusters, filtros, My PINs e Spotlight Cards.
- Matches: area de contatos desbloqueados, interesses, portfolio, chat, notificacoes e historico.
- Maxxis AI: assistente flutuante dentro do app para guiar uso da plataforma e contextualizar duvidas de Real Estate.

O modelo comercial combina:

- saldo de nuggets;
- packs de nuggets;
- planos Basic, Pro e Enterprise;
- desbloqueio de contatos;
- exclusividade temporaria;
- spotlight/destaque pago;
- suporte operacional e KPIs administrativos.

Principio central de producao:

- Supabase/Postgres/RPCs/Edge Functions sao a fonte de verdade.
- Stripe Webhook e a fonte de verdade financeira.
- `localStorage` nunca deve decidir direito pago, nuggets, plano, unlock, match pago ou contato desbloqueado.
- Cards publicos nunca podem carregar email, telefone, WhatsApp ou canais privados.

## 2. Arquitetura Atual

### 2.1 Frontend

Stack principal:

- React 19.
- Vite 7.
- Supabase JS.
- Stripe JS.
- Leaflet / React Leaflet / Supercluster.
- Framer Motion.
- jsPDF/html2canvas para PDF.
- Vitest para testes.
- Sentry/logs estruturados quando configurado.

Arquivos/pastas principais:

- `src/App.jsx`: orquestracao de sessao, rotas internas, modais e distribuicao de estado.
- `src/pages/Dashboard.jsx`: modulo Feed.
- `src/pages/MapView.jsx`: modulo MapView.
- `src/pages/MatchesPage.jsx`: modulo Matches.
- `src/pages/Onboarding.jsx`: cadastro de perfis, propriedades, servicos e preview.
- `src/pages/Pricing.jsx`: planos, packs, checkout e Billing Portal.
- `src/pages/AdminDashboard.jsx`: KPIs, suporte, doacoes de nuggets, concessao de plano e operacao.
- `src/components/maxxis/MaxxisAssistant.jsx`: widget e modal do Maxxis AI.
- `src/services/`: camada runtime de regras, Supabase, plano, unlock, suporte, mapa, feed, consentimento e tema.
- `src/lib/`: funcoes puras, normalizacao, sanitizacao, formatadores, ordenacao e politicas locais.

### 2.2 Backend e Banco

Supabase concentra:

- Auth e OAuth Google.
- Postgres com RLS.
- RPCs de negocio.
- Edge Functions.
- Storage de imagens.
- Realtime para chat, notificacoes e eventos operacionais.

Edge Functions relevantes:

- checkout Stripe.
- portal Stripe.
- stripe-webhook.
- stripe-reprocess-queue.
- delete-account.
- send-support-email.
- Maxxis AI / assistente.
- geocode-address, quando usado para geocoding backend.

### 2.3 Stripe

Stripe controla:

- assinaturas;
- Billing Portal;
- checkout de packs;
- eventos financeiros;
- renovacao/cancelamento de planos;
- idempotencia de webhooks;
- reprocessamento de eventos fora de ordem.

Regra: saldo de nuggets e plano so devem mudar depois de confirmacao server-side/webhook, nunca apenas por retorno visual do frontend.

### 2.4 Services e Camadas Canonicas

Services importantes:

- `planUsageService`: plano, nuggets, limites e features.
- `unlockedContactService`: contatos desbloqueados canonicos via RPC.
- `unlockHydrationService`: transforma unlock canonico em estado visual.
- `feedActionService`: acoes visuais de feed sem dados sensiveis.
- `mapInventoryService`: inventario unico de pins e spotlight.
- `themeService`: tema, logo e bootstrap visual.
- `consentService`: cookies, termos e privacy/data.
- `supportService`/fluxos de suporte: tickets, mensagens e historico.

Regra de arquitetura:

- Paginas orquestram estado.
- Services chamam Supabase/RPCs.
- Libs fazem funcoes puras.
- Componentes exibem dados recebidos.
- Componentes nao devem decidir entitlement pago.

## 3. Fontes De Verdade Por Dominio

### 3.1 Autenticacao

Fonte primaria:

- Supabase Auth.

Fluxos:

- signup email/senha;
- confirmacao por email;
- login email/senha;
- OAuth Google;
- reset de senha;
- callback de auth;
- sessao persistida e hidratacao segura.

Regras:

- Usuario recorrente nao deve ser tratado como primeiro acesso se ja possui perfil valido.
- Confirmacao de email deve retornar para rota valida do app, sem 404.
- Recriacao de conta com mesmo email nao deve reidratar historico antigo indevidamente.

### 3.2 Perfis

Perfis logicos:

- `personal`: perfil pessoal/profissional individual.
- `professional`: perfil business/operacional.
- `fsbo`: perfil For Sale By Owner.

Regras:

- Pelo menos um perfil valido deve existir para publicacao.
- Qualquer perfil pode ser o principal, secundario ou terciario.
- Personal nao e obrigatoriamente a referencia principal.
- Cada perfil tem nome, avatar, estado, categoria, email, telefone e canais de contato proprios.
- Nenhum perfil pode hidratar nome/avatar/dados de outro perfil do mesmo usuario.
- Cards devem usar a identidade do perfil vinculado ao item por `primary_profile`/escopo equivalente.

### 3.3 Portfolio

Entidades:

- propriedades;
- servicos;
- cards de perfil/pessoa.

Regras:

- Todo item precisa de `owner_id`.
- Todo item precisa de escopo de perfil vinculado.
- Propriedades aparecem em Showcase/Interests/MapView.
- Servicos e perfis aparecem em Connections/People/MapView.
- Imagens de propriedade/servico/perfil devem vir do DB/Storage, sem fallback ficticio em producao.
- Excluir item deve pedir confirmacao e persistir a exclusao/retirada de publicacao no banco.

### 3.4 Feed Global

Fonte primaria:

- RPC de inventario global, normalizada por `normalizeCard`.

Regras:

- Cards publicos devem ser sanitizados.
- Email, telefone, WhatsApp e contact methods privados nao podem existir no objeto publico.
- Cards ja desbloqueados pelo usuario nao devem continuar consumindo swipes como se fossem novos.
- Cards proprios podem ser visualizados, mas nao selecionados como match/unlock.
- Cards proprios devem ir ao final da pilha por padrao.
- Randomizacao da primeira sessao deve ser deterministica por seed de sessao.

### 3.5 Contatos Desbloqueados

Fonte canonica:

- RPC `ds_get_unlocked_contact_cards(p_user_id)`.
- `src/services/unlockedContactService.js`.

Estrutura esperada:

- owner desbloqueado;
- perfil primario;
- escopo de unlock;
- contato;
- portfolio;
- propriedades desbloqueadas;
- status de exclusividade.

Regras:

- Se nao ha entitlement, contato deve ser `null`/bloqueado.
- Se ha unlock de owner, contato e portfolio completo devem aparecer sem paywall adicional.
- Se ha unlock de propriedade, contato do owner aparece no contexto daquela propriedade.
- Mobile, desktop, modal e refresh devem mostrar o mesmo resultado.
- `ContactButtons` deve ser apresentacional.
- `PortfolioContactPanel` centraliza exibicao de contato em Matches.

### 3.6 Planos, Nuggets e Features

Fonte primaria:

- DB/RPCs via `planUsageService`.

Actions controladas:

- `swipe`;
- `unlock`;
- `spotlight`;
- `export_pdf`;
- `chat`;
- `exclusivity`.

Regras:

- Nenhum componente deve decidir por `plan === 'pro'`, mock local ou `ds_subscription_mock`.
- Upgrade pago ou concedido por admin deve refletir imediatamente via DB/Realtime/refresh de service.
- Nuggets so podem ser debitados/creditados por servidor.

### 3.7 Notificacoes

Fonte primaria:

- tabela `notifications` e realtime.

Tipos:

- unlock;
- exclusive;
- spotlight_expired;
- chat;
- support;
- system.

Regras:

- Notificacoes devem persistir entre sessoes.
- Clicar nao deve apagar historico automaticamente.
- Usuario deve poder excluir item individualmente e, quando existir UI, excluir todas.
- Notificacoes clicaveis devem levar ao modulo correto.

## 4. Fluxos Principais

### 4.1 Primeiro Acesso

Fluxo:

1. Usuario acessa homepage.
2. Aceita cookies, se necessario.
3. Faz signup/login.
4. Aceita termos/privacidade se ainda nao aceitou a versao vigente.
5. App hidrata sessao.
6. Feed ou onboarding abre conforme existencia de perfil valido.

Regras:

- Nao deve haver flash de tema errado.
- O loader deve respeitar tema ativo.
- Usuario ja cadastrado nao deve ver botao de registro como primeiro acesso se possui perfil publicado/valido.

### 4.2 Onboarding, Edicao e Preview

Fluxo:

1. Usuario cria ou edita perfis.
2. Define prioridade de cada perfil.
3. Cria propriedades e servicos.
4. Vincula cada item ao perfil correto.
5. Visualiza Preview to Feed.
6. Publica.
7. Feed, MapView, Matches e My Cards devem refletir DB.

Preview to Feed:

- coluna esquerda deve alternar cards de perfil/pessoa;
- coluna direita deve mostrar somente propriedades/servicos vinculados ao perfil selecionado;
- nao deve repetir card pessoal na coluna de propriedades/servicos;
- em mobile, cards verticais nao podem estourar viewport nem comprimir dados.

### 4.3 Feed

Abas:

- Connections / Pessoas e Servicos.
- Spotlight / Destaques.
- Showcase / Vitrine de Negocios.

Fluxo:

1. Busca inventario global.
2. Normaliza e sanitiza.
3. Aplica filtros.
4. Ordena com `orderDeck`.
5. Mantem memoria da posicao ao trocar modulos.
6. Renderiza cards.

Interacoes:

- X rejeita.
- estrela favorita/desbloqueia conforme contexto.
- check/match seleciona interesse quando permitido.
- cards proprios geram toast "Own card, not selectionable".

### 4.4 MapView

Fonte:

- `mapInventoryService.buildMapInventory(normalizedCards, currentUserId, filters)`.

Inventario:

- `allPins`: todos os pins validos e publicados.
- `spotlightCards`: subconjunto pago de `allPins`.
- `myPins`: subconjunto proprio de `allPins`.
- `clusterablePins`: pins clusterizaveis.

Regras:

- Todos os usuarios/perfis publicados devem aparecer no mapa conforme filtros.
- Todos os pins devem derivar da mesma lista base.
- `Spotlight Cards` mostra apenas cards com destaque pago.
- O mapa principal mostra todos os pins elegiveis, nao apenas spotlight.
- My PINs + Deals mostra propriedades do usuario logado.
- My PINs + People mostra perfis/servicos do usuario logado.
- Clusters devem expandir com contagem correta.
- Geocoding client-side por Nominatim/Census/Photon/ArcGIS deve ser evitado; lat/lng deve estar persistido ou resolvido por Edge Function/backfill.

### 4.5 Matches

Colunas:

- People.
- Interests.
- painel de conversa/portfolio.

Estados:

- Locked.
- Unlocked/Paid.
- Archived.
- Exclusive.

Regras:

- Contatos desbloqueados aparecem em Matches.
- Entitlement vem de `unlockedContactService`.
- Propriedades de owner desbloqueado nao devem pedir paywall adicional.
- Propriedade exclusiva de terceiro mostra badge/timer, nao paywall generico.
- Liberação cruzada/reciproca deve aparecer quando prevista pela regra de unlock/exclusividade.
- Filtros de estado em Interests devem operar sobre estado da propriedade.

### 4.6 Chat Usuario-Usuario

Regras para chat:

1. O contato desbloqueado deve ter DealSifter Chat como canal desejado ou regra de aviso deve ser aplicada.
2. Ambos os lados precisam ter plano com chat liberado para conversa plena.
3. Se o remetente tem chat e o recebedor nao:
   - recebedor recebe aviso de tentativa de contato e sugestao de upgrade;
   - remetente recebe aviso para usar canais alternativos disponiveis no perfil.
4. Mensagens sistemicas devem respeitar idioma do usuario.
5. Mensagens importantes devem gerar notificacao clicavel.
6. Historico minimo deve ser preservado e paginado.

### 4.7 Suporte Humano

O suporte dentro do app possui:

- chat/ticket real;
- historico por usuario;
- tickets abertos e resolvidos;
- agrupamento de tickets fechados por usuario;
- badges de nao lidas no Admin;
- quick messages/presets editaveis;
- configuracao de linguagem/tamanho quando aplicavel;
- opcao de email transacional quando provider esta configurado.

Admin:

- botao "Chat Sup." no painel;
- lista de novos chats;
- lista de solucionados;
- abertura de conversa estilo Matches;
- quick replies e mensagens personalizadas.

Usuario:

- acessa suporte por Settings/Communications ou Maxxis AI;
- notificacoes clicaveis levam ao chat de suporte.

### 4.8 Maxxis AI

Maxxis AI e o assistente integrado ao DealSifter Match. Ele substitui gradualmente o antigo GuideTips como guia principal do usuario.

Interface:

- widget flutuante em todas as telas;
- icone baseado na logomarca/gif do app;
- suporte a drag/drop do widget;
- modal sobreposto ao app;
- minimizacao sem perder contexto de conversa;
- botao de reset;
- botao de suporte humano;
- campo de digitacao com botao Send;
- mensagens do usuario com gradiente/transparencia no padrao visual dos chats;
- tema claro/escuro com contraste correto.

Conhecimento primario:

- documentacao `.md` do DealSifter Match;
- funcionalidades reais do app;
- workflows de Feed, MapView, Matches, Pricing, Onboarding, Settings, Admin, suporte, PWA/mobile, nuggets, unlock, spotlight e exclusividade.

Conhecimento secundario:

- Tax Deed Investing nos EUA;
- Wholesale Real Estate nos EUA;
- mercado imobiliario americano;
- REITs, flipping, wholetail, buy-and-hold, seller financing e outros topicos correlatos quando ajudarem o uso do app.

Limitacoes:

- nao deve inventar funcionalidades inexistentes;
- nao deve dar consultoria juridica/fiscal/financeira personalizada;
- nao deve expor chaves, tokens, SQL sensivel, logs privados ou dados confidenciais;
- deve sugerir suporte humano para casos de conta, pagamento, bug critico ou informacao sensivel.

Navegacao interna:

- Maxxis pode gerar botoes internos para levar o usuario ao modulo certo.
- Actions permitidas incluem: Feed, MapView, Matches, Pricing, Onboarding, Settings, Profile, Notifications, Support e Admin quando aplicavel.
- Usar no maximo 2 botoes de navegacao por resposta.
- Texto dos botoes deve acompanhar idioma detectado.

Protocolo de resposta:

- cumprimentar de forma calorosa quando apropriado, preferencialmente na primeira interacao diaria;
- confirmar entendimento quando util;
- responder de forma clara e sucinta primeiro;
- ampliar se o usuario pedir;
- usar exemplos praticos;
- sugerir proximos passos;
- manter tom profissional, didatico e nao condescendente.

### 4.9 Pricing e Checkout

Fluxo:

1. Usuario escolhe pack ou plano.
2. App mostra resumo e termos.
3. Checkout Stripe abre.
4. Webhook confirma pagamento.
5. DB atualiza plano/nuggets.
6. UI atualiza via refresh de services/realtime.

Regras:

- saldo nao sobe antes do webhook;
- fechar aba antes do retorno nao deve conceder saldo indevido;
- eventos Stripe duplicados devem ser ignorados por idempotencia;
- eventos fora de ordem devem ser logados/reprocessados quando necessario.

### 4.10 Admin System

Funcoes:

- KPIs operacionais;
- receita e eventos financeiros;
- nuggets manuais;
- concessao gratuita de Pro/Enterprise;
- Chat Sup.;
- tickets e historico;
- Stripe reprocess queue;
- Entitlement Alerts;
- monitoramento de eventos criticos;
- suporte a incidentes.

Regras:

- Toda acao admin que altera plano/nuggets deve gravar evento/auditoria.
- Upgrades concedidos devem afetar imediatamente chat, swipes, unlocks, PDF e demais features.

## 5. Regras De Negocio Criticas

### 5.1 Custo Snapshot De Unlock

Regra:

- custo = soma do portfolio ativo do contato no momento da intencao;
- custo minimo = 1 nugget;
- custo deve ser calculado no servidor;
- token de intencao possui TTL;
- se portfolio mudar antes da confirmacao, RPC retorna erro `UnlockCostChanged` com novo valor.

### 5.2 Entitlement Owner vs Propriedade

Unlock de owner:

- libera contato do owner;
- libera portfolio completo do owner sem paywall adicional;
- nao concede exclusividade.

Unlock de propriedade:

- libera detalhes da propriedade especifica;
- libera contato do owner no contexto daquela propriedade;
- demais propriedades podem continuar bloqueadas.

Exclusividade:

- bloqueia propriedade para terceiros;
- deve impedir acesso indireto aos canais exclusivos por outro card do mesmo contato durante vigencia;
- comprador exclusivo ve normalmente;
- terceiros veem badge/timer.

### 5.3 Spotlight

Regra:

- usuario escolhe card ativo para destacar;
- destaque aparece em Feed, barra de anuncios, halo visual e sidebar `Spotlight Cards` no MapView;
- cards destacados proprios tambem devem aparecer nos pontos de destaque para todos os usuarios, inclusive para o usuario logado.

### 5.4 Dados Publicos vs Dados Pagos

Publico:

- nome publico;
- avatar publico;
- categoria;
- localizacao publica;
- badges;
- resumo;
- portfolio sem canais privados.

Pago/desbloqueado:

- email;
- telefone;
- WhatsApp;
- canais de contato;
- detalhes permitidos pela regra de entitlement.

Regra: nenhum builder publico pode carregar contato privado, mesmo que a UI esteja borrando visualmente.

### 5.5 Soft-Delete e LGPD

Ao deletar conta:

- registrar auditoria;
- anonimizar dados pessoais;
- preservar trilha financeira/KPI sem PII;
- cancelar assinatura ativa;
- desativar cards/portfolio;
- tratar arquivos em Storage conforme politica;
- impedir reidratacao indevida em nova conta com mesmo email.

### 5.6 Consentimento e Termos

Regras:

- aceitar termos/privacidade uma vez por versao;
- persistir aceite no DB;
- manter historico mesmo apos cancelamento/delecao, para auditoria;
- nao exibir modal repetidamente para usuario ja aceito;
- checkout pode exigir aceite especifico de termos comerciais.

## 6. Internacionalizacao

Idiomas:

- ingles como padrao;
- portugues;
- espanhol.

Regras:

- UI deve usar `translations.js` ou camada equivalente.
- Mensagens sistemicas devem preferir `message_code` + `params`.
- Chat e suporte devem respeitar preferencia de linguagem.
- Maxxis deve detectar idioma e responder no idioma do usuario.
- Nomes proprios, marcas e enderecos nao devem ser traduzidos.

## 7. Tema, Logo, Mobile e PWA

Tema:

- `themeService` controla tema, logo e meta theme-color.
- `index.html` aplica `data-theme` cedo para evitar flash.
- Toggle deve mostrar a acao oposta correta.

Logo:

- tema claro usa asset claro;
- tema escuro usa asset escuro;
- mobile usa imagem unica correta do conjunto logo+nome+Match.

PWA:

- manifest com icons 192/512;
- apple-touch-icon;
- display standalone;
- botao "Adicionar a tela principal" no hamburger;
- iOS mostra instrucao manual;
- Android usa prompt nativo quando disponivel.

Mobile/iOS:

- iPhone SE 2 e Safari iOS sao referencia de menor viewport suportado.
- Modais nao podem extrapolar viewport.
- Teclado nao pode cobrir input de chat.
- Cards verticais precisam quebrar badges/linhas sem cortar informacao.
- Build deve preservar polyfills/legacy quando necessario.

## 8. PDF De Exportacao

Fluxo:

1. Usuario acessa portfolio/propriedade liberada.
2. Se plano permite, usa Export PDF.
3. PDF deve seguir layout A4.
4. Deve incluir cabecalho, dados do owner/propriedade, imagens, notas e mapa.

Regras:

- Logo oficial no cabecalho.
- Fotos adicionais podem aparecer em grid 2 linhas x 5 colunas quando houver.
- Mapa deve ficar bem enquadrado.
- Sem paginas em branco.
- Valores monetarios devem usar formato compacto quando o espaco for pequeno: `$300K`, `$1,290K`, `$2M`.

## 9. Observabilidade e Operacao

Eventos importantes:

- falha de checkout;
- webhook stuck/out-of-order;
- RPC de unlock falhando;
- contato desbloqueado sem dados canonicos;
- paywall em owner desbloqueado;
- falha de Edge Function;
- erro de MapView/geocode;
- erro de Maxxis AI;
- falha de suporte/email.

Regras:

- nao logar PII;
- usar hashes para IDs em observabilidade externa;
- AdminDashboard deve concentrar alertas operacionais quando possivel;
- runbooks devem orientar diagnostico antes de alterar codigo.

## 10. Checklist Funcional Por Modulo

### Auth

- Signup email/senha.
- Login email/senha.
- Login Google.
- Confirmacao por email.
- Reset de senha.
- Callback correto.
- Sessao preservada sem logout falso.
- Termos e privacy com historico.

### Onboarding

- Criar/editar perfil personal.
- Criar/editar perfil professional.
- Criar/editar perfil fsbo.
- Limpar perfil sem reidratar outro escopo.
- Upload de avatar independente por perfil.
- Criar propriedades.
- Criar servicos.
- Vincular item ao perfil correto.
- Preview to Feed por perfil selecionado.
- Publicar e refletir em Feed/MapView/Matches.

### Feed

- Connections mostra pessoas/servicos reais.
- Showcase mostra propriedades reais.
- Spotlight mostra destaques pagos.
- Cards proprios nao selecionaveis.
- Cards desbloqueados nao consomem swipe como novos.
- Contatos privados permanecem ocultos ate unlock.
- Ordenacao e filtros funcionam.

### MapView

- Todos os pins publicados aparecem conforme filtros.
- People/Deals/My PINs funcionam em combinacao.
- Spotlight Cards lista somente destaques pagos.
- Clusters contam e expandem corretamente.
- Clique em pin leva ao card correto no Feed.
- Sem geocoding client-side que gere CORS.

### Matches

- Contatos desbloqueados aparecem.
- Emails/telefones aparecem somente quando ha entitlement.
- Owner desbloqueado libera portfolio completo.
- Propriedade desbloqueada libera contexto correto.
- Exclusividade mostra timer/badge.
- Filtro de estado em Interests funciona.
- Chat e notificacoes persistem.

### Pricing

- Packs de nuggets.
- Planos Pro/Enterprise.
- Checkout Stripe.
- Portal Stripe.
- Webhook atualiza saldo/plano.
- Falhas exibem mensagem clara.

### Admin

- KPIs reais.
- Doacao de nuggets.
- Concessao de plano.
- Chat Sup.
- Tickets abertos/resolvidos.
- Reprocessamento Stripe.
- Entitlement Alerts.

### Maxxis AI

- Widget flutuante aparece.
- Drag/drop funciona.
- Modal abre e minimiza sem perder contexto.
- Envia mensagem real.
- Responde no idioma do usuario.
- Sugere navegacao interna quando util.
- Suporte humano acessivel.
- Nao inventa funcionalidades.

## 11. Riscos Persistentes

### 11.1 App.jsx Ainda Sensivel

Mesmo com services extraidos, `App.jsx` ainda concentra orquestracao ampla. Risco: ajuste em feed afetar matches, plano ou onboarding.

Direcao:

- continuar extraindo feed state;
- reduzir acoplamento de hydrations;
- manter services como unica entrada de dados canonicos.

### 11.2 Onboarding e Escopo

Risco: perfis personal/professional/fsbo misturarem nome/avatar/dados quando usuario limpa ou alterna escopo.

Direcao:

- reforcar que cada perfil e independente;
- salvar limpezas explicitamente;
- eliminar qualquer fallback cruzado entre perfis.

### 11.3 Entitlement De Contatos

Risco: Matches, modal ou mobile exibirem contatos de forma divergente se algum caminho fugir do service canonico.

Direcao:

- `unlockedContactService` como unica fonte;
- `PortfolioContactPanel` como render unico;
- testes E2E de contatos desbloqueados antes de deploy.

### 11.4 MapView

Risco: filtros/pins/spotlight divergirem se surgir fonte paralela.

Direcao:

- todos os pins via `mapInventoryService`;
- geocoding backend/backfill;
- QA MapView V2 obrigatorio apos ajustes.

### 11.5 Maxxis AI

Risco: assistente responder fora do escopo, inventar feature ou falhar silenciosamente por chave/API.

Direcao:

- manter documentacao operacional atualizada;
- logs claros para falha de AI;
- fallback para suporte humano;
- atualizar prompt/documentacao quando novos modulos forem adicionados.

### 11.6 i18n

Risco: strings hardcoded em portugues/ingles aparecerem no idioma errado.

Direcao:

- auditoria continua em componentes novos;
- mensagens sistemicas por codigo;
- Maxxis e chat respeitando idioma ativo.

## 12. Recomendacao De Proximo Caminho

Sequencia tecnica sugerida:

1. Consolidar de vez o isolamento de perfis no Onboarding.
2. Revalidar entitlement de contatos desbloqueados em desktop, mobile e modal.
3. Finalizar MapView como consumidor puro de `mapInventoryService`.
4. Remover qualquer dependencia runtime de localStorage proibido.
5. Expandir testes unitarios para services canonicos.
6. Executar QA mobile/iOS antes de cada deploy visual.
7. Usar Maxxis AI como guia principal e reduzir dependencia de GuideTips.

## 13. Conclusao

O DealSifter Match ja possui uma base ampla: auth, onboarding, feed, mapa, matches, pricing, checkout, admin, suporte, chat, spotlight, exclusividade, i18n, PWA/mobile, PDF e Maxxis AI.

O desafio principal nao e falta de funcionalidade. O desafio e garantir consistencia entre:

- perfil correto;
- portfolio correto;
- card publico sanitizado;
- contato desbloqueado canonico;
- mapa derivado do mesmo inventario;
- plano/nuggets validados por servidor;
- experiencia mobile sem regressao visual.

Maxxis AI passa a ser parte central da experiencia: orienta o usuario, reduz dependencia de tooltips estaticos, leva o usuario ao modulo correto e apoia com conhecimento de Real Estate sem ultrapassar limites de produto, privacidade ou consultoria profissional.
