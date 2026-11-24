# DealSifter — publicação de relatórios e modais

Registro vigente: [execução, resultados e ressalvas](DEALSIFTER_LAUNCH_CLOSURE_EXECUTION.md). A política de publicação progressiva Classe A foi aplicada; publicação técnica permanece separada do aceite comercial humano.

## Publicação vigente — Production de 24/11/2026

Publicado e conferido em **https://dealsifter.com/**, www e host Vercel. Deployment **dpl_AFHx1AFTwsTuGnXWyV5khESJ23bn**, READY; código **4e5cc98b4211e6b412a93b50450cc0dea9aab029**, fingerprint **63837bdec969653cdb86bf79f6c3aa7be5c9f9c2ecdb55aa92f2de31c60f0e03**. Rollback preservado: **dpl_Ai7NXQNG4j4KznfQJegX1ZiASMAX**.

- Indicador compartilhado de alterações pendentes nos salvamentos de perfil, investimento, imóveis/serviços e revisão de dados Maxxis; corrigida a captura tardia da primeira edição. Campos de novo registro destacam o respectivo botão de portfólio. Movimento reduzido mantém destaque estático.
- Gmail usa inicialmente o perfil principal cadastrado e respeita a seleção explícita do usuário, sem usar email do login ou de outro perfil. Não houve envios de teste.
- Sidebar mobile: fotos redondas de 34 px dos respectivos My Cards A/B, preservando o grid, contadores, cores e ações; somente altura/padding dos badges ajustados.
- Validação: 142 testes distintos pertinentes passaram em execuções direcionadas, lint completo seguido de lint dos últimos arquivos PASS, contratos TypeScript PASS, build/secret scan PASS, oito provas SSR/CSS de componentes e seis casos de navegação por build/Production PASS. Seis acessos HTTPS aos domínios e hashes dos assets Dashboard/Onboarding confirmados. Isso não constitui aceite humano autenticado.
- Backend: metadados das 28 funções preservados; sem novo deploy backend, migration, secrets ou cobrança. Arquivos anteriores já publicados foram reconciliados no commit geral. Stash preservado. Sem push.
- **Decisão comercial permanece CONDITIONAL GO:** verificação Google de acesso a dados em análise e aceite visual humano pendente. Publicação técnica não encerra esses gates.

Evidências locais ignoradas: `.tmp-codex/save-reminder-release-20261123/` (source, build, validation, browser, compiled-browser, production, production-smoke, domains e backend-after).

## Histórico — Production de 21/11/2026

Publicado em 21/11/2026: **`dpl_sMdDKzasEJXwq959SRUpmJNcthn4`**, READY, https://dealsiftermatch.vercel.app. Base `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262` com delta isolado, fingerprint `07e460378a5c3b83ce87511f72efad5d6f8ded7013ba342f7337fbb2fe3ba00d`. Rollback `dpl_6nbp4AfM2rxL84wXRUL4xECtUhVD`. Sem novo commit/push nesta rodada; manifesto identifica o source exato.

- **IN GOD WE TRUST ✝** permanece no final de Empresa/Company. Modal localizado em EN/PT/ES, com KJV, Almeida Revista e Corrigida e Reina-Valera 1909; foco, X/Escape, reduced-motion e layout conferidos. Dez testes e quinze cenários de navegador por ambiente PASS; evidência preservada no delta seguinte.
- **Pricing:** comparação corrigida para Basic 20 swipes/dia e PRO 15 Matches ativos, como já aplicados no servidor. Cinco testes, lint, TypeScript, builds e seis cenários por ambiente PASS. Preços e regras inalterados.
- **LC‑05:** diagnóstico HTTP 422 específico e integridade/CAS/reload/PDF preservados; evidência recente reaproveitada. Evidência de fronteira reutilizada. Inputs versão 17 e Chat 105 receberam depois somente a correção isolada do primeiro “Não sei”; JWT e funções Gmail preservados, sem migration geral.
- **Decisão comercial atual: CONDITIONAL GO.** LC‑03 comercial e LC‑06 alerta externo encerrados; assinatura TEST cancelada e configuração temporária retirada. Faltam aceite visual humano e quotas/restrições Gmail. Ver matriz vigente no relatório de execução; sem novo commit/push.


- **Primeiro “Não sei”:** correção backend publicada em Production (Inputs 17/Chat 105), 26 testes, Enterprise 11 e PRO 9 checks UI/PDF/reload, 13 checks de smoke. Grafos publicados confirmam somente dois módulos alterados. Snapshot frontend acima permanece vigente; o manifesto registra separadamente o delta backend.

## Histórico — modais responsivos de 21/11/2026

Publicado em 21 de novembro de 2026: deployment `dpl_aQU5cyEmcnKDMx79iK8yvmrGgdgo`, READY, código `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262`, em https://dealsiftermatch.vercel.app.

- O conjunto de ajustes dos modais está publicado: melhor aproveitamento da largura, redução de espaçamentos, distribuição em colunas, paginação dos destaques e abas do perfil de investimento em telas menores/baixas. Inclui o quadro compacto de custo e saldo do desbloqueio, além de contatos, compra de nuggets, acesso, edição de imóvel e entrega de relatórios.
- Mobile preserva a rolagem quando necessária; em conteúdo excepcional, zoom ou telas muito baixas, a rolagem de segurança evita esconder informações. Os cenários desktop/tablet conferidos ficaram sem rolagem ou botões cortados. Não foram alterados custos, saldos, critérios de desbloqueio ou confirmação de compra/envio.
- Validação local: 24/24 testes funcionais PASS, 63 conferências de layout e dez verificações adicionais do desbloqueio compacto PASS. Lint, contratos TypeScript e build isolado do commit exato PASS. Os três timeouts na execução concorrente foram resolvidos pela reexecução sequencial das quatro suítes, sem alteração funcional para mascará-los.
- Production: quatro assets críticos e 12 arquivos dos novos modais conferidos por hash, com paridade das dez amostras de relatórios. Modal público de acesso/cadastro aberto na aplicação real em 1366×768, 1024×768, 768×1024 e 390×844: HTTP 200, sem rolagem, transbordamento horizontal, erros de JavaScript ou falhas de assets; duas colunas nas telas maiores e uma no celular.
- Somente frontend publicado. Sem migrations, redeploy de funções, alteração de segredos/flags, Auth, pricing, nuggets ou Stripe. Nenhum login real, compra, desbloqueio ou envio de email executado pelo agente nesta publicação. Os demais modais foram conferidos com fixtures locais. Stash preservado; sem push.

Recibos privados da publicação: `.tmp-codex/modal-layout-production/`; conferências locais: `.tmp-codex/modal-layout-20261121/`. Rollback do frontend: `dpl_E1HCT53SB3mZjX1jUsgqSJ7Ky82g`. As funcionalidades de relatório/email das publicações abaixo permanecem incluídas.

## Histórico — edição do email e nomes dos relatórios

Atualização de 21 de novembro de 2026: deployment `dpl_E1HCT53SB3mZjX1jUsgqSJ7Ky82g`, READY, código `5c4679b97df3c0ae7bf319a54ed2183b8311850b`, em https://dealsiftermatch.vercel.app.

- O painel de conteúdo da mensagem permite editar assunto e corpo antes de preparar o envio. O usuário pode voltar por “Editar destinatários e mensagem”; a confirmação final envia o texto revisado com os anexos originais. As edições não alteram o relatório salvo nem o PDF.
- Referências visíveis aos níveis internos foram substituídas por Basic, PRO e Enterprise no modal, assunto e corpo gerados do email, incluindo o helper legado de rascunho. Identificadores internos e permissões permanecem iguais.
- O servidor valida o texto editado e considera seu conteúdo normalizado na proteção contra duplicidade. Assunto vazio, quebras de linha no assunto, caracteres de controle e textos acima dos limites são rejeitados antes de reservar ou enviar. A confirmação explícita continua obrigatória.
- Validação: 57/57 testes PASS; lint, TypeScript de contratos, Deno da função e build offline PASS. Staging autenticado: três verificações de confirmação e isolamento PASS, sem alteração das fixtures ou registros de email. Production: oito verificações negativas e quatro verificações CORS PASS; assets críticos e dez amostras conferidos por hash. Smoke público desktop/mobile PASS, sem erros de JavaScript, falhas de assets ou chamadas de provedores. O agente não executou envio autenticado real em Production.
- Somente a função `report-mail-delivery` foi atualizada (versão 3 em Production, versão 8 em staging). Sem migrations, alteração de Auth/OAuth, segredos, aquisição, preços, nuggets ou Stripe. Nenhum email real enviado pelo agente. Stash preservado; sem push.

Recibos privados: `.tmp-codex/r32-message-edit/`. Rollback do frontend: `dpl_2M3qj13ygtzbvvWXrqiXh8QVr3FP`; backup da função anterior no mesmo diretório. A regra vigente de remetente continua sendo o email salvo no perfil ativo, conforme a etapa abaixo.

## Histórico — remetente do perfil ativo

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
