# DealSifter / Maxxis Deal AI — auditoria de implementação e roteiro

Data: 2026-09-10. Base local: `fix/production-real-defects`, HEAD `db53314`.

## Parecer

A direção é coerente: separar registros externos, preservar proveniência, consultar cache antes de gastar quota e autorizar dados no backend são decisões corretas. Eu manteria essa arquitetura incremental. Mudaria a sequência e os critérios de conclusão: menos etapas administrativas que repetem os mesmos gates, mais jornadas completas que comprovem valor para o usuário.

O principal descompasso com o objetivo final não é falta de animações nem de módulos. Property Intelligence foi deliberadamente construída sem conexão com Maxxis. Hoje existem duas cadeias distintas: o chat e suas ferramentas de dados internos; o painel de evidências RentCast. O nome do painel não significa que o chat já consome essas evidências.

Eu priorizaria uma primeira jornada completa: abrir imóvel autorizado, ler evidência real, perguntar ao Maxxis sobre um campo, receber resposta com origem/data e voltar ao card correto. Depois integraria comparações, insights e monetização. Preservaria em paralelo os escopos originais de suporte ao app e educação sobre Tax Deed/Wholesale.

## Limites e evidências desta auditoria

- Inspeção de código, migrations locais, testes, documentos e histórico Git. Os prompts de fases são requisitos, não comprovantes de execução.
- Reexecução local: **60 arquivos / 613 testes PASS** em Maxxis e Property Intelligence. São testes automatizados; não são 613 conversas reais nem validação do provedor remoto.
- Gate isolado imediatamente anterior: **13 arquivos / 71 testes PASS**, build de **898 módulos PASS**, `tsc -p tsconfig.contracts.json --noEmit` PASS. Sem alteração de código de produto desde esses gates.
- Limitação descoberta: `tsconfig.contracts.json` inclui somente `src/types/**/*.ts`. Esse PASS não verifica os tipos de `supabase/functions/_shared/property-data`. Vitest transpila TypeScript, mas não substitui checagem de tipos.
- Não executei RentCast, Gemini, compra, concessão de entitlement, migration, commit, push ou deploy nesta auditoria. Não certifico o funcionamento atual desses serviços remotos.
- As validações históricas de staging e produção são distinguidas de verificações atuais. Não há base suficiente para declarar todo o app sem bugs ou calcular uma probabilidade numérica de falha.

## Fechamento da 1D-B.0

| Controle | Resultado |
|---|---|
| Mudanças Property Intelligence isoladas | Sim; quatro arquivos rastreados modificados mais arquivos novos da feature |
| Trabalho Maxxis/Matches | Preservado em `stash@{0}`, nome `wip-maxxis-matches-pre-property-intelligence-deploy` |
| Arquivos ambíguos | Nenhum diff misto identificado nos arquivos compartilhados |
| TypeScript isolado | PASS, com a limitação de cobertura descrita acima |
| Testes direcionados isolados | PASS — 71 testes |
| Build isolado | PASS |
| Nova fixture | `07343e87-1ef8-4ca5-a88e-be49d95431a7` |
| Caminho de criação | Formulário normal de Onboarding, botão Add to Portfolio, sessão autenticada da conta autorizada |
| Origem dos dados | Endereço indicado pelo usuário; tipo, ZIP e preço recuperados do cadastro correspondente no app |
| Visibilidade | `publish_to_showcase=false`; perfil `fsbo` |
| Identificação | Descrição inicia com `PI_1D_B0_PRIVATE_TEST_COPY`; explicita cópia de teste, sem alegar propriedade do imóvel |
| Cache novo | **NONE FOUND**, consulta direta: 0 linhas |
| Entitlements novos | 0 linhas para a fixture |
| Usage RentCast da fixture | 0 linhas; nenhum acesso RentCast executado |
| Commit / push / deploy | Nenhum |

A sessão temporária foi encerrada e o servidor local parado. Runners temporários foram removidos. A fixture persistente permanece, conforme autorizado. A conta nominalmente descrita como administradora tem `is_admin=false` no banco; a identidade corresponde à conta explicitamente autorizada, e nenhum privilégio foi elevado.

A fixture é **Land**, não SFR. Sua existência e seu endereço no app não garantem cobertura RentCast. A futura 1D-B.2 deverá tratar ausência de registro como resultado real, sem alterar o tipo ou inventar evidência para obter um PASS.

O inventário anterior contou 47 arquivos Property Intelligence e 13 marcações Maxxis/Matches. Quatro arquivos backend Maxxis apareciam modificados, mas tinham diff normalizado vazio; o stash registra oito alterações de conteúdo rastreado e uma migration nova. Não se deve apresentar 13 diffs de conteúdo como se todos existissem. Este relatório acrescenta um documento de auditoria ao conjunto Property Intelligence.

**1D-B.0: PASS no escopo de isolamento e fixture.** Está preparado para o checklist da 1D-B.1, não liberado incondicionalmente para produção. Os achados abaixo devem integrar a revisão de release. A publicação continua dependente de autorização da fase correspondente.

## Arquitetura observada

```text
React / Vite / JavaScript + contratos TypeScript
  App → Feed / MapView / Matches / Onboarding
  ├─ MaxxisAssistant → maxxisService → Supabase maxxis-chat
  │    ├─ contexto estruturado + conhecimento versionado
  │    ├─ Gemini + registro de ferramentas autorizado
  │    └─ propriedades, perfis, serviços, métricas, workflow do app
  │
  └─ MatchesPortfolio / PortfolioDetail → PropertyIntelligenceSection
       → propertyIntelligenceService → Supabase property-intelligence
         → autenticação → RPC de entitlement
           ├─ negado: LOCKED, sem carregar evidência
           └─ autorizado: PropertyEvidenceService
              → propriedade interna → cache PostgreSQL
                 ├─ hit: registro normalizado
                 └─ miss: Usage Guard → RentCast /properties
                          → validação/endereço → normalização → cache
              → campos permitidos + conflitos + fonte/data

Persistência: Supabase PostgreSQL, Auth, RLS, RPCs, Storage.
Frontend publicado: Vercel. Provedores externos: backend Supabase.
```

Não encontrei referência a RentCast/PropertyEvidence/property_intelligence no registro de ferramentas e módulos Maxxis examinados. A conexão entre as duas cadeias ainda precisa ser implementada e autorizada.

## Inventário histórico das fases

Legenda: **código** = implementação encontrada; **histórico** = execução relatada/documentada, não recertificada remotamente; **pendente** = não concluída no alvo pretendido. As várias tentativas de fechamento não são funcionalidades adicionais.

### Fundação e hardening

| Fase/trabalho | O que entregou ou buscou entregar | Estado que é possível sustentar |
|---|---|---|
| Maxxis inicial / Evolution Plan | Guia do app, educação, chat Gemini | Código evoluído; documento contém diagnóstico antigo, não representa sozinho o runtime atual |
| MVP: busca, Investor Profile e matching | Perfil estruturado, busca de imóveis/serviços, scores | Código: `getMyInvestmentProfile`, `searchMatchedProperties`, `calculatePropertyMatch`, `behaviorAffinity` |
| MVP: Deal Advisor/Copilot/actions | Métricas, comparações, workflow, mensagens e confirmação | Código e testes encontrados; não confundir com dados RentCast |
| Release preparation / promotion / hotfixes | Gates, segurança de release e correções | Histórico; cada deploy deve ser associado ao artefato e backend efetivos |
| 5A — E2E / release readiness | Jornadas staging, auth, perfis, fluxos reais | Histórico, evidência em `b96a214` e `E2E_TESTING.md` |
| 5B — Observability | Sentry, métricas, alertas | Código/documentação; recebimento de alertas relatado, não retestado agora |
| 5C — Abuse / rate limit / cost | Proteções de abuso e limites | Histórico e controles existentes; não substituem limite específico RentCast |
| 5D — Integrity / recovery | Recuperação, integridade e disaster readiness | Histórico, `4300dc4`, `DISASTER_RECOVERY.md` |
| 5E — Performance / database | Gates e baselines de eficiência | Histórico, `3caac7d`; baseline registra latências que merecem acompanhamento |
| 5F — Architecture / modularization | Extrações de responsabilidades | `ARCHITECTURE_BASELINE.md`; componentes centrais ainda concentram muita lógica |
| 5G — Future feature readiness | Flags, contratos de entrega e prontidão | Documentação e infraestrutura; não certifica automaticamente features futuras |
| Production promotion / unblock / final execution | Publicação e desbloqueios operacionais | Histórico; não repetido nesta fase |

### Programa Fase 6 — 35 itens

| Fase / itens | Implementações identificadas | Situação |
|---|---|---|
| 6.0 — Baseline | Contrato não regressivo, snapshots desktop/mobile, gates | Documentação e testes; baseline histórica não equivale ao HEAD atual |
| 6A — 1–5 | Context snapshot, surface awareness, contexto do imóvel e usuário | `features/maxxis/context`; commits `a0e33eb`, `2a1d37a` |
| 6B — 6–10 | Deal intelligence interativa, gaps e explicações estruturadas | `features/maxxis/intelligence`, `4fd8c1d` |
| 6C — 11–15 | Smart Actions e confirmação controlada | `features/maxxis/actions`, `7011416` |
| 6D — 16 | Proactive Signal Engine | Código em `proactive` |
| 6D — 17 | Relevance / Attention Engine | Regras determinísticas |
| 6D — 18 | Proactive Message Composer | Mensagens estruturadas/localizadas |
| 6D — 19 | Throttling / dismissal / anti-intrusion | Supressão, dedupe e limites |
| 6D — 20 | Passive Maxxis Bubble | UI e eventos; commit base `cb872f5` |
| 6E — 21 | Avatar State Engine | `015b7b9`, state machine |
| 6E — 22 | Rendering / microanimations | `6a26dd9`, assets oficiais |
| 6E — 23 | Bubble/avatar synchronization | `cf62ed9` |
| 6E — 24 | Attention / visual safety | `d528c87` |
| 6E — 25 | Interaction settings | `b57f469`, preferences |
| 6F — 26–30 | Deal memory / recall / continuidade | `011e214`, memória estruturada local; não é memória universal entre dispositivos |
| 6G — 31 | Experience orchestrator | `edb260a` |
| 6G — 32 | Contextual composer | `275fe8f` |
| 6G — 33 | Next best interaction | `5936a27` |
| 6G — 34 | Cross-surface handoff | `a52d1be` |
| 6G — 35 | Integrated acceptance | `c614e07`, `b268e0c`; existem testes integrados |

Agrupei 1–15 e 26–30 pelos módulos verificáveis: não reconstruí nomes individuais ausentes como se fossem uma lista oficial. O histórico de 35 implementações não permite dizer que 35 jornadas reais estejam hoje aprovadas em produção.

### Recuperação e reparos posteriores

| Fase/trabalho do histórico | Resultado/evidência e limite |
|---|---|
| Pós-Fase 6 / card cleanup | Auditorias e correções de referências/identidade; novas regressões foram relatadas depois |
| Avatar, branding e preferences | Nome Maxxis Deal AI, geometria e interações; não resolve disponibilidade do LLM |
| Restore core / provider / conhecimento | `809750e`, `6fe5f1b`, `53b1243`: runtime Gemini, interpretação de tools e conhecimento versionado |
| Tooltips/login, mapa, minicards, links | Reparos em commits `144abb9`, `6cb35f6`, `755caae`, `c2b0e41`, `ed7f2b2`, `bc1208b` |
| Sugestões e exclusão de próprios cards | `371c8e2`, `4edbc31`; comportamento real requer identidade e dados da sessão corretos |
| R0 — source of truth | `a9c4d2f`: estabelecer origem de release |
| R0-B — blockers / staging | `c190be6`: prontidão de reparo |
| R1 — conversation contract | `3b97840` registra validação staging; base de recuperação do core |
| R2 — real runtime gate | `63bd321`: exigir teste real de runtime |
| R2.5 — human preview | `dfc7cc2`: preview navegável |
| R2.5A — acesso/CORS | Correções solicitadas de acesso e origem; não certificadas novamente |
| R2.5B — zero-friction access | Preparação do acesso humano e dataset; histórico |
| R2.6 — latency / context | `ada0e43`: candidato staging e reparos de contexto |
| R2.6C — provider / fixture | Estabilização solicitada; resultado atual do provider não medido nesta auditoria |
| R2.7 — human acceptance / signals | `f1d64a1`: runbook de aceitação humana |
| R2.7A / R2.7A-H | Entitlements e dataset staging; distinguir dados de teste de produção |
| R2.7B-FAST / R2.7B-E2E | Unlock/portfolio e aceitação; `0bb6b61` documenta staging |
| Private production canary | `4e75f96`, `89b61e8`, `f30af78`; histórico de promoção controlada |
| Real-world defect repair | `93d4b92`, `a759cbc`; correções de identidade/UI/core |
| Últimos reparos Maxxis/Matches | Stash preservado; não fazem parte deste artefato isolado |
| Vercel preview env repair | `32a89dd`, `db53314`; base local atual |

### Property Intelligence / RentCast

| Fase | Implementação / intenção | Estado |
|---|---|---|
| 1A — Provider abstraction | Evidence, statuses, tipos, provider, fixtures | Código em `property-data`; mocks são instrumentos de teste |
| 1B — RentCast + usage guard | Client `/properties`, mapper, erros, limite 45 | Código e testes; não conecta Maxxis |
| 1C — cache + evidence | PostgreSQL cache, TTL, separação interno/externo, conflitos | Código e testes; ainda não commitado neste branch |
| 1C.1 — migration readiness | Preparação/aplicação controlada e tentativa live | Histórico de tentativas; 403 relatado não é sucesso de consulta |
| 1C.1B — resume live | Retomar consulta após configuração | Requisito/histórico; não inferir HTTP 200 a partir do pedido |
| 1C FINAL — production controlled | Validação em alvo production | Histórico; existência de cache observada anteriormente, não revalida toda cadeia |
| 1C.1 — real property smoke | Lookup com imóvel real | Subfase com numeração reutilizada; normalizar o registro de execuções |
| 1D-A — Property Detail | Painel, locked/unlocked, RPC de entitlement | Implementado localmente, testes anteriores UI mocked 2/2; live UI pendente |
| 1D-B — entitled production UI | Miss real pela UI e segundo acesso hit | Não encerrada; bloqueada antes pelo bundle publicado |
| 1D-B.0 — isolamento/fixture | Separar WIP e criar segundo registro | Concluída nesta sequência; fixture privada e cache vazio verificados |
| 1D-B.1 — deploy UI controlado | Publicar após checklist de inércia | Pendente; resolver critérios conflitantes e revisar achados |
| 1D-B.2 — live validation | Entitlement de teste + uma chamada + cache hit | Pendente e não autorizada nesta execução |
| 1D-C — Nuggets/pricing | Compra pública do entitlement | Não implementada nesta feature; backend/CTA não fazem débito |
| Integração RentCast → Maxxis | Tool de evidências, respostas com origem/data | Ainda ausente |
| RentCast → comparações/insights/mapa | Reuso autorizado da mesma evidência | Ainda ausente; não criar buscas pagas automáticas por navegação |
| AVM / rent estimate / comps | Dados estimados e comparáveis | Não implementados neste provider; explicitamente fora das fases anteriores |
| ARV / MAO / ROI / cash flow enriquecidos | Cálculo com entradas comprovadas e hipóteses explícitas | Pendente; métricas internas existentes não significam enriquecimento RentCast |

## O que funciona e o que ainda não está demonstrado

| Comportamento | Evidência | Exemplo / consequência |
|---|---|---|
| Negar acesso sem entitlement | `resolvePropertyIntelligenceAccess` e testes | Sem grant retorna LOCKED; `loadEvidence` não é chamado |
| Falha de autorização não libera dados | HTTP captura falha e devolve unavailable | Não há fallback de entitlement true no caminho inspecionado |
| CTA não cobra | `LockedSection` abre modal explicativo | Clicar em desbloquear ainda não compra relatório |
| Cache hit evita provider | EvidenceService/cache e testes | Segunda consulta com entrada válida usa evidência já normalizada |
| Campo externo ausente | Mapper/schema/view model | Imposto ausente fica indisponível; não deve virar imposto zero |
| Conflitos sem overwrite | `conflicts.ts`, renderização | Metragens diferentes são exibidas como divergência; anúncio não é corrigido automaticamente |
| Sanitização de proprietário | `ownerPresence` | Nomes de owners não são entregues pelo presenter; aparece presença de registro |
| Busca interna e matching | Tool registry e testes Maxxis | Listar oportunidades usa o banco e score do backend; não dados inventados pelo chat |
| Contexto e memória | Módulos específicos/testes | Retomar checkpoint estruturado depende do contexto autorizado; memória local não garante sincronização entre dispositivos |
| Proatividade | Motores/event bridge presentes | Ausência de bubble pode ser supressão válida, falta de evento ou problema de contexto; exige rastrear motivo |
| Chat explicando imposto RentCast | Não há tool/conexão correspondente | O painel pode ter imposto e o chat ainda não receber esse dado |
| Pesquisa web com referências | Não identificada no registro de ferramentas examinado | Educação do LLM não equivale a pesquisa atual de regras de um condado |
| Publicação atual da UI e integridade remota | Não revalidada nesta execução | Build local e branch não comprovam qual frontend/backend o usuário acessa |

## Achados e prioridades

### P0 — antes de ativação live ampliada

1. **O modo disabled não controla o endpoint atual.** `propertyIntelligenceHttp.ts` força `PROPERTY_DATA_MODE` para `live` ao construir o serviço. Isso evita mock nesse caminho, mas ignora uma configuração disabled como kill switch. Separar bloqueio operacional de seleção de provider; produção deve aceitar live ou disabled, nunca mock. Não alterado nesta auditoria.
2. **Cache não inclui identidade do endereço.** A chave é property ID/provider/data type. Se o mesmo registro mudar de endereço, um hit pode entregar evidência do endereço anterior por até o TTL. Incluir fingerprint normalizado e verificar a correspondência antes de devolver cache. Exemplo: usuário corrige imóvel A para B, mas o UUID permanece.
3. **Duplicação de chamadas simultâneas.** Não há coalescência/lock por propriedade entre cache miss e provider. Duas aberturas concorrentes podem reservar duas chamadas. O limite mensal protege o orçamento máximo, não garante uma chamada por miss compartilhado. Precisa teste de concorrência no backend antes de prometer exatamente uma chamada em uso real.
4. **Critério de visibilidade contraditório.** 1D-B.1 pede invisível para todos e também seção LOCKED visível. O código satisfaz a segunda apresentação, não a primeira. Definir exposição de UI separada do entitlement. Não marcar ambos PASS.
5. **Fixture privada exige verificação de todas as superfícies.** Ser do administrador não torna o dado privado por si só. `publish_to_showcase=false` foi verificado, mas exclusão de feed, mapa, busca Maxxis e portfólio público deve ter gate próprio. O cadastro original de terceiros nunca deve ser transferido à conta de teste.

### P1 — antes de expansão de produto

6. **Gate de tipos parcial.** Adicionar checagem própria de Edge Functions/imports Deno ou projeto TS apropriado; não usar somente o tsconfig de contratos do frontend como certificado geral.
7. **Entitlement PI é por conta e imóvel.** Schema: `(user_id, property_id, unlock_type)`, sem profile scope. Isso pode ser intencional para compra do relatório, mas difere da exigência de independência Personal/Business/FSBO nos contatos. Formalizar antes de monetizar; não compartilhar unlock de contato com PI implicitamente.
8. **Autorização após retirada do anúncio.** O repositório de evidência lê por UUID usando service-role e não consulta status/publicação. Há grant explícito, portanto não é leitura pública irrestrita; falta definir se o grant continua válido quando o anúncio fica privado/inativo ou muda de controle.
9. **Minimização de dados nos conflitos.** O presenter remove nomes, mas envia valores de conflitos, que podem conter endereço. Revisar autorização campo a campo antes de ligar essa saída ao Gemini. Remover ownerNames sozinho não comprova ausência de PII.
10. **Erro amigável sem diagnóstico suficiente no suporte.** Manter classification/request ID nos logs internos para auth, CORS, provider, quota, schema e cache. A UI pode continuar amigável. Um único unavailable não permite saber o que corrigir.
11. **Ordem da contabilidade diferente do fluxo desenhado.** `RentCastPropertyDataProvider` finaliza consumo depois do HTTP 200 e antes de normalizar/gravar cache. Isso conta sucesso HTTP mesmo se o endereço divergir ou cache falhar, conforme intenção conservadora. Separar sucesso do provider de sucesso de entrega ao usuário, especialmente antes de cobrar Nuggets.
12. **Recuperação de reservas/timeout.** Reservas abandonadas contam conservadoramente; reconciliação é pendente. Falha de rede/timeout também precisa política sobre resultado remoto incerto, em vez de equiparar automaticamente ausência de resposta a custo zero.
13. **Proveniência de tempo.** Updated usa retrievedAt; não é necessariamente a data do registro fiscal. Exibir data de consulta separada do ano fiscal/data efetiva quando disponível.
14. **Reatividade à identidade e grant.** A seção recarrega por propertyId/loadIntelligence, sem dependência explícita da sessão ou versão de entitlement. Verificar troca de conta com componente preservado e atualização pós-compra; remount de tela não deve ser a única garantia contra dado antigo.
15. **Documentos desatualizados.** O plano inicial descreve chat estático enquanto o runtime possui tools e conhecimento versionado. `PROPERTY_INTELLIGENCE_PHASE_1C.md` também não acompanha todas as promoções relatadas. Registrar design histórico separado de status operacional.

### P2 — melhoria progressiva

- Cache por identidade canônica entre anúncios distintos do mesmo imóvel, sem compartilhar permissões entre usuários.
- Validação de endereço suporta conjunto limitado de sufixos; unidades e diferenças de formatação podem produzir recusa legítima. Não afrouxar a ponto de associar imóvel errado.
- Client seleciona o primeiro registro retornado e não envia `limit=1`, pedido no requisito 1B. Validar ambiguidade/unidade e aderência ao contrato antes de expandir endpoints.
- Frontend e backend devem ter manifesto conjunto: commit do frontend, versão/hash das funções, migrations, configuração e smoke associado.
- A classificação VERIFIED_RECORD significa registro vindo do provider, não garantia absoluta de atualidade ou correção jurídica.

## Roteiro que eu seguiria

| Ordem | Entrega | Critério de conclusão | Arquivos/áreas principais |
|---|---|---|---|
| 1 | Fechar decisões de inércia e identidade | Visível locked versus oculto definido; PI por conta/perfil definido; fixture não aparece a terceiros | UI section, entitlement policy, testes de publicação |
| 2 | Corrigir núcleo antes do live gate | disabled efetivo; cache ligado ao endereço; duas requisições concorrentes geram uma consulta; tipos backend verificados | `propertyIntelligenceHttp.ts`, `cache.ts`, EvidenceService, migrations aditivas, testes |
| 3 | 1D-B.1 com artefato reproduzível | Diff revisado, migrations conhecidas, frontend/backend registrados, usuário comum continua bloqueado sem consumo | Vercel/release manifest e E2E real |
| 4 | 1D-B.2 controlada | Uma fixture, grant limitado, miss real autorizado, reload hit sem reserva; ausências/divergências honestas | UI real, cache e usage ledger |
| 5 | Primeira integração Maxxis somente leitura | Perguntar sobre dado da tela entrega mesma evidência, fonte/data, link para o imóvel e sem nova chamada se cache válido | `toolRegistry.ts`, sanitização de tool results, serviço de evidência compartilhado, capabilities |
| 6 | Regressão de valor do Maxxis | App help, educação, busca interna, pergunta factual e erro do provider continuam úteis e distinguíveis | Prompts/conversation contracts, runtime knowledge e E2E multilíngue |
| 7 | Insights baseados em evidência | Evento real de mudança/falta/divergência gera insight relevante; próprio card suprimido quando descoberta; motivos de supressão rastreáveis | proactive, context, attention, continuity |
| 8 | Comparação e mapa como consumidores | Reuso do snapshot autorizado; mesma identidade; navegação não dispara varredura paga | compareProperties, adapters de contexto, navegação existente |
| 9 | 1D-C — monetização | Compra idempotente, saldo/grant transacionais, regra de falha/reembolso explícita, sem duplicidade | RPC de compra, ledger Nuggets existente, UI; evitar nova carteira paralela |
| 10 | Dados avançados em fases separadas | AVM/rent/comps com proveniência e status ESTIMATED; custo e cobertura medidos | Novos tipos/data_type/providers sem reescrever Property Record |
| 11 | Análises financeiras explicáveis | Fórmula determinística, entradas presentes, hipóteses explícitas; sem valor factual inferido pelo LLM | dealMetrics/advisor + schemas e testes |
| 12 | Rollout gradual | Canary→grupo reduzido→público; latência/erro/custo/cache/unlocks medidos e rollback pronto | Flags, observabilidade e manifesto de release |

Minha mudança de ordem principal seria entregar o primeiro benefício RentCast dentro do Maxxis antes da cobrança pública e de novas animações. O vínculo de leitura deve reutilizar o mesmo serviço backend, sem construir outra integração RentCast no chat. Os controles de entitlement continuam válidos mesmo no canary gratuito.

## Exemplos de aceitação do objetivo final

1. **Suporte:** “Como favorito e desbloqueio um contato?” → explica fluxo real e abre o módulo; não faz lookup RentCast.
2. **Educação:** “Qual a diferença entre Tax Deed e Wholesale?” → mantém conversa educacional. Se pedir regra atual/local, consulta futura fonte verificável e a cita; sem pesquisa implementada, informa a limitação.
3. **Descoberta:** “Quais imóveis do app combinam com meu perfil?” → usa perfil + inventário autorizado, links canônicos; não faz chamada RentCast para cada resultado.
4. **Evidência:** “Qual o imposto deste imóvel?” → com entitlement/cache: valor, ano fiscal e fonte; sem informação: indisponível; sem acesso: fluxo de autorização.
5. **Divergência:** metragem cadastrada diferente do registro → mostra as duas origens; não escolhe vencedor nem sobrescreve anúncio.
6. **Navegação:** abrir o link do resultado retorna ao card certo e mantém favorito/unlock no fluxo normal.
7. **Proatividade:** mudança real de evidência gera aviso útil uma vez, respeita preferências; nenhuma bubble promocional fictícia para preencher silêncio.
8. **Falha externa:** indisponibilidade RentCast limita apenas evidência externa; ajuda do app e busca interna continuam operacionais.
9. **Cobrança futura:** duplo clique/reload não debitam duas vezes; falha de entrega tem estado transacional definido.

Essas jornadas devem ser verificadas no mesmo candidato de release, em desktop/mobile e com perfis distintos. O critério de avanço é comportamento observado e custo controlado, não quantidade de módulos ou de prompts executados.

## Referências locais

- `docs/MAXXIS_EVOLUTION_PLAN.md`, `docs/MAXXIS_AI_DOCUMENTACAO.md` — intenção e histórico; não runtime atual por si só.
- `docs/PHASE_6_BASELINE_REPORT.md`, `docs/ARCHITECTURE_BASELINE.md` — evidências históricas e limitações.
- `docs/PROPERTY_INTELLIGENCE_PHASE_1C.md` — contrato inicial de cache/evidence.
- `supabase/functions/_shared/property-data/` — provider, cache, access, HTTP, usage, normalização e testes.
- `supabase/migrations/20260909183000_external_provider_usage_guard.sql`.
- `supabase/migrations/20260909190000_property_intelligence_cache.sql`.
- `supabase/migrations/20260910120000_property_intelligence_entitlements.sql`.
- `src/components/property-intelligence/`, `src/services/propertyIntelligenceService.js`.
- `supabase/functions/_shared/maxxis/toolRegistry.ts`, `maxxisKnowledge.ts`, `geminiModels.ts`.
- `src/features/maxxis/` — contexto, ações, memória, proatividade, avatar e orquestração.
- `tsconfig.contracts.json` — escopo efetivo do gate TypeScript.

Nenhuma correção de produto recomendada neste documento foi aplicada durante a auditoria. A única gravação remota foi a fixture explicitamente autorizada, além da sessão temporária necessária para o cadastro.
