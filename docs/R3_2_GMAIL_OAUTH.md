# Caixa postal OAuth — somente Gmail

Decisão vigente do proprietário: não contratar Azure nem adicionar custos; viabilizar somente Gmail. O registro Microsoft está suspenso. Login Supabase, Production, preços, nuggets, Stripe, relatório e entitlement permanecem inalterados.

## Custo e escopo

O Google informa que o uso padrão da Gmail API não tem custo adicional, dentro de suas quotas. A documentação também anuncia cobranças por excedentes para 2026; portanto não se deve habilitar faturamento, contratar plano, aumentar quotas ou ativar serviços pagos para este teste. Se o console exigir cartão/faturamento, interromper e verificar antes de continuar. Não foi ativada cobrança nem feita chamada Gmail nesta etapa.

Fontes: [Gmail API: quotas e preço](https://developers.google.com/workspace/gmail/api/reference/quota), [escopos Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).

Solicitar somente `openid`, `email` e `https://www.googleapis.com/auth/gmail.send`. O último é sensível, não restrito; a publicação geral exige tratar a verificação OAuth do Google. Não solicitar leitura, alteração ou exclusão de mensagens, nem `https://mail.google.com/`. O teste começa em modo Testing, limitado ao Gmail autorizado na lista de testadores; não equivale a liberação geral em Production.

## Código local

- `connectionSecurity.ts`: segurança compartilhada de estados/PKCE e criptografia AES-256-GCM por usuário/contexto.
- `googleConnection.ts`: autorização Google com PKCE S256, state aleatório de dez minutos e consumo único; troca de código no servidor; identidade obtida do userinfo HTTPS com `email_verified=true`, Gmail exato e igual ao email confirmado do Supabase. Não interpreta ID token sem validar assinatura. Usa o access token para consultar a identidade diretamente no endpoint oficial.
- `report-mailbox-oauth/index.ts`: somente Google, configuração `MAIL_GOOGLE_CLIENT_ID` / `MAIL_GOOGLE_CLIENT_SECRET` / `MAIL_TOKEN_ENCRYPTION_KEY` / `MAILBOX_ALLOWED_ORIGINS`. Rotas start/status/disconnect exigem JWT validado e origem permitida; callback GET exige state válido e não registra URL, código, tokens ou dados do provedor. Respostas sem cache, sem referrer, sem script. Revisar retenção/redação de logs de gateway no staging antes de usar credenciais reais: o callback Google contém código na query.
- `reportMailboxService.js`: somente URL Google, consentimento explícito e conferência da conta antes e depois da requisição.
- `docs/proposals/report_mailbox_oauth.sql`: proposta restrita a Google, fora das migrations automáticas e terminando em ROLLBACK; RLS sem leitura de segredos pelo navegador. Finalização atômica impede recriação após cancelamento.

Os componentes Google foram publicados somente no Preview de conferência e no staging, conforme autorização específica abaixo. O estado conectado só aparece após confirmação real do servidor. O módulo Microsoft anterior fica sem rota ativa, apenas como candidato histórico local; não há fallback para ele.

A etapa inicial aceita somente endereços `gmail.com`/`googlemail.com`, sem reinterpretar aliases nem substituir remetente. Caixa Hotmail ou Google Account com endereço externo não é aceita como Gmail. Não altera automaticamente o email de ninguém. Para testar mantendo o requisito do remetente, a conta real do staging deve ter o mesmo Gmail confirmado.

Consentimento online, sem refresh token persistido: exige reconectar após a expiração do access token. Desconectar remove tokens/estados locais, mas não revoga automaticamente a autorização na página de segurança Google. Não promove selo global de usuário verificado. Nenhuma conexão envia mensagem por si só.

## Cadastro pelo proprietário, sem faturamento

1. Abrir [Google Cloud Console](https://console.cloud.google.com/) com o Gmail administrador. Criar projeto separado `DealSifter Email QA`, sem ativar avaliação paga ou faturamento.
2. Em APIs e serviços → Biblioteca, habilitar somente Gmail API.
3. Em Google Auth Platform → Branding, configurar nome, email de suporte e contato reais. Audience: External, manter Testing e adicionar somente o Gmail de teste em Test users.
4. Data Access: adicionar somente `openid`, `email` (pode aparecer como `userinfo.email`) e `https://www.googleapis.com/auth/gmail.send`.
5. Clients → Create client → Web application. Nome `DealSifter Email QA`. Redirect URI exato: `https://oqdcnjupquhybwdbeeew.supabase.co/functions/v1/report-mailbox-oauth/callback`.
6. Informar ao agente somente o Client ID público e o Gmail da conta real do staging. Não enviar client secret, arquivo de credenciais, senha ou token pelo chat. O segredo será colocado no backend por canal seguro, sem bundle frontend.

O callback está publicado somente no staging. Não adicionar a URL de callback Supabase Auth no lugar deste endereço: login e consentimento de caixa são fluxos separados. A origem do Preview está restrita ao endereço exato aprovado, sem wildcard. Cadastro externo informado como concluído pelo proprietário; a autorização da caixa continua dependendo da interação dele com o Google.

Base oficial: [configuração do consentimento](https://developers.google.com/workspace/guides/configure-oauth-consent), [OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server).

## Verificação desta etapa

50/50 testes offline: 17 do adaptador Google, 15 de regressão do núcleo Microsoft anterior, 8 do cliente exclusivo Google, 5 do painel e 5 de regressão da entrega contextual. Cobrem configuração ausente, email confirmado, Gmail obrigatório, identidade verificada, mismatch, scopes, PKCE, expiração, replay/concorrência, criptografia, cancelamento em andamento, isolamento/troca de conta, rejeição de URL Microsoft, consentimento explícito, popup bloqueado e ausência de estado conectado otimista. TypeScript estrito dos núcleos, Deno check do endpoint real com SDK Supabase e lint dos arquivos alterados passaram.

O painel `GmailConnectionPanel` está integrado à entrega contextual para usuários Gmail no novo Preview. Conectar não envia mensagens nem habilita um botão falso de envio com PDF. Os testes unitários usam mocks; nenhuma conexão OAuth real ou envio real foi executado pelo agente. O build/123 testes da entrega de relatórios anterior não comprovam o novo recurso OAuth.

O novo build offline do candidato Gmail passou, com TypeScript do contrato e fingerprint `9422f9f19c82ac5d0f1d3787bf669a51c7002d372d23b6be0c828f446fb190e0`. A conta real autorizada possui perfil e um relatório salvo no staging; essa conferência contou registros sem imprimir conteúdo do relatório ou dados pessoais. Caminho de conferência: abrir esse relatório em Meus Relatórios → preparar entrega → painel Conectar seu Gmail.

## Schema aplicado com autorização específica

O proprietário autorizou somente o dry-run e aplicação de `docs/proposals/report_mailbox_oauth.sql` em `oqdcnjupquhybwdbeeew`. Target `maxxis-migration-validation` reconfirmado antes das operações.

- SHA-256 do SQL normalizado em LF: `96432292f9b4171c144c0c4a297378afdaef6b6b11e16fb0193e31f11343c532`.
- Dry-run transacional: PASS; ROLLBACK confirmado por inventário posterior sem objetos.
- Checagens: privilégios de anon/authenticated negados; permissão service_role; RLS habilitada sem policies de navegador; função security invoker; rejeição de usuário divergente, estado expirado/não reivindicado, replay e cancelamento; conclusão atômica.
- Aplicação exata após o dry-run: PASS. Somente duas tabelas, um índice e uma função; zero linhas persistidas, sem tokens reais.
- Conferência REST após aplicação: anon HTTP 401; backend HTTP 200, zero linhas. Os testes SQL com fixtures ficaram restritos à transação revertida, sem criar/editar contas Auth.
- Evidências locais sem segredos: `.tmp-codex/r32-mailbox/schema-dry-run.json`, `schema-applied.json` e `schema-postcheck.json`.
- Client Secret local presente, sem impressão do valor e sem publicação. Nenhum segredo, função Edge ou frontend foi publicado por esta autorização. Não houve alteração em Production, login, nuggets, pricing ou Stripe.

A proposta permanece fora de `supabase/migrations` e termina em ROLLBACK; não reaplicá-la sem conferir o inventário. Nenhuma versão foi registrada no histórico de migrations por esta autorização. A promoção futura precisa reconciliar isso antes de aplicar migrations em outros ambientes.

## Gates pendentes

Conta real indicada pelo proprietário conferida por leitura: existe no staging, com email confirmado e sem bloqueio. Nenhum dado pessoal foi inserido neste relatório. Schema aplicado conforme autorização acima. Configurações OAuth instaladas somente no backend do staging, com arquivos locais privados ignorados pelo Git. Zero chamadas Google pelo agente.

1. Concluir autorização Google real pelo proprietário no novo Preview e conferir o estado conectado retornado pelo servidor. Não alterar Supabase Auth.
2. Validar manualmente caixa divergente, expiração e cancelamento; os testes offline não substituem essa prova com provedor real.
3. Homologar a interface de conectar/desconectar com a conta real autorizada.
4. Entrega contextual implementada e publicada posteriormente em staging; ver R3_2_GMAIL_REPORT_DELIVERY_CANDIDATE.md. Recebimento real ainda depende da confirmação do proprietário.
5. Homologação do proprietário e verificação OAuth antes de liberação geral. Manter Production intocável nesta etapa.

Sem commit, push, alteração de contas ou chamadas pagas. Schema, função, configurações e Preview publicados somente nos destinos autorizados de staging, sem Production. Stash preservado. Rotação de chave, expurgo de estados expirados e eventual consentimento persistente ainda exigem definição operacional.

## Publicação autorizada da conexão, sem envio

- Staging: `oqdcnjupquhybwdbeeew`, target reconfirmado antes das operações.
- Função `report-mailbox-oauth` versão 1, ACTIVE, gateway `verify_jwt=false` apenas para viabilizar callback; start/status/disconnect validam JWT no código. Nenhuma outra função foi publicada.
- Segredos instalados: `MAIL_GOOGLE_CLIENT_ID`, `MAIL_GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_ENCRYPTION_KEY`. Valores não entram nos recibos, frontend ou documentos.
- Preview: [conferência Gmail](https://dealsiftermatch-1qtzmvcmk-deal-sifter-match-s-projects.vercel.app), deployment `dpl_C2e97ZCHKfGizg2oBVpKxRyvmaz7`, estado READY.
- `MAILBOX_ALLOWED_ORIGINS` e `MAXXIS_PREVIEW_ALLOWED_ORIGINS` configurados com essa origem exata; origens regulares anteriores dos módulos Maxxis preservadas. CORS novo confirmado para a função Gmail, maxxis-analysis-inputs e maxxis-chat.
- Varredura do build: PASS, inclusive comparação com valores reais do segredo OAuth e da chave de criptografia, sem imprimir os valores.
- Nove verificações HTTP reais: JWT ausente/inválido/anon → 401; origem diferente → 403; callback sem state → 400; método incorreto → 405; status da própria conta QA autenticada → 200; consentimento ausente → 400; conta QA não Gmail → 400 antes de qualquer chamada Google. Zero estados/conexões persistidos após as verificações.
- Login QA foi feito legitimamente por senha da fixture existente, sem impersonação, criação de contas ou bypass. Isso não comprova autorização da caixa real.
- Production Vercel preservada: `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`. Supabase Production não foi alterado. HEAD e stash mantidos.
- Evidências privadas locais: `.tmp-codex/r32-mailbox/staging-functions.json`, `preview.json`, `connection-security-probes.json`, `preview-assets.json` e `vercel-target.json`.

Smoke de navegador QA: PASS, login por senha HTTP 200, Matches e contato sintético visíveis, sem erros de página. HTML obtido do Preview por acesso Vercel autenticado; assets locais idênticos aos publicados, verificados por hash, com backend staging real. Rotas externas foram bloqueadas para impedir chamadas Google/Gemini/RentCast. Essa prova não substitui a navegação/consentimento do proprietário com seu Gmail. Recibo: `.tmp-codex/r32-mailbox/browser.json`.

O proprietário ainda precisa efetuar o consentimento Google. Nenhum email enviado; entrega do PDF por API Gmail permanece fora desta publicação.

## Preview vigente após publicação da entrega

A publicação de conexão acima é histórica. O Preview atual autorizado é https://dealsiftermatch-82shz5lo6-deal-sifter-match-s-projects.vercel.app, com CORS limitado a essa origem. A função report-mail-delivery v1 e sua tabela privada foram publicadas mediante autorização específica, sem republicar a função OAuth. Nenhuma mensagem enviada pelo agente; consentimento e envio real pelo proprietário continuam pendentes. Evidências e limites em R3_2_GMAIL_REPORT_DELIVERY_CANDIDATE.md.

## Atualização posterior: Property Release/L1

A extensão L1 e a remoção do email de perfil como fallback de destinatário foram publicadas mediante autorização específica. Preview vigente: https://dealsiftermatch-60x7087fe-deal-sifter-match-s-projects.vercel.app. Detalhes, schema e evidências em R3_2_PROPERTY_RELEASE_GMAIL_FIX.md. As URLs de publicações anteriores acima são históricas. Nenhum email real enviado pelo agente.

## Correção posterior de continuidade

Preview vigente: https://dealsiftermatch-nx96y4o7m-deal-sifter-match-s-projects.vercel.app. Correção do leitor L1 para a consulta autorizada existente e estado terminal de envio nas três categorias. Evidências e limites em R3_2_MAIL_DELIVERY_CONTINUITY_FIX.md. As URLs anteriores acima são históricas. Sem nova migration, Production ou email enviado pelo agente.
