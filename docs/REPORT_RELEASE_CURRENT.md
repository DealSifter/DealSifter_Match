# Maxxis — entrega de relatórios R-3.2

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
- A conexão Gmail é separada do login e exige consentimento do próprio usuário em cada ambiente. O remetente deve corresponder ao Gmail confirmado da conta. Sem leitura de mensagens; escopos limitados a identidade e envio. Reconectar quando o token expirar.
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
