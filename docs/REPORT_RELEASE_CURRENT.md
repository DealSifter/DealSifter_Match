# Maxxis — entrega de relatórios R-3.2

## Publicação vigente — Production

Atualização publicada em 17 de novembro de 2026: deployment `dpl_2M3qj13ygtzbvvWXrqiXh8QVr3FP`, READY, código `c5976acc21f6edc4236d6fd8033d9520c2b2223a`, no domínio https://dealsiftermatch.vercel.app.

- O remetente de relatórios é o email salvo no perfil ativo (pessoal, profissional ou FSBO), sem fallback para o email de login ou para outro perfil. O servidor consulta somente o cadastro do usuário autenticado. A autenticação permanece independente e inalterada.
- A caixa Google autorizada deve corresponder ao Gmail desse perfil. O consentimento verifica a titularidade da caixa; mudança do email do perfil durante a autorização ou antes do envio impede usar uma identidade desatualizada. Nenhum campo enviado pelo navegador substitui essa verificação.
- Para um perfil sem Gmail, o modal explica a restrição e oferece acesso ao onboarding do perfil ativo para editar e salvar seu email principal, sem mudar o login. Destinatários continuam escolhidos pelo usuário ou recuperados de suas preferências privadas; o remetente não é usado como destinatário padrão.
- Após conectar o Gmail, o painel fica recolhido, com opção de gerenciar a conexão. PDF, fotos, confirmação de envio, layouts e dez amostras dos relatórios foram preservados.
- Regressão final: 67/67 testes PASS, lint PASS, checagem Deno das duas funções PASS e build offline PASS. No staging, teste autenticado com login e email do perfil diferentes passou; a fixture foi restaurada pelo mesmo RPC autorizado e não houve chamadas Google ou envios.
- Production: somente `report-mailbox-oauth` e `report-mail-delivery` atualizadas para a versão 2; oito verificações negativas e quatro verificações CORS PASS, sem novas conexões ou entregas. Assets críticos e hashes das dez amostras conferidos. Smoke público desktop/mobile: HTTP 200, zero erros de JavaScript, falhas de assets ou chamadas de provedores. Sem migration, alteração de segredos, Auth, cobrança, preços ou push. Stash preservado.

Limite: o agente não executou consentimento nem envio com conta real em Production. O proprietário já confirmou a conexão e o recebimento de mensagens nas etapas anteriores. Para usar outro perfil, salvar seu Gmail no cadastro e autorizar a caixa correspondente. As regras de audiência do aplicativo Google continuam vigentes.

Recibos privados desta atualização: `.tmp-codex/r32-profile-sender/`. Rollback do frontend: `dpl_uVn4AptSQcWupw5JZtiA1sQP1tUe`; backups das duas funções anteriores no mesmo diretório. A política de remetente acima substitui a referência ao email da conta nas etapas históricas abaixo.

## Histórico — publicação inicial R-3.2

Publicado em 17 de novembro de 2026 em https://dealsiftermatch.vercel.app. Deployment `dpl_uVn4AptSQcWupw5JZtiA1sQP1tUe`, READY, associado ao commit de código `af26946b296358158b5e852e821077b0020cccf4`. O proprietário confirmou ter acrescentado o callback de Production no Google antes da promoção.

- As duas migrations abaixo passaram por dry-run transacional com ROLLBACK verificado, foram aplicadas e registradas no histórico de Production. As policies existentes do contexto permaneceram idênticas. Nenhuma conta, fixture ou conexão de staging foi copiada.
- As quatro funções foram publicadas. JWT obrigatório no gateway das funções de análise/entrega; callback OAuth sem JWT no gateway e rotas protegidas com validação interna. Origem Gmail limitada ao domínio canônico de Production; demais origens/configurações existentes não foram modificadas.
- Build offline e contrato TypeScript PASS; lint PASS. Deno das quatro entradas mantém os 36 diagnósticos preexistentes do grafo compartilhado, sem novos erros. Regressão ampliada: 803 casos; 799 passaram inicialmente, quatro contratos antigos foram atualizados e as quatro suítes passaram na reexecução, 29/29. Não houve correção de runtime para mascarar essas falhas. A assinatura das amostras foi regenerada pelo renderer real; todas as dez imagens publicadas correspondem aos hashes aprovados.
- Oito probes negativos e quatro verificações CORS em Production PASS. Sem gravações de caixa/entrega ou chamadas Google nesses probes. A primeira execução do roteiro OAuth usava GET, recebeu corretamente 405 e foi corrigida para POST; nenhuma mudança de produto foi necessária.
- Smoke público desktop/mobile: HTTP 200, zero erros de JavaScript ou falhas de assets. Dezesseis assets críticos publicados, incluindo as dez amostras, conferidos por hash.
- Worker real servido por Production, com fixtures fictícias locais: L1 1 página/5 fotos/1 mapa; L2 3 páginas/5 fotos/1 mapa; L3 6 páginas/5 fotos/2 mapas. Todos com PDF válido e interface responsiva. Sem provedores, gravação de relatórios, cobranças ou envios reais pelo agente.
- Stash preservado. Sem push. Configuração pública de Production preservada; alterações privadas restritas às quatro configurações Gmail descritas abaixo, com chave de criptografia exclusiva de Production.

Limite da validação: consentimento e envio reais foram confirmados pelo proprietário no staging. Em Production o usuário precisa conectar seu Gmail novamente; os tokens não são transferidos. Não foi alegada homologação autenticada humana em Production nem alterada a audiência/verificação do aplicativo OAuth Google.

Rollback do frontend: deployment anterior `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`. Backups privados das duas funções anteriores e recibos de schema/deploy/probes permanecem em `.tmp-codex/r32-production/`. As migrations são aditivas e não devem ser removidas por rollback destrutivo automático. PDFs/PNGs de QA e recibos não entram no Git. Os dois recibos de QA rastreados alterados pela regressão foram guardados no diretório privado e seus arquivos rastreados restaurados ao conteúdo anterior, sem exclusão de arquivos.

## Candidato aprovado

O proprietário confirmou no staging a autorização da caixa Gmail, o envio da mensagem e a criação do card no Trello após configurar o destinatário exclusivo correto. A aceitação pela API Gmail continua distinta da confirmação de recebimento no destino. O agente não executa envios reais de teste.

Escopo: complementação conversacional R-3/R-3.1, exportação contextual após reload, entrega Gmail de Property Release/L1 e relatórios salvos L2/L3, destinatários privados recuperados, PDF anexado automaticamente e fotos opcionais existentes no documento. Inclui os ajustes de visualização de senha e as amostras do app já conferidos no Preview. Mantém os layouts aprovados.

Fingerprint do código validado: `ffb670d558b35cb72e5be09dd0487f465eb2116be80cac3654f23ca9161c293e`.

## Dependências de publicação

- Production Supabase: `cyeipfskwwisbbayyaca` (`DealSifterMatch`). Staging: `oqdcnjupquhybwdbeeew`.
- Migrations explícitas: `20261105230000_maxxis_analysis_context_cas.sql` e `20261117160000_report_mailbox_delivery.sql`. A segunda consolida os três schemas de caixa/entrega aprovados em staging. Não executar um push geral de migrations pendentes.
- Funções: `maxxis-analysis-inputs`, `maxxis-chat`, `report-mailbox-oauth`, `report-mail-delivery`.
- OAuth: callback Google de Production `https://cyeipfskwwisbbayyaca.supabase.co/functions/v1/report-mailbox-oauth/callback`; preservar também o callback de staging no cliente Google.
- Configuração privada somente no backend: `MAIL_GOOGLE_CLIENT_ID`, `MAIL_GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_ENCRYPTION_KEY`, `MAILBOX_ALLOWED_ORIGINS`. Chave de criptografia distinta por ambiente. Nunca copiar conexões, tokens ou fixtures entre ambientes.
- A conexão Gmail é separada do login e exige consentimento do próprio usuário em cada ambiente. Na publicação vigente, o remetente deve corresponder ao Gmail salvo no perfil ativo e confirmado pelo Google. Sem leitura de mensagens; escopos limitados a identidade e envio. Reconectar quando o token expirar.
- O modo de audiência/verificação do aplicativo Google permanece o configurado pelo proprietário. Publicar o frontend não amplia a lista de testadores nem constitui verificação OAuth para acesso geral.
- `inbox@app.trello.com` só reconhece remetentes associados à conta Trello. Para outro remetente ou um quadro específico, usar o endereço exclusivo gerado pelo Trello. O aplicativo não o substitui automaticamente.

## Segurança e limites

As tabelas de caixa/entrega não concedem privilégios nem policies ao navegador. O callback usa state único, expiração e PKCE; demais rotas validam JWT. Entrega exige revisão e confirmação próprias, validação do documento/acesso e reserva idempotente. Uma mensagem aceita não é reenviada automaticamente. Falhas indeterminadas não são tratadas como entrega confirmada.

Sem alteração de preços, nuggets, Stripe, políticas de autenticação, RLS existente ou aquisição paga nesta publicação. Sem envios executados pelo agente. PDFs, imagens de QA, backups, credenciais e recibos operacionais privados permanecem fora do Git; somente as amostras que integram o app são versionadas.

## Evidências e histórico

- [Correção final e conferência autenticada L1/L2/L3](R3_2_MAIL_DELIVERY_CONTINUITY_FIX.md).
- [Complementação conversacional](R3_CONVERSATIONAL_REPORT_COMPLETION.md), [resolução de entradas desconhecidas](R3_1_UNKNOWN_INPUT_RESOLUTION.md).
- [Exportação contextual](R3_2_CONTEXTUAL_EXPORT_EMAIL_FIX.md), [conexão Gmail](R3_2_GMAIL_OAUTH.md), [entrega Gmail](R3_2_GMAIL_REPORT_DELIVERY_CANDIDATE.md), [extensão L1](R3_2_PROPERTY_RELEASE_GMAIL_FIX.md).

As URLs de Preview e restrições de publicação registradas nesses documentos descrevem suas respectivas etapas históricas. Este índice consolida o candidato autorizado para promoção. Recibos locais da publicação ficam em `.tmp-codex/r32-production/`, sem segredos em documentos versionados.
