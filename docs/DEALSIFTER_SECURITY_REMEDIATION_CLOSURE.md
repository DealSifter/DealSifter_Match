# DealSifter Match — SEC-1: encerramento da remediação de segurança

Data de referência: 24/11/2026, America/Sao_Paulo. Alguns recibos técnicos usam UTC de 25/11. Escopo: SEC-01 a SEC-05 e verificações complementares expressamente solicitadas. Este é o único relatório consolidado SEC-1; o relatório SEC-0 foi preservado integralmente.

**Atualização SEC-2:** as seções A–F preservam o registro histórico SEC-1. A seção G registra a intervenção posterior, o estado vigente de SEC-06 e a classificação atual de U-01, sem reabrir SEC-01 a SEC-05.

## A. Executive Summary

**Decisão final de segurança: NO-GO para lançamento comercial irrestrito.** As cinco vulnerabilidades originais receberam correções específicas, testes positivos/negativos e publicação em Production. Permanecem dois bloqueadores independentes: possibilidade comprovada de envio de PII/confidências no texto e histórico ao Gemini, sob modalidade sem billing informada pelo proprietário, e compartilhamento de resposta entre identidades na deduplicação de requisições do cliente, reproduzido com transporte mockado. Corrigir esses pontos não estava autorizado nesta rodada.

Estado inicial SEC-0: 1 CRITICAL, 2 HIGH, 2 MEDIUM, 2 RISK e 8 NOT VERIFIED; decisão NO-GO. Estado final dos cinco findings originais: corrigidos e validados no alcance descrito abaixo. Isso não certifica ausência de outras vulnerabilidades nem substitui a decisão global do Launch Closure, seus gates comerciais ou LC-02/LC-04.

Lotes A, B e C publicados. Não há lote desses cinco aguardando deploy. O backup local protegido passou por recuperação isolada antes das migrations. Não houve alteração visual, de arquitetura, preços, custos, prazos de exclusividade, saldos, regras de planos ou feature flags. O único ajuste de runtime frontend captura o perfil ativo do comprador na intenção de compra, necessário para a reciprocidade correta.

Commits de implementação: `6a71302365fc85bc328d1c8129116cfb2539f7d1` (titularidade Stripe) e `72be60f0397d604c28087c08e929a903adcda058` (permissões e contatos por escopo). Branch `fix/production-real-defects`. Não houve push nesta execução.

## B. Remediation Matrix

| Finding / estado inicial | Causa e correção mínima | Validação negativa | Validação positiva | Resultado efetivo |
| --- | --- | --- | --- | --- |
| SEC-01 / CRITICAL | INSERT de cliente em `unlocks` criava entitlement sem passar pela compra. Revogados INSERT de tabela e coluna de PUBLIC/anon/authenticated; removida somente `unlocks_insert_own`. | Inserção direta negada; ausência de entitlement não revela contato. | Compra pela rotina existente, débito único, repetição sem débito duplicado e leitura legítima passaram com fixtures sintéticas e rollback. | **PASS — staging e Production**. Backend mantém INSERT; SELECT necessário preservado. |
| SEC-02 / HIGH | `subscriptions` era gravável pelo próprio beneficiário e o Customer armazenado era aceito sem prova de titularidade. Revogados INSERT/UPDATE diretos e policies próprias correspondentes; Portal e Checkout verificam Customer retornado pelo Stripe, ID e `metadata.supabase_user_id`. | Alteração de plano/Customer negada; Free sem acesso pago; Customer alheio, sem metadata, excluído ou inconsistente rejeitado. Falha de consulta não cria substituto. Email igual não prova titularidade. | Escrita server-side e leitura própria preservadas; PRO/Enterprise ativos e Customer legitimamente vinculado aceitos; canceled/unpaid com plano-base Free não recebem acesso pago. | **PASS — permissões e duas Edge Functions em Production**. Não foram modificados Customers, assinaturas ou pagamentos reais. |
| SEC-03 / HIGH | RPC legada não aplicava a autorização canônica de escopo/exclusividade. Agora projeta a RPC canônica, mantendo contrato de linhas/JSON. Removido fallback de email/telefone para conta/login. Reciprocidade usa exclusivamente o perfil do comprador registrado na intenção. | Perfil B e FSBO não comprados negados; exclusividade ativa de terceiro oculta os mesmos contatos nas duas RPCs; sem fallback de email de login; payload posterior não troca o perfil congelado na intenção. | Perfil comprado, entitlement anterior, agregação legada, acesso ao portfólio por escopo e reciprocidade com prazo preservados; expiração testada; compra exclusiva sintética mantém custo e débito existentes. | **PASS — SQL e frontend em Production**. Definições canônica/legada conferidas contra staging. |
| SEC-04 / MEDIUM | UPDATE de tabela permitia destinatário alterar a mensagem inteira. Revogados UPDATE de tabela/coluna e concedido somente `UPDATE(read_at)` a authenticated, preservando RLS do destinatário. | Alterações de body, sender, data e metadata negadas; terceiro não lê nem marca; remetente não altera recibo do destinatário. | Envio/leitura pelos participantes e atualização do recibo pelo destinatário passaram. SELECT, INSERT, rotina de chat e configuração Realtime preservados. | **PASS — staging e Production**. Mensagens existentes não foram alteradas. |
| SEC-05 / MEDIUM | Policies INSERT antigas combinavam por OR e anulavam o namespace. Removidas somente `profile_images_owner_insert` e `property_images_owner_insert`; preservadas policies de prefixo próprio. | Upload em prefixo alheio e update/delete alheios negados em SQL e pela Storage API no staging. | Upload próprio e leitura pública nos dois buckets passaram; arquivos sintéticos novos removidos pelo próprio dono. | **PASS — staging e Production**. Buckets, limites, MIME, caminhos e imagens existentes preservados. |

### Arquivos e objetos alterados

- `supabase/migrations/20261124220000_sec1_financial_write_permissions.sql`: grants/policies de `unlocks` e `subscriptions`, incluindo privilégios por coluna.
- `supabase/migrations/20261124220100_sec1_scoped_contact_reads.sql`: `ds_get_unlocked_contact_cards(uuid)`, `ds_get_unlocked_contact_snapshots()`, grants EXECUTE e patch pontual de metadata em `ds_purchase_property_unlock`. `ds_get_user_unlock_state` mantém sua definição e usa a projeção corrigida.
- `supabase/migrations/20261124220200_sec1_chat_storage_permissions.sql`: grants de `chat_messages` e policies INSERT dos dois buckets.
- `supabase/functions/_shared/stripeCustomerOwnership.ts` e os handlers `create-portal-session/index.ts`, `create-checkout-session/index.ts`: validação server-side do vínculo, sem fallback por email.
- `src/services/unlockService.js`: captura `buyerProfileScope` do perfil ativo já usado no aplicativo, antes da criação da intenção. Preserva o escopo do vendedor e os demais metadados.
- Testes: `scripts/sec1-transactional-validation.sql`, `scripts/sec1-contact-validation.sql`, `scripts/sec1-billing-handlers.test.mjs`, `src/services/unlockService.security.test.js`, `supabase/functions/_shared/stripeCustomerOwnership.test.ts`, `src/lib/supabaseClient.securityDiscovery.test.js` e `supabase/functions/_shared/maxxis/sec1PrivacyAndEntitlement.test.ts`.
- Este relatório. O arquivo SEC-0 permanece com o mesmo conteúdo.

### Contratos e limites relevantes

A definição de compra exclusiva de staging possui tratamento de repetição adicional ausente na definição de Production. A migration B não substitui uma pela outra: altera somente o ponto de registro de metadata, preservando cada corpo preexistente. As demais rotinas relevantes foram comparadas e preservadas.

O proprietário confirmou que o contato recíproco deve ser o do **perfil ativo usado na compra**, acompanhado do prazo de exclusividade. Por isso, a intenção autenticada congela esse escopo e a compra copia o valor da intenção, não do payload posterior. Valores ausentes/inválidos não autorizam adivinhar outro perfil. A consulta agregada anterior ao deploy encontrou zero exclusividades ativas em Production; não foi necessário reescrever histórico. Clientes antigos sem esse metadado precisam recarregar a versão publicada; a reciprocidade não revela um perfil por suposição.

O gate Stripe agora falha fechado quando a titularidade não é comprovável. Um vínculo histórico sem a metadata exigida pode precisar de reconciliação futura com a fonte Stripe; não foi inserida metadata retroativamente. Os dois Customers históricos não tiveram titularidade externa certificada nesta rodada.

Não foi certificado o cenário de assinatura ainda marcada `active` apesar de `current_period_end` vencido, sem atualização de status pelo ciclo de billing. Foram testados os estados canceled/unpaid e preservada a regra existente de plano-base confiável; não se apresenta isso como teste completo de expiração/replay financeiro.

## C. Complementary Checks

### U-01 — Gemini e privacidade: FAIL no controle de payload; gate bloqueado

**Confirmado no código e no teste isolado:** o backend utiliza Gemini Developer API (`generativelanguage.googleapis.com`). O sanitizador de texto remove controles e limita tamanho, mas não remove PII. A compactação do histórico conserva email e orçamento confidencial sintéticos. O teste usa o sanitizador real, o compactador real e `callGemini` com `fetch` mockado: o corpo preparado contém esses dados. Zero chamadas generativas externas foram realizadas. A projeção de tools mascara parte dos contatos; esse controle parcial não cobre texto espontâneo e histórico.

**Informado pelo proprietário, sem prova independente no painel de billing:** a chave utilizada pertence ao projeto `gen-lang-client-0466397101`, sem conta de faturamento ativa. Não se inferiu modalidade apenas da existência de quota gratuita. A vinculação administrativa da chave ao projeto e eventuais condições regionais/contratuais especiais não foram certificadas.

Os [termos oficiais Gemini API](https://aistudio.google.com/docs/terms), consultados nesta execução, vedam dados pessoais, sensíveis ou confidenciais nos serviços não pagos e vinculam a modalidade paga da API a projeto com billing ativo. Considerando a modalidade declarada pelo proprietário, o payload demonstrado é incompatível com exposição irrestrita de dados reais. Não há prova de que PII real já tenha sido transmitida nem conclusão de incidente.

Nos caminhos inspecionados, o logger Maxxis projeta métricas operacionais, identificadores e códigos, em vez de registrar integralmente o prompt. Histórico e memória também têm mecanismos de persistência no cliente e contextos privados existentes. Isso não certifica todos os logs remotos, retenção, backups, respostas de erro ou persistência externa; esses itens permanecem **NOT VERIFIED**. Não foi extraído histórico real para ampliar a investigação.

Menor tratamento futuro: definir uma condição de serviço compatível e impedir que texto/histórico/contexto indevidos cheguem ao provedor, com teste dirigido dos caminhos efetivos. Redaction abrangente, mudança de provedor, ativação de billing e desligamento do Maxxis não foram executados nem estão implicitamente autorizados.

### U-02 — Backup e recuperação: PASS com cobertura delimitada

Preflight: lista de backups Supabase vazia e PITR desativado. O proprietário não conhecia backup externo e autorizou preparar backup protegido e validar recuperação antes de migrar.

Criado snapshot consistente somente leitura de **56 tabelas / 8.536 registros**, abrangendo 52 tabelas públicas e `auth.users`, `auth.identities`, `storage.buckets`, `storage.objects`. Snapshot em **24/11/2026 às 22:13 Brasília**; validação às **22:22**. Backup cifrado AES-256-GCM; chave protegida por Windows DPAPI CurrentUser; ACL local restrita ao usuário e SYSTEM. Não foi enviado a serviços externos nem incluído no Git.

Recuperação em PostgreSQL 17 local isolado: carga e restauração de **280 constraints**, geração de dump nativo, cifragem, decifragem e `pg_restore` em segunda base; hashes de conteúdo de todas as 56 tabelas conferidos. Servidor local encerrado e os três diretórios de clusters temporários desta execução removidos após checagem de caminho/processo. Artefatos cifrados e recibo preservados em `.tmp-codex/sec1-20261124/recovery/`.

Limites: ponto de recuperação local único, sem retenção automatizada ou cópia fora do dispositivo comprovadas; não inclui binários de Storage, secrets remotos, sessões Auth ou estado dos provedores externos. A restauração não é um clone operacional completo dos serviços Supabase. As definições anteriores dos objetos SQL afetados e os bundles anteriores das duas Edge Functions foram preservados separadamente. **PASS para o gate de recuperação destas migrations sem transformação de dados; não é certificação de disaster recovery integral.** O vínculo DPAPI exige preservar o contexto Windows capaz de recuperar a chave.

Rollback de Vercel não recupera banco; rollback de Edge não recupera dados; definições SQL não substituem o backup de dados. Uma recuperação não deve reabrir silenciosamente as permissões vulneráveis. Preferir correção progressiva; qualquer escolha entre indisponibilidade e reexposição exige decisão explícita.

### N-03 — Cache e troca de conta: FAIL; novo SEC-06

**SEC-06 — HIGH/P1, exposição condicionada à sobreposição de requisições no mesmo cliente.** `src/lib/supabaseClient.js` deduplica GET/HEAD por método e URL, sem Authorization. Teste local do módulo real, com identidades e respostas sintéticas, mantém A pendente e inicia B na mesma URL com outro Bearer: apenas uma chamada de transporte ocorre e ambos recebem o resultado de A.

Isso confirma compartilhamento de resposta entre identidades na camada de transporte. O teste que passa é uma **reprodução da falha**, não uma correção. Não foi demonstrada uma extração real nem um fluxo completo de logout/login que sobrescreva toda a UI; alguns consumidores possuem guardas de cancelamento/identidade. O alcance de atualização tardia de estado em todos os consumidores permanece **NOT VERIFIED**. Essa limitação não elimina a quebra demonstrada no isolamento do transporte.

Correção mínima sugerida, não implementada: separar deduplicação pelo contexto autenticado e impedir aplicação de respostas antigas nos consumidores afetados, com testes da troca de identidade e da deduplicação legítima na mesma identidade. A instrução SEC-1 exige registrar o novo finding sem ampliar automaticamente a remediação.

### MFA administrativo: NOT VERIFIED quanto à proteção efetiva

Consulta agregada: **2 administradores ativos; 0 com fator Supabase verificado**. Não se conclui que MFA Google seja inexistente. Exigência de AAL no app e eventual MFA no provedor externo não foram comprovadas. Nenhuma configuração de autenticação foi modificada.

Conferência específica do proprietário: [Supabase Authentication → Users](https://supabase.com/dashboard/project/cyeipfskwwisbbayyaca/auth/users), abrir a própria conta administrativa e verificar fatores MFA; se o acesso administrativo usa Google, confirmar também a exigência de MFA nessa conta/provedor. Não enviar credenciais, tokens ou lista de usuários.

### Integridade histórica: sem fraude confirmada; reconciliação limitada

Verificação somente leitura e agregada: **24 unlocks**, dos quais 4 com gasto zero, 10 com comprador administrador e 4 pelo caminho de imóvel; essas categorias podem se sobrepor. Três não tinham referência financeira disponível na primeira correlação. O aprofundamento agregado encontrou intenção consumida em dois; o terceiro é anterior às rotinas atuais de compra. Todos os três têm gasto positivo registrado. Isso não prova fraude nem certifica a origem do registro legado restante. Nenhum foi apagado, invalidado ou alterado.

Assinaturas: **2 registros, zero assinaturas pagas ativas**, zero ativas pagas sem Customer, zero divergências de plano nesse subconjunto e zero vínculos Customer duplicados. Não houve reconciliação externa dos dois Customers no Stripe nem investigação exaustiva de concessões especiais em `users.plan`. Esses limites permanecem explícitos. O procedimento futuro mínimo para o caso legado é confrontar sua autorização/origem histórica, sem invalidação automática.

## D. Production Evidence

Production Supabase: `cyeipfskwwisbbayyaca`; staging: `oqdcnjupquhybwdbeeew`. As três migrations foram aplicadas, registradas e verificadas individualmente:

| Versão | Objeto | SHA-256 do SQL validado/publicado |
| --- | --- | --- |
| `20261124220000` | Permissões financeiras, SEC-01/02 | `c7fdd8392b23b2adf870bae4845e047a5746f9caf346eed1e960c62cf3586a36` |
| `20261124220100` | Contatos por perfil e exclusividade, SEC-03 | `05fa35c02ded4961bb98e28d67c3fe08ade19e7d60724a5a7304498bedc0a719` |
| `20261124220200` | Chat e Storage, SEC-04/05 | `b13734c246bc4764be33fc4fcc65261020bacd7c562dca283d5783c01177de78` |

Permissões efetivas de Production: INSERT em unlocks negado para anon/authenticated; INSERT/UPDATE em subscriptions negados para ambos; UPDATE de tabela em chat negado, UPDATE(`read_at`) permitido a authenticated, UPDATE(`body`) negado. INSERT financeiro de service_role preservado. As duas policies Storage amplas não existem mais. EXECUTE das duas RPCs de leitura de contatos negado a anon e permitido a authenticated. As rotinas de compra preservam seus controles internos de autenticação.

Edge Functions do commit `6a71302`: `create-portal-session` **v18** (antes v17) e `create-checkout-session` **v53** (antes v52). Verificados status ACTIVE, hashes e configuração `verify_jwt` preservada; autenticação interna permanece. Smoke seguro em ambas: OPTIONS **200**, POST sem autenticação **401**. Nenhuma sessão Stripe foi criada pelo smoke. As outras 26 funções não foram redeployadas.

Frontend indispensável do commit `72be60f`: deployment **`dpl_A4XkH2J5MdKoCQ3UVVpeJQBAAQwB`**, READY e alvo Production confirmado. [Site canônico](https://dealsifter.com/) e [deployment imutável](https://dealsiftermatch-4448sbt6p-deal-sifter-match-s-projects.vercel.app). Fingerprint `1d0aa995e8546912073dc9390a9acad0c8dc5501ba340551b9729a463755dd9b`. Referência anterior de frontend: `dpl_DkSm1HDCtJmxcbnPMTm9QzzU8diL`. A publicação contém somente a captura de perfil em `unlockService.js` como mudança de runtime frontend; nenhuma alteração de componente ou CSS.

Recibos técnicos privados, fora do Git, em `.tmp-codex/sec1-20261124/`: `permissions-production.json`, `contacts-production.json`, `billing-production.json`, `contact-tests.json`, `storage-api-smoke.json`, `recovery/recovery-receipt.json`, `frontend/build.json`, `frontend/production.json`, `frontend/production-smoke.json`, `frontend/critical-assets.json` e `final-integrity.json`. Não copiar dumps, chave, tokens ou logs privados para o relatório público.

As primeiras tentativas de deploy das duas Edge Functions e das migrations A/C foram rejeitadas pela revisão automática por exigir autorização específica dos componentes de Production. O proprietário aprovou essas unidades explicitamente; só então foram executadas. Não houve contorno da rejeição.

## E. Regression and Integrity

### Verificações executadas

- **38 verificações SQL dirigidas: PASS**, incluindo pares negativo/positivo dos cinco findings, compra e exclusividade com Nuggets sintéticos, contratos canônico/legado e reciprocidade. Executadas em transação com rollback no staging; incluem as 24 verificações iniciais A/C, sem somá-las como cobertura independente.
- **Storage API real no staging: PASS**, namespace próprio/alheio, update/delete alheio e leitura pública dos dois buckets. Somente os dois pequenos arquivos sintéticos criados pelo teste foram removidos.
- **33 testes Vitest finais: PASS**, em sete arquivos: consumidores de contatos/Maps, gates de planos, modal, captura do perfil, titularidade Stripe e investigações mockadas de privacidade/cache. Os testes de U-01/N-03 reproduzem problemas ainda abertos.
- **10 testes dos handlers Portal/Checkout: PASS**, executando os handlers com transporte substituído, sem Stripe real. Os oito testes unitários do helper Stripe também integram os 33 acima.
- Build de produção isolado/offline: **PASS**, 146 assets, sem sourcemaps e scan de secrets aprovado. Configuração pública de Production e flags preservadas.
- Navegador local e publicado: **PASS** para seis casos por ambiente, rotas `/privacy` e `/terms`, recarga, retorno à homepage/rodapé e ausência de overflow horizontal em 1440, 768 e 390 px. Sem erros de página e sem chamadas de escrita/backend pelos testes. **18 assets críticos** do domínio canônico conferidos por hash, incluindo app-shell, Dashboard, Onboarding, Settings, Matches e Maps. URLs canônica/www verificadas por leitura.
- ESLint dos arquivos JS afetados: sem erros; typecheck de contratos TypeScript do projeto: PASS. A configuração ESLint não abrange os arquivos TS de Edge (o comando explicitou warnings de arquivo ignorado); não se afirma lint desses TS.
- Deno check do escopo Edge comparado ao baseline: **zero erros novos**, mas permanecem **dois erros preexistentes**: API Stripe fixada em `2024-04-10` diverge do literal de versão aceito pelo SDK. Não foram silenciados nem alteradas dependências/API para fazê-los desaparecer. Portanto, não se declara typecheck Edge totalmente limpo.

Limites de regressão: não foram repetidos indiscriminadamente todos os E2E do app, compras reais, geração paga de relatórios, exportação PDF completa ou envio Gmail. Contratos de portfólio e consumidores foram verificados no alcance diretamente afetado; isso não reabre nem substitui a aceitação humana/comercial anterior. Paginação de chat não foi reescrita; seus grants de leitura e contrato existente foram preservados, sem nova certificação E2E integral de Realtime.

Ocorrências de harness corrigidas antes dos PASS: Storage bloqueou DELETE SQL pelo guard nativo; o teste passou a usar a opção transacional da própria Storage API, mantendo RLS, e foi complementado pelo teste via API. A geração inicial da migration B precisava de terminador SQL; corrigida e revalidada. O runner dos handlers passou a usar o esbuild já instalado após incompatibilidade da API de transpile do TypeScript local. Assertions não foram retiradas para forçar aprovação.

### Preservação

Nenhum redesenho de UX/UI, CSS, landing, cards, onboarding, Maps, feed ou modais. Preservados autenticação, perfis, FSBO, portfólio, Connections, chat, Maxxis, Property Intelligence e relatórios no alcance das mudanças. Não foram ativados recursos pagos, PITR, provedores, feature flags ou novos serviços externos.

**35 stashes originais preservados**, incluindo `af44d02f` e `e6871a82`, sem aplicar/descartar seu conteúdo. O hook de commit usou e removeu somente seu stash temporário automático. A preparação pendente de verificação de contatos não entrou no release. SHA-256 do relatório SEC-0 preservado: `500bdfc1c9c7727ccfc1bf8c94fb5c3c458d0dd83b0a2b28ec49e758d0577010`.

Migrations não transformaram registros de negócio nem alteraram tabelas de dados. Não houve cobrança, compra, unlock ou consumo real de Nuggets; nenhum email, SMS ou ligação enviado; nenhuma chamada generativa externa. Login QA e testes sintéticos foram limitados ao staging autorizado. Consultas e deploys podem gerar logs técnicos nativos; não se confunde isso com alteração deliberada de dados de usuários. Não foi emitido certificado de invariância de todos os registros contra ações concorrentes de terceiros.

## F. Remaining Security Backlog

Bloqueadores desta decisão: **U-01** e **SEC-06/N-03**. Não remediados por ausência de autorização para ampliar o escopo. MFA efetivo, origem do unlock legado e titularidade externa dos Customers têm evidência incompleta, conforme C; não foram classificados automaticamente como fraude ou bypass.

Limitações SEC-0 mantidas: **N-01**, secrets em histórico completo/logs/backups; **N-02**, matriz dinâmica de todas as RPCs/RLS (somente superfícies desta remediação foram testadas); **N-04**, Broadcast/Presence e assinatura Realtime alheia ponta a ponta; **N-05**, Gmail OAuth/quotas/reconexão e LC-04; **N-06**, replay/concorrência e ciclo completo financeiro TEST/LIVE (testes sintéticos atuais não certificam toda a cadeia); **N-07**, aplicabilidade de advisories de dependências; **N-08**, proteção administrativa e demais integrações, SSRF e retenção/remoção integral. N-03 deixou de ser apenas indício na camada de transporte, mas o alcance completo na UI segue não certificado.

Backup automatizado e externo, binários Storage e recuperação operacional completa continuam sem certificação. Nenhum desses NOT VERIFIED foi convertido em PASS por inferência. Não foi iniciada nova auditoria geral nem outra fase de hardening.

## G. SEC-2 — Isolamento de requisições e respostas entre sessões

### Baseline e escopo

Baseline efetivamente conferida: branch `fix/production-real-defects`, HEAD `7fe53dd57d4c77f67f6793121630cbce21c0071c`, workspace limpo e os mesmos 35 stashes. Production estava no deployment `dpl_A4XkH2J5MdKoCQ3UVVpeJQBAAQwB`, frontend `72be60f`. Referências de Portal v18, Checkout v53 e das três migrations reaproveitadas da SEC-1; não houve nova remediação desses objetos.

Única intervenção de desenvolvimento: SEC-06/N-03. Commit de implementação **`ab89795b26d3a4e28f31096156476ee93cce7d58`**. Dois arquivos de runtime alterados: `src/lib/supabaseClient.js` e `src/hooks/useAuthSession.js`. O teste de descoberta `src/lib/supabaseClient.securityDiscovery.test.js` foi convertido em regressão permanente; adicionado `src/hooks/useAuthSession.security.test.jsx` para o consumidor diretamente afetado. Nenhuma biblioteca, migration, Edge Function, configuração de autenticação ou componente visual foi alterado.

### Correção localizada

A deduplicação continua restrita a GET/HEAD pendentes no domínio exato do Supabase, fora dos endpoints Auth. Sua chave transitória agora usa geração de autenticação, identidade do sinal de cancelamento e digest SHA-256 de método, URL, headers efetivos e opções de requisição relevantes. Isso separa Authorization, apikey, representação, Range/Prefer e demais headers; sinais independentes não passam a compartilhar cancelamento. A chave não contém tokens brutos. Não foi criado armazenamento persistente, log ou telemetria de credenciais. O token atual permanece apenas em memória para comparação com a autorização efetiva da chamada, como já ocorre no SDK.

O listener síncrono de Auth, registrado antes dos consumidores da UI, avança a geração ao trocar token/sessão, sair da conta ou alterar autorização/MFA. SIGNED_IN repetido com o mesmo token e eventos nulos transitórios de refresh não interrompem uma sessão válida. Tokens distintos do mesmo usuário não são considerados equivalentes. Endpoints Auth permanecem sob o lifecycle nativo do SDK.

Além de limpar o mapa, cada resposta de dados é conferida antes da entrega e antes/depois da leitura do corpo, incluindo clones e chunks de stream. Respostas obsoletas falham com `AbortError` genérico, sem retornar dados da identidade anterior. A proteção também cobre POST/RPC e Functions, que continuam sem deduplicação; descartar uma resposta não desfaz uma operação já executada no servidor. Erros da sessão atual continuam sendo propagados ao SDK para seus retries existentes; erro tardio da sessão antiga vira AbortError e não provoca retry com credencial obsoleta.

O hook Auth tinha uma continuação diretamente relacionada: a consulta pendente de `users.is_admin` podia restaurar status/navegação da conta anterior. Uma revisão local impede tanto sua aplicação tardia quanto a restauração de bootstrap anterior a uma transição de sessão. Guardas de cancelamento/identidade já existentes nos consumidores de hidratação foram preservadas. Não houve varredura ou reestruturação geral do gerenciamento de estado.

Em contexto sem Web Crypto, o transporte conserva a proteção de sessão e executa a leitura sem deduplicá-la, em vez de construir uma chave insegura. Em Production HTTPS com Web Crypto, a deduplicação permanece ativa e foi testada. Não se desabilitou globalmente a otimização.

### Validação dirigida

**22 testes aprovados**, com identidades sintéticas e fetch mockado. Incluem: deduplicação GET/HEAD legítima com corpos independentes; A/B; anônimo/autenticado; login durante leitura anônima; logout/login durante GET e POST; sessões diferentes do mesmo usuário; corpo e stream tardios; clones obsoletos; refresh; mudança de autorização sem troca de token; eventos repetidos/nulos; Request/Headers e opções de representação; cancelamentos independentes; limpeza após erro; bypass correto de deduplicação em writes/Auth/outro domínio; SDK PostgREST real sobre transporte mockado, mantendo retry legítimo e recusando dados/retry antigos; hook de bootstrap e consulta administrativa tardia.

A reprodução original agora exige duas chamadas distintas e dados de A somente para A e de B somente para B. Não foram removidas assertions para forçar PASS. Na primeira execução, um mock artificial definiu `response.text` como não reconfigurável; esse caso foi substituído por uma Response com ReadableStream real para testar leitura tardia sem alterar assertions de segurança. O resultado final é 22/22.

ESLint dos quatro arquivos: PASS sem warnings; typecheck de contratos do projeto: PASS. Os dois erros Edge preexistentes não foram corrigidos nem seus testes repetidos. Não foram reexecutados os 38 checks SQL, regressões integrais de Stripe/Storage/Maxxis ou investigação de payload U-01.

Build isolado/offline do commit `ab89795`: **PASS**, 146 assets, scan de secrets aprovado e zero sourcemaps. Configuração pública e feature flags de Production preservadas. Smoke público local: **PASS**, seis casos em desktop/tablet/mobile (1440/768/390 px), sem overflow horizontal ou erros de página. Smoke autenticado do mesmo artefato com adapter somente leitura ao staging: **PASS** em desktop e mobile, conferindo sessão QA, dashboard, configurações, recarga e restauração da identidade. Foram realizadas 74 leituras no staging; zero requisições ao backend Production, escritas ou chamadas pagas. O adapter bloqueou tentativas de escrita/Functions antes de chegarem ao backend. Esses testes não constituem regressão integral dos módulos preservados.

O smoke autenticado inicialmente parou por um seletor do harness com acento diferente do rótulo existente; a primeira substituição também não atravessou a codificação do stdin PowerShell. O seletor foi corrigido com expressão ASCII verificada, mantendo a exigência de abrir a seção real de configurações. O produto não foi alterado para contornar o teste; a execução final passou.

**SEC-06: PASS — corrigido, validado e publicado em Production.** Deployment **`dpl_hKHkeugDqF3MAG9FADbtyvxUP5vt`**, READY e alvo Production confirmado, fonte `ab89795b26d3a4e28f31096156476ee93cce7d58`, fingerprint `e9fdf3cfc774fd95e1d3e2609e38a692572d19f7448cc622eab294c7cdd15d3f`. [Domínio canônico](https://dealsifter.com/) e [deployment publicado](https://dealsiftermatch-mfapapkfc-deal-sifter-match-s-projects.vercel.app).

Pós-deploy: seis casos de navegador público aprovados em desktop/tablet/mobile, zero erros de página, 18 assets críticos do domínio canônico conferidos por SHA-256 contra o artefato validado, rotas `/`, `/privacy`, `/terms` com HTTP 200 em canônico e www. Conferência somente leitura confirmou as 28 Edge Functions e as três migrations SEC-1 preservadas. SEC-2 não executou migration nem deploy de Edge. Nenhuma regressão identificada no alcance verificado; isso não certifica todos os consumidores ou fluxos do produto fora desse alcance.

Recibos privados da execução: `.tmp-codex/sec2-20261124/`, com baseline, testes e manifests de build/publicação. Não contêm backup novo de banco. O deployment anterior foi preservado como referência operacional; rollback não deve reabrir SEC-06 silenciosamente. Em regressão relevante, priorizar correção localizada ou contenção e decisão explícita sobre eventual reexposição.

### U-01 — OPEN — PROVIDER PRIVACY / OWNER DECISION REQUIRED

Classificação vigente: **EXTERNAL DATA PROCESSING / PROVIDER PRIVACY / CONTRACTUAL COMPLIANCE**. Reaproveitada a prova sintética da SEC-1 de que texto livre/histórico podem incluir informações pessoais/confidenciais no payload externo; modalidade sem billing foi informada pelo proprietário. Não é um finding de bypass comprovado de unlock pelas tools do Maxxis, vazamento comprovado entre usuários, exposição pública das conversas ou incidente comprovado no Gemini. Nenhuma dessas conclusões decorre de U-01; tampouco há certificação integral de todas as tools.

O proprietário avaliará separadamente uma modalidade de processamento compatível. U-01 permanece aberto até solução aprovada e validada; ausência de vazamento interno não o converte em PASS. A postergação não autoriza exposição irrestrita de dados pessoais/confidenciais à modalidade incompatível.

Maxxis foi integralmente preservado: tools, system prompts, orquestração, memória, contexto, histórico, texto livre, modelos, matching, Property Intelligence, entitlements, desbloqueios, Nuggets, Usage Guards e limites. Não foram implementados filtros/redaction, alterado provedor, ativado billing, desligado Maxxis ou feitas chamadas Gemini nesta rodada.

### MFA — procedimento manual do proprietário

Estado herdado, sem nova investigação: dois administradores do app, nenhum fator Supabase verificado; MFA Google e exigência de AAL2 nas operações internas não certificados. MFA das contas de infraestrutura é diferente de MFA exigido pelo backend nas operações administrativas do DealSifter.

Conferir cada conta administrativa relevante, uma por vez, sem compartilhar códigos, QR, tokens ou recovery codes. Antes de eventual regularização, manter acesso ao método atual e guardar recuperação em local privado. O Codex não ativou métodos, invalidou sessões ou alterou exigências nesta rodada.

| Conta | Caminho para conferir e regularizar manualmente | Evidência mínima a registrar, sem segredos |
| --- | --- | --- |
| Google | [Conta Google → Segurança e login](https://myaccount.google.com/security) → Como você faz login → Verificação em duas etapas; conferir conta correta e métodos existentes. [Instruções oficiais](https://support.google.com/accounts/answer/185839?hl=pt-BR). | Ativa/inativa, método e disponibilidade de recuperação. |
| Supabase Dashboard | [Account → Security](https://supabase.com/dashboard/account/security) → Multi-factor authentication, conforme [documentação oficial](https://supabase.com/docs/guides/platform/multi-factor-authentication). | MFA da conta do painel e recuperação disponíveis. A ativação encerra outras sessões do painel; planejar essa regularização fora desta execução, sem revogação automática pelo Codex. |
| GitHub | [Settings → Password and authentication](https://github.com/settings/security) → Two-factor authentication; se ausente, seguir [configuração oficial](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication). | 2FA ativa e recuperação guardada; conferir todos os administradores relevantes, sem mudar exigência da organização nesta rodada. |
| Vercel | [Account Settings → Authentication](https://vercel.com/account/settings/authentication) → Two-factor authentication; conferir Active/Enabled e método cadastrado, conforme [documentação oficial](https://vercel.com/docs/two-factor-authentication). | Proteção pessoal ativa e recuperação disponível. Exigência para toda a equipe é configuração separada e não foi alterada. |
| Stripe | [Settings → Personal details](https://dashboard.stripe.com/settings/user) → Two-step authentication; conferir métodos e recuperação segundo [instruções oficiais](https://support.stripe.com/questions/enable-two-step-authentication). | Proteção da própria conta ativa; exigência da equipe é separada e não foi alterada. |
| Administração interna DealSifter | Para cada conta administrativa, conferir seus fatores em [Production → Authentication → Users](https://supabase.com/dashboard/project/cyeipfskwwisbbayyaca/auth/users). Registrar também se a aplicação exige desafio/AAL2 antes de operações administrativas. | Cadastro de fator não prova enforcement. Se o app não oferecer inscrição/desafio ou o backend não exigir AAL2, registrar essa necessidade de implementação futura; não marcar como protegido apenas por MFA no Google ou no painel Supabase. |

### Recuperação e histórico preservados

U-02 continua **PASS limitado**: 56 tabelas, 8.536 registros e 280 constraints recuperados na SEC-1; AES-256-GCM/DPAPI, cobertura e limitações locais já documentadas. Não foi criado novo backup, repetida restauração, habilitado PITR ou enviado artefato a terceiros. O unlock legado não reconciliado e os registros Stripe históricos permanecem intactos, sem presunção de fraude; as limitações financeiras da SEC-1 continuam válidas.

### Encerramento vigente SEC-2

**GO técnico para a correção SEC-06, já publicada. NO-GO para declarar lançamento comercial irrestrito enquanto U-01 não tiver solução de processamento compatível aprovada e validada.** U-01 é pendência de privacidade externa/decisão do proprietário, não evidência de bypass interno do Maxxis. MFA administrativo permanece NOT VERIFIED; U-02 permanece PASS limitado; a origem do unlock legado segue não reconciliada. Nenhuma dessas pendências foi convertida em PASS ou usada para adiar a publicação SEC-06.

Preservados design, layout, UX/UI, funcionalidades, configuração pública, feature flags e todos os 35 stashes. Relatório SEC-0 e snapshot cifrado SEC-1 mantêm seus hashes. Zero alterações de dados reais de negócio, cobranças, consumo de Nuggets, envios ou chamadas generativas. Sem novas dependências, infraestrutura, backup integral, correção de erros Edge preexistentes ou nova frente de hardening. Commit de implementação `ab89795`; registro de encerramento em commit documental separado, sem necessidade de novo deploy. Nenhum push realizado nesta rodada.
