# P0 — CHECK durável: proposta para aprovação

Baseline: `4a27e2eea3ad3ff233f428a32908683b52ad1401`.
Worktree: `.tmp-codex/address-identity-p0`. Os 13 arquivos incrementais de `final-predeploy-correction/correction.patch` permanecem preparados, sem reaplicar ou substituir. Nesta etapa, somente arquivos nesta pasta de QA foram adicionados. SQL fora de supabase/migrations, com extensão .sql.proposed, não executado.

## Auditoria curta

| Infraestrutura versionada examinada | Resultado |
| --- | --- |
| App.jsx: upsert → notifyPropertySaved; serviço/provider da revisão | SAVE é confirmado antes do evento. Maps/Promises locais não sobrevivem à aba. |
| property_fact_reviews/history; migration 20261014213000 | Persistem resultados/decisões/revisões, não intenção pendente pré-aquisição. READ não retoma CHECK. |
| ds_store_property_fact_review | Reutilizável: snapshot + histórico + notificação atômicos, owner, revision CAS e publisherUpdatedAt. Não faz parte da transação inicial de SAVE. |
| properties.updated_at/set_updated_at | Também muda em upserts sem diferença, fotos/preço. Não identifica intenção/tentativa; varrer timestamps causaria backfill indevido. |
| properties_invalidate_changed_address; migration 20261013000001 | BEFORE invalida geocode/publicação; não enfileira. Novo AFTER deve observar seus resultados. |
| Stripe queue; migrations 20260701000004/6; stripe-reprocess-queue | Fila de eventos de pagamento, com endpoint admin. Não misturar imóveis/PII; aproveitar apenas padrão SKIP LOCKED. |
| property-fact-review/runtime.ts | Endpoint exige sessão owner. Worker não pode impersonar usuário com service JWT; reutilizar runtime interno e dependências backend. |
| public-parcel e módulos resolver/registry/cache/upstreamBudget | Reutilizar políticas, flags, licenças e limites; não afrouxar auth do endpoint público. |
| .github/workflows/observability-smoke.yml | Cron de health check a cada 30 min, não consumidor de tarefas imobiliárias. Não inserir service secrets nele. |
| pg_cron/pg_net/scheduler imobiliário | Nenhuma configuração versionada encontrada. Catálogo/agenda live NÃO consultados nem presumidos. |

EXISTING DURABLE INFRA: NO para CHECK imobiliário comprovado; há componentes reutilizáveis, não uma continuidade pronta.
ROOT CAUSE: transação SAVE e despacho CHECK são separados. Encerrar a aba nesse intervalo ou durante a fila perde a intenção, sem job persistido recuperável.

## Menor desenho proposto

SAVE + AFTER trigger/enqueue na mesma transação → PENDING → backend claim/lease → aquisição autorizada → runtime existente → conclusão atômica (snapshot/histórico/notificação/job).

Uma tabela, um registro por propriedade, coalescendo versões; sem payload do imóvel, contatos, cookies, JWT ou tokens de usuário. Campos: property_id/owner_id, generation, identity_hash/input_hash, status, attempts, next_attempt_at, lease token/expiry, timestamps e result_code sanitizado. Fingerprints DB são separados dos hashes dos motores.

Trigger apenas em INSERT futuro ou alteração dos inputs relevantes/publicação explícita. Upsert sem alteração, preço, descrição, fotos e UI não criam job. Sem INSERT SELECT/backfill de legados. Enqueue falhou → SAVE inteiro falha, nunca confirmação falsa. Transferência de owner invalida versão/token anteriores.

Claim de um item, SKIP LOCKED, lease aleatório de 2 min, transação termina antes da rede. Máximo 3 tentativas totais; retry após 1 min e 5 min. Crash expira lease; terceiro crash termina FAILED/LEASE_EXHAUSTED. Nunca retry infinito.

Finish bloqueia properties antes de jobs (mesma ordem do trigger), revalida owner, generation, token, lease e input_hash atual. Trabalho antigo retorna false sem efeitos. Chama o RPC de revisão atual dentro da mesma transação que conclui o job. Revision CAS/updated_at protegem alterações e decisões simultâneas; conflito precisa reprocessar a versão atual, não sobrescrever.

SUCCEEDED é execução concluída, NÃO imóvel VERIFIED. Exige recibo GIS executado e cache de provider conferido, sem falha temporária. Indisponibilidade → RETRY/FAILED; flags/licenças/identidade/entitlement/guard bloqueados → BLOCKED com motivo. Cache miss/ausência não vira conflito. Snapshot parcial válido pode ser preservado com RETRY, sem declarar verificação concluída. Erro antes de snapshot atualiza só job.

At-least-once com efeitos idempotentes, não exatamente uma chamada de rede: crash após adquirir GIS e antes do commit pode repetir aquisição dentro de guards/limites. Dedup de notificações continua no RPC/histórico existentes. KEEP/ACCEPT/LATER, provenance, relay autorizado A/B, alertas, modal e Maxxis permanecem.

## Worker, scheduler e CTA — ainda não implementados

Proposta: Edge Function backend dedicada, reutilizando runPropertyFactReview e os módulos existentes de aquisição/cache/entitlement/flags/budget. Owner relido da tarefa + properties. Não guardar/forjar JWT de usuário. A autenticação do endpoint property-fact-review e public-parcel não muda.

Scheduler a cada minuto, consulta existência de trabalho devido antes de invocar Edge, um item por claim e timeout inferior ao lease. Preferir pg_cron + pg_net/Vault SOMENTE após confirmar disponibilidade/autorizar. Se ausentes, aprovar scheduler externo autenticado equivalente; não reutilizar health workflow como worker. Nenhum scheduler/extensão/secret foi criado.

Worker/RPCs somente service/scheduler; secrets apenas backend, nunca URL/browser/logs. Falta de scheduler preserva PENDING, mas impede progresso: monitorar idade/backlog/FAILED.

Corte coordenado obrigatório antes de ativar: listener automático pós-save da aba deixa de adquirir dados em modo durável e apenas observa/hidrata revisão. CTA manual permanece, mas handler owner autenticado deve usar o mesmo lease filtrado por propriedade para evitar aquisição concorrente. PROCESSING/backoff retorna estado salvo/pendente sem nova aquisição.

Para CTA após retenção/estado terminal, falta preparar o pequeno RPC backend de reenqueue explícito sob lock de properties, owner revalidado, nova generation. NÃO usar upsert frontend nem reiniciar job ativo. SQL proposto cobre SAVE, claim, finish e retenção, não esse adaptador final. A implementação do worker/adaptadores e esse RPC dependem da aprovação. Não habilitar worker junto do listener antigo sem esse corte.

## Segurança, custo e retenção

Tabela operacional sem grants/policies anon/authenticated: nem A nem B leem tokens de lease ou alteram tarefas. Service_role somente; handlers devem revalidar owner. Revisões/notificações privadas continuam com RLS atual. Nenhuma alteração de RLS existente.

RentCast sempre cache-only/acquire:false, sem compra implícita; GIS apenas fontes públicas autorizadas com flags/licenças/Usage Guard/rate limits existentes. Guard indisponível bloqueia honestamente. Nada no renderer/abertura do modal/renderização dispara aquisição.

Até 1.440 ticks de scheduler/dia no intervalo de 1 min, invocação Edge só com trabalho devido; até 3 tentativas por versão material. Valor monetário depende do plano/carga, não foi inventado nem consultado. Coalescência por propriedade reduz fila; muitas novas versões ainda podem gerar carga: medir e manter limites/backend budget. Nenhuma chamada live nesta tarefa.

Retenção: um job por imóvel, terminais por 14 dias; limpeza diária até 100 por chamada. Não apagar pendentes/retry/processing por retenção; monitorar backlog. FK cascade só acompanha exclusão de propriedade/owner. Não apagar histórico factual original.

## Riscos, aprovação e rollback

Trigger acrescenta trabalho à transação SAVE; testar latência, permissões e deadlocks em banco descartável autorizado. Validar hashes/inputs e interação com geocode BEFORE. SQL NÃO foi executado nem homologado em PostgreSQL. Instalação/agenda real em produção continua desconhecida.

Depois de aprovação: leitura do catálogo live; teste autorizado de migration/roles; implementar worker/adaptadores com providers fake; validar controles abaixo; publicação coordenada com scheduler inicialmente OFF; aprovação separada para ativar. Não tratar esta proposta como deploy-ready.

Rollback proposto: desligar scheduler/worker; remover apenas novo trigger properties_enqueue_fact_check em transação autorizada; restaurar listener/manual anteriores coordenadamente. Preservar jobs para diagnóstico/retomada, sem truncar. Revisões, histórico, notificações e dados do imóvel intocados. Limpeza de funções/tabela só depois, separadamente autorizada.

## Testes necessários depois da aprovação (PENDING)

1. PostgreSQL: SAVE e job no mesmo commit, cliente fechado; rollback do SAVE não deixa job. Erro no trigger impede confirmar SAVE.
2. Worker sem navegador retoma tarefa; crash antes/depois de rede e commit expira lease e usa novo token.
3. 3 tentativas/backoffs 1 e 5 min; falha/crash final → FAILED, sem loop.
4. Duas gravações rápidas e retorno ao endereço anterior: generation nova vence; finish antigo não escreve.
5. Workers/CTA concorrentes: lease/SKIP LOCKED e finish repetido não duplicam snapshot/histórico/notificação.
6. Evidência material fake → notificação privada no mesmo commit do resultado; evidência idêntica não renotifica.
7. Ausência/sem conflito → nenhum amarelo; preservar testes anteriores de KEEP/ACCEPT/LATER e A/B.
8. Provider/guard indisponível e flag off → RETRY/BLOCKED/FAILED; nunca falso SUCCEEDED/VERIFIED ou chamada RentCast paga.
9. Roles anon/A/B não acessam tarefas/RPCs; troca de owner, exclusão de conta/imóvel e auth worker não vazam dados.
10. Providers mockados e rede bloqueada, zero chamadas live. Retenção mantém pendentes; CTA reenqueue após limpeza é explícito e sob lock.
11. Worker não impersona sessão; scheduler autenticado; listener antigo não cria fan-out. Medir SAVE/concorrência.
Os testes estáticos desta proposta NÃO comprovam esses comportamentos reais.

Validação executada: 6 testes estáticos da proposta aprovados com `node qa/address-identity-p0/durable-check-proposal/proposal-contract.test.mjs`. O runner com isolamento tentou criar subprocesso e foi bloqueado pelo sandbox (EPERM); execução direta do mesmo arquivo funcionou sem escalada. Uma expressão de teste inicialmente atravessava vários comandos SQL; foi limitada ao comando de INSERT e o teste corrigido passou. Nenhum PostgreSQL foi executado. As 46 verificações e os 20 casos incrementais anteriores não foram repetidos. `git apply --reverse --check` confirmou que o patch incremental anterior continua correspondendo à worktree; HEAD permanece na baseline e não há alteração unstaged de código nela.

## Resultado

MIGRATION REQUIRED: YES (mais trigger, worker/scheduler e permissões backend).
BROWSER CLOSE SURVIVAL: NOT IMPLEMENTED.
PERSISTENCE AT SAVE: NOT GUARANTEED hoje; ATOMIC somente no desenho.
RETRY AND IDEMPOTENCY: PENDING.
PROVIDER BUDGET PRESERVED: PASS nesta entrega, sem aquisição ou alteração dos contratos atuais.
SECURITY: PENDING homologação das novas permissões propostas.
TYPECHECK/BUILD: não aplicável a esta entrega documental/SQL proposto; runtime incremental preservado.
DEPLOY READY: NO. Aguardar aprovação; sem migration aplicada, deploy ou chamada paga.
