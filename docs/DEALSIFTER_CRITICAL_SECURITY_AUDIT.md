# SEC-0 — DealSifter Match — Auditoria crítica de segurança

Data: 24/11/2026. Natureza: investigação somente de leitura. Decisão de segurança: **NO-GO**.

## A. Executive Summary

Há bloqueadores concretos na autorização de desbloqueios e assinaturas em Production. RLS está habilitado na maioria das tabelas, mas algumas policies permitem ao próprio usuário escrever registros que outros controles tratam como prova de pagamento/autorização. A interface usar o caminho correto não impede acesso direto à Data API.

Foram identificados **5 findings únicos confirmados: 1 CRITICAL, 2 HIGH, 2 MEDIUM e 0 LOW**. As confirmações decorrem de catálogos e definições efetivas de Production, acompanhados de inspeção estática; não foram executados exploits, inserções, alterações de assinatura ou extrações de contatos reais. Confirmação de permissões inseguras não significa incidente de exploração já observado.

O inventário de controles desta auditoria contém **16 PASS, 5 FAIL, 2 RISK e 8 NOT VERIFIED**. Os PASS são limitados ao aspecto expressamente descrito na seção C; não certificam integralmente cada módulo. Os RISK e NOT VERIFIED estão separados dos findings confirmados e não entram nas contagens de severidade acima.

### Versões e ambientes

| Item | Evidência observada |
| --- | --- |
| Branch | `fix/production-real-defects` |
| HEAD local | `e2f3d3217920cb42cf0c5a2f7b1d1003e5023f20` — registro documental da publicação |
| Código do frontend publicado | `7fb11cf66e2485cf54a9b4259ac69490d6722e1e` |
| Deploy Vercel | `dpl_DkSm1HDCtJmxcbnPMTm9QzzU8diL`, `READY`, `https://dealsifter.com/` |
| Correspondência do frontend | 18/18 assets principais públicos coincidem por SHA-256 com o artefato da publicação; não se recalcularam todos os 146 assets remotos |
| Supabase Production | `cyeipfskwwisbbayyaca`, `ACTIVE_HEALTHY` |
| Edge Functions | 28 versões/hashes/JWT flags coincidem com o snapshot da publicação de 24/11; exemplos: `maxxis-chat` v106, `create-portal-session` v17, `stripe-webhook` v48 |
| Staging | `oqdcnjupquhybwdbeeew`: somente evidências anteriores consultadas; não foi reauditado dinamicamente nem alterado nesta rodada |
| Preparação não publicada | Verificação de contatos no stash `af44d02f24322774e0d63f1c1eb9c6463b8f3a89`, excluída do runtime auditado e preservada |

Arquitetura observada: SPA React 19/Vite na Vercel; Supabase Auth, PostgreSQL/Data API, Storage e Realtime; Edge Functions Deno; Stripe Checkout/Portal/webhooks; Gemini Developer API pelo backend Maxxis; integrações de evidência imobiliária e Gmail OAuth. Não existe um servidor Vercel de aplicação que intermedeie todas as consultas ao Supabase. O isolamento depende dos grants, policies, RPCs e autorizações das Edge Functions.

Foram priorizados: exposição de secrets; acesso a contatos e dados privados; permissões de escrita; caminhos financeiros; dados enviados ao LLM; autenticação; Storage; cache e telemetria. Sem auditoria geral de UX, novas funcionalidades ou compliance jurídico.

**Prontidão para usuários reais:** não há base para exposição comercial irrestrita enquanto SEC-01 e SEC-02 permanecerem. SEC-03 também precisa ser resolvido antes de prometer isolamento de contatos por perfil e exclusividade. Esta decisão de segurança é nova evidência bloqueante e não reabre indiscriminadamente os outros gates do Launch Closure.

## B. Security Scorecard

Contagens atribuídas à área principal de cada finding, sem duplicar causas em outras áreas. “Misto” significa haver controles observados e limitações distintas, não uma certificação global.

| Área | Status | Critical | High | Medium | Low | Confiança da evidência |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Secrets | PASS parcial / NOT VERIFIED | 0 | 0 | 0 | 0 | Boa para árvore/artefato atual; histórico e logs completos não verificados |
| Database/RLS | FAIL — SEC-01/02; contados nas áreas financeiras | 0 | 0 | 0 | 0 | Alta para grants, policies, triggers e funções remotas |
| Tenant Isolation | FAIL — SEC-03 | 0 | 1 | 0 | 0 | Alta para o desvio de escopo na definição publicada |
| APIs/Edge Functions | Misto; SEC-02 alcança Portal/Maxxis | 0 | 0 | 0 | 0 | Código inspecionado; cobertura remota integral limitada |
| Storage | FAIL — SEC-05 | 0 | 0 | 1 | 0 | Alta para buckets e combinação de policies remotas |
| Realtime | PASS parcial / NOT VERIFIED | 0 | 0 | 0 | 0 | Publicação/RLS observadas; sem inscrições adversariais |
| PWA/Cache | PASS parcial / NOT VERIFIED | 0 | 0 | 0 | 0 | Inspeção estática, sem teste de troca de conta nesta rodada |
| Authentication/Session | PASS parcial / NOT VERIFIED | 0 | 0 | 0 | 0 | Configuração Auth real; sem login/refresh/logout novos |
| Stripe/Payments | FAIL — SEC-02 | 0 | 1 | 0 | 0 | Escrita de assinatura confirmada; exploração não executada |
| Nuggets/Unlocks | FAIL — SEC-01 | 1 | 0 | 0 | 0 | Cadeia determinística confirmada em Production |
| Maxxis/AI Privacy | RISK — U-01 | 0 | 0 | 0 | 0 | Texto bruto identificado; modalidade comercial Google desconhecida |
| Additional Security Findings | FAIL — SEC-04; demais pontos não verificados | 0 | 0 | 1 | 0 | Permissões de chat efetivas; dependências contextualizadas |

## C. Controles existentes e preservados

### Inventário de 16 controles PASS, com alcance delimitado

| ID | Controle verificado | Evidência e limite |
| --- | --- | --- |
| C-01 | Rastreabilidade do release | Vercel `READY`, metadados de commit, 18 hashes públicos e 28 metadados de funções comparados; não equivale a atestar toda a lógica |
| C-02 | Ausência dos padrões de secrets pesquisados na árvore atual | 2.243 arquivos textuais rastreados: nenhum padrão de Stripe secret/webhook, Google API key literal, private key, `sb_secret_` ou JWT `service_role`; `.env.example` é o único `.env*` rastreado. Busca por padrões não detecta todo secret possível |
| C-03 | Higiene do artefato atual | 116 arquivos textuais do artefato isolado examinados: nenhum dos padrões acima, zero source maps e zero caminhos `.env`/`.git`/`auth.json`. Não foi feito crawling de arquivos ocultos em Production |
| C-04 | Headers HTTPS efetivos | GET da homepage: HTTP 200, HSTS, `nosniff`, `DENY`, Referrer-Policy, CSP `base-uri 'self'; frame-ancestors 'none'; object-src 'none'` e `no-store`. CSP não possui `script-src`; não se declara prevenção completa de XSS |
| C-05 | Campos administrativos de `users` protegidos de escrita direta | Sem INSERT/UPDATE de tabela para anon/authenticated. Grants authenticated por coluna: INSERT `id,email,full_name`; UPDATE `id,email,full_name,phone,settings_payload`. `nuggets`, `plan_id`, `is_admin` não estão nessa allowlist; RLS exige o próprio ID |
| C-06 | Mail server-only e barreiras de acesso a dados operacionais | Grants/policies de mail, caches/entitlements de inteligência e budgets foram inspecionados; leitura própria de entitlements não significa escrita autorizada. `report_mailbox_connections`, states e deliveries sem grants anon/authenticated; `deleted_records_audit`, embora sem RLS, também sem SELECT desses papéis. Ausência de RLS isoladamente não virou finding |
| C-07 | Propriedades privadas e contexto de análise têm barreiras no banco | `properties` com policies owner-only; contexts por `reviewer_user_id=auth.uid()` mais `ds_has_maxxis_analysis_context_access`; CAS authenticated-only. Não se certificam todos os payloads públicos de texto livre |
| C-08 | Inventário de feed usa projeção server-side | `ds_get_global_feed_inventory`: EXECUTE authenticated, não anon; seleciona inventário publicado/ativo; não seleciona email/telefone de `users`, sanitiza `profile_payload` e suprime endereço/coordenadas quando solicitado. Não há fallback a tabelas-base em `feedStateService.js` |
| C-09 | Parte importante das RPCs vincula identidade ao JWT | Definições remotas de `ds_get_user_unlock_state`, `ds_get_unlocked_contact_cards`, `ds_get_active_exclusivities` e `export_user_data` rejeitam IDs de outro usuário, salvo exceção server-side explicitamente prevista. SEC-03 é um desvio distinto dentro de um proprietário |
| C-10 | Caminho legítimo de compra possui controles financeiros | Definições remotas de `ds_purchase_contact_unlock`/`ds_purchase_property_unlock`: `auth.uid()`, intenção/custo/validade/escopo, locks, débito condicional a saldo suficiente; constraint de saldo não negativo. SEC-01 permite contornar esse caminho. Corridas não foram reexecutadas |
| C-11 | Checkout calcula preço no servidor | `create-checkout-session/index.ts`: `getUser`, mapa de preços de ambiente, quantidade 1, metadados derivados do usuário, retorno com allowlist e rate limit. Não foi criado checkout |
| C-12 | Verificação de assinatura Stripe existe antes do processamento | `stripe-webhook/index.ts:42` usa `constructEventAsync` com corpo bruto; limita tamanho e rejeita método incorreto. Idempotência tem ledger no processor; prova transacional end-to-end atual não foi repetida |
| C-13 | Operações de conta/admin têm checks adicionais | Inspeção de `delete-account` e `stripe-reprocess-queue`: `getUser`; reprocessamento verifica `users.is_admin`, não metadata editável. `verify_jwt=false` não foi tratado como ausência automática de autenticação |
| C-14 | Auth nativo possui confirmação e rotação | Configuração real: confirmação de email exigida (`mailer_autoconfirm=false`), Google OAuth ativo, JWT 3.600 s, refresh rotation ativa, reuse interval 10 s; limites email=2, refresh=150, verify=30. Não houve tentativa de brute force |
| C-15 | Limpeza de cache implementada e ausência de cache SW de aplicação localizado | `App.jsx:4407`, `localStoragePolicy.js`, limpeza IndexedDB por usuário; chaves sensíveis não autorizam acesso pago. Busca em `src/public` não localizou registro de Service Worker/Workbox. Teste dinâmico de navegador compartilhado permanece N-03 |
| C-16 | Minimização parcial de IA e telemetria implementada | `toolResultForGemini.ts` projeta campos e mascara emails/telefones; tools usam contexto autenticado; budgets limitam contexto/chamadas; `observability.js:131` desabilita PII padrão e aplica scrubbers. Não cobre o texto livre de U-01 nem prova os logs remotos |

Realtime Postgres Changes publica tabelas como chats e notifications, que possuem SELECT por participante/dono; isso é evidência de configuração favorável, não de teste real de assinatura. As partições internas `realtime.messages_*` sem RLS não foram automaticamente tratadas como tabelas públicas acessíveis pela Data API.

### Evidência anterior reutilizada, sem repetir operações

- `docs/DEALSIFTER_LAUNCH_CLOSURE_AUDIT.md:71`: gates de grants/RLS/mail e CAS; rechecados nos pontos acima.
- `docs/DEALSIFTER_LAUNCH_CLOSURE_EXECUTION.md`: registros de QA RLS A/B, CAS, Stripe TEST e duplicados. Provas restritas às fixtures e operações ali documentadas; não anulam caminhos alternativos encontrados nesta investigação.
- `docs/FEED_MATCH_ORDERING_RELEASE.md`, `docs/MAP_SESSION_PREFERENCES_RELEASE.md`, manifesto e recibos existentes em `.tmp-codex/feed-ordering-release-20261124`: identidade do release, hashes e snapshots de backend. Não foram executados scripts antigos que escrevem recibos ou alteram fixtures.

## D. Confirmed Findings

### SEC-01 — Inserção direta de desbloqueio produz autorização sem cobrança

- **Blocos:** B/E. **Status:** FAIL. **Severidade:** CRITICAL — P0. **Ambiente:** Production confirmado por metadados; staging não revalidado.
- **Localização:** `public.unlocks`, policy `unlocks_insert_own`; `supabase/migrations/20260409181738_init_mvp_auth_profiles_properties.sql:197`; RPCs publicadas `ds_get_unlocked_contact_cards` e `ds_get_unlocked_contact_snapshots`.
- **Evidência:** authenticated possui INSERT de tabela; policy exige somente `buyer_id=auth.uid()`. Constraint aceita `nuggets_spent>=0` e comprador diferente do vendedor. Não há trigger BEFORE INSERT que valide intenção, débito ou origem server-side: os triggers observados são captura de DELETE e notificação AFTER INSERT. As RPCs de leitura usam a existência dessa linha como entitlement e retornam email/telefone do contato correspondente.
- **Causa confirmada:** registro de autorização financeira gravável pelo beneficiário, sem vinculação obrigatória ao procedimento de compra.
- **Cenário controlado/pré-requisitos:** usuário autenticado com perfil no banco e identificador público de outro proprietário pode construir uma inserção própria aceita pela policy; a leitura de contatos passa a confiar nesse registro. Descrição lógica, sem payload operacional nem execução. Não depende de conhecer secrets ou do frontend exibir o botão.
- **Dados/operações e impacto:** contatos privados, portfólio liberado por entitlement e receita de Nuggets; permite aquisição indevida em escala por contas autenticadas. Não foi medido volume nem consultado conteúdo de vítimas.
- **Compensatórios:** RPC legítima tem intenção, locks, cotação e saldo; FK e RLS limitam quem figura como comprador. Não protegem a inserção alternativa.
- **Correção mínima sugerida:** retirar INSERT direto de anon/authenticated em `unlocks`, remover/neutralizar a policy permissiva e manter criação somente na RPC autorizada. Conferir caminhos legítimos antes; não apagar unlocks existentes nesta etapa. Revisar eventual histórico de registros suspeitos posteriormente, com autorização.
- **Esforço:** LOW. **Migration:** SIM, pontual de grants/policy. **Arquitetura:** NÃO. **Regressão:** LOW. **UX/UI:** nenhuma mudança visual esperada; caminho antigo que insira diretamente deverá ser identificado.
- **Tratamento:** bloquear lançamento irrestrito até correção. **Testes futuros mínimos:** inserção direta negada; compra legítima debita uma vez e libera só o escopo comprado; repetição não duplica débito; leitura bloqueada sem entitlement. Staging primeiro, smoke do fluxo legítimo. Não executados nesta SEC-0.

### SEC-02 — Assinatura e vínculo Stripe editáveis pelo próprio beneficiário

- **Blocos:** B/E/F. **Status:** FAIL. **Severidade:** HIGH — P0. **Ambiente:** Production; caminho de Portal também identificado no corpo publicado v17.
- **Localização:** `public.subscriptions`; policies `Users can insert own subscription` e `Users can update own subscription`; `supabase/functions/_shared/maxxis/runtimeEntitlement.ts:103`; `create-portal-session/index.ts:60` e `:132`.
- **Evidência:** authenticated possui INSERT/UPDATE de tabela, policies restringem só `user_id=auth.uid()`, sem trigger de proteção em subscriptions. Colunas incluem `plan_id`, `status`, períodos e `stripe_customer_id`. Runtime Maxxis dá precedência a `subscriptions.plan_id` quando status é active/trialing. Portal devolve o `stripe_customer_id` encontrado e cria sessão para esse customer sem conferir sua vinculação no Stripe. Busca booleana no bundle publicado confirmou o retorno direto desse ID; nenhum Portal foi criado.
- **Causa confirmada:** cache financeiro controlável pelo usuário tratado como fonte confiável de autorização e identidade externa.
- **Cenário/pré-requisitos:** conta autenticada pode modificar a própria assinatura e apresentar plano elevado ao loader Maxxis. Ataque a Portal de terceiro exige, adicionalmente, conhecer um customer ID válido da vítima e haver funcionalidades habilitadas naquele Portal; este impacto adicional não foi executado nem teve sua amplitude certificada.
- **Dados/operações e impacto:** acesso indevido a capacidades pagas/consumo potencial de fornecedores; inconsistência de billing. Não se afirma crédito automático de Nuggets nem roubo de cartão: o webhook credita por caminho separado e o cartão não é exposto integralmente pelo Stripe.
- **Compensatórios:** `users.plan_id/is_admin` não são graváveis pelo cliente; webhook assinado e preço server-side. Não eliminam a precedência da assinatura adulterável no loader.
- **Correção mínima:** remover INSERT/UPDATE de cliente em subscriptions, mantendo SELECT próprio e escritas server-side existentes; confirmar no Portal que o customer pertence ao usuário em fonte não editável. Não migrar de provedor nem reescrever o billing.
- **Esforço:** LOW–MEDIUM. **Migration:** SIM, permissões. **Arquitetura:** NÃO. **Regressão:** LOW–MEDIUM. **UX/UI:** sem alteração visual; conferir criação legítima de cache/assinatura.
- **Tratamento:** bloqueador. **Testes futuros:** alteração direta de plano/customer negada; webhook legítimo continua atualizando; Free não obtém capacidade paga; Pro legítimo mantém acesso; Portal rejeita vínculo alheio e aceita o próprio. Teste de cancelamento/expiração do mesmo loader. Sem cobrança/envio de eventos nesta auditoria.

### SEC-03 — RPC legada de contatos ignora o escopo comprado e a exclusividade

- **Blocos:** B/C/E. **Status:** FAIL. **Severidade:** HIGH — P1, resolver antes da oferta de isolamento por perfil. **Ambiente:** definição efetiva de Production.
- **Localização:** `public.ds_get_unlocked_contact_snapshots()` e `ds_get_user_unlock_state(uuid)`; fonte local correspondente em `supabase/migrations/20260706000001_unlock_snapshot_property_and_reciprocal.sql:4`. Contrastar com a RPC mais nova em `20260729000001_profile_scoped_unlock_entitlements.sql:557`.
- **Evidência:** EXECUTE da função legada permitido a authenticated; `unlock_sources` lê seller sem `unlocks.profile_scope`; `latest_unlocks` agrupa só por vendedor. `profile_scope` deriva o contato do imóvel/serviço publicado mais recente, com fallback personal/professional. A seleção final devolve contato sem o bloqueio `active_other` presente na RPC nova. `ds_get_user_unlock_state` também agrega o resultado legado. Nenhuma dessas funções foi executada para ler contatos reais.
- **Causa confirmada:** autorização antiga por proprietário permaneceu acessível ao lado da autorização nova por perfil; consumir a RPC nova na UI não revoga a antiga.
- **Cenário/pré-requisitos:** usuário com desbloqueio anterior de um perfil consulta a superfície legada quando outro perfil do mesmo proprietário é o mais recente, ou quando há exclusividade de outro comprador. A definição pode liberar contato fora do escopo/supressão aplicada no contrato novo. Não depende de forjar unlock de SEC-01; exige relação anterior válida.
- **Dados/impacto:** email/telefones de outro perfil do proprietário e quebra da promessa de exclusividade. Fallback para contato de conta pode ampliar a exposição além do contato cadastrado no perfil.
- **Compensatórios:** leitura vinculada ao comprador autenticado e RPC nova aplica escopo/exclusividade. Impedem acesso arbitrário entre compradores, mas não resolvem o endpoint antigo.
- **Correção mínima:** fazer a projeção legada respeitar o entitlement por perfil e exclusividade, preferencialmente reaproveitando a autorização da RPC canônica; ou revogar somente endpoints comprovadamente sem consumidores e ajustar a agregação dependente. Não remover indiscriminadamente integrações de leitura.
- **Esforço:** MEDIUM. **Migration:** SIM, função/grant específico. **Arquitetura:** NÃO. **Regressão:** MEDIUM, por consumidores legados. **UX/UI:** sem redesenho; pode corrigir contatos indevidamente visíveis.
- **Tratamento/testes futuros:** verificar chamadas diretas das duas superfícies: perfil A comprado não revela B/FSBO; exclusividade de terceiro suprime os mesmos campos em ambas; compra válida mostra exatamente o perfil autorizado. Revisar reciprocidade e expirados sem realizar novas compras reais.

### SEC-04 — Recibo de leitura permite reescrever a mensagem e sua autoria

- **Blocos:** B/C. **Status:** FAIL. **Severidade:** MEDIUM — P1. **Ambiente:** Production.
- **Localização:** `chat_messages_update_recipient_read`; `supabase/migrations/20260703000001_chat_read_receipts_pagination.sql:14`; trigger remoto `trg_enforce_chat_message_access`.
- **Evidência:** UPDATE de tabela concedido a authenticated, com privilégio efetivo em todas as 12 colunas, incluindo `body`, `sender_id`, `created_at`, `message_type` e metadata. Policy verifica somente `recipient_id=auth.uid()` antes/depois. O único trigger de autorização de chat observado executa BEFORE INSERT, não UPDATE. Seu bypass de tipos system/system_notice também merece verificação futura, sem constituir finding adicional aqui.
- **Causa:** RLS limita a linha, mas não os campos de uma operação cujo propósito é atualizar `read_at`.
- **Cenário/pré-requisitos:** destinatário de uma mensagem existente altera conteúdo/autor preservando a si próprio como destinatário. Não é acesso a conversa arbitrária nem exploração executada.
- **Dados/impacto:** integridade de negociações, autoria e cronologia; uma mensagem exibida pode deixar de representar o que o remetente escreveu.
- **Compensatórios:** SELECT por participante e INSERT vinculado ao sender; limitam alcance, sem proteger imutabilidade da mensagem recebida.
- **Correção mínima:** retirar UPDATE de tabela e conceder somente UPDATE(`read_at`), mantendo policy por destinatário; preferir esse mecanismo existente a criar arquitetura de chat nova.
- **Esforço:** LOW. **Migration:** SIM. **Arquitetura:** NÃO. **Regressão:** LOW. **UX/UI:** nenhum impacto visual esperado.
- **Testes futuros:** recibo legítimo funciona; update de body/sender/metadata negado; usuário externo não lê nem marca; envio normal e paginação continuam. Aplicação somente após autorização.

### SEC-05 — Policy antiga permite upload no namespace de outro usuário

- **Blocos:** C/Storage. **Status:** FAIL. **Severidade:** MEDIUM — P2. **Ambiente:** Production.
- **Localização:** `storage.objects`: `profile_images_owner_insert`, `property_images_owner_insert`; `supabase/migrations/20260520164247_storage_and_subscriptions.sql:20` e `:42`.
- **Evidência:** policies INSERT antigas exigem apenas bucket correto e `auth.uid() IS NOT NULL`. Coexistem com policies que exigem primeiro segmento do caminho igual ao UID. Policies permissivas combinam por OR, de modo que a policy antiga aceita criação em caminho alheio. UPDATE por diretório não é uma proteção de INSERT. Nenhum upload foi realizado.
- **Causa:** duas gerações de policy, com a mais ampla mantendo a autorização efetiva.
- **Cenário/pré-requisitos:** conta autenticada cria objeto novo sob prefixo de terceiro; se a aplicação confia no prefixo para atribuição/limpeza, o arquivo aparenta pertencer ao namespace errado. Não se comprovou substituição de arquivo já existente, publicação automática no card ou execução de script.
- **Dados/impacto:** poluição de namespace, atribuição ambígua e abuso de armazenamento; alcance limitado por limites/tipos do bucket.
- **Compensatórios:** buckets aceitam JPEG/PNG/WebP/GIF, 5 MiB profile e 10 MiB property; UPDATE/DELETE têm verificações de diretório/owner. Buckets públicos para imagens publicadas não são falha por si só.
- **Correção mínima:** retirar/estreitar apenas as policies INSERT antigas e conservar a regra de prefixo próprio. Conferir formatos históricos dos caminhos antes da mudança.
- **Esforço:** LOW. **Migration:** SIM, policies. **Arquitetura:** NÃO. **Regressão:** LOW. **UX/UI:** nenhuma mudança esperada se os uploads já usam UID correto.
- **Testes futuros:** upload próprio permitido, prefixo alheio negado, foto pública publicada continua acessível e update/delete alheios negados.

## E. Unverified Risks

Dois indícios fundamentados, ainda sem confirmação de todo o impacto:

| ID | Status / severidade potencial | Evidência e verificação mínima necessária |
| --- | --- | --- |
| U-01 | RISK / HIGH, podendo subir conforme dados/modalidade | `maxxis-chat/index.ts:74` só remove controles/espaços; `:964` inclui mensagem e histórico compactado no request Gemini. `maxxisContextBudget.ts:14` também não mascara PII do histórico. Bundle publicado v106 contém o padrão de inclusão do texto. Projeção de tool sanitiza parte dos dados, mas isso não cobre mensagens espontâneas. Não houve envio real nem prova de PII de usuário já transmitida. Gemini Developer API é identificado pelo código; projeto exato da chave, região/condições e billing ativo **não foram comprovados**. Confirmar no Google o projeto da chave server-side e billing/modalidade, sem revelar chave; capturar em teste isolado com PII sintética e transporte mockado os dois caminhos de request. Para serviço não pago, a restrição de envio de dados pessoais/confidenciais dos termos oficiais torna esse risco comercialmente relevante. Não presumir Free a partir de quota gratuita |
| U-02 | RISK / HIGH para recuperação | Management API de backups respondeu `pitr_enabled=false`, lista de backups vazia. Isso não prova inexistência de backup externo. Confirmar artefato recente, retenção e resultado de restauração isolada previamente disponível; qualquer nova operação que gere estado exige autorização. Rollback Vercel não restaura dados financeiros/contatos perdidos |

Oito verificações que não puderam ser concluídas neste escopo:

| ID | Status | Verificação mínima pendente |
| --- | --- | --- |
| N-01 | NOT VERIFIED | Secrets em todo histórico Git, clones públicos, logs Vercel/Supabase, SMTP e backups: foram examinados árvore atual e artefato, não todo o histórico nem todos os logs. Necessário inventário de superfícies e busca mascarada autorizada; não rotacionar chaves por hipótese |
| N-02 | NOT VERIFIED | Matriz dinâmica atual anon/A/B de todas as RPCs/policies: executar apenas em staging com fixture e protocolo expressamente aprovado. Nesta rodada só catálogos, sem login que crie sessão ou extração de dados privados |
| N-03 | NOT VERIFIED | Logout/reload e troca de conta com IndexedDB e requisição pendente: testar offline/mockado sem gravar artefatos extras ou em protocolo futuro autorizado. `supabaseClient.js` deduplica GET por URL/método sem incluir token; possibilidade de cruzamento na janela de troca de conta precisa de reprodução antes de virar FAIL |
| N-04 | NOT VERIFIED | Realtime Broadcast/Presence/assinatura de conversa alheia: policies/publications não provam handshake e filtragem. Necessário teste isolado com identidades QA e definição dos canais realmente usados; não enviar eventos reais nesta rodada |
| N-05 | NOT VERIFIED | Gmail OAuth ponta a ponta, quotas/consentimento e reconexão: código tem state/PKCE e criptografia AES-GCM, mas não houve autorização nova nem envio. Aprovação de branding não certifica aprovação do scope `gmail.send`; preservar gate LC-04 |
| N-06 | NOT VERIFIED | Idempotência financeira concorrente, replay, cancelamento e TEST/LIVE efetivos: assinatura/ledger e provas históricas existem, mas não foram gerados eventos/transações. Necessária releitura das configurações Stripe efetivas e teste TEST aprovado após tratar SEC-02; sem chamar transações nesta auditoria |
| N-07 | NOT VERIFIED | Aplicabilidade completa das dependências: consulta atual ao registry retornou advisories para 11 nomes do lockfile, incluindo Vite/Vitest, undici, DOMPurify, Zod e ferramentas de build. Não são 11 vulnerabilidades exploráveis comprovadas do site. Vercel serve artefato estático; dev server/test runner não são o runtime publicado. Revisar call sites e condições específicas de DOMPurify/jsPDF, uso server-side de undici e entradas de build antes de classificar impacto. Não houve `npm audit fix`, instalação ou atualização |
| N-08 | NOT VERIFIED | MFA e proteção de sessão administrativa efetivamente exigida, configuração completa de provedores/integrações/previews, SSRF por todas as rotas de URLs e retenção/exportação/remoção integral. Os checks localizados e flags observadas não certificam esses fluxos completos. Exigem inspeção dirigida por operação em etapa autorizada, sem ampliar automaticamente esta auditoria |

### Observações que não foram infladas a vulnerabilidade confirmada

- Auth Production permite redirecionamentos exatos para a URL Vercel e localhost:5173/5174; `site_url` permanece Vercel. Ausência de wildcard e restrição ao redirect não mostram open redirect arbitrário. Domínio canônico pode exigir alinhamento funcional, mas nenhuma configuração foi alterada.
- CAPTCHA e proteção de senha vazada estão desabilitados, senha mínima é 6; existem limites nativos. Sem teste de abuso ou ameaça concreta adicional, são hardening, não bypass confirmado.
- Sem timebox/inactivity timeout server-side e JWT de 1 hora: comportamento nativo, não evidência isolada de revogação quebrada. Logout não torna todo access token imediatamente inválido; não se recomenda substituir a arquitetura de sessão por isso.
- Imagens dos dois buckets são públicas e listáveis conforme policies; para fotos intencionalmente publicadas isso é esperado. Fotos de portfólios privados e seus metadados não foram extraídas; confidencialidade de imagens não publicadas precisa ser definida/testada se prometida.
- Nenhum `dangerouslySetInnerHTML`, `eval` ou `new Function` em código de aplicação foi localizado na busca dirigida; ler `innerHTML` para drag-and-drop não é, por si, sink de XSS. Conteúdo ativo em PDF/dependências não foi certificado.
- Grants amplos de TRUNCATE/TRIGGER existem em diversas tabelas, mas não se demonstrou um executor SQL acessível a anon/authenticated. Não se afirmou que a Data API exponha TRUNCATE.

## F. Recommended Minimum Remediation

**Nenhuma correção foi aplicada.** As cinco correções mínimas correspondem aos cinco grupos de causa confirmados. SEC-01/02 podem compartilhar uma migration pequena de permissões, preservando verificações separadas. Não há justificativa para refatoração geral.

| ID | Severidade | Correção mínima | Esforço | Risco de regressão | Impacto UX/UI | Migration | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | CRITICAL | Revogar INSERT de cliente em unlocks; somente compra autorizada cria entitlement | LOW | LOW | Sem redesenho | SIM | P0 |
| SEC-02 | HIGH | Subscriptions somente leitura para cliente; vínculo Stripe validado server-side | LOW–MEDIUM | LOW–MEDIUM | Sem redesenho | SIM | P0 |
| SEC-03 | HIGH | Aplicar autorização canônica de escopo/exclusividade às leituras legadas | MEDIUM | MEDIUM | Corrige conteúdo indevido | SIM | P1 antes da oferta correspondente |
| SEC-04 | MEDIUM | Conceder UPDATE somente de read_at, mantendo RLS do destinatário | LOW | LOW | Nenhum esperado | SIM | P1 |
| SEC-05 | MEDIUM | Remover a alternativa INSERT de Storage sem prefixo próprio | LOW | LOW | Nenhum esperado | SIM | P2 |

Todos os cinco grupos dispensam alteração arquitetural. Risco geral de regressão **LOW–MEDIUM**, concentrado em consumidores legados de contatos e integração de billing. Cada correção precisa do par negativo/positivo descrito em D, sem bateria indiscriminada. Para mudança SQL isolada: validação de grants/policies e smoke no staging; se houver alteração TypeScript no Portal/Maxxis, typecheck e testes dirigidos; build/smoke de frontend somente se código cliente também mudar.

U-01 e U-02 exigem primeiro esclarecer fatos, não contratar serviço ou escrever código por suposição. Não se recomenda rotacionar credentials nem aplicar hardening em massa nesta etapa.

## G. Backlog — Optional Hardening

- Alinhar senha mínima/proteção de senhas vazadas e avaliar CAPTCHA conforme abuso observado; verificar MFA administrativo antes de impor fricção geral.
- Rever `script-src`/CSP após inventário dos recursos reais; a CSP atual não deve ser anunciada como controle completo de XSS.
- Reduzir grants não usados conforme superfície comprovada, sem confundir permissões SQL com endpoints efetivamente disponíveis.
- Tratar advisories aplicáveis ao ambiente de desenvolvimento/build em atualização pequena e testada; não atualizar todas as dependências por contagem bruta do registry.
- Completar evidência de recuperação e limites/contrato do LLM; se confirmados riscos materiais em U-01/U-02, deixam de ser hardening opcional.

## H. Security Launch Readiness

**NO-GO para lançamento comercial irrestrito, dentro do escopo de segurança avaliado.** Há permissões bloqueadoras confirmadas, não apenas ausência de documentação. Os controles legítimos de compra e JWT não compensam a criação direta de entitlement nem a edição direta da assinatura consumida pelo backend.

Condições mínimas para nova decisão: SEC-01/02 corrigidos e validados negativamente/positivamente; SEC-03 alinhado ao contrato comercial de perfis/exclusividade; classificação conclusiva de U-01 e evidência mínima de recuperação em U-02. SEC-04 deve ter tratamento priorizado pela integridade das negociações; SEC-05 pode ser planejado conforme a exposição de uploads, sem ignorar sua existência. Não há percentual de segurança nem certificação de ausência de outros defeitos.

Esta decisão não autoriza desligar produção, modificar flags ou iniciar SEC-1. A publicação existente permanece preservada. O proprietário deverá autorizar separadamente a remediação e suas eventuais migrations/testes.

## I. Workspace and Environment Integrity

Baseline: árvore limpa, HEAD `e2f3d32`; stash de preparação `af44d02f` e stash anterior `e6871a82`, além dos demais stashes existentes. A auditoria não aplicou, descartou, criou ou alterou stash.

Atividades realizadas:

1. `git status --short`, branch/HEAD e listagem de stashes; leituras dirigidas por `rg`, `Get-Content`, `git ls-files`.
2. GETs Management API Supabase para identidade, Auth (somente campos não secretos emitidos), Functions, backups e download em memória de corpos de funções. O download do Portal e Maxxis retornou 200; o de report-mail-delivery foi interrompido antes de conclusão. Não houve arquivo de download ou uso desses corpos para deploy.
3. Management API database/query com **SELECTs de metadados**: `pg_class`, `pg_policies`, grants de tabela/coluna, `pg_proc`/`pg_get_functiondef`, triggers, constraints, `information_schema`, `pg_publication_tables`, metadados de buckets. Nenhuma RPC de negócio foi executada por SELECT. Nenhum registro de perfil, mensagem, contato ou relatório foi extraído.
4. GETs Vercel de projeto/deploy e GETs públicos da homepage/18 assets; SHA-256 comparado em memória.
5. Busca de padrões de secrets em arquivos rastreados e artefato já existente, sem reproduzir valores. Consulta HTTPS ao endpoint npm `/-/npm/v1/security/advisories/bulk`, enviando somente nomes/versões públicos de 661 pacotes; sem executar npm, gerar cache ou alterar lockfile.
6. Consulta de documentação oficial atual. Scripts inline via stdin/`node --input-type=module`; não foram criados scripts ou recibos intermediários. Nenhuma suíte foi executada, pois a evidência principal veio de metadados e a restrição proíbe efeitos persistentes desnecessários.

Uma primeira consulta inline falhou na interpretação de aspas antes de executar o SQL; foi substituída por stdin. Alguns padrões com wildcard de caminho no PowerShell não expandiram; buscas direcionadas subsequentes supriram os pontos relevantes. Isso não gerou alteração no ambiente.

Integridade preservada: nenhum código-fonte, migration, configuração, registro de negócio, credential, saldo, assinatura, feature flag ou stash foi alterado; nenhum envio, chamada generativa/paga, cobrança, consumo de Nuggets, unlock, deploy, commit ou push. **Único arquivo criado/alterado no workspace por esta auditoria: este relatório autorizado.** Consultas de leitura podem gerar logs técnicos automáticos nos provedores; não são gravações deliberadas em dados do produto. A inspeção não garante ausência de alterações concorrentes realizadas por terceiros.

Conferência de encerramento: `git status --short` apresentou somente `?? docs/DEALSIFTER_CRITICAL_SECURITY_AUDIT.md`; HEAD e os dois primeiros stashes mantiveram os hashes da baseline. Nova leitura de Vercel confirmou o mesmo deployment, e os metadados das 28 funções continuaram idênticos ao snapshot da publicação. Não se emitiu um certificado de invariância de todos os registros do banco, pois isso exigiria outra superfície de coleta e não é necessário para confirmar as ações efetivamente executadas.

### Referências oficiais consultadas

- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [privilégios por coluna](https://supabase.com/docs/guides/database/postgres/column-level-security): grants e policies compõem a autorização; RLS de linha não restringe campos de UPDATE.
- [Supabase — Storage access control](https://supabase.com/docs/guides/storage/security/access-control) e [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals): downloads públicos e escrita são controles diferentes.
- [Supabase — sessões](https://supabase.com/docs/guides/auth/sessions): lifetime de JWT, rotação e limites de revogação; não se inferiu vulnerabilidade de um comportamento esperado.
- [Stripe — webhooks](https://docs.stripe.com/webhooks): assinatura do corpo original e tratamento de duplicados; não substituem autorização do banco da aplicação.
- [Google — termos Gemini API](https://ai.google.dev/gemini-api/terms): condições de uso de dados diferem entre serviço pago e não pago; modalidade efetiva de Production não comprovada.
- Advisories do registry foram tratados como sinais: exemplos [Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [Vite/launch-editor](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [DOMPurify](https://github.com/advisories/GHSA-p98j-92pf-mc4p), [undici](https://github.com/advisories/GHSA-4w7w-5xrc-9h26). Suas condições específicas não foram reproduzidas.

Referenciais de classificação: OWASP Top 10/API Security/ASVS e LLM Top 10, especialmente autorização de objetos/propriedades, integridade de transações, sensitive information disclosure e excessive agency. Utilizados para orientar o raciocínio, sem alegar certificação de conformidade.
