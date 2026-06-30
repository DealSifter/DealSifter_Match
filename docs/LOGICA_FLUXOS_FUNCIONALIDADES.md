# DealSifter - Logica, Fluxos e Funcionalidades

Ultima atualizacao: 2026-06-29

Este documento registra como o app esta estruturado hoje, quais sao as principais fontes de dados, como os fluxos funcionais se conectam e quais pontos ainda merecem atencao antes de consolidar uma operacao em producao com usuarios reais.

## 1. Resumo Executivo

O DealSifter e um app de matchmaking imobiliario com tres vitrines centrais:

- Feed: vitrine principal de pessoas, servicos, propriedades e oportunidades.
- Map View: visualizacao geografica de cards ativos e oportunidades.
- Matches: area de organizacao, desbloqueio, portfolio, contatos e chat.

O app tambem possui:

- Onboarding/cadastro: cria perfis, propriedades, servicos e preferencias.
- Pricing/checkout: controla assinaturas, packs de nuggets e pagamentos via Stripe.
- Admin System: acompanha KPIs, suporte e operacoes administrativas.
- Profile/Edit Profile: preferencias, comunicacao, pagamentos, seguranca, privacidade e dados.
- GuideTips: sistema inicial de guias e dicas para orientar o usuario.

O maior ponto estrutural atual e que o app evoluiu muito rapido e ainda possui trechos legados em `App.jsx`, `Onboarding.jsx` e em caches locais. A direcao correta ja iniciada e transformar o Supabase/DB na fonte de verdade para dados reais e deixar `localStorage` apenas como cache, UX temporaria ou fallback nao autoritativo.

## 2. Arquitetura Atual

### Frontend

Stack principal:

- React 19.
- Vite 7.
- Supabase JS.
- Stripe JS.
- Leaflet, React Leaflet e Supercluster para mapas.
- Framer Motion para animacoes.
- jsPDF para exportacao PDF.
- localForage/localStorage para cache e estado local.

Arquivos principais:

- `src/App.jsx`: orquestracao central, rotas internas, hidratacao, modais, feed global e conexao entre modulos.
- `src/pages/Dashboard.jsx`: modulo Feed.
- `src/pages/MapView.jsx`: modulo Map View.
- `src/pages/MatchesPage.jsx`: modulo Matches.
- `src/pages/Onboarding.jsx`: cadastro rapido, perfis, portfolio, preview e publicacao.
- `src/pages/Pricing.jsx`: planos, packs, FAQ, comparativo e checkout.
- `src/pages/AdminDashboard.jsx`: KPIs administrativos.

Hooks ja extraidos:

- `src/hooks/useAuthSession.js`: login, signup, OAuth Google, sessao Supabase e recuperacao de senha.
- `src/hooks/useProfileSync.js`: controle de salvamento/sincronizacao de perfil.
- `src/hooks/usePortfolioSync.js`: hidratacao e refresh de portfolio.
- `src/hooks/useCheckoutFlow.js`: fluxo de checkout, retorno Stripe, termos e intencao pendente.

### Backend e Banco de Dados

O backend operacional esta no Supabase:

- Auth: cadastro, login, OAuth Google, confirmacao de email.
- Postgres: perfis, portfolio, propriedades, servicos, desbloqueios, spotlights, eventos administrativos, consentimentos.
- RPCs: funcoes para feed global, eventos, KPIs, desbloqueios e guardrails.
- Edge Functions: checkout Stripe, portal Stripe e webhooks.
- Storage: imagens e midias dos cards.

### Stripe

O Stripe e usado para:

- Assinaturas mensais e anuais.
- Packs de nuggets.
- Checkout externo/hospedado.
- Webhook para refletir pagamento, plano, nuggets e eventos financeiros.

### LocalStorage e Cache

Uso valido:

- Preferencias visuais temporarias.
- Estado de UI.
- Ultima aba/modulo.
- Deck atual do feed durante a sessao.
- Cache temporario de formulario antes de persistir.

Uso que exige cautela:

- Regras de plano.
- Historico de unlock.
- Cards publicados.
- Portfolio real.
- Dados de identidade.

Para producao, essas informacoes devem vir do DB. O localStorage nao deve ser fonte final de verdade para aquilo que impacta cobranca, matching, desbloqueio, feed global ou visibilidade entre usuarios.

## 3. Fontes de Verdade por Dominio

### Autenticacao

Fonte primaria:

- Supabase Auth.

Fluxo:

- Signup por email cria usuario e pode exigir confirmacao por email.
- Login por email/senha usa `supabase.auth.signInWithPassword`.
- Google OAuth usa `supabase.auth.signInWithOAuth`.
- Confirmacao por email deve retornar o usuario para fluxo de login correto, evitando entrada direta indevida se a regra de produto exigir login manual apos confirmacao.

Observacoes:

- A sessao e preservada durante estados transitorios nulos para evitar logout falso ao navegar entre modulos.
- O app diferencia logout real de falhas temporarias de hidratacao.
- Admin pode ter privilegio de multipla sessao para testes.
- Usuarios comuns devem ter uma unica sessao ativa, com timeout por inatividade.

### Perfil do Usuario

Fonte primaria:

- Tabelas Supabase ligadas ao usuario autenticado.

Perfis logicos:

- `personal`: perfil profissional pessoal.
- `professional`: perfil business/operacional.
- `fsbo`: perfil For Sale By Owner.

O arquivo `src/lib/profileScopeResolver.js` centraliza parte da regra:

- Normalizacao de escopo.
- Resolucao de campos por escopo.
- Montagem de `profile_payload`.
- Filtro contra nomes suspeitos como `D4$`, `Drive4$`, `New User`, `Owner` e `Select`.

Regra de produto:

- O usuario precisa ter ao menos um perfil valido.
- Um perfil pode ser `Primary`, `Secondary`, `Tertiary` ou `Select`.
- Apenas perfis com prioridade publica valida e portfolio publicado devem gerar cards de dashboard/feed.
- Campos de skills, preferencias ou categorias nao podem substituir nome real do perfil.

### Portfolio

Fonte primaria:

- Propriedades e servicos persistidos no DB.

Entidades:

- Propriedades: aparecem no Showcase quando publicadas.
- Servicos: aparecem em Connections quando publicados.
- Cards de pessoa/perfil: aparecem em Connections quando o perfil esta valido e possui conteudo publicado atrelado.

Regra de vinculo:

- Cada item de portfolio precisa ter `owner_id`.
- Cada item precisa ter `primary_profile`/escopo efetivo: `personal`, `professional` ou `fsbo`.
- O card de feed deve puxar identidade do perfil vinculado ao item, nao de outro perfil do mesmo usuario.
- Mudar prioridade do perfil altera exposicao do card, mas nao deve misturar identidade entre perfis.

### Feed Global

Fonte primaria:

- RPC `ds_get_global_feed_inventory()`.

Regra:

- O feed global deve trazer cards reais, publicados, ativos e vinculados corretamente.
- Cards do proprio usuario podem aparecer, mas devem ficar por ultimo por padrao.
- Cards mock/demo nao devem entrar em producao real.
- Se um usuario de teste cria card, outro usuario deve conseguir ver esse card no feed e no MapView, salvo filtros aplicados.

### Desbloqueios e Exclusividade

Fonte primaria:

- Tabelas de unlock/exclusividade no Supabase.
- Eventos administrativos para KPI.

Regra de custo:

- Desbloqueio normal custa a soma do portfolio ativo do contato/proprietario.
- Custo minimo: 1 nugget.
- Exemplo: se o contato possui 9 itens ativos, desbloqueio custa 9 nuggets.
- Exclusividade total custa 20 nuggets adicionais quando elegivel.
- Exclusividade parcial custa 18 nuggets, aplicando 10% de desconto sobre 20.

Regra de exclusividade:

- Exclusividade se aplica a propriedades, nao ao card pessoal em si.
- Se o usuario desbloqueia um card de pessoa que possui propriedade elegivel, o modal pode oferecer exclusividade vinculada a essa propriedade.
- O contato pessoal continua desbloqueavel por outros usuarios, salvo se outra regra especifica for criada.
- A propriedade exclusiva fica bloqueada para novos desbloqueios durante 7 dias.
- Ao expirar, se nao foi marcada como vendida/fechada/pausada, volta a ser elegivel.

### Spotlight/Destaque

Fonte primaria:

- Tabela de spotlights/destaques no Supabase.
- Eventos administrativos para KPI.

Regra:

- 10 nuggets por card destacado.
- Duracao: 1 mes.
- O usuario escolhe quais cards ativos deseja destacar.
- Cards destacados aparecem:
  - Barra de minicards/anuncios no Feed.
  - Sidebar do MapView em `Spotlight Cards`.
  - Halo visual no card da pilha.

### Planos e Limites

Fonte primaria desejada:

- DB e plano do usuario sincronizado via Stripe/Webhook.

Estado atual:

- Parte das regras esta em `src/lib/planAccess.js`.
- Alguns contadores ainda usam localStorage, o que e aceitavel para UX temporaria, mas nao para controle final de producao.

Planos atuais:

- Basic/Free:
  - 3 nuggets por mes.
  - 20 swipes por dia.
  - 5 matches favoritados por dia.
  - 3 matches desbloqueados ativos.
  - Perfil padrao com verificacao opcional.
- Pro:
  - US$ 49/mes.
  - 20 nuggets + 3 no primeiro mes.
  - Likes ilimitados.
  - 10 desbloqueios por mes.
  - 15 matches ativos.
  - Exportacao PDF.
  - Chat DealSifter.
  - 20% de desconto em destaque.
- Enterprise:
  - US$ 129/mes.
  - 60 nuggets + 20 no primeiro mes.
  - Tudo do Pro.
  - Desbloqueios e matches ativos ilimitados.
  - 2 contatos exclusivos gratis por mes.
  - Perfil em destaque gratis.

## 4. Fluxos Principais

### 4.1 Primeiro Acesso

Fluxo esperado:

1. Usuario acessa homepage.
2. Ve aviso de cookies apenas se ainda nao aceitou.
3. Abre login/signup.
4. Aceita termos e privacidade se ainda nao aceitou.
5. Entra no app.
6. Feed abre como modulo inicial.
7. Se nao possui perfil valido, dashboard mostra chamada de cadastro.

Pontos sensiveis:

- Nao deve piscar homepage apos login.
- Nao deve alternar tema claro/escuro durante hidratacao.
- Termos/cookies devem ter memoria por usuario ou por device, conforme regra juridica.

### 4.2 Cadastro de Perfil e Portfolio

Fluxo esperado:

1. Usuario abre New Card/Onboarding.
2. Escolhe perfil Professional ou FSBO.
3. Preenche ao menos um perfil.
4. Define prioridade de dashboard/feed.
5. Registra propriedades ou servicos no portfolio unificado.
6. Vincula cada item ao perfil correto por `primary_profile`.
7. Escolhe se o item aparece em Showcase/Connections.
8. Salva.
9. DB atualiza.
10. Feed, MapView, MyCard e Matches hidratam a partir do DB.

Direcao arquitetural atual:

- Unificar propriedades/servicos em um unico portfolio.
- Eliminar o formulario FSBO paralelo como fonte separada de propriedades.
- FSBO passa a ser um perfil/escopo, nao uma area isolada de cadastro de propriedade.

### 4.3 Feed

Abas:

- Connections: pessoas e servicos.
- Spotlight: cards destacados.
- Showcase: propriedades e oportunidades.

Fluxo:

1. App carrega inventario global.
2. Normaliza cards e escopos.
3. Aplica filtros de categoria e estado.
4. Aplica ordenacao de preferencias.
5. Se nao houver preferencia, primeira abertura pos-login randomiza.
6. Durante a mesma sessao, preserva posicao do deck ao trocar modulos.
7. Cards do proprio usuario ficam por ultimo, salvo preferencia paga `my cards first`.

Botao estrela:

- Em Showcase deve abrir fluxo de desbloqueio quando for intencao de unlock.
- Em Connections deve desbloquear card pessoal/contato ou oferecer exclusividade de propriedade vinculada quando aplicavel.
- Favoritar e desbloquear nao podem ser confundidos.

Status visuais:

- `New`: card novo/elegivel.
- `Hot`: baseado em desempenho real de desbloqueios ou metrica definida.
- `Trending/Em Alta`: baseado em favoritos/interesses quando regra existir.
- `Exclusive`: propriedade bloqueada por exclusividade ativa.
- `Spotlight`: card com destaque pago.
- `Verified`: perfil verificado.

### 4.4 Map View

Fluxo:

1. Carrega pins de cards ativos globais.
2. Mostra pessoas e propriedades conforme filtros.
3. Usa clusters em zoom baixo.
4. Em zoom de cidade/pin, clusters devem explodir em pins.
5. Ao dar zoom out, clusters devem se recompor.
6. Sidebar mostra filtros e cards destacados pagos.

Regras:

- O mapa deve mostrar todos os pins globais ativos.
- A sidebar `Spotlight Cards` deve mostrar somente cards com destaque pago.
- Flood + Street esta oculto ate a camada de flood funcionar corretamente.

### 4.5 Matches

Colunas:

- People: contatos/perfis.
- Interests: propriedades/interesses.
- Area principal: chat, portfolio e dados de contato.

Fluxo:

1. Usuario favorita ou desbloqueia um card.
2. Card entra em Matches.
3. Se desbloqueado, contatos aparecem.
4. Portfolio vinculado aparece conforme perfil/owner.
5. Propriedades atreladas ao contato devem ser destacadas quando o contato e selecionado.
6. O inverso tambem deve ocorrer: selecionar propriedade destaca contato dono.
7. Chat deve funcionar entre usuarios reais com persistencia no DB.

Estados:

- Locked: favoritado, mas ainda nao desbloqueado.
- Unlocked/Paid: contato desbloqueado.
- Archived: oculto sem perda de direito.
- Deleted: removido pelo usuario, sem reembolso.

Regra de exclusao:

- Arquivar e preferivel a deletar.
- Contato pago/desbloqueado deve alertar que o usuario tem direito ao contato.
- Se deletar em Matches, tambem deve sumir do acompanhamento no Feed.
- Durante exclusividade ativa, exclusao deve ser bloqueada ou fortemente restringida conforme regra definida.

### 4.6 Chat

Tipos de chat:

- Chat entre usuarios dentro do modulo Matches.
- Chat de suporte DealSifter dentro de Communication, separado do Matches.

Regras:

- Free pode visualizar algumas areas, mas chat pode ser bloqueado por plano.
- Plano Pro/Enterprise habilita chat conforme regra.
- Chat real deve persistir em DB.
- Mensagens devem sincronizar entre devices do mesmo usuario quando permitido.

### 4.7 Pricing e Checkout

Fluxo:

1. Usuario escolhe plano ou pack.
2. Modal interno apresenta resumo e termos.
3. Usuario aceita termos.
4. App chama Edge Function de checkout.
5. Stripe abre checkout hospedado.
6. Retorno `success` ou `cancelled` atualiza app.
7. Webhook atualiza plano/nuggets/eventos.

Eventos importantes:

- Checkout aberto.
- Checkout cancelado.
- Checkout concluido.
- Carrinho abandonado.
- Compra de pack.
- Assinatura criada/alterada/cancelada.

### 4.8 Admin System

Funcoes:

- KPIs operacionais.
- Nuggets manuais para testes/admin.
- Monitoramento de eventos.
- Suporte.
- Metricas de checkout, unlock, exclusividade, spotlight, assinaturas e usuarios.

KPIs desejados/atuais:

- Usuarios ativos.
- Novos usuarios por dia, semana e mes.
- Contatos desbloqueados.
- Exclusividades compradas.
- Highlights/spotlights ativos e comprados.
- Nuggets comprados em packs.
- Receita em US$.
- Assinaturas por plano.
- Conversoes Free para Pro/Enterprise.
- Carrinho abandonado.
- Mensagens de suporte.
- Status Supabase/Stripe.

Risco atual:

- KPI so e confiavel se todos os fluxos registrarem eventos no DB.
- Compras mock/sandbox nao devem alimentar KPI real.

## 5. Onboarding e Regra de Escopo

### Escopos

O app trabalha com tres escopos funcionais:

- `personal`: perfil profissional pessoal.
- `professional`: perfil business/operacoes.
- `fsbo`: perfil de proprietario vendedor.

### Campos Chave

Cada perfil deve manter identidade propria:

- Nome.
- Avatar.
- Estado/localidade.
- Email.
- Telefones.
- Categoria/skills.
- Prioridade de dashboard.
- Status de verificacao.

### Regra de Publicacao

Um card so deve aparecer publicamente se:

- O perfil existe.
- O perfil possui prioridade publica valida.
- Ha pelo menos um item de portfolio ativo vinculado ao perfil.
- O item esta marcado para aparecer em Showcase ou Connections.
- O owner_id e o escopo batem com o usuario e perfil corretos.

### Problema que a unificacao busca resolver

Antes havia risco de:

- FSBO ter formulario paralelo.
- Propriedade puxar nome de propriedade como nome de perfil.
- Skill virar nome do contato.
- Um item de um perfil aparecer no card de outro perfil.
- Avatar ser replicado entre perfis.
- Cards fantasmas permanecerem apos delete/recriar conta.

A solucao correta e:

- Portfolio unico.
- Escopo explicito por item.
- Owner preview derivado do perfil correto.
- DB como fonte de verdade.
- Sem fallback ficticio em producao.

## 6. Regras de Badges, Icones e Tarjas

### Feed

Cards principais:

- Tarjas ficam sobre a imagem/avatar, quando aplicavel.
- Badges principais ficam no canto superior esquerdo.
- Icones de status ficam no canto superior direito.

Minicards:

- Icones no canto superior direito.
- Badges no canto inferior direito.
- Prioridade visual para status mais importante.

### Matches

Colunas:

- Usar apenas icones compactos lado a lado.

Portfolio:

- Icones no canto superior direito da imagem do card.
- Badges completos acima do endereco no mobile.
- Badges ao lado do endereco nas telas maiores.

### MapView Sidebar

Cards da sidebar devem seguir a mesma hierarquia visual de informacao dos minicards.

### Hierarquia sugerida

1. Exclusividade ativa.
2. Spotlight.
3. Verificado.
4. Hot.
5. Trending/Em Alta.
6. New.

## 7. PDF de Exportacao

Fluxo:

1. Usuario desbloqueia portfolio.
2. Se plano permite, pode exportar PDF.
3. Modal oferece download ou envio por email.
4. PDF deve conter dados objetivos da propriedade.
5. Imagem principal e mapa com pin devem aparecer.

Pontos desejados:

- Usar logo oficial completa.
- Layout profissional para investidores.
- Sem paginas extras em branco.
- Imagem principal deve vir do DB/Storage, nao de fallback ficticio.
- Snapshot de mapa deve ser estavel e visualmente util.

## 8. Consentimento, Cookies e Legal

Itens:

- Banner de cookies na homepage.
- Modal de Privacy & Data no primeiro login.
- Termos de uso.
- Politica de privacidade.
- Aceite para checkout.

Regras:

- Nao pedir aceite repetidamente se ja foi aceito.
- Se termo for atualizado com nova versao, pedir novo aceite.
- Consentimentos devem ser persistidos no DB para usuario logado.
- LocalStorage pode ajudar no device, mas DB deve ser fonte principal para usuario autenticado.

## 9. Internacionalizacao

Idiomas:

- Ingles como padrao.
- Portugues.
- Espanhol.

Regras:

- Nomes de pessoas e empresas nao devem ser traduzidos.
- Termos tecnicos podem permanecer em ingles quando fizer sentido comercial.
- Homepage e primeira experiencia podem usar ingles como base.
- Modais, botoes, labels, badges e tooltips devem usar o seletor global de idioma.
- Linguagem de chat e configuracao separada da linguagem geral do app.

Risco atual:

- Trechos implementados recentemente podem ainda conter strings fixas.
- O ideal e continuar centralizando em `src/i18n/translations.js` ou camada equivalente.

## 10. GuideTips

Conceito:

- Sistema hibrido de guia e dica.
- Acionado por icone de lampada.
- Deve poder ser ligado/desligado.
- Deve orientar o usuario sem bloquear fluxo normal.

Fase atual:

- Primeira implementacao no Feed.
- Overlay com foco em elementos.
- Precisa ser expandido para MapView, Matches, New Card e Pricing.

Regras de UX:

- Tema claro e escuro devem ter overlays diferentes.
- No tema escuro, camada de destaque precisa ser clara o suficiente para contraste.
- No mobile, se a dica depende de sidebar, a sidebar deve abrir automaticamente.

## 11. Performance e Estabilidade

Medidas ja presentes:

- `quotaFriendlyFetch` deduplica leituras GET/HEAD para Supabase.
- Lazy loading de paginas.
- Hooks separados para auth, profile sync, portfolio sync e checkout.
- Build com Vite.
- Alguns mocks desativados em producao por `import.meta.env.DEV`.

Pontos que ainda exigem cuidado:

- `App.jsx` continua muito grande.
- `Onboarding.jsx` ainda concentra muita regra.
- Alguns modulos ainda dependem de estado local extenso.
- Hydration precisa evitar tela piscando, troca de tema e homepage temporaria.
- Preferencias devem vir do DB, com localStorage apenas como fallback.

## 12. Integridade de Dados

Ferramenta atual:

- `src/lib/dataIntegrityAudit.js`.

Ela audita:

- Perfis.
- Records locais/globais.
- Owner id.
- Escopo.
- Owner preview.
- Nomes suspeitos.
- Inconsistencia entre perfil e item.

Exposicao em runtime:

- `window.__DS_DATA_AUDIT`
- `window.__DS_PRINT_DATA_AUDIT`

Uso recomendado:

- Rodar depois de criar/editar perfil.
- Rodar depois de adicionar propriedade/servico.
- Rodar ao detectar card fantasma.
- Rodar antes de release para producao.

## 13. Guardrails de Producao

Regras importantes:

- Nao usar mock como dado real.
- Nao usar fallback ficticio para contato, perfil, portfolio, unlock ou KPI.
- Dados publicos do feed devem vir do DB.
- Dados pagos devem ser rastreaveis.
- Debito de nuggets deve ter evento correspondente.
- KPI financeiro deve refletir evento real de Stripe ou evento interno autorizado.
- Delete account deve apagar ou desvincular corretamente dados do usuario.
- Recriar conta com mesmo email nao deve reidratar historico antigo indevido.

## 14. Pontos de Risco Ainda Relevantes

### 14.1 Refatoracao incompleta

`App.jsx` ainda centraliza muita regra. Isso aumenta risco de efeito colateral quando uma correcao de Feed impacta Matches ou Onboarding.

Recomendacao:

- Continuar extraindo dominios:
  - Global feed service.
  - Profile/portfolio normalizer.
  - Unlock/exclusivity service.
  - Plan usage service.
  - Consent service.

### 14.2 Onboarding ainda sensivel

Perfis, propriedades e servicos precisam obedecer uma regra unica de escopo.

Recomendacao:

- Finalizar unificacao do portfolio.
- Eliminar formulario FSBO paralelo como fonte independente.
- Garantir que todo item tenha `owner_id`, `primary_profile`, `profile_payload` e `ownerPreview` coerentes.

### 14.3 Plan limits parcialmente locais

Contadores locais podem ser burlados ou ficar inconsistentes entre devices.

Recomendacao:

- Mover limites diarios/mensais para DB/RPC.
- LocalStorage apenas para UX imediata.

### 14.4 Realtime e multi-device

Admin pode usar multiplos devices. Usuario comum deve ter uma sessao ativa.

Recomendacao:

- Definir claramente quais eventos sincronizam realtime.
- Chat, unlocks, matches e feed global precisam refletir atualizacoes rapidamente.

### 14.5 KPI depende de eventos completos

Se um fluxo desconta nuggets mas nao registra evento, KPI quebra.

Recomendacao:

- Toda compra/desbloqueio/destaque deve registrar:
  - usuario.
  - entidade.
  - custo em nuggets.
  - valor USD quando houver.
  - origem do fluxo.
  - status.

## 15. Checklist Funcional por Modulo

### Auth

- Signup email/senha.
- Login email/senha.
- Login Google.
- Confirmacao por email.
- Reset de senha.
- Sessao unica para usuario comum.
- Multisessao para admin.
- Timeout por inatividade.
- Termos e cookies com memoria.

### Onboarding

- Criar perfil personal/professional.
- Criar perfil FSBO.
- Definir prioridade.
- Limpar perfil exigindo salvar.
- Upload de avatar por perfil sem misturar imagens.
- Criar propriedade.
- Criar servico.
- Vincular item ao perfil correto.
- Publicar/retirar de Showcase ou Connections.
- Preview correto.
- MyCard correto.

### Feed

- Connections mostra perfis/servicos globais corretos.
- Showcase mostra propriedades globais corretas.
- Spotlight mostra cards destacados.
- Filtros funcionam.
- Ordenacao respeita preferencias.
- Proprios cards ficam por ultimo por padrao.
- Botao estrela nao confunde favorito com unlock.
- Badges e tarjas refletem estado real.

### MapView

- Pins globais aparecem.
- Pins do usuario logado aparecem quando publicados.
- Pins de outros usuarios aparecem.
- Clusters explodem e reagrupam.
- Sidebar lista apenas spotlights pagos.
- Sem pins mockados em producao.

### Matches

- Favoritos aparecem corretamente.
- Desbloqueios aparecem corretamente.
- Contatos pagos mostram email/telefone.
- Card pessoal destaca propriedades atreladas.
- Propriedade destaca card pessoal dono.
- Chat real persiste.
- Arquivar/deletar segue regra.
- Exclusividade mostra icone/timer correto.

### Pricing

- Planos mensal/anual.
- Desconto anual.
- Packs de nuggets.
- Checkout Stripe abre.
- Cancelamento retorna ao Pricing.
- Sucesso atualiza plano/nuggets.
- FAQ e comparativo multilanguage.

### Admin

- KPIs reais.
- Exclusividades compradas aparecem.
- Spotlights aparecem.
- Carrinho abandonado aparece.
- Receita em US$ aparece quando houver evento financeiro real.
- Graficos mostram dados reais e periodo correto.

## 16. Recomendacao de Proximo Caminho

Para estabilizar o app sem quebrar o que ja funciona, a melhor sequencia e:

1. Congelar a regra de dominio:
   - DB e fonte de verdade.
   - Fallback local nunca vira dado real em producao.
   - Portfolio unico.
   - Escopo obrigatorio por item.

2. Criar uma camada unica de normalizacao:
   - `normalizeProfile`.
   - `normalizePortfolioItem`.
   - `normalizeFeedCard`.
   - `normalizeMatchRecord`.

3. Fazer auditoria automatica por usuario:
   - Listar perfis.
   - Listar itens.
   - Conferir owner_id.
   - Conferir escopo.
   - Conferir ownerPreview.
   - Conferir publicacao.

4. Corrigir Feed e MapView primeiro:
   - Sao as vitrines globais.
   - Tudo que aparece ali impacta confianca do usuario.

5. Corrigir Matches depois:
   - Precisa refletir unlocks, contatos, portfolio e chat com fidelidade.

6. So depois expandir ToolTips e verificacao:
   - GuideTips ajudam UX.
   - Verificacao de email/telefone aumenta credibilidade.
   - Mas ambas dependem de base de dados confiavel.

## 17. Conclusao

O app ja possui uma base funcional ampla: auth, onboarding, feed, mapa, matches, pricing, checkout, admin, badges, exclusividade, spotlight, i18n e guias. O problema principal nao e falta de funcionalidades. O problema principal e consolidacao de fonte de verdade e consistencia entre perfis, portfolio, feed global e historico de interacoes.

A prioridade tecnica deve ser estabilizar o nucleo:

- Perfil correto.
- Portfolio correto.
- Feed global correto.
- MapView correto.
- Matches correto.
- Debito e historico rastreaveis.

Depois disso, as proximas funcionalidades podem ser implementadas com muito menos risco de regressao.
