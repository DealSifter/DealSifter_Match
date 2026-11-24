# DealSifter Match — Release reconciliation & launch closure audit

Data: 21/11/2026. Modalidade: somente leitura, com criação exclusiva deste documento. Escopo: deltas recentes e gates indispensáveis ao lançamento; não é uma certificação geral da plataforma.

## A. Executive Verdict

**CONDITIONAL GO. O produto tem as implementações recentes publicadas, mas ainda não há evidência suficiente para declarar concluída a preparação do lançamento comercial.** Não foi encontrado P0 confirmado nesta auditoria. Isso não equivale a provar ausência de defeitos em jornadas não executadas.

Permanecem **0 P0 confirmados, 6 pendências P1 de fechamento e 0 P2 formalizados neste pacote**. As seis pendências não são seis bugs: predominam configuração de release e evidência de aceite. Nenhum novo defeito funcional foi reproduzido. As melhorias adiáveis estão separadas em L.

- **R‑3/R‑3.1:** implementados, testados com autenticação no staging e publicados em Production. O código das duas funções principais coincide integralmente entre local, staging e Production. O aceite visual humano do percurso completo continua sem encerramento registrado. Não reconstruir o Gap Resolver.
- **R‑3.2:** exportação contextual e entrega Gmail com anexos estão implementadas e publicadas. Há prova autenticada anterior de preservação do relatório salvo e confirmação do proprietário de recebimento e criação do card no Trello. Não se trata mais de mero `mailto`. A edição posterior de assunto/corpo e o remetente do perfil também foram publicados. Falta fechar o alcance comercial do OAuth e o aceite do candidato final, sem presumir que todo destinatário recebeu porque a API respondeu ACCEPTED.
- **Ambientes:** as quatro funções recentes têm paridade exata de fonte. O Preview de conferência ficou atrás do frontend de Production; não serve para homologar as últimas mudanças de remetente, edição e modais. Há diferenças de schema no staging, mas a RPC CAS mantém o mesmo comportamento; **não há justificativa para copiar indiscriminadamente o schema nem redeployar as quatro funções**.
- **Próxima prioridade:** identificar/congelar o candidato atual e preparar, mediante autorização separada, um Preview de staging do mesmo source/frontend. Em seguida, uma única rodada residual de aceite, com escopo finito descrito abaixo.

Não foi feito commit, push, deploy, login novo, alteração de flags, migration, envio, compra, unlock, escrita remota, chamada paga ou limpeza nesta auditoria. Não foram repetidas suítes completas. As consultas remotas foram GETs administrativos, SELECTs de definições/contagens e leitura de assets públicos. Nenhum conteúdo de contato, token ou mensagem foi incluído neste documento.

## B. Matriz de estado atual

### Identidade do release e rastreabilidade

| Item | Estado verificado |
|---|---|
| Checkout | `fix/production-real-defects`, HEAD `21e6b7787f168abadc73388489c328eace387a60` |
| Árvore inicial | Limpa; a única inclusão desta tarefa é este documento |
| Source de Production | `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262`; HEAD acrescenta o registro documental da publicação |
| Production | https://dealsiftermatch.vercel.app — `dpl_aQU5cyEmcnKDMx79iK8yvmrGgdgo`, READY, SHA acima confirmado pela API Vercel |
| Preview de conferência registrado | https://dealsiftermatch-nx96y4o7m-deal-sifter-match-s-projects.vercel.app — `dpl_53JTEub4fxeFkFvtcVsJap8BYxtk`, READY; sem SHA Git na metadata |
| Fingerprint desse Preview | Manifest local da entrega: `ffb670d558b35cb72e5be09dd0487f465eb2116be80cac3654f23ca9161c293e`; identifica o candidato histórico, não o HEAD atual |
| Supabase Production | `cyeipfskwwisbbayyaca`, DealSifterMatch, ACTIVE_HEALTHY |
| Supabase staging | `oqdcnjupquhybwdbeeew`, maxxis-migration-validation, ACTIVE_HEALTHY |
| Remoto origin | `DealSifter/DealSifter_Match`; consulta `ls-remote`, sem fetch: branch atual remota em `d36ea4ad9fea8330010ee4faf56b9f73b142fa46`, main em `16aababd60c92ddf074b8956cb17de8b4bbce364`, dev em `9b82456e98621d2b43f6d89d9ec26072d2055965` |
| Diferença de push | 37 commits locais posteriores ao SHA remoto da branch, incluindo correções anteriores a R‑3.2 e documentação. O deploy prebuilt existe independentemente desse push. Não promover `main` por suposição |
| Fork | `Tarsox/DealSifter_Match`, main `1cc20595ce5cd6dcfe142bb2ac04f754ba701f7f`; a consulta não retornou a branch atual nesse fork |
| Stash | Topo `e6871a826f822fa3b42a2c904d901e212c52c89a`, `wip-maxxis-matches-pre-property-intelligence-deploy`; preservado |
| Rollback frontend | `dpl_E1HCT53SB3mZjX1jUsgqSJ7Ky82g`, anterior aos ajustes gerais de modais e já com edição de email |

Foram identificados 14 worktrees: principal; `report-responsiveness-20261018`; `address-identity-p0`; `analytical-intelligence-20261019`; `deploy-4ea6583`; checkouts `l1-export-fix`, `l1-overflow-fix`, `report-design-release`, `report-facts-release`, `report-freeze`; e os irmãos `agents-established-guan`, `agents-git-email-permission-fix`, `copilot-nugget-charging-logic-fix`, `repair-maxxis-runtime`. São históricos distintos; sua existência não indica código incluído no candidato. Nenhum foi removido ou aplicado. As cópias privadas de candidatos não devem ser confundidas com worktrees ou novas fontes oficiais.

### Componentes

| Componente | Local | Staging | Production | Divergência / interpretação |
|---|---|---|---|---|
| Frontend | Source `1862ad2` + docs `21e6b77` | Preview histórico R‑3.2 | `dpl_aQU…`, source `1862ad2` | Staging não acompanha as últimas entregas de UI/email; LC‑01 |
| Maxxis Chat | Fonte atual | v81, ACTIVE, JWT | v104, ACTIVE, JWT | Arquivos e bundle idênticos; versões são contadores por ambiente |
| Analysis inputs / Preflight | Fonte atual | v20, ACTIVE, JWT | v15, ACTIVE, JWT | Arquivos e bundle idênticos; não falta implementação em Production |
| Gap Resolver R‑3.1 | UNKNOWN, estimativas revisadas, manual, parcial e retomada | Backend atual; E2E autenticado anterior | Backend atual; frontend publicado | Aceite humano residual LC‑02, não falha comprovada |
| Exportação contextual R‑3.2 | Referência salva, renderer e modal de entrega | Fluxo anterior comprovado; frontend desatualizado | Inclui remetente do perfil, editor e novos modais | Preservação do snapshot implementada; fechar delta de aceite |
| Basic / PRO / Enterprise | Renderer e worker atuais | PDFs anteriores autenticados válidos | Worker/Core publicados coincidem com o build verificado | Não redesenhar ou repetir todos os testes de paginação |
| Gmail OAuth | Fonte atual | v6, ACTIVE, gateway sem JWT | v2, ACTIVE, gateway sem JWT | Bundle idêntico; callback usa state/PKCE, rotas de gestão validam JWT |
| Gmail delivery | Fonte atual | v8, ACTIVE, JWT | v3, ACTIVE, JWT | Bundle idêntico; backend envia PDF/fotos, com confirmação |
| CAS / migrations | `20261105230000`; release Gmail `20261117160000` | CAS registrado; Gmail aplicado por propostas anteriores, sem essa versão unificada no histórico | Ambas versões registradas | Não reaplicar SQL por diferença de histórico; comparar contratos antes de qualquer ação |
| Contexto privado | `deal_assumptions.r3Completion`, CAS | RLS, revisão, PT409; colunas extras de outro contrato de contexto | RLS, revisão, PT409 | SQL CAS difere em comentários; fluxo executável equivalente. Colunas extras não são requisito deste release |
| Entitlements | Gates existentes preservados | Duas contas QA Enterprise; relatórios salvos | Gates publicados; sem cópia das fixtures | Compra/concorrência comercial atual não certificada por teste de renderer; LC‑03 |
| Feature flags | Dependem do build | Valor efetivamente servido não reconfirmado | `VITE_PROPERTY_INTELLIGENCE_ENABLED=false` no bundle publicado | A presença da função/secret não ativa a capacidade no frontend |
| Observabilidade | Sentry com sanitização e metadados de release | Metadata de configuração parcial | DSN incorporado e release `modal-layout-1862ad2b8db5` no bundle | Configuração comprovada; ingestão/alerta operacional recente NOT VERIFIED, LC‑06 |

### Evidência remota nova e sanitizada

Comparação em memória dos ESZIPs publicados, recuperando fontes originais quando disponíveis e normalizando apenas CRLF/LF: **zero arquivos diferentes ou ausentes** contra o checkout nos dois ambientes.

| Função | Arquivos iguais por ambiente | SHA‑256 do bundle, igual nos dois ambientes |
|---|---:|---|
| maxxis-chat | 169 | `240a3c1547bedb548ff87748e78b9eb2392e1a88fa5649c2df12254200b49a81` |
| maxxis-analysis-inputs | 150 | `79db633810c53475c61438208eb25b817e52632f1d65d3a646a730ee4c1d11fd` |
| report-mailbox-oauth | 5 | `51666400132d4d9c53f4657be646e6ce6e8714af776e090509da7523df90b2bb` |
| report-mail-delivery | 7 | `05d1c1c3c4f2163066b265e1d540dd3fd86eccbed804227b1ec155273471bdc6` |

GETs novos no domínio canônico: HTTP 200 e hash idêntico ao manifesto do build para `index.html`, `assets/index-BqyoosQu.js`, `assets/reportPdf.worker-B6Qdecy_.js` e `assets/reportPdfCore-b11WEDER.js`. Não se atribui a esses GETs uma homologação autenticada.

SELECTs novos confirmaram, em ambos os bancos: RLS ativo nas quatro tabelas de contexto/mail; policies do contexto limitadas ao próprio reviewer com `ds_has_maxxis_analysis_context_access`; ausência de grants anon/authenticated nas três tabelas de mail; RPC de conclusão OAuth sem EXECUTE para esses papéis; CAS permitido a authenticated, negado a anon, SECURITY INVOKER, lock/revisão, PT409 e trigger de revisão presentes. Não foram executadas as RPCs de escrita.

## C. Implementações concluídas

| Solicitação | Implementação, teste e publicação | Limite da conclusão |
|---|---|---|
| PDF responsivo e design aprovado | Worker fora da thread principal, correções Basic de overflow, fatos/descrição legal, fotos, cabeçalho, mapas, rodapé e previews incorporados antes de R‑3.2. Prova do worker servido por Production: Basic 1 página, PRO 3, Enterprise 6, cinco fotos, mapas e PDF válido | Fixtures locais usando artefatos publicados; não comprova completude analítica de qualquer imóvel real |
| R‑3 / R‑3.1 | Preflight cache-only; campos privados incrementais; UNKNOWN persistido; métodos defensáveis; confirmação explícita; manual; parcial sem inventar ROI/lucro; CAS/reload/retomada e ScenarioEngine existente. Histórico: 51 testes direcionados, 88 de motor/projeção, 16 verificações autenticadas e caminhos estimado/parcial em navegador | Contagens têm escopos próprios, não devem ser somadas como uma suíte atual. Aceite humano não registrado |
| Matches → Portfólio | Unlock legítimo entre contas fictícias, RPC canônica de contatos pagos e associação ao portfólio; L2/L3 abertos em sessão autenticada. Fixture ainda existe, com planos Enterprise e ambos os relatórios salvos | Não houve novo login nem navegação autenticada nesta auditoria |
| L3 preparado não virar Basic | Referência contextual contém tipo, relatório, imóvel, versão, fingerprint e cenário. Entrega resolve o artefato salvo; email não reinicia a análise | Prova autenticada anterior e fonte atual; delta de modal ainda exige aceite residual |
| Email não baixar PDF automaticamente | Preparar email renderiza o mesmo documento para anexar; download ocorre na ação específica de baixar | Código atual em `ReportDeliveryModal.jsx`; não reabrir o antigo `mailto` como se fosse fluxo vigente |
| PDF e fotos automáticos | Backend Gmail produz MIME e envia PDF mais fotos disponíveis, após revisão/consentimento. L1 resolve fonte autorizada via RPC, sem depender de SELECT direto negado por RLS | Até cinco fotos, limite total de 6 MiB; ausência de fotos no snapshot é informada, não inventada |
| Remetente/destinatário | Remetente é o Gmail salvo no perfil ativo, validado no servidor contra a caixa OAuth. Login mantém identidade de autenticação. Destinatários privados salvos ou escolhidos; remetente não é padrão de destinatário | Gmail/googlemail pessoal; não suporta Outlook nem todo domínio Google Workspace |
| Mensagem editável e nomes públicos | Assunto/corpo editáveis, validados e enviados; hash normalizado na idempotência. Basic/PRO/Enterprise substituem os níveis internos no fluxo alterado | Nomes internos continuam legitimamente no schema/permissões; não prometer varredura exaustiva de toda tradução da aplicação |
| Modais desktop/tablet/mobile | `1862ad2`: 24 testes, 63 casos de layout e dez verificações adicionais de unlock; lint, contratos e build do commit exato aprovados. Smoke público em quatro resoluções; mobile mantém scroll necessário | Demais modais foram exercitados com fixtures locais; não foi feita compra/envio real para comprovar layout |

Fontes principais: [registro vigente](REPORT_RELEASE_CURRENT.md), [R‑3](R3_CONVERSATIONAL_REPORT_COMPLETION.md), [R‑3.1](R3_1_UNKNOWN_INPUT_RESOLUTION.md), [cenário QA](R3_1_QA_ACCEPTANCE_SCENARIO.md), [continuidade de entrega](R3_2_MAIL_DELIVERY_CONTINUITY_FIX.md).

Os testes antigos continuam úteis somente nos contratos preservados: não houve alteração de renderer, ScenarioEngine ou implementação R‑3.1 no delta `af26946..HEAD`. O manifesto R‑3.2 anterior confirma estabilidade dos arquivos centrais de conclusão/cenários, mas contém diferenças nos adaptadores de UI e mail; para esses arquivos valem as regressões posteriores de 67/57/24 casos e os respectivos recibos. Isso não transforma testes locais em E2E humano atual.

### Os cinco problemas originais de R‑3.2

1. **L3 substituído por Basic:** correção contextual presente, testada com referência salva e publicada; não reproduzido no estado auditado.
2. **Download inesperado:** separado de preparar email no fluxo vigente; corrigido e publicado.
3. **Seleção/análise reiniciada:** entrega reaproveita artefato salvo; correção de callback perdido no reload incorporada.
4. **Remetente confundido com destinatário:** o cliente local de email escolhia a própria conta; fluxo backend e posterior vínculo ao perfil ativo substituíram esse comportamento.
5. **Email não recebido:** proprietário confirmou que a configuração genérica do endereço Trello era a causa naquele teste, e depois confirmou recebimento/card. Não há base para manter esse incidente como bug aberto do envio. Production tem três registros ACCEPTED — dois PROPERTY_RELEASE e um SAVED_REPORT — mas isso não prova entrega de cada mensagem nem certifica a versão mais recente de todas as telas.

O documento [R3_2_CONTEXTUAL_EXPORT_EMAIL_FIX.md](R3_2_CONTEXTUAL_EXPORT_EMAIL_FIX.md) descreve uma etapa intermediária de rascunho. Não deve prevalecer sobre a publicação Gmail e suas atualizações.

## D. Implementações incompletas e dependências

Não foi identificada implementação necessária ainda exclusivamente local nos quatro backends auditados. O que falta é **fechar o candidato e seus aceites**, não implementar R‑3.1/R‑3.2 novamente.

| Item | Estágio exato | Dependência faltante |
|---|---|---|
| Preview final | READY, mas anterior às últimas mudanças do frontend | LC‑01: novo candidato de mesmo source, staging e origem exata; autorização antes de publicar |
| Aceite R‑3.1 | Testes técnicos e percurso autenticado anteriores aprovados | LC‑02: proprietário percorre estimado/parcial e reload no candidato final |
| Escopo comercial completo | Contratos e testes históricos existem; prova atual de compra concorrente/Stripe não localizada | LC‑03: pacote finito de aceite comercial ou exclusão explícita das capacidades não validadas |
| Gmail para novos usuários | Envio do proprietário comprovado; backend publicado | LC‑04: audiência/test users/verificação/quota do projeto Google não acessíveis nesta auditoria |
| Capacidade máxima de contexto | Compactação anterior resolveu a fixture; persistência normal funciona | LC‑05: fronteira real de 8 KiB ainda não coberta por evidência localizada |
| Monitoramento operacional | DSN e release realmente no bundle | LC‑06: recibo recente de ingestão/alerta e disponibilidade da automação remota |

## E. Diagnóstico QA e fixtures

**O cenário não desapareceu.** SELECTs atuais do staging confirmam:

- Investidor QA A `ba324c30-0dd5-4ce9-afe6-66ed733d2b5d` e publicador QA B `735e0496-7929-4b64-8533-62d287f96795`: duas contas confirmadas, ativas, plano Enterprise.
- Imóvel sintético `d3f15cc0-f5e5-431f-beeb-d3eb4b2d2a74`, “1200 Fictional QA Avenue”: existe, ativo, pertence ao publicador QA B.
- Unlock `b954e233-7c28-496c-8024-361653187827`: existe para A → B, custo histórico de um nugget. Foi criado pelo fluxo legítimo autorizado; não por alteração visual.
- Um relatório MAXXIS_ANALYSIS e um DEAL_INTELLIGENCE, não excluídos, pertencem a QA A nesse imóvel. Ausência de linhas específicas de entitlement não impede o acesso pelo plano Enterprise; não é necessário conceder novo benefício.
- Dois contextos privados do imóvel existem; `r3Completion` presente; maior armazenamento de assumptions dessas linhas: 1.818 bytes. A fixture pode já conter respostas de testes anteriores: conferir estado inicial antes de esperar as mesmas perguntas, sem apagar dados silenciosamente.
- Esses dois usuários, imóvel e unlock não foram encontrados em Production. Não copiar fixtures para Production.

Percurso de conferência: entrar como **investidor QA A**, perfil pessoal → Matches, contatos pagos/desbloqueados (filtro All/Paid correspondente à interface) → **R3 Fictional QA B** → Portfólio → imóvel → PRO/Enterprise → Preflight/Maxxis → PDF. Não é necessário inventar uma linha de match para substituir o registro canônico de desbloqueio. O recibo autenticado anterior comprova o caminho, a persistência e o reload; o SELECT atual comprova existência, não a renderização atual da tela ou uma nova avaliação de RLS como QA A.

QA `.invalid` não é caixa Gmail real. Não usar essa conta para comprovar recebimento de email. O aceite Gmail exige conta real autorizada, perfil Gmail correspondente e destinatário de teste escolhido, mediante autorização de envio. Não reutilizar a sessão/caixa de outro usuário.

Fixtures permanecem intactas. A limpeza restrita já descrita no cenário QA só deve ocorrer depois do aceite humano e de autorização específica; não há justificativa para excluir unlocks/contextos enquanto ainda são necessários. Não adicionar saldo, alterar Matching/RLS ou simular compra para obter PASS.

## F. Defeitos comprovados

**Nenhum bug funcional novo confirmado nas jornadas recentes auditadas.** Foram comprovadas duas divergências de release, agrupadas em LC‑01:

1. O Preview de conferência é anterior ao frontend atualmente servido em Production. Causa: publicações posteriores não acompanhadas de novo Preview de staging equivalente. Impacto: proprietário pode testar comportamento antigo e interpretar como regressão/ausência de correção. Correção mínima: Preview do candidato congelado; sem modificar os backends já equivalentes.
2. `qa/README.md` aponta para `docs/REPORTS_RELEASE_CURRENT.md` (plural), registro de 05/11 que ainda diz R‑3 pendente e cita deployment antigo. O registro correto mais recente é `docs/REPORT_RELEASE_CURRENT.md` (singular). Causa documental comprovada. Correção mínima futura: um índice vigente e redirecionamento documental, preservando histórico.

Os antigos travamentos/overflow Basic, callback perdido após reload, aquisição L1 negada por SELECT direto, `mailto` e inversão de remetente não foram reapresentados como bugs abertos: há correções e provas posteriores compatíveis. Não se comprovou que as colunas extras do contexto no staging causem falha: a diferença da RPC é de comentários, não de operações. Não aplicar migration de “paridade” por esse motivo.

## G. Gaps de evidência e gates críticos

### G.1 Segurança e capacidade

| Gate | Evidência atual / limite |
|---|---|
| Auth/JWT | Metadata remota exige JWT nas duas funções de análise e entrega; OAuth callback dispensa JWT no gateway por desenho, mas gestão valida o usuário no código. State de uso único, expiração de dez minutos, PKCE S256 e binding de usuário/perfil/caixa |
| Contexto privado / CAS | RLS, grants, trigger e SQL remoto confirmados nos dois ambientes; testes autenticados anteriores A/B e 409. Não foi produzido novo teste adversarial remoto nesta tarefa |
| Limite R‑3.1 | Constraint real `pg_column_size(deal_assumptions) <= 8192`; limite de 65.536 bytes do envelope CAS é outro contrato. Máximos atuais: Production 1.502 bytes em 17 linhas, staging 1.824 em quatro linhas. Nenhuma linha atual próxima do teto |
| Cobertura de fronteira | Não localizado teste exercitando persistência real próximo/acima de 8 KiB nas suítes R‑3.1/conclusão. JSON.stringify, número de caracteres ou envelope de 64 KiB não substituem `pg_column_size`. LC‑05, sem propor aumento do limite |
| Service role | Restrito ao servidor para tokens/ledger OAuth/mail; relatório salvo consultado com cliente do usuário e autorização explícita. Basic usa fonte autorizada canônica; contatos não são liberados por service role |
| Anexos / mensagem | PDF validado por assinatura e parser; JPEG/PNG, até cinco fotos, até 6 MiB no conjunto; entrada HTTP limitada; até dez destinatários; proteção de headers, assunto até 240 caracteres e corpo até 60.000 |
| Envio / duplicidade | Confirmação explícita; reserva única por usuário/referência/destinatários/contexto de envio e mensagem editada; ACCEPTED não reenvia, FAILED exige retry explícito, resultado ambíguo vira INDETERMINATE sem retry automático |
| Remetente | Perfil salvo do próprio usuário e escopo ativo, sem fallback para login; Google confirma titularidade e correspondência. Estado conferido novamente antes de envio |
| Secrets / logs | Inventário somente de nomes; nenhum segredo extraído para o documento. Token criptografado com contexto de usuário/provedor; tabelas mail sem grants de navegador. Sanitização de observabilidade presente; scan da publicação vigente PASS |
| Rate limits | Guardas de análise/provedores existentes preservadas. Mail tem idempotência, limites de payload e quotas Google; não foi localizado limitador dedicado de frequência por usuário no endpoint mail. Ausência de evidência de abuso não é incidente P0; não prometer volume ilimitado, LC‑04 define capacidade comercial |

Fontes: `supabase/migrations/20261105230000_maxxis_analysis_context_cas.sql`, `supabase/migrations/20261002173000_maxxis_deal_assumptions.sql`, `supabase/functions/_shared/maxxis/reportCompletion.ts`, `unknownInputResolution.ts`, `supabase/functions/_shared/mailbox/{googleConnection,connectionSecurity,senderProfile,reportMailDelivery}.ts`, entradas das duas funções de mail e `src/lib/observability.js`.

### G.2 Jornadas essenciais e integrações

| Módulo/integração | Comprovado | NOT VERIFIED / fallback e custo |
|---|---|---|
| Auth, onboarding e perfis | Contratos existentes; teste autenticado de remetente diferente do login; smoke público atual de acesso/cadastro | Aceite atual de criação/edição/sessão entre perfis integra LC‑03; não alterar autenticação para testar mail |
| Marketplace, feed, edição, filtros | Implementação e auditorias anteriores; delta recente predominantemente layout | Publicação/edição/visibilidade e permissões em sessão atual não certificadas pelo smoke anônimo; LC‑03 |
| Matching, contatos e Portfólio | Unlock legítimo, E2E anterior e fixture atual | Caminho humano final LC‑02; novos desbloqueios/exclusividade e cobrança LC‑03 |
| Maxxis | R‑3.1 determinístico/cache-only e cenários existentes; fontes de backend atuais equivalentes | Conversação generativa com custo não foi chamada. Resultado parcial e dados externos ausentes são estados legítimos |
| Relatórios | Renderer, snapshot, previews, worker/download e preservação de referência com evidências | Não garantir seis páginas para qualquer conteúdo extremo; não atribuir completude analítica ao simples PDF válido |
| Prestadores / FSBO | Contratos e funcionalidades existentes mapeados na auditoria anterior; perfil FSBO considerado no remetente | Aceite comercial das jornadas que serão anunciadas precisa de decisão LC‑03; não foi reaberta auditoria geral desses módulos |
| Supabase / Vercel | Projetos saudáveis, funções ACTIVE, deployment READY e quatro assets com hashes iguais | Não equivalem a SLA de disponibilidade, recuperação ensaiada ou todos os RPCs da plataforma certificados |
| RentCast / GIS | Production tem funções e secret RentCast configurados; flag Property Intelligence do frontend está false; guard/cache existem | Não foi chamado provedor. Valor do hard limit e capacidade contratada não foram inspecionados. Não anunciar enriquecimento geral ativo; cache/evidência ausente/resultado parcial são fallback seguro |
| Gemini | Secret/model/timeout presentes; arquitetura de limites existente preservada | Sem chamada paga nem comprovação atual de quota externa; não trocar fluxo determinístico por Gemini para resolver gaps |
| Stripe / Nuggets | Secret e price IDs presentes em Production; contrato checkout servidor, webhook idempotente e débito/entitlement por RPC documentados | Staging sem nomes de secrets Stripe no inventário e nenhuma linha em stripe_webhook_events nos dois ambientes. Isso não prova falha, mas também não prova checkout→webhook→crédito ou cobrança única. LC‑03 |
| Gmail | Secrets indispensáveis presentes em ambos; backend com paridade; seis ACCEPTED no staging e três em Production; proprietário confirmou recebimento/card | Audiência/verificação/quotas Google não vistas; LC‑04. Todas as conexões registradas estavam expiradas no SELECT (uma staging, duas Production): esperado pelo consentimento online sem refresh token; reconectar, não usar tokens vencidos nem transferir entre ambientes |
| Monitoramento | DSN e release embutidos, sanitização e workflow de smoke existentes | Execução remota recente, ingestão e destino do alerta não confirmados. Workflow local observa frontend Production e Edge staging; isso não é monitoramento autenticado de todo backend Production. LC‑06 |

Não foram consultados RentCast/Gemini/Stripe/Gmail para gerar trabalho faturável. As 16 operações externas billable_success do mês já existentes no ledger de Production são histórico, não chamadas feitas para esta auditoria. O staging não retornou operações desse mês nessa tabela.

## H. Matriz de prioridades e fichas de fechamento

“Bloqueia” abaixo se refere ao **GO comercial irrestrito**, não à existência atual do app em Production. Uma lacuna de prova não foi rotulada BUG CONFIRMADO.

| ID | Descrição / classe | P0/P1/P2 | Causa comprovada | Correção mínima | Aceite | Bloqueia lançamento |
|---|---|---|---|---|---|---|
| LC‑01 | Candidato/Preview/registro divergentes — RELEASE CONFIGURATION | P1 | Sim para diferença de frontend, refs remotas e índices | Congelar source, arquivar manifest sanitizado, alinhar um Preview e índice; push somente autorizado | Source/artefato inequívocos; Preview staging equivalente; links vigentes | SIM para afirmar homologação do candidato final |
| LC‑02 | Aceite humano R‑3.1 e delta R‑3.2 — NOT VERIFIED | P1 | Falta de registro, não causa de falha funcional | Um percurso assistido com fixture existente e revisão do delta mail | Estimativa/parcial, reload e mesma referência/PDF conferidos pelo proprietário | SIM se R‑3.1 anunciado |
| LC‑03 | Jornadas comerciais e monetização sem prova atual suficiente — NOT VERIFIED | P1 | Ausência de recibo compatível; não bug de billing comprovado | Decidir escopo e executar somente casos finitos abaixo em ambiente seguro | Isolamento, visibilidade, débito/crédito únicos e entitlement comprovados no escopo | SIM para lançamento comercial pago irrestrito |
| LC‑04 | Alcance comercial do Gmail — NOT VERIFIED | P1 | Configuração Google não acessível | Confirmar audiência/verificação/quota e um usuário novo elegível, ou restringir oferta explicitamente | Usuários anunciados conseguem consentir; limites/reconexão claros | SIM se email geral prometido; NÃO com exclusão explícita aceitável |
| LC‑05 | Fronteira do contexto de 8 KiB — NOT VERIFIED | P1 | Constraint comprovada; cobertura de fronteira não localizada | Teste dirigido de persistência/erro/recuperação, sem aumentar schema por padrão | Preserva dados anteriores e informa limite sem travar a retomada | SIM para aceite R‑3.1 sem ressalva; mitigar restringindo casos e escopo até prova |
| LC‑06 | Alerta/monitoramento do release sem recibo operacional — NOT VERIFIED | P1 | DSN comprovado; ingestão/rotina remota desconhecidas | Conferir ingestão recente e execução/aviso do smoke existente | Release identificável e alerta operacional verificável, sem PII | SIM para GO sem acompanhamento mínimo |

### LC‑01 — Release / frontend / documentação

- **Ambientes e função:** checkout, repositório remoto, Preview staging, índice QA. Responsável técnico: release/frontend.
- **Esperado versus observado:** um candidato rastreável corresponde ao que o proprietário testa; observado Preview anterior, 37 commits ainda não publicados na branch remota e dois índices “current” contraditórios. Não houve perda de source demonstrada.
- **Evidência/causa:** IDs e refs em B; manifests de publicação e índice QA. Causa comprovada de divergência documental/de release; nenhuma falha de backend decorrente foi demonstrada.
- **Impacto/correção mínima:** evitar homologação da versão errada; registrar source e build exatos, tornar índice único e preparar Preview do source atual conectado ao staging. Não usar remote main como substituto do candidato.
- **Aceite/dependências:** hash e Supabase alvo conferidos, flags explicitadas, CORS apenas da origem exata, mudanças revisáveis e recibo versionável sanitizado. Nenhum segredo/PDF real no Git. Depende de autorização para publicação/push e de decisão da branch oficial; sem migration necessária.

### LC‑02 — R‑3.1 e exportação contextual

- **Ambientes e função:** Preview alinhado, Matches/Portfólio/Maxxis/relatório e modal Gmail. Responsável técnico: QA de produto/frontend-relatórios.
- **Esperado versus observado:** proprietário consegue o percurso completo; existem provas técnicas anteriores, mas não encerramento visual humano do candidato atual. Não há falha funcional atual comprovada.
- **Evidência/causa:** E e documentos R‑3.1, recibos R‑3.2 e registros de publicação. Causa da ausência de aceite não atribuída a código.
- **Impacto/correção mínima:** impede anunciar R‑3.1 homologado; conferir PRO/Enterprise, “Não sei” → revisão → confirmação, parcial com métricas desconhecidas ausentes, reload persistido e retomada do pedido original. No delta mail conferir perfil ativo, destinatário salvo/escolhido, editor, nome público e mesmo artefato; preparar sem download automático.
- **Aceite/dependências:** recibo com candidato, pedido/referência, resultado e aprovação humana; PDF/snapshot mantêm imóvel, tipo, fontes/data, cenário e limitações. Depende LC‑01; sessão legítima e eventual reset sintético/envio real precisam autorização específica. Não requer novo motor, migration ou deploy se passar.

### LC‑03 — Escopo comercial e jornadas pagas

- **Ambientes e função:** QA/staging e leitura de readiness Production; Auth/perfis, marketplace, desbloqueio, relatórios/entitlements, Stripe, prestador/FSBO anunciados. Responsável técnico: QA de produto/backend financeiro.
- **Esperado versus observado:** prova atual das jornadas prometidas, sobretudo débito/crédito único; há contratos e QA anteriores, sem evidência atual suficiente de transação concorrente/webhook completo. Nenhuma cobrança indevida demonstrada; tabela de eventos vazia não é prova de defeito.
- **Evidência/causa:** `CHECKOUT_FINANCIAL_FLOW_AUDIT.md`, `QA_E2E_FLUXOS_FINANCEIROS.md` (plano, não execução), `qa/current-state-audit/01_EXECUTIVE_HANDOFF.md` e SELECTs em G. Ausência de prova confirmada; causa funcional não comprovada.
- **Impacto/correção mínima:** antes de lançamento pago, delimitar oferta e obter recibo finito: (1) sessão/isolamento e troca de perfil; (2) publicar/editar propriedade sintética e verificar visibilidade/feed/filtro/permissões; (3) unlock normal/exclusividade e acesso ao Portfólio sem débito duplicado; (4) compra de relatório e repetição concorrente com um único débito/entitlement; (5) checkout de plano/topup em Stripe test mode → webhook duplicado → um único crédito, com falha/cancelamento sem crédito; (6) uma jornada crítica de prestador/FSBO somente se anunciada.
- **Aceite/dependências:** candidato e versão dos RPCs vinculados aos recibos, saldos/eventos antes/depois sanitizados e papéis A/B. Não testar billing com cobrança real por conveniência. Configurar test mode/fixtures/transações exige autorização própria; sem alterações de preços, prod keys ou lógica. Deploy/migration apenas se caso reproduzir defeito e correção for aprovada. Se excluir uma capacidade, anúncio/UI/oferta precisam refletir a exclusão; excluir Stripe enquanto se vende planos não é mitigação aceitável.

### LC‑04 — Gmail comercial

- **Ambientes e função:** projeto OAuth Google e envio backend Production. Responsável técnico: integração email/configuração do provedor.
- **Esperado versus observado:** audiência anunciada consegue consentir e enviar; proprietário conseguiu, mas status Testing/Production, test users, eventual verificação e quotas do projeto não foram consultados.
- **Evidência/causa:** código OAuth usa `openid email gmail.send`, consentimento online sem refresh token; inventário de secrets e confirmação do proprietário. Não há erro Google atual demonstrado.
- **Impacto/correção mínima:** não prometer envio a todos sem conferir audiência. Obter metadata sanitizada do console; verificar usuário elegível adicional e limites. Pode manter oferta inicial restrita ao Gmail pessoal e a público permitido, com comunicação explícita e download PDF como fallback.
- **Aceite/dependências:** caixa corresponde ao email do perfil ativo; novo consentimento permitido; anexos corretos e recebimento/card confirmado quando houver envio autorizado; ACCEPTED e recebimento registrados separadamente. Depende do escopo LC‑03 e Preview LC‑01 para UI final. Acesso ao console, mudança de audiência ou envio real exigem autorização; nenhuma migration inferida. Rate limit adicional/refresh token não são implementação obrigatória automática deste pacote.

### LC‑05 — Capacidade R‑3.1

- **Ambientes e função:** serialização `r3Completion`, CAS e tabela privada staging. Responsável técnico: backend Maxxis/QA de persistência.
- **Esperado versus observado:** casos válidos próximos da capacidade persistem; acima do teto falham de forma recuperável e sem sobrescrever dados. Os casos existentes são pequenos; compactação anterior resolveu a fixture, mas não certificou a fronteira.
- **Evidência/causa:** constraint e tamanhos em G, ausência de caso correspondente nas suítes inspecionadas. Risco potencial, sem overflow atual reproduzido.
- **Impacto/correção mínima:** teste dirigido de payload com proveniência longa/campos combinados, medindo o `pg_column_size` real, caso abaixo e acima do teto, CAS concorrente e reload após rejeição. Não usar dados reais; não aumentar limite antes de reproduzir necessidade.
- **Aceite/dependências:** nenhuma perda de contexto prévio, nenhum zero fabricado, erro compreensível e retomada possível; estimativas preservam origem/premissas. Escritas de teste só após autorização QA específica. Migration/deploy não necessários se passar; correção mínima somente após falha comprovada.

### LC‑06 — Operação e alerta

- **Ambientes e função:** Sentry/automação GitHub/Vercel. Responsável técnico: operação/release.
- **Esperado versus observado:** release atual identificável em ingestão e rotina de health com alerta acessível; bundle contém configuração válida após trim e release, mas execução remota/ingestão recente não foram certificadas. Não se comprovou monitoramento quebrado.
- **Evidência/causa:** `src/lib/observability.js`, `docs/OBSERVABILITY.md`, `.github/workflows/observability-smoke.yml`; refs remotas atrás do candidato. DSN configurado no Vercel sozinho não foi usado como prova: sua incorporação no bundle foi verificada.
- **Impacto/correção mínima:** conferir evento existente sanitizado e run recente do smoke, destino do alerta e acesso operacional; evitar gerar evento/email desnecessário. Registrar cobertura real: frontend Production + Edge staging, não toda jornada autenticada de Production.
- **Aceite/dependências:** recibo de ingestão do release e health/alerta operacional ou procedimento manual temporário explicitamente assumido e testado. Qualquer disparo controlado/configuração precisa autorização; não exige migration. Depende da identidade do candidato LC‑01.

## I. Plano consolidado — no máximo quatro frentes

**Frente A — Correções efetivamente bloqueantes.** Nenhum P0 funcional comprovado a corrigir agora. Corrigir somente uma falha que LC‑02/03/05 venha a reproduzir e que impeça escopo anunciado. Um único pacote mínimo por causa, sem redesenho ou novo motor. Não converter automaticamente lacunas em tickets de código.

**Frente B — Homologação residual.** Após LC‑01, executar LC‑05 e a rodada humana LC‑02; em paralelo independente, fechar o escopo/casos LC‑03 e acesso Google LC‑04. Aproveitar fixture existente e provas compatíveis; repetir apenas os deltas, salvo falha nova. Responsáveis técnicos: QA de produto, Maxxis, backend financeiro e integração Gmail.

**Frente C — Production Readiness.** LC‑01 e LC‑06: source oficial, índice, hashes, diferenças de flags/schema documentadas, rollback e monitoramento. Não copiar secrets/tokens/fixtures nem aplicar migrations por comparação de contador de versões. Backend recente já equivalente. Responsável técnico: release/operação.

**Frente D — Launch Candidate.** Congelar escopo e artefato após aceites, registrar ressalvas/exclusões aceitas e obter decisão do proprietário. Se nenhum código mudou, não há razão para novo deploy geral. Se houve correção, promover exclusivamente o delta testado, com recibo e smoke posterior. A aprovação do diagnóstico não autoriza essa publicação.

## J. Checklist de Production Readiness

- [x] Source de frontend publicado identificado e quatro assets canônicos conferidos por hash.
- [x] Quatro funções recentes ACTIVE, com paridade de fonte nos dois ambientes.
- [x] Migrations recentes de Production registradas; CAS/RLS/grants/trigger relevantes conferidos.
- [x] Sem evidência de necessidade de nova migration para R‑3.1 ou mail.
- [x] Worker real e previews têm recibos de publicação; sem regressão de renderer identificada no delta posterior.
- [x] Remetente do perfil, consentimento, anexos, confirmação e idempotência presentes no backend publicado.
- [x] Rollback frontend identificado; backups de funções indicados nos recibos de release anteriores.
- [x] Property Intelligence false no frontend Production; não considerar essa oferta ativa por inferência.
- [ ] LC‑01: source oficial/manifest persistido e Preview do candidato final com índices coerentes.
- [ ] LC‑02: aceite humano explícito do percurso R‑3.1 e delta de entrega.
- [ ] LC‑03: escopo comercial fixado e provas finitas de autorização/monetização correspondentes.
- [ ] LC‑04: público elegível Google e capacidade de envio confirmados ou oferta honestamente restrita.
- [ ] LC‑05: fronteira de armazenamento e recuperação comprovadas.
- [ ] LC‑06: ingestão/health/alerta operacional comprovados.
- [ ] Decisão final do proprietário sobre candidato, escopo e publicação, após esses recibos.

## K. Plano de publicação e rollback — NÃO EXECUTADO

1. Fixar branch/source `1862ad2` como base de produto, mantendo o HEAD documental identificado; revisar os 37 commits não publicados antes de qualquer push. Não substituir pelo estado de main. Versionar manifest/evidência sanitizados, nunca credenciais ou PDFs reais.
2. Com autorização específica, criar Preview desse source ligado ao staging, conferindo flag e origem CORS exata. Não redeployar funções equivalentes nem transferir bancos/tokens.
3. Executar somente os aceites residuais autorizados. Se passarem sem código novo, registrar o release atualmente em Production como candidato aceito; **não fazer redeploy geral cerimonial**.
4. Se houver defeito reproduzido: preparar diff mínimo, testes correspondentes e Preview. Migration só se contrato realmente exigir, com SQL revisado/dry-run autorizado antes. Ordem de eventual mudança incompatível: schema aditivo necessário → funções → frontend; não há mudança desse tipo demonstrada hoje.
5. Antes de eventual promoção autorizada: confirmar ID do deployment anterior, source, hashes, configurações e backup das funções afetadas. Rollback do último frontend: `dpl_E1HCT53SB3mZjX1jUsgqSJ7Ky82g`. Esse rollback é de UI; preserva mail editável, mas não recupera estado de banco.
6. Validar depois: canonical/source/hash, assets/worker, erros de console/ingestão, acesso legítimo e mesmo artefato de relatório. Envio real, compra e providers continuam dependentes de autorização; probes não devem causar cobrança. Reverter frontend ao ID anterior em regressão confirmada; funções somente para backup exato do componente alterado e schema compatível. Não restaurar banco inteiro para desfazer release de UI.

Recibos privados locais consultáveis, sem incorporá-los ao Git: `.tmp-codex/modal-layout-production/{release,deployment,assets,browser-smoke}.json`, `.tmp-codex/r32-message-edit/`, `.tmp-codex/r32-profile-sender/`, `.tmp-codex/r32-production/`, `.tmp-codex/r32-mail-flow-fix/`, `.tmp-codex/r31-completion/closing.json`, `.tmp-codex/r31-matches/audit.json`. São auxiliares locais, não um arquivo oficial reproduzível por terceiros; LC‑01 inclui preservar o mínimo sanitizado versionável. Nenhum script operacional dessas pastas foi executado integralmente nesta auditoria.

## L. Backlog pós-lançamento

Podem ser adiados, desde que não sejam anunciados como capacidades disponíveis: envio Outlook/Workspace genérico; refresh token e conexão Gmail permanente; confirmação universal de entrega na caixa do destinatário; novo motor financeiro; enriquecimento geral hoje atrás de flag desativada; refatoração de modais/relatórios e ajustes cosméticos não regressivos. Resultado sem dados externos e PDF parcial identificado não devem virar promessa de valuation completo.

Consolidação física de worktrees/arquivos históricos e limpeza de fixtures podem ocorrer após o aceite, com inventário/backup e autorização restrita. Não são condição para renderizar relatórios nem motivo para apagar a fixture atual. Não aplicar stash para “limpar pendências”. Nenhuma expansão estética ou arquitetural integra o pacote mínimo de lançamento.

## M. Decisão final

| Dimensão | Decisão | Condição objetiva |
|---|---|---|
| CODE READY | SIM para o delta recente auditado | Implementações publicadas e regressões compatíveis; sem bug funcional novo confirmado. Não é certificação de todos os módulos |
| QA READY | CONDICIONAL | LC‑01/02/05 e casos do escopo LC‑03 |
| SECURITY READY | CONDICIONAL para lançamento | Gates recentes de JWT/RLS/CAS/mail conferidos; provas autenticadas anteriores preservadas, sem repetir auditoria geral. Aceite de autorização/concorrência comercial LC‑03 ainda necessário |
| COMMERCIAL SCOPE READY | NÃO encerrado | Definir oferta e comprovar o que será vendido; LC‑03/04 |
| PRODUCTION READY | PARCIAL | Aplicação publicada e saudável na inspeção; rastreabilidade/aceite/monitoramento LC‑01/06 pendentes |
| LAUNCH READY | CONDITIONAL GO | Nenhum P0 confirmado; fechar as seis condições e obter aprovação do proprietário. Se teste revelar P0 ou P1 indispensável sem mitigação, a decisão passa a NO‑GO até correção |

**Não há fundamento para reimplementar R‑3.1, substituir o envio Gmail ou redesenhar novamente os PDFs. O pacote final é de rastreabilidade, aceite residual e prova comercial/operacional; código novo só diante de falha reproduzida.** A confirmação anterior do proprietário sobre Gmail/Trello encerra aquele incidente específico, mas não substitui a aprovação humana do conjunto R‑3.1 nem autoriza lançamento irrestrito.

### Resumo executivo — sequência única de fechamento

| Ordem | Ação | Prioridade | Dependência | Critério de aceite | Exige nova autorização? | Impacto no lançamento |
|---:|---|---|---|---|---|---|
| 1 | LC‑01 — Congelar source/manifest, corrigir índice vigente e publicar um Preview equivalente ligado ao staging; decidir push da branch correta | P1 | Identidade em B | Hash/source/alvo claros e Preview que contém o delta atual | SIM para editar outros documentos, commit/push, Preview e CORS; esta tarefa é só auditoria | Evita homologar versão errada; nenhum redeploy de backend necessário |
| 2 | LC‑03 — Fixar oferta e executar os seis casos comerciais aplicáveis, com Stripe test mode e fixtures autorizadas | P1 | Escopo decidido; candidato 1 para UI | Autorização/isolamento e débito/crédito únicos com recibos | SIM para configuração/testes com escrita; nunca cobrança real implícita | Necessário antes de vender capacidades pagas não certificadas |
| 3 | LC‑05 — Testar fronteira real de 8 KiB, rejeição e recuperação do contexto | P1 | Candidato 1 e autorização QA | Abaixo/acima do limite sem perda/travamento e reload correto | SIM para escrita QA; nenhuma migration presumida | Fecha risco específico restante de persistência R‑3.1 |
| 4 | LC‑02 — Proprietário aceitar Matches → Portfólio → PRO/Enterprise → estimativa/parcial → reload/PDF e delta do modal mail | P1 | 1; 3 para aceite completo de R‑3.1 | Mesmo pedido/artefato, inputs privados persistidos e aceite humano registrado | SIM para qualquer reset/envio real além da navegação | Encerra a homologação que os testes automatizados não substituem |
| 5 | LC‑04 — Confirmar audiência/quota OAuth Google e consentimento de usuário adicional elegível ou restringir oferta | P1 | Escopo 2; Preview 1 para UI | Público anunciado consegue conectar; recebimento separado de ACCEPTED quando autorizado | SIM para console/configuração/consentimento e envio reais | Condiciona oferta geral de envio Gmail; PDF continua fallback |
| 6 | LC‑06 — Obter recibo de ingestão do release e execução/alerta de health existente | P1 | Identidade 1 | Release e alerta operacional comprovados sem PII | Leitura pode prosseguir; SIM para disparo/configuração | Garante acompanhamento mínimo da abertura comercial |
| 7 | Registrar decisão do proprietário e congelar candidato; promover apenas eventual delta aprovado e verificar hashes/smoke | Gate final | 1–6 aceitos ou exclusões explícitas admissíveis | Zero P0/P1 bloqueante no escopo; aprovação e rollback documentados | SIM; auditoria não autoriza execução | Permite GO sem iniciar novo ciclo exploratório |
