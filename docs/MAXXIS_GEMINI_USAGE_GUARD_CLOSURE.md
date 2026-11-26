# Maxxis — Gemini Provider Usage Guard

Data: 25/11/2026. Commit de implementação: `4a84ec3306688726ba1a70338a5c616b03a080bc`.

## Estado de entrega

| Estado | Resultado |
| --- | --- |
| IMPLEMENTATION STATUS | PASS no escopo validado |
| PRODUCTION DEPLOYMENT | DEPLOYED — migration e dois consumidores publicados e conferidos |
| CONFIGURATION STATUS — 26/11/2026 | BLOCKED — incompatibilidade comprovada dos pools instantâneos |
| PRODUCTION ENFORCEMENT — 26/11/2026 | DISABLED; ativação BLOCKED, configuração revisão 1 preservada |
| BILLING — 26/11/2026 | NOT VERIFIED; nenhuma ativação ou alteração realizada |

## Tentativa de ativação — 26/11/2026

Escopo exclusivamente administrativo, sem mudanças no código, migrations, modelos, secrets, frontend ou deployments. HEAD inicial `3cdd79d`; branch `fix/production-real-defects`; workspace inicialmente limpo; 35 stashes com os mesmos hashes. Production continua com Maxxis v107 e tradução v9, bundles idênticos aos publicados. Permissões das tabelas/RPCs verificadas por leitura: nenhum acesso indevido de anon/authenticated.

**Decisão: não ativar.** O roteiro exige preservar fluxos legítimos de múltiplas chamadas e interromper quando a configuração não puder fazê-lo. A distribuição 70/15/15 combinada com RPM 12 impede esse gate no guard existente. Não houve gravação de configuração em Production.

| Parâmetro | Autorizado/informado nesta rodada | Efetivo em Production |
| --- | --- | --- |
| Quotas Google principal | Proprietário informou 15 RPM / 250.000 TPM / 500 RPD | Vínculo dessas quotas com a chave/projeto de Production ainda não comprovado |
| Principal | `gemini-3.5-flash-lite` | Confirmado por comparação interna do modelo conhecido com o valor/digest administrativo, sem exposição de secrets |
| Fallback | `gemini-3.5-flash`, sem quota comprovada | Modelo preservado; sem restrição nova enquanto DISABLED |
| Global | 12 RPM / 200.000 TPM / 400 dia / 12.000 mês | `global` e `provider_limits` continuam vazios |
| Pools | FREE 70%, pagantes 15%, operacional 15% | FREE 25%, pagantes 60%, operacional 15%, todos inativos |
| Individuais | FREE 3/30/1; PRO 20/300/2; Enterprise 50/1000/3: dia/mês/concorrência | Mesmos valores armazenados, inativos |
| Fuso do provedor | Necessário `America/Los_Angeles` | Nulo, sem aplicação |
| Flags | Ativação condicionada aos gates | `mode=DISABLED`, `provider_verified=false`, `commercial_approved=false`, revisão 1 |
| Contabilização | Consumo anterior deve ser considerado | Zero execuções/tentativas/reservas pendentes no ledger; uso Google ocorrido durante DISABLED desconhecido |

### Impedimentos e menor decisão necessária

1. **Pool pagante por minuto:** `floor(12 × 15%) = 1` chamada e `floor(200.000 × 15%) = 30.000` tokens. A transação isolada autorizou a primeira chamada do PRO e negou a segunda da mesma execução com `GEMINI_PAID_POOL_LIMIT`, mesmo com reserva diária/mensal disponível. O guard verifica RPM a cada tentativa e não espera a renovação da janela. Os percentuais são únicos para todos os períodos; não há configuração separada do pool instantâneo. Para três chamadas pagantes na mesma janela, seria necessário pelo menos 25% de 12 RPM. A menor alternativa somente administrativa seria uma decisão explícita de redistribuição, por exemplo 60/25/15; manter exatamente 70/15/15 exigiria alteração pontual da política do guard, proibida nesta rodada. Nenhuma alternativa foi aplicada ou presumida aprovada.
2. **Fallback:** retirar a chave do modelo ou usar quota zero é rejeitado. Foi comprovada uma restrição somente por configuração: teto operacional interno `models["gemini-3.5-flash"].calls_minute=1` produz capacidade zero nos pools FREE/pagantes por arredondamento, com os percentuais propostos; o principal passa e a tentativa fallback é negada antes do transporte. Isso não é quota Google comprovada nem uma opção explícita de desligamento. Depende dos percentuais e do arredondamento e precisa ser revalidado se os pools mudarem. Não foi gravado em Production. Mesmo essa restrição não resolve o impedimento 1.
3. **Campos adicionais obrigatórios sem valores aprovados:** `global.tokens_day`, `global.tokens_month` e `global.concurrency`. A reserva atual do chat é 514.936 tokens por chamada e 1.544.808 por execução; para caber uma execução no pool de 15%, os tetos globais de tokens dia/mês precisariam ser pelo menos 10.298.720 cada, antes de outros consumos. Para comportar três execuções concorrentes Enterprise nesse pool, a concorrência global precisaria ser pelo menos 20. São mínimos matemáticos, não quotas reais do Google nem configuração final aprovada. A reserva conservadora não mede custo faturável exato.
4. **Comprovação externa e janela segura:** projeto Google e billing atuais não estão acessíveis nesta sessão. Foi solicitada somente a confirmação do ID de projeto que mostra as quotas e da ausência de faturamento; a referência histórica é `gen-lang-client-0466397101`. O ledger vazio não prova ausência de consumo Google enquanto DISABLED. Antes de ativar, é indispensável conhecer o consumo do período ou estabelecer uma janela segura sem consumo concorrente não contabilizado. Esperar um reset sem controlar esse intervalo não basta.

### Validação dirigida e períodos

Uma transação isolada em staging, integralmente revertida, comprovou seis achados: segunda chamada pagante negada; fallback sem caps permitido; remoção de modelo rejeitada; zero rejeitado; principal permitido com restrição interna de fallback; fallback negado por essa restrição. Nenhuma chamada HTTP ao Gemini foi executada. A primeira versão do ensaio tentou reduzir o teto diário do fallback depois de simular seu consumo e foi corretamente rejeitada; o ensaio final usou savepoint/rollback para isolar a autorização não verificada e validou a restrição por minuto. Não foram repetidas as suítes anteriores.

Os parâmetros adicionais usados no ensaio (tokens/dia 20 milhões, tokens/mês 600 milhões, concorrência 20) eram exclusivamente sintéticos para isolar o problema de RPM; não são proposta de Production. Evidências privadas: `.tmp-codex/gemini-activation-20261126/preflight.json`, `targeted-validation.json` e `final-integrity.json`. Conferência final PASS_UNCHANGED: configuração/revisão/RPCs e versões publicadas intactas, rollback do staging confirmado, 35 stashes idênticos e zero escritas em Production.

O guard usa janela móvel de 60 segundos para chamadas/tokens, dia do provedor no timezone configurado e mês interno UTC; interações comerciais individuais usam UTC. `America/Los_Angeles` respeita horário sazonal: meia-noite corresponde a 08:00 UTC no inverno e 07:00 UTC no verão, ambos conferidos por SQL. Reservas pendentes contam na janela vigente; tentativas iniciadas pertencem ao período real de início. A documentação Google confirma quotas por projeto, TPM de entrada e reset RPD à meia-noite do Pacífico; o guard usa tokens totais conservadores, não apenas entrada. [Documentação oficial consultada](https://aistudio.google.com/docs/rate-limits).

Recuperação administrativa: nenhuma mudança foi feita, portanto não há configuração a reverter. O JSON anterior completo e a revisão foram preservados no recibo privado; qualquer alteração futura usa `ds_gemini_set_config` com a revisão então vigente, sem zerar ledger nem descartar reservas. Não restaurar cegamente a revisão antiga após uso concorrente. Não houve novos custos deliberados, ativação de billing, chamadas de IA, operações financeiras ou alteração de dados reais. UX/UI, RentCast, SEC-01 a SEC-06 e Maxxis permanecem preservados. U-01 continua OPEN; não foi declarado GO comercial irrestrito.

A revisão automática inicialmente exigiu autorização específica para a migration de Production. O proprietário autorizou expressamente a migration e os dois consumidores do commit `4a84ec3`; a publicação abaixo foi executada após essa autorização. Publicação técnica não autoriza ativação comercial.

Staging `oqdcnjupquhybwdbeeew`: migration `20261125120000_gemini_provider_usage_guard`, `maxxis-chat` v88 e `presentation-translate` v1, ACTIVE e JWT preservado. A tradução ainda não existia nesse staging; foi publicada para validar o segundo consumidor. Os outros 26 componentes permaneceram iguais. Configuração em DISABLED, sem quotas reais inventadas.

Production `cyeipfskwwisbbayyaca`: migration aplicada em 25/11/2026 às 22:57:08 UTC (19:57:08 Brasília); funções publicadas às 22:57:54 UTC. `maxxis-chat` v107 e `presentation-translate` v9 ACTIVE, com JWT preservado. Os outros 26 componentes e as 143 migrations anteriores permaneceram intactos. Conferência final PASS: configuração revisão 1, DISABLED, flags `commercial_approved` e `provider_verified` em `false`, tetos reais vazios, zero execuções/tentativas no ledger; RLS e negação de acesso aos objetos/RPCs por usuários comuns confirmadas.

Bundles publicados SHA-256: Maxxis `bd89b92830278bc9bcd3a8833a7551502a235bff8ba576bee5ca42e9c974cc13`; tradução `6bf072c8dd8427eea784f787d564965670e1e50f7b4e6dc2c7fc8c7f1a89a4fd`. Frontend preservado no deployment `dpl_hKHkeugDqF3MAG9FADbtyvxUP5vt`, release `ab89795b26d3a4e28f31096156476ee93cce7d58`. Nenhum build/deploy frontend realizado.

## Implementação e preservação

Reutilizados: cliente Gemini central, modelos configurados, budgets de execução/contexto, identidade autenticada, fonte server-side de planos e contratos existentes de resposta/fallback. Do RentCast foram reaproveitados os padrões de reserva e separação de capacidade; suas tabelas, RPCs, caches e semântica não foram reutilizados nem alterados.

Arquivos do commit:

- `supabase/migrations/20261125120000_gemini_provider_usage_guard.sql`: configuração, ledger dedicado, reserva/finalização/manutenção e permissões.
- `supabase/functions/_shared/maxxis/geminiUsageGuard.ts`: sessão por execução, RPCs, reserva de tokens e respostas controladas PT/EN/ES.
- `supabase/functions/_shared/maxxis/geminiClient.ts`: autorização imediatamente antes do transporte e reconciliação em `finally`.
- `supabase/functions/maxxis-chat/index.ts` e `supabase/functions/presentation-translate/index.ts`: contexto confiável e encerramento da sessão.
- `supabase/functions/_shared/maxxis/geminiUsageGuard.test.ts`, `scripts/gemini-usage-guard-validation.sql` e `scripts/gemini-usage-translation-handler.test.mjs`: testes dirigidos.
- `supabase/functions/_shared/maxxis/sec1PrivacyAndEntitlement.test.ts`: somente adaptação da assinatura do cliente ao contexto mockado DISABLED, sem mudar assertions nem reabrir U-01.

Objetos novos: `gemini_usage_config`, `gemini_usage_executions`, `gemini_usage_attempts`; RPCs `ds_gemini_reserve_execution`, `ds_gemini_begin_attempt`, `ds_gemini_finalize_attempt`, `ds_gemini_close_execution`, `ds_gemini_set_config`, `ds_gemini_prune_usage`; helpers/trigger próprios `ds_gemini_*`. RLS habilitada; usuários comuns e anônimos sem leitura/escrita/execução. Service role consulta a configuração e usa somente as RPCs de entrada; ledger sem acesso direto por essa role.

Prompts, tools, R-3, histórico, memória, modelos, generation config, entitlements, preços, Nuggets, relatórios e UX/UI foram preservados. Rate limit existente de 20 requests de chat/usuário/60 segundos, até três chamadas, uma rodada de tools, budget de 75 segundos e timeout Gemini de até 60 segundos permanecem. A autorização consome parte do tempo restante antes do transporte. Tradução mantém cache/claim, uma chamada, 15 segundos, saída de 8.192 tokens e conteúdo original em falha.

Modelo efetivo confirmado no preflight: `gemini-3.5-flash-lite`; fallback existente: `gemini-3.5-flash`. Não foram alterados secrets, Google Cloud, billing, dependências, frontend ou flags não relacionadas.

## Controles preparados — ainda inativos

| Dimensão | Implementação |
| --- | --- |
| FREE / PRO / Enterprise | Propostas dia: 3/20/50; mês: 30/300/1000; concorrência: 1/2/3. Chamadas/tokens por período opcionais por plano. |
| Pools | FREE 25%, pagantes 60%, reserva operacional 15%; PRO/Enterprise podem ser separados manualmente. Sem redistribuição automática. |
| Global/modelo | Chamadas e tokens por minuto/dia/mês, concorrência e limites opcionais por modelo. Capacidade pendente considerada. |
| Atomicidade | Lock transacional único serializa reserva, autorização por tentativa, finalização e configuração. Reserva e finalização idempotentes. |
| Execução | Chat reserva até três chamadas antes da primeira; fallback/interpretation usam a mesma execução e uma interação comercial. Cada tentativa é contabilizada separadamente. |
| Tradução | Categoria própria; consome chamadas/tokens/pool/global, sem interação comercial de chat. Cache e caminhos locais não chamam o guard. |
| Interrupção | Parcela não usada é liberada; tentativa possivelmente enviada conserva consumo estimado. Comprovadamente não enviada pode ser anulada. TTL de dois minutos para reserva abandonada. |
| Retenção | 120 dias, configurável entre 90 e 365. Limpeza limitada a 500 execuções antigas por fechamento ou RPC administrativa; sem sistema adicional de analytics. |

O plano é derivado no banco de `subscriptions`/`users`, incluindo o fallback já existente, e a identidade vem da autenticação server-side. Dados de plano/quota do frontend não autorizam consumo. O identificador interno da execução é gerado no servidor; `request_id` existente permanece apenas como metadado de correlação, pois seu header pode ser fornecido pelo cliente.

Ledger armazena UUID autorizado, plano/pool/consumidor/modelo, tentativas, estados e timestamps, limites reservados e contagens de tokens. Não contém prompts, mensagens, histórico, contatos, payloads de tools ou credenciais. Exclusão legítima da conta torna a referência ao usuário nula sem apagar consumo global. `dispatched` diferencia envio conhecido, não envio comprovado e incerteza.

Tokens são reconciliados com `usageMetadata`: prompt, saída, raciocínio, tool-use, cache e total. Cache é registrado, mas não somado novamente ao prompt. Total confirmado e componentes não sobrepostos são considerados; metadata ausente mantém reserva conservadora. Reserva por bytes UTF-8 e budgets existentes não representa tokens faturáveis exatos. [Referência oficial de geração/UsageMetadata](https://aistudio.google.com/api-reference/generate-content).

Em ENFORCEMENT, falta/indisponibilidade do guard impede a chamada externa; chat retorna mensagem controlada e tradução conserva o original. Operações determinísticas continuam conforme os contratos anteriores. DISABLED consulta a configuração e não grava reservas nem aplica quotas; indisponibilidade dessa consulta ainda falha de maneira conservadora. Portanto DISABLED não equivale a proteção de consumo ativa.

## Quotas e aprovação comercial pendentes

RPM, TPM e RPD efetivos do projeto Google não foram comprovados. `provider_limits` e `global` permanecem vazios; timezone diário é nulo; `provider_verified` e `commercial_approved` são falsos. Nenhum limite sintético dos testes é quota real de Production.

Interações individuais reiniciam à meia-noite UTC; mês operacional usa UTC. Janela instantânea é móvel de 60 segundos. Dia do provedor exige timezone IANA explícito: a documentação Google indica reset RPD à meia-noite do Pacífico, não UTC. Modelos e quotas dependem do projeto e não garantem disponibilidade. [Documentação oficial de rate limits](https://aistudio.google.com/docs/rate-limits).

O proprietário precisa confirmar limites reais por projeto/modelo, uso do mesmo projeto por outros consumidores, tetos operacionais de dia/mês/tokens/concorrência e propostas comerciais/pools. A página de preços anuncia Maxxis incluído e ausência de cobrança por pergunta; quotas propostas não foram tratadas como autorização para reduzir benefícios. Exportações, entitlements e unlocks opcionais de 3/5 Nuggets permanecem intactos.

## Administração e ativação sem redeploy

1. Usar acesso administrativo de banco/backend protegido; nunca expor service role no navegador. Consultar `settings, revision` de `public.gemini_usage_config`.
2. Preparar o JSON completo, inicialmente com `mode: DISABLED`. Preencher `provider_limits.calls_minute`, `calls_day`, `tokens_minute` com evidência real, `provider_day_timezone` e as sete dimensões obrigatórias de `global`: `calls_minute`, `calls_day`, `calls_month`, `tokens_minute`, `tokens_day`, `tokens_month`, `concurrency`. Configurar caps por modelo quando necessários.
3. Ajustar propostas de `plans`, `pools` e `plan_pool` somente após decisão comercial explícita. Pools somam 100%; limites internos não excedem quotas confirmadas. Percentuais também se aplicam à concorrência, com arredondamento para baixo: dimensionar para não tornar um pool inutilizável. A reserva conservadora de três chamadas e dos modelos candidatos pode reduzir antecipadamente a capacidade utilizável.
4. Executar `select public.ds_gemini_set_config(<JSON completo>::jsonb, <revision lida>);`. CAS rejeita concorrência administrativa. Validações rejeitam parâmetros inválidos; sob enforcement, reduções consideram consumo e reservas já comprometidas. Mudanças de timezone/mapeamento são bloqueadas quando existe ledger do mês corrente.
5. Somente após comprovar quotas, aprovar benefícios e verificar ambos os consumidores publicados: marcar `provider_verified`/`commercial_approved` como verdadeiros e alterar `mode` para `ENFORCEMENT` via a mesma RPC. Esta etapa NÃO foi autorizada nem executada neste trabalho.

Não há painel novo, OBSERVATION, Elastic Quota ou cobrança financeira. `future_financial_limit_minor` permanece nulo; não constitui orçamento financeiro implementado. Revisões administrativas não exigem redeploy.

## Evidências e regressões

| Verificação dirigida | Resultado |
| --- | --- |
| SQL transacional em staging, rollback das fixtures | 31 casos PASS: limites, pools, permissões reais authenticated, idempotência, consumo incerto, retenção da capacidade e configuração. |
| Conexões simultâneas | Quatro requisições SQL paralelas: uma reserva de três chamadas aceita e três negadas contra capacidade cinco; fixtures próprias removidas e DISABLED restaurado. |
| Transporte Gemini mockado | 13 testes PASS; caminhos de uma/múltiplas chamadas, categorias, quota, metadata, timeout e fail-closed. |
| Handler real de tradução sob dependências mockadas | Quatro casos PASS: cache, idioma igual, tradução e original em quota esgotada. |
| Novos módulos centrais | Deno check e lint PASS. |
| Typecheck dos endpoints afetados | 37 diagnósticos preexistentes no baseline e 37 atuais; zero novos por código/expressão/arquivo. Os dois erros SDK Stripe anteriores não foram alterados. |
| Smokes staging | Ambos OPTIONS 200 / POST sem sessão de usuário 401; health Maxxis 200; RPC DISABLED por REST sem criação de ledger. |
| Smokes Production | Ambos OPTIONS 200 / POST sem sessão de usuário 401; health Maxxis 200; RPC DISABLED por REST sem criação de ledger. Zero chamadas generativas. |
| Preservação | Hashes dos helpers RentCast, budgets, runtime entitlements, economia e arquivos SEC-06 preservados; 143 migrations anteriores de Production intactas, incluindo SEC-01 a SEC-05. 35 stashes com a mesma lista de hashes. |

Houve uma ambiguidade de alias SQL durante desenvolvimento, corrigida antes da migration em staging; todos os casos foram reexecutados. A comparação inicial do typecheck confundia ordenação textual de unions com erros novos; a comparação final preserva os diagnósticos por código, expressão e arquivo, sem supressões. Nenhuma regressão relevante identificada no escopo testado. Não foi executada auditoria geral ou bateria ampla.

Recibos locais privados em `.tmp-codex/gemini-guard-20261125/`: `baseline.json`, `sql-tests.json`, `unit-tests.json`, `concurrency.json`, `typecheck.json`, `staging-applied.json`, `staging-functions.json`, `production-migration.json`, `production-functions.json`, `final-integrity.json` e stdout do handler. Migration validada SHA-256 `7a483e067c733ba606b5c3cd6af4ae105435ce076821dfba8ba91af9a00c9caa`. Nenhum backup/credencial foi versionado.

## Recuperação e limites residuais

Migration apenas aditiva, sem transformação de registros existentes. Bundles anteriores dos dois consumidores foram preservados localmente. Snapshot de Production cifrado AES-GCM/DPAPI de 25/11/2026 01:13 UTC, recuperação PostgreSQL 17 validada às 01:22 UTC: 56 tabelas, 8.536 linhas e 280 constraints. Integridade do arquivo cifrado reconferida antes da publicação; SHA-256 `282ec18be0179287e2f28680f7aea611fcca4b9bae8d00fd62d95ec92a629bb8`.

Esse ponto local não certifica DR completo, retenção externa, binários Storage, secrets, sessões Auth ou estado de provedores. A recuperação proporcional desta mudança é manter/desativar enforcement, corrigir adiante ou restaurar somente os dois bundles anteriores quando necessário; preservar ledger e demais migrations. Não executar rollback destrutivo nem reverter SEC-01 a SEC-06.

Limitações: serialização global privilegia correção sobre grande escala; estimativas conservadoras podem negar capacidade antes do teto nominal. Tentativa incerta não garante prova de processamento pelo Google. Retry do mesmo HTTP pelo usuário é nova execução, não replay de resposta armazenada; idempotência aplica-se às reservas/tentativas internas. Não há garantia de disponibilidade externa ou controle sobre usos fora do aplicativo. Retenção depende do fechamento de operações/manutenção administrativa. Com DISABLED não há ledger de novas chamadas nem proteção efetiva de consumo.

Nenhuma chamada generativa externa foi executada nos testes, nenhuma operação financeira real foi realizada e nenhum custo adicional foi gerado deliberadamente. Billing/API keys/projeto Google permaneceram sem alterações; isso não equivale a certificação de uso externo total zero. U-01 continua OPEN, independente: controle de consumo não resolve privacidade no Gemini Free. Nenhuma nova fase foi iniciada.
