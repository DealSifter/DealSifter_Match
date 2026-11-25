# Maxxis — Gemini Provider Usage Guard

Data: 25/11/2026. Commit de implementação: `4a84ec3306688726ba1a70338a5c616b03a080bc`.

## Estado de entrega

| Estado | Resultado |
| --- | --- |
| IMPLEMENTATION STATUS | PASS no escopo validado |
| PRODUCTION DEPLOYMENT | BLOCKED — aguardando autorização específica após rejeição da revisão automática |
| COMMERCIAL ENFORCEMENT | CONFIGURATION REQUIRED; staging em DISABLED |

A autorização geral da seção 19 do roteiro foi considerada insuficiente pela revisão automática para a migration específica de Production. Nenhuma alteração deste trabalho foi executada em Production. O proprietário recebeu a solicitação exata para a migration e os dois consumidores abaixo. Publicação técnica não autoriza ativação comercial.

Staging `oqdcnjupquhybwdbeeew`: migration `20261125120000_gemini_provider_usage_guard`, `maxxis-chat` v88 e `presentation-translate` v1, ACTIVE e JWT preservado. A tradução ainda não existia nesse staging; foi publicada para validar o segundo consumidor. Os outros 26 componentes permaneceram iguais. Configuração em DISABLED, sem quotas reais inventadas.

Production `cyeipfskwwisbbayyaca`, conferência somente por leitura: novos objetos ausentes; `maxxis-chat` v106 e `presentation-translate` v8 preservados. Frontend preservado no deployment `dpl_hKHkeugDqF3MAG9FADbtyvxUP5vt`, release `ab89795b26d3a4e28f31096156476ee93cce7d58`. Nenhum build/deploy frontend necessário.

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
| Preservação | Hashes dos helpers RentCast, budgets, runtime entitlements, economia e arquivos SEC-06 preservados; 143 migrations anteriores de Production intactas, incluindo SEC-01 a SEC-05. 35 stashes com a mesma lista de hashes. |

Houve uma ambiguidade de alias SQL durante desenvolvimento, corrigida antes da migration em staging; todos os casos foram reexecutados. A comparação inicial do typecheck confundia ordenação textual de unions com erros novos; a comparação final preserva os diagnósticos por código, expressão e arquivo, sem supressões. Nenhuma regressão relevante identificada no escopo testado. Não foi executada auditoria geral ou bateria ampla.

Recibos locais privados em `.tmp-codex/gemini-guard-20261125/`: `baseline.json`, `sql-tests.json`, `unit-tests.json`, `concurrency.json`, `typecheck.json`, `staging-applied.json`, `staging-functions.json` e stdout do handler. Migration validada SHA-256 `7a483e067c733ba606b5c3cd6af4ae105435ce076821dfba8ba91af9a00c9caa`. Nenhum backup/credencial foi versionado.

## Recuperação e limites residuais

Migration apenas aditiva, sem transformação de registros existentes. Bundles anteriores dos dois consumidores foram preservados localmente. Snapshot de Production cifrado AES-GCM/DPAPI de 25/11/2026 01:13 UTC, recuperação PostgreSQL 17 validada às 01:22 UTC: 56 tabelas, 8.536 linhas e 280 constraints. Integridade do arquivo cifrado reconferida antes da publicação; SHA-256 `282ec18be0179287e2f28680f7aea611fcca4b9bae8d00fd62d95ec92a629bb8`.

Esse ponto local não certifica DR completo, retenção externa, binários Storage, secrets, sessões Auth ou estado de provedores. A recuperação proporcional desta mudança é manter/desativar enforcement, corrigir adiante ou restaurar somente os dois bundles anteriores quando necessário; preservar ledger e demais migrations. Não executar rollback destrutivo nem reverter SEC-01 a SEC-06.

Limitações: serialização global privilegia correção sobre grande escala; estimativas conservadoras podem negar capacidade antes do teto nominal. Tentativa incerta não garante prova de processamento pelo Google. Retry do mesmo HTTP pelo usuário é nova execução, não replay de resposta armazenada; idempotência aplica-se às reservas/tentativas internas. Não há garantia de disponibilidade externa ou controle sobre usos fora do aplicativo. Retenção depende do fechamento de operações/manutenção administrativa. Com DISABLED não há ledger de novas chamadas nem proteção efetiva de consumo.

Nenhuma chamada generativa externa foi executada nos testes, nenhuma operação financeira real foi realizada e nenhum custo adicional foi gerado deliberadamente. Billing/API keys/projeto Google permaneceram sem alterações; isso não equivale a certificação de uso externo total zero. U-01 continua OPEN, independente: controle de consumo não resolve privacidade no Gemini Free. Nenhuma nova fase foi iniciada.
