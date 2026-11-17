# Conexão da caixa de email do usuário — decisão e pré-requisitos

> HISTÓRICO MICROSOFT — SUPERADO: o proprietário optou por somente Gmail, sem contratar Azure nem adicionar custos. O roteiro vigente está em [R3_2_GMAIL_OAUTH.md](R3_2_GMAIL_OAUTH.md). O endpoint e o cliente locais agora aceitam somente Google; as instruções Microsoft abaixo não devem ser executadas. Nada deste candidato foi publicado.

Decisão do proprietário em 16 Nov 2026: o remetente deve ser a caixa do usuário logado, não um domínio do DealSifter. A autorização deve ser OAuth; uma confirmação para abrir Outlook não atende a esse requisito. A futura verificação do email do cadastro poderá se relacionar a essa autorização, mas são estados distintos.

## O que foi conferido

Somente staging `oqdcnjupquhybwdbeeew`, por leitura: os provedores Azure/Microsoft e Google do Supabase estão desabilitados. Não existem as configurações de cliente Microsoft e chave de criptografia de tokens de uma integração de caixa postal. Não foi alterado Auth nem feita chamada ao Microsoft Graph.

O Supabase Auth atual continua sendo o login do DealSifter. Seu JWT não é um token com permissão para enviar email por uma caixa Outlook/Gmail. A documentação do [login Microsoft no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-azure) também exige um aplicativo registrado no provedor.

As fixtures atuais têm endereços `.invalid`; não possuem caixa real e não podem comprovar conexão ou recebimento. O proprietário autorizou um teste com uma conta real no staging e ficou de identificá-la. O agente/backend não executou envio real. O proprietário relatou envio manual pelo Outlook e recebimento, com remetente selecionado pelo cliente externo; isso não comprova uma conexão OAuth nem um envio pelo backend.

## Integração prevista: Microsoft primeiro

1. Manter a sessão Supabase e iniciar uma autorização de caixa postal separada, vinculada ao `auth.uid()` existente. Não fazer logout, substituir a identidade do usuário nem trocar o remetente por uma conta do sistema.
2. Exigir autorização explícita do usuário. Usar Authorization Code + PKCE, `state` aleatório com validade curta e consumo único; retorno limitado à origem de Preview aprovada. O segredo e a troca do código ficam no backend. Base: [fluxo oficial de autorização Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
3. Pedir somente identidade e envio delegado: `openid profile email User.Read Mail.Send`; `offline_access` somente para manter a conexão com consentimento claro. Não pedir leitura da caixa nem permissão de envio como qualquer usuário da organização.
4. Conferir a identidade retornada pela Microsoft com o email confirmado da conta DealSifter. Uma conta de destino em “Para” nunca seleciona o remetente. Rejeitar uma caixa diferente e oferecer reconexão. Tratar aliases explicitamente, sem aceitar identidade apenas por um valor digitado no frontend.
5. Guardar tokens apenas no backend, criptografados, em armazenamento privado sem leitura direta pelo frontend; oferecer desconectar/revogar e expiração visível. Registrar a autorização, provedor, identidade vinculada e data, sem tokens em logs.
6. Envio por ação separada: `POST /me/sendMail` delegado, com o mesmo PDF/artefato autorizado, vinculado a usuário/imóvel/versão/hash. O remetente é a caixa autorizada. A [API oficial](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0) aceita anexos com `Mail.Send`; uma resposta `202` indica aceitação do pedido, não comprova entrega. Sem repetir análise, geração cobrada ou aquisição.
7. Idempotência por solicitação de entrega e fingerprint de relatório/destinatários. Timeout após envio fica com estado indeterminado, sem retry automático que duplique mensagens. Separar conexão autorizada, envio aceito, falha e entrega comprovada.

O Google requer registro, consentimento e adaptador próprios; não está implementado por analogia ao Microsoft. A conexão com um provedor não autoriza o outro.

## Configuração externa ainda necessária

Registrar um aplicativo web no Microsoft Entra para contas organizacionais e contas pessoais Microsoft, incluindo Outlook/Hotmail. O registro deve ser do proprietário/organização, com permissões **delegadas**, não `Application Mail.Send`.

Configuração prevista, exclusivamente no staging:

- `MAIL_MICROSOFT_CLIENT_ID`: ID público do aplicativo.
- `MAIL_MICROSOFT_CLIENT_SECRET`: segredo no ambiente do backend, nunca no chat ou bundle.
- `MAIL_TOKEN_ENCRYPTION_KEY`: chave própria de criptografia no backend.
- Callback do candidato local: `https://oqdcnjupquhybwdbeeew.supabase.co/functions/v1/report-mailbox-oauth/callback`. A função **não foi publicada**; não é um callback já operacional. O retorno usa POST (`form_post`), sem código na URL.
- Origem de retorno: somente o Preview final de conferência.
- Conta real do staging com email correspondente à caixa autorizada, a ser informada pelo proprietário.

O esquema privado de tokens/estados e o registro idempotente de entregas serão uma proposta aditiva a revisar antes de qualquer migration. Nesta tarefa não foram aplicados schema, segredos, funções OAuth, alterações de provedor de login ou permissões Microsoft.

## Relação com “usuário verificado”

Reservar estados distintos: `EMAIL_CONFIRMED`, `MAILBOX_CONSENT_GRANTED`, `MAILBOX_CONNECTED` e `SEND_ACCEPTED`. Autorizar a caixa pode fornecer evidência de controle do email, mas não promove silenciosamente o usuário a um selo global de verificação. A política desse selo ainda será definida pelo proprietário.

## Estado real

| Item | Estado |
|---|---|
| Requisito de remetente e OAuth delegado | Confirmado pelo proprietário |
| Inventário do staging | Conferido, sem configuração de caixa postal |
| Fluxo de rascunho manual e preservação do PDF | Implementado na R-3.2, não equivale a OAuth |
| Registro Microsoft / configurações seguras | Pendente, externo ao repositório |
| Autorização e armazenamento privado de tokens | Candidato local implementado; não publicado, depende de configuração e revisão aditiva |
| Envio delegado com o PDF autorizado | Ainda não implementado; nenhuma mensagem enviada |
| Teste com caixa real | Autorizado; aguarda identificação da conta e integração operacional |
| Production | Intocada |

Não existe botão ou autorização simulada que afirme uma conexão funcional sem esses pré-requisitos.

## Candidato local preparado após a instrução de continuar

- `supabase/functions/_shared/mailbox/microsoftConnection.ts`: consentimento separado do login, PKCE S256, state aleatório com validade de dez minutos, consumo único, confirmação do email do cadastro, identidade obtida de `/me`, comparação estrita da caixa, tokens AES-256-GCM com contexto de usuário. Não aceita alias divergente automaticamente. As duas requisições Microsoft têm timeout e não têm retry.
- `supabase/functions/report-mailbox-oauth/index.ts`: rotas `start`, `status` e `disconnect` exigem JWT validado pelo servidor e origem permitida; somente o callback dispensa JWT, com state obrigatório. Metadados de conexão são lidos do servidor; tokens não chegam ao cliente. Nenhum endpoint de envio foi criado.
- `src/services/reportMailboxService.js`: cliente autenticado com reconferência da conta após a resposta, consentimento explícito e validação da URL Microsoft. Ainda não conectado à interface publicada; não há botão que prometa conexão operacional.
- `docs/proposals/report_mailbox_oauth.sql`: proposta aditiva fora de `supabase/migrations`, terminando em `ROLLBACK`. Tabelas com RLS e sem acesso de `anon`/`authenticated`; RPC restrita a `service_role` para concluir a autorização atomicamente. Cancelar/substituir uma autorização impede que seu callback pendente recrie a conexão.

O candidato não solicita `offline_access` nem armazena refresh token. A autorização expira junto do access token e exige reconexão. Desconectar apaga a autorização local; não equivale a revogar o consentimento no portal Microsoft. O consentimento do provedor deve ser removido pelo titular no portal, se desejar. Não altera selo de usuário verificado.

### Validação e limites

22/22 testes locais, com transportes injetados e nenhuma rede: email não confirmado, configuração ausente, PKCE, expiração, replay, concorrência, recusa de consentimento, identidade divergente, mudança de email, falta de permissão, falha HTTP sem retry, criptografia e cancelamento durante a autorização; no cliente, consentimento, isolamento de conta, troca de conta, endpoint indisponível e URL substituída. TypeScript estrito do núcleo de domínio passou. Não foi executado typecheck Deno/SDK da função Edge, dry-run SQL ou teste OAuth autenticado; esses gates continuam pendentes. O build/123 testes de entrega R-3.2 são da versão anterior validada, não uma homologação deste novo candidato OAuth.

Não houve nova publicação de frontend, função, migration, segredo ou configuração de Auth. Production, cobrança e o stash permanecem preservados. O callback precisará de gateway `verify_jwt=false` ao publicar, mantendo a validação explícita de JWT nas demais rotas; essa configuração não foi alterada nesta etapa.

### Próximos gates, antes de habilitar o recurso

1. Proprietário registra aplicativo Microsoft web para contas pessoais e organizacionais, com permissões delegadas `User.Read` e `Mail.Send`, e informa somente o ID público do aplicativo e a identificação da conta real do staging. O segredo não deve ser enviado pelo chat.
2. Revisar o SQL, verificar SQL/Deno e preparar o dry-run transacional. Solicitar autorização específica para schema, nova função e configuração somente no staging antes de aplicar/publicar. Usar `MAILBOX_ALLOWED_ORIGINS` com a origem exata aprovada; segredo e chave de criptografia somente no backend.
3. Integrar e conferir a interface de conectar/desconectar, inclusive cancelamento, expiração e caixa divergente, com a conta real autorizada. Sem ampliar Auth/RLS/entitlements.
4. Implementar separadamente entrega autenticada do artefato PDF autorizado, com idempotência e estados de envio aceito/indeterminado. Não aceitar upload arbitrário como se fosse o relatório validado e não confundir Graph 202 com entrega comprovada.

Questões operacionais ainda abertas: rotação da chave de criptografia, remoção periódica de estados expirados e política de conexão persistente. Nenhuma delas foi preenchida com comportamento simulado.
