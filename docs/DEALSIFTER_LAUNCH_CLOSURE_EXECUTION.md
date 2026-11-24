# DealSifter Match — execução de fechamento LC‑01 a LC‑06

Data: 21/11/2026. Base: [auditoria concluída](DEALSIFTER_LAUNCH_CLOSURE_AUDIT.md). Este documento registra execução direcionada, não uma nova auditoria.



<!-- CURRENT_LAUNCH_CLOSEOUT_BEGIN -->

## Fechamento vigente — 21/11/2026, atualizado após P‑03R

### Resumo executivo — decisão para o lançamento

**Decisão técnica: CONDITIONAL GO.** Os controles comerciais indispensáveis testados passaram: sessões e isolamento, marketplace, Nuggets, exclusividade, aquisições premium e Stripe TEST. O proprietário confirmou o alerta externo no Hotmail em 21/11 às 19:33. A falha real encontrada no primeiro “Não sei” foi corrigida, validada e publicada em Production. Não há P0/P1 bloqueante confirmado pelos cenários executados; o GO irrestrito ainda depende do aceite visual humano e da confirmação das quotas/restrições Gmail. A decisão comercial final pertence ao proprietário.

Frontend Production **https://dealsifter.com/** (também www e host Vercel), deployment **dpl_Aee7JTjm5tRYDMPkFqBgNvKWVqgj**, READY; código **20b993f851dab9b9707c22c5e1bf22789727cc95**, fingerprint **a575c5385d67fc480963d3bf26c0d013e5814ae894c8995f76a93b68edbcb707**. Correção Classe A das preferências/sessão Maps publicada em 24/11/2026: zoom, estilo, agrupamento e filtros gerais prevalecem na abertura; ajustes da sidebar valem durante a sessão e são descartados no logout. 20 testes direcionados, lint completo, TypeScript, build isolado, 38 verificações de staging por adaptador privado somente leitura e smokes públicos PASS. 28 funções backend preservadas. Preparação de verificação de contatos e stash preservados. Sem migrations, push, envios, compras ou chamadas pagas. Rollback frontend **dpl_6PTzjfCSBJ4Cq3FdZCS7gmgbNubk**. Evidências: `.tmp-codex/map-release-20261124/`. Gates comerciais e aceite humano inalterados.

P‑03R concluiu dois checkouts reais em **Stripe TEST** (P5 US$9 e PRO US$49/mês), um checkout cancelado sem crédito, dois replays deliberados sem duplicidade e rejeições de assinatura/corpo inválidos. Crédito legítimo total do investidor **31 Nuggets**; débitos totais **30**: contato 1, PRO 3, Enterprise 5 e exclusividade 21. Saldo final **1**, sem crédito manual ou dinheiro real. A assinatura TEST foi cancelada; o webhook retornou a conta a Basic. O webhook TEST novo foi desativado e as cinco configurações exclusivamente temporárias retiradas, preservando as 21 anteriores e o CORS do Preview de relatórios. Fixtures e ledger continuam disponíveis para conferência.

**Capacidades tecnicamente aprovadas no escopo testado:** publicação/edição/visibilidade de imóveis e serviços sintéticos, perfis Personal/Business/FSBO, unlocks e exclusividade, aquisição/acesso persistente de PRO/Enterprise, PDF e billing de P5/PRO via fluxos existentes. Não se certificaram dinheiro real, checkout de todos os produtos Stripe, SLA integral ou Gmail sem limites. O Gmail permanece sujeito às quotas reais; PDF é a alternativa existente. Não houve exclusão implícita de prestadores/FSBO.

### Matriz vigente GO/NO-GO

| Gate | Resultado | Evidência | Bloqueante? | Ação restante |
|---|---|---|---|---|
| LC‑01 | PASS | Frontend canônico 200; bundles backend/estado/JWT; 150/169 módulos por função conferidos | Não | Manter manifesto e rollback |
| LC‑02 | OWNER ACTION | Enterprise 11/11 e PRO 9/9 no navegador autenticado; PDF real e reload; evidência anterior de estimativas reaproveitada | Para declarar aceite humano | Proprietário executar checklist único abaixo |
| LC‑03 | PASS | B1–B6 abaixo; Stripe TEST real, webhooks e débitos/entitlements concorrentes | Não no escopo testado | Nenhuma nova bateria comercial necessária |
| LC‑04 | OWNER ACTION | Proprietário declarou Google em produção/verificado; implementação e prova anterior de recebimento/Trello preservadas | Para oferta Gmail irrestrita | Confirmar quotas/restrições efetivas no projeto Google |
| LC‑05 | PASS | Fronteira real 8.192/8.193 bytes, CAS/RLS/reload/PDF e erro controlado já compatíveis | Não | Evidência reutilizada; limite preservado |
| LC‑06 | PASS | Health frontend/Edge, evento Sentry natural existente, workflow e confirmação humana do alerta externo 44957302667 | Não no alcance comprovado | Acompanhamento operacional contínuo; sem promessa de cobertura integral |

### LC‑03 — cobertura comercial encerrada

| Cenário | Resultado | Prova e limite de alcance |
|---|---|---|
| B1 — autenticação/perfis/isolamento | PASS | 28 checks API autenticados compartilhados com B2/B6; RLS A/B; 6 checks UI de alternância Personal → Business → FSBO → Personal com dados remotos distintos, sem alterar os perfis |
| B2 — marketplace | PASS | Publicação, edição própria/rejeição alheia, ocultação/republicação e integridade via API real; 6 checks dos filtros reais sobre inventário remoto; 5 checks UI Matches → Portfólio → imóvel → reload. Filtros não foram apresentados como gestos visuais |
| B3 — Nuggets/unlocks | PASS | Unlock normal concorrente 1/0, mesmo registro; exclusividade total 21 com saldo 22→1, uma compra e concorrente/repetição recusadas sem novo débito; vínculo correto ao Portfólio |
| B4 — relatórios premium | PASS | Aquisições concorrentes PRO 3 e Enterprise 5, uma cobrança/entitlement/artefato por capacidade; repetição zero; artefato privado de A invisível a B. Enterprise 11 checks UI/PDF/reload e PRO 9, este após cancelar o plano. Permissões Enterprise e percurso estimado anteriores compatíveis reaproveitados |
| B5 — Stripe | PASS | Dois checkouts pagos TEST com crédito único automático; checkout cancelado/expirado sem crédito; 2 replays sem crédito extra; 2 respostas 400 inválidas sem ledger; cancelamento da única assinatura QA com plano Basic e saldo preservado |
| B6 — prestadores/FSBO | PASS | Jornada autenticada de publicação → inventário visível → edição autorizada/negação alheia → ocultação/republicação para serviço Business e imóvel FSBO; alternância dos perfis na UI. Não se alegou compra adicional de serviço ou desbloqueio de contato desses escopos |

### Correção real descoberta e publicação isolada

- **Causa:** ao registrar o primeiro “Não sei”, o contexto guarda a disposição UNKNOWN antes de qualquer input confirmado. A recomposição de evidência financeira usava `r3Completion.userId`, ainda ausente, embora o cenário já contivesse a identidade autenticada. O guard correto retornava `SCENARIO_IDENTITY_MISMATCH`/HTTP 500. Logs e teste local reproduziram o defeito; não se tratava de falta de saldo ou entitlement.
- **Delta mínimo Classe A:** `refreshReportFinancialEvidence.ts` recebe o userId autenticado explicitamente; `toolRegistry.ts` o transmite. O guard de identidade permanece e rejeita outro usuário. Novo teste `refreshReportFinancialEvidence.test.ts`. Sem alterar schema, RLS, motores, custos ou dados de Production.
- **Validação:** 26 testes direcionados PASS. Comparação Deno das árvores isoladas sem diagnósticos novos: 171/180 diagnósticos baseline respectivamente Inputs/Chat; não se declarou typecheck geral limpo. Compilação/publicação das funções passou. Staging com API real, sessão por senha e HTML/assets publicados verificados; APIs não foram mockadas. Autosaves e rotas externas não necessárias foram bloqueados. Enterprise preservou o primeiro UNKNOWN, permitiu parcial explícito, mesmo pedido/artefato e PDF; PRO não exigiu lacunas financeiras opcionais e omitiu cenário não confirmado. PDFs preliminares de 2 páginas, sem fotos na fixture, com imóvel, fontes/ausência de fontes e limitações verificados; mapas externos bloqueados nessa bateria.
- **Production:** Inputs v17, ESZIP `ae334fcf11ac21d217177cd0f3687154277846dbe39f737949217cc728d90e29`; Chat v105, ESZIP `1325275382e60c6491fdc1d30093866c10319db294f48f95dd4280265f784340`. JWT true nos dois; hashes iguais aos candidatos de staging. Os quatro grafos recuperados confirmaram alteração somente dos dois módulos previstos. Smoke: 13 checks PASS, incluindo 401 sem sessão e hashes Gmail preservados; nenhum teste autenticado/escrita em dados Production foi alegado.
- **Rollback específico:** fontes anteriores e ESZIPs preservados em `.tmp-codex/first-unknown-fix-20261121/rollback/{maxxis-analysis-inputs,maxxis-chat}/`; versões anteriores 16/104, hashes `31f75498cc51268c1b9dd17bfb376784ff8f413d4f4e07a37678ef671e050d4f` e `240a3c1547bedb548ff87748e78b9eb2392e1a88fa5649c2df12254200b49a81`. Reimplantar só a função afetada a partir desse snapshot; rollback frontend separado `dpl_6nbp4AfM2rxL84wXRUL4xECtUhVD`.

### Exceções expressamente autorizadas e preservação

- Somente staging: criação da função ausente `ds_unlock_maxxis_report(uuid,text,text,jsonb)`, corpo igual ao publicado em Production, dry-run/rollback antes, execução authenticated-only. Nenhuma tabela/RLS/histórico de migration alterado. Custos 3/5 preservados; sem crédito/entitlement manual.
- Somente staging: a rotina existente expirou exclusivamente `93abfa2c-0fda-4b8b-911b-e3ffe601982e`, com validade terminada em setembro; reconferência antes mostrou um expirável e zero exclusões. Nenhum registro apagado.
- Teto revisado aprovado: exclusividade 21 e rodada 30, exatamente respeitados. Saldo legítimo do investidor 31, final 1. Duas contas e quatro registros sintéticos mantidos; exclusividade QA de 7 dias expira automaticamente em 28/11, sem acesso premium de plano indefinido. Não remover fixtures antes do aceite visual nem restaurar saldo por SQL.
- Configuração Stripe TEST temporária encerrada; nenhum segredo em documento versionável. Chaves locais do proprietário não foram alteradas. Preços/produtos TEST e ledger são trilha histórica, não catálogo LIVE. Funções de pagamento não foram redeployadas.
- Os checkouts reais confirmaram pagamento/webhook; o navegador foi encerrado após a confirmação API, sem certificar renderização da tela de retorno autenticada. No replay P5, a resposta `ok` foi recebida antes de o leitor de QA tentar JSON e falhar; a reconciliação read-only comprovou o ledger/saldo invariantes. Não se inventou um status HTTP perdido nem se repetiu o replay.
- O alerta externo é PASS por confirmação explícita do proprietário: Hotmail, 21/11/2026 19:33, execução [44957302667](https://github.com/DealSifter/DealSifter_Match/actions/runs/44957302667). Não houve acesso à caixa, ampliação de scopes ou segundo disparo. Workflow cobre frontend Production e Edge configurado no staging; health direto separado cobriu Edge Production. Sentry natural compatível anterior foi reutilizado, sem alegar evento do novo fingerprint ou SLA integral.

<!-- OWNER_ACCEPTANCE_GMAIL_BEGIN -->
### LC‑02 — roteiro único de aceite do proprietário — 21/11/2026

**Resultado humano: PENDENTE — nenhum aceite foi atribuído ao proprietário.** As provas automatizadas anteriores permanecem válidas; não substituem esta conferência. Não se reabriram LC‑01, LC‑03, LC‑05 ou LC‑06.

Abrir **https://dealsiftermatch-pxx5h7mn8-deal-sifter-match-s-projects.vercel.app**. Este Preview usa staging e o candidato compatível já publicado; checkout TEST está desativado. Usar a conta QA existente **`r3-14946805-c4de-48a1-b15e-31f6fd06ff31-a@example.invalid`**, contato **R3 Fictional QA B**, imóvel **1200 Fictional QA Avenue**, UUID **`d3f15cc0-f5e5-431f-beeb-d3eb4b2d2a74`**. A senha existente está somente no arquivo local ignorado `.tmp-codex/r3-completion/fixtures.local`, entrada `label: A`; não enviar o arquivo ou a senha pelo chat. Não é necessário novo cadastro, compra ou unlock.

**Preparo QA autorizado e concluído:** o proprietário autorizou expressamente reabrir somente os três custos de posse/venda/financiamento. A gravação pela sessão QA legítima e RPC CAS existente avançou a revisão **44 → 45**, removendo somente os inputs `holdingCosts`, `sellingCosts`, `financingCosts` e suas disposições UNKNOWN anteriores. Demais premissas, parâmetros, saldo e os dois relatórios salvos foram comparados e preservados. O Preflight cache-only respondeu **200 / NEEDS_INPUT**, com as três perguntas e os três candidatos de estimativa disponíveis; nenhum custo foi confirmado pelo Codex. Sem compra, débito, email ou alteração em Production. Baseline e proposta preservados; recibo `.tmp-codex/owner-acceptance-20261121/estimated-context-rearmed.json`. Não restaurar automaticamente o contexto sobre respostas que o proprietário venha a fornecer; eventual restauração exige nova comparação e CAS. A conferência humana continua PENDENTE.

Executar a sequência abaixo com as lacunas agora preparadas, ou registrar precisamente o passo pendente:

1. **Matches → Portfólio.** Entrar com a conta QA, abrir **R3 Fictional QA B**, depois **1200 Fictional QA Avenue**. Conferir endereço, preço, características e vínculo do contato. Se aparecer cobrança de desbloqueio, parar e registrar PENDENTE; não comprar.
2. **Pedido Enterprise e “Não sei”.** No imóvel, abrir exportação → análise Maxxis → **Enterprise**. Anotar a referência do pedido/relatório exibida. Clicar **Não sei** nas perguntas de custos; verificar alternativas e as premissas necessárias. Nenhuma estimativa deve ser aceita automaticamente. Se abrir diretamente um relatório já salvo, isso não comprova a interação “Não sei”; registrar essa etapa como pendente.
3. **Primeiro, ramo parcial.** Escolher **Continuar com dados parciais** e, quando solicitado, **Gerar com limitações explícitas**. Conferir a identificação preliminar/parcial, os custos indisponíveis e indicadores que dependem deles sem números fabricados. Baixar o PDF parcial. Dados cadastrais disponíveis podem aparecer normalmente; valores fictícios ou estimados não devem parecer fatos verificados.
4. **Reload da mesma versão.** Anotar a referência e recarregar a página. Reabrir o relatório preparado pelo Maxxis, sem iniciar nova geração antes desta comparação. Conferir mesmo imóvel, referência, respostas e limitações e baixar novamente esse PDF. Reabrir um relatório salvo não deve gerar cobrança ou duplicar seu artefato.
5. **Ramo estimado.** Voltar ao mesmo imóvel e iniciar conscientemente uma nova análise Enterprise para rever as lacunas ainda não preenchidas. Essa nova solicitação pode ter referência nova; dentro dela a referência deve permanecer. Escolher **Não sei → Estimar e continuar**. Conferir valores, bases, origem e natureza hipotética antes de **Confirmar estimativas apresentadas e continuar**. Depois de confirmar, recarregar e conferir a persistência dessas premissas. Não inventar bases ausentes para fazer o botão avançar; nesse caso registrar PENDENTE com o campo solicitado.
6. **PRO e Enterprise/PDF.** Abrir os relatórios disponíveis sem nova compra, baixar ambos e conferir nome público, imóvel, conteúdo, cabeçalho, tamanho do texto, fotos/mapa quando disponíveis, cortes/sobreposições, paginação somente no rodapé, origem das estimativas e limitações. Comparar cada PDF ao respectivo pedido/versão; os dois produtos não precisam ter o mesmo conteúdo ou quantidade de páginas. Se aparecer cobrança, parar. Abrir o arquivo baixado, não somente considerar o clique como prova.
7. **Modal de envio — somente revisão.** No relatório preparado, conferir remetente do **perfil ativo**, destinatário escolhido/salvo, assunto e corpo editáveis, referência e PDF correspondente, além de fotos disponíveis. **Não confirmar envio.** A conta QA `.invalid` não tem Gmail; o bloqueio de envio nessa conta é esperado e não certifica remetente conectado/anexos de uma caixa real. Para essa parte residual, em **https://dealsiftermatch.vercel.app**, o proprietário pode abrir um relatório próprio já preparado com seu perfil Gmail elegível, revisar os mesmos campos e a lista de anexos e fechar o modal. Não gerar compra, enviar mensagem ou associar o PDF fictício a um relatório real. Se não houver relatório próprio já disponível, registrar essa parte como PENDENTE, sem criar acesso ou enviar email.

**Registro pelo proprietário:** `APROVADO`; ou `REPROVADO — passo, ação, resultado observado e esperado, URL/idioma/dispositivo`; ou `PENDENTE — passo e justificativa`. Para aprovação integral, incluir os dois ramos, reload, PDFs e revisão do modal elegível. O Codex não atribui aprovação humana nem interpreta silêncio como aceite.

### LC‑04 — Gmail OAuth: configuração efetiva e decisão comercial

Conferência somente leitura em 21/11/2026. A sessão não dispõe de Google Cloud Console autenticado, conector Google Cloud ou `gcloud`; por isso, não se inferiram as configurações do Console a partir de um envio bem-sucedido. Não houve consentimento novo, consulta de tokens/caixas de usuários, envio ou mudança de configuração.

| Campo | Evidência efetiva | Estado restante |
|---|---|---|
| Projeto | Nome **DealSifter** informado anteriormente pelo proprietário; prefixo do Client ID `409149808435` é pista para localizar o projeto. No retorno atual, o proprietário confirmou Client ID/callback e informou o nome exibido **DealSifter Email QA**, sem confirmar o tipo desse campo | Confirmar **Project ID/número** no Console; nome exibido do cliente/app não comprova Project ID, audiência ou verificação |
| Cliente Gmail Production | **`409149808435-mqlpklvr1p9ula48k82f427l0ucernof.apps.googleusercontent.com`**, confirmado por correspondência SHA‑256 com a configuração aplicada no backend Production | Localizar este ID exato em **Clients**, preservando outros clientes e URIs |
| Callback aplicado | `https://cyeipfskwwisbbayyaca.supabase.co/functions/v1/report-mailbox-oauth/callback` | Conferir sua presença no cliente exato, sem editar |
| User Type | Proprietário informou **EXTERNO**, após orientação para a tela Audience | Confirmado por relato humano; sem inspeção direta do Console |
| Publishing Status | Proprietário informou **Em produção**, após orientação para a tela Audience | Confirmado por relato humano; não equivale à aprovação de `gmail.send` |
| Verification | Captura mais recente: Branding verificado e aparecendo aos usuários; **O acesso aos dados do seu app está em análise**; equipe Google recebeu o formulário | Submissão recebida confirmada por captura; aprovação de acesso a dados ainda pendente. Não presumir aceite do vídeo, demais requisitos ou quotas |
| Scopes efetivamente solicitados | **`openid`, `email`, `https://www.googleapis.com/auth/gmail.send`**, recuperados do fonte publicado. Inclusão de `gmail.send` no Console especificamente autorizada e conclusão relatada pelo proprietário | Não confundir declaração salva com aprovação Google; runtime/scopes não foram alterados nesta entrega |
| Elegibilidade aplicada pelo app | Email do perfil ativo deve terminar em **`@gmail.com` ou `@googlemail.com`** e coincidir com a caixa autorizada; validações de sessão/conta existentes preservadas | Hotmail/Outlook, `.invalid` e domínios próprios Workspace não passam por este fluxo atual. Ter login Google por si só não basta |
| Usuários/consentimento | Proprietário esclareceu **3 de 100**: três usuários autorizados de um teto exibido de cem, não limite de três | Não confundir esse teto OAuth com quotas Gmail API ou mensagens/dia; verificação específica/advertências e políticas aplicáveis continuam pendentes |
| Quotas API efetivas | Captura do projeto exibido DealSifter, Gmail API ativada: **Units per minute 1.200.000** e **Units per minute per user 6.000**. Previous quota: 1.200.000 e 15.000, separadamente rotuladas | Limites por minuto confirmados por evidência visual do proprietário; nenhum ajuste realizado. Limites da caixa Gmail e condições diárias/faturamento não são certificados por essa tabela |
| Expiração/reconexão | Implementação publicada pede **`access_type=online`**, utiliza o prazo retornado pelo Google e não guarda refresh token; exige reconexão após expiração/revogação | Não anunciar conexão permanente ou envio desassistido. Não confundir expiração atual com regras de refresh token de apps Testing |

Fonte efetiva: bundle OAuth Production SHA‑256 `51666400132d4d9c53f4657be646e6ce6e8714af776e090509da7523df90b2bb`, inalterado. Foram recuperados somente o entrypoint e os módulos Gmail/perfil pertinentes; nenhuma nova auditoria de segurança. Evidência sanitizada: `.tmp-codex/owner-acceptance-20261121/oauth-readiness.json`.

**Classificação atual: LIMITED RELEASE — provisória, não aprovada como oferta pública.** O público comprovado continua restrito às contas do proprietário com conexão/uso anteriormente relatados, respeitando o email Gmail do perfil e a validade da autorização. Não há prova suficiente para **READY FOR PUBLIC LAUNCH**. Não foi demonstrado um bloqueio novo que justifique **NOT READY**; há informações obrigatórias ainda não confirmadas. Uma oferta limitada a novos usuários somente pode ser aprovada após definir a elegibilidade efetivamente permitida pelo Console e obter aceite explícito do proprietário para a comunicação/restrição. Os envios anteriores não foram reapresentados como novos testes em Production.

**Continuação em 23/11/2026:** após a autorização pontual, o proprietário mostrou a seleção exclusiva de `gmail.send` e a tela resultante com **Aprovação necessária**, campo **Como os escopos serão usados"** vazio e aviso de alterações ainda não salvas. Este é o estado mais recente e substitui a lista inicialmente vazia como estado de edição, sem afirmar persistência. Próximo passo autorizado: preencher a justificativa factual abaixo, salvar e conferir o estado resultante. Não enviar para verificação, alterar Branding ou executar envio de email. Justificativa preparada:

> O DealSifter Match utiliza gmail.send para enviar relatórios de imóveis pela conta Gmail conectada pelo próprio usuário. Antes do envio, o usuário revisa os destinatários, o assunto, o corpo e os anexos e confirma a operação. A mensagem inclui o PDF do relatório e, opcionalmente, fotos do imóvel, podendo ser enviada a um CRM escolhido pelo usuário. O aplicativo não lê, pesquisa, altera ou exclui mensagens da caixa de email. Os escopos básicos de identificação não permitem enviar emails; gmail.send fornece a permissão específica necessária, sem solicitar acesso mais amplo à caixa postal.

Salvar esta declaração não comprova aprovação da marca, aprovação de acesso a dados ou remoção do teto de usuários. LC‑02, quotas e eventual aceite comercial limitado continuam pendentes; gates já encerrados preservados.

### LC‑04 — checklist curto no Google Cloud Console — somente leitura

Abrir **https://console.cloud.google.com/** e manter o mesmo projeto selecionado em todas as telas. Não alterar status, scopes, clientes, URIs, quotas ou billing para preencher este checklist. Informar somente campos públicos/estados e valores agregados, sem chaves, tokens, client secrets, listas de usuários ou conteúdo de emails.

**Conferência guiada atual — uma tela por vez:** proprietário confirmou EXTERNO, Em produção e 3 de 100. A declaração exclusiva de `gmail.send` foi autorizada e sua conclusão relatada pelo proprietário; a verificação continua pendente. Campos legais da captura de Branding estavam vazios. As URLs públicas agora foram publicadas no domínio canônico Vercel com autorização específica, sem alterar Console, scopes ou backend. O domínio próprio está cadastrado na Vercel, mas seu DNS/encaminhamento externo no GoDaddy ainda impede os paths legais. As quotas por minuto foram posteriormente comprovadas pela captura registrada abaixo; não foram inferidas do teto OAuth de 100 usuários. Não submeter verificação ou mudar configurações Google automaticamente.

| Tela/caminho | Conferir e informar |
|---|---|
| Seletor de projeto → **IAM & Admin → Settings** (ou cartão **Project info** do Dashboard) | Nome, **Project ID** e número. Em **Google Auth Platform → Clients**, localizar o Client ID `...mqlpklvr1p9ula48k82f427l0ucernof.apps.googleusercontent.com` e confirmar o callback acima |
| **Google Auth Platform → Audience** | **User type**, **Publishing status**, OAuth user cap/usuários permitidos e se há restrição a test users ou organização; basta quantidade/estado, sem lista de emails |
| **Google Auth Platform → Data Access** e **Verification Center** | Scope `gmail.send`; status separado de **Brand** e **Data access**; aprovação desse scope, revisões pendentes, advertências ou limites. Se a UI apresentar nomes diferentes, informar exatamente o texto exibido |
| **APIs & Services → Enabled APIs & services → Gmail API** | API habilitada. Em **Quotas & System Limits**, registrar os **limites efetivos** por minuto/projeto e por minuto/usuário/projeto, eventuais cotas diárias, uso atual/overrides e avisos de restrição. Alternativa: **IAM & Admin → Quotas & System Limits**, filtro serviço `gmail.googleapis.com` |
| Gmail API / avisos do projeto e tipo de conta autorizada | Limites/restrições adicionais exibidos, eventual limiar diário/cobrança aplicável; categoria Gmail pessoal/Workspace/trial, sem identificar outras contas. Não solicitar aumento, ativar billing ou mudar plano |

Os caminhos de Audience/Data Access/Verification Center são documentados pelo [Google Auth Platform](https://support.google.com/cloud/answer/15544987); os caminhos para valores efetivos são os de [Cloud Quotas](https://docs.cloud.google.com/docs/quotas/view-manage). A autorização genérica do projeto Gemini não comprova aprovação do scope Gmail.

### LC‑04 — quotas API, limites da conta e comunicação comercial

- **API e projeto:** a referência pública atual informa **1.200.000 unidades/minuto/projeto**, **6.000 unidades/minuto/usuário/projeto** e **100 unidades por `messages.send`**. A própria página distingue projetos com uso anterior e quotas atualizadas a partir de maio/2026; também descreve limiar diário de 80.000.000 unidades antes de cobrança aplicável. Estes são valores de referência, **não leitura da quota deste projeto**, nem garantia de mensagens/dia ou custo zero. Conferir limites/avisos efetivos sem ativar cobrança. [Gmail API — Usage limits](https://developers.google.com/workspace/gmail/api/reference/quota).
- **Conta e entrega:** Gmail pessoal pode bloquear envio ao ultrapassar 500 mensagens/dia; o Google informa retomada possível entre 1 e 24 horas. Há ainda limites por destinatários, reputação e abuso. Uso por outros aplicativos também consome a capacidade da caixa; uma quota API livre não evita o limite da conta. [Limites Gmail](https://support.google.com/mail/answer/22839).
- **Workspace:** a referência geral indica até 2.000 mensagens/dia em contas pagas e 500 em trial, além de limites próprios de destinatários; isso não certifica cada conta e **não torna domínios próprios elegíveis no app atual**. [Limites Workspace](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace).
- **Consentimento:** `gmail.send` é **sensitive**, não um scope básico de login. External/Testing limita test users; External publicado mas não verificado pode manter advertência e teto de usuários. Publicação External com marca e scopes verificados permite audiência ampla, sujeita às políticas Workspace. Conferir também modo Personal, caso exibido. [Scopes Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [estados OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [Audience](https://support.google.com/cloud/answer/15549945).
- **Reconexão:** o fluxo online atual requer autorização válida para cada período de acesso; refresh automático/offline não foi implementado nesta entrega. [OAuth para aplicações Web](https://developers.google.com/identity/protocols/oauth2/web-server).

**Comunicação mínima proposta, ainda sujeita a aceite explícito para release limitado:** “Envio de relatórios pelo Gmail disponível para perfis elegíveis com endereço @gmail.com ou @googlemail.com, mediante conexão e confirmação do usuário. Sujeito às permissões e limites do Google; pode ser necessário reconectar. A exportação PDF permanece disponível.” Não anunciar suporte Outlook/Hotmail/domínios próprios, envio ilimitado, conexão permanente, entrega garantida ou acesso público antes de comprovar a audiência. Se Testing/Internal/unverified restringirem o público, acrescentar precisamente o grupo/limite permitido; não usar “todos os usuários Gmail”. Esta proposta é registro de fechamento, não alteração de UI ou aceite comercial implícito.

### Matriz final residual — somente LC‑02/LC‑04

| Item | Resultado | Evidência | Ação do proprietário |
|---|---|---|---|
| Aceite visual LC‑02 | **PENDENTE / OWNER ACTION** | Provas anteriores preservadas; preparo QA autorizado aplicado via CAS 44→45; três perguntas/estimativas disponíveis; relatórios e saldo preservados | Executar roteiro e registrar APROVADO, REPROVADO com defeito reproduzível, ou PENDENTE com justificativa |
| Gmail OAuth LC‑04 | **LIMITED RELEASE — provisório / OWNER ACTION** | Branding verificado/publicado; formulário recebido e acesso a dados em análise; quotas atuais confirmadas por captura: 1.200.000 unidades/min/projeto e 6.000/min/usuário | Acompanhar decisão Google e exigências; preservar escopo comercial compatível. A captura de quotas não comprova aprovação de acesso público |
| Oferta comercial compatível | **PENDENTE / OWNER ACTION** | Limites atuais de API conhecidos; Gmail pessoal do perfil, reconexão, limites da caixa e verificação Google continuam condicionando a oferta | Obter aprovação Google compatível com o público anunciado ou aprovar explicitamente uma oferta limitada com elegibilidade e comunicação comprovadas |
| Launch Decision | **CONDITIONAL GO** | Gates encerrados preservados; duas pendências humanas não convertidas em PASS | GO somente com aceite humano registrado e Gmail comprovadamente compatível com a oferta, incluindo aprovação explícita de eventual limitação |

Nenhum código, configuração, migration, commit, push ou deploy foi alterado nesta etapa. A única escrita remota foi o preparo da fixture QA expressamente autorizado, restrito aos três custos na revisão 44→45. Nenhuma compra, unlock ou mensagem foi executada. Atualizado somente este documento versionável; evidências, baseline e recibo da operação ficam no diretório privado ignorado indicado acima. Stash preservado; nenhum aceite humano atribuído pelo Codex.
**Atualização LC‑04 — URLs legais, 23/11/2026:** após a declaração autorizada de `gmail.send`, o proprietário informou ter concluído o preenchimento e recebido solicitação de verificação. Esse relato sucede o estado de edição não salvo descrito acima; aprovação Google continua pendente. A captura seguinte de Branding mostra os campos de homepage, privacidade e termos vazios. O checkout tem `TermsPage.jsx` e `PrivacyPolicyPage.jsx`, mas `src/App.jsx` inicia em `landing` e não resolve o pathname dessas páginas; links legais da homepage abrem modais. Não há documento legal estático em `public`. Portanto, não há URL direta comprovada nessa implementação para fornecer ao Google; HTTP 200 do fallback SPA não basta. Proposta mínima: expor `/privacy` e `/terms`, reutilizar textos existentes, garantir acesso anônimo após reload e links públicos na homepage, validar e publicar somente a correção. Isso exige autorização específica porque a missão atual determina “Atualizar somente os registros de fechamento” e “Não executar novo commit, push, deploy ou migration por padrão”. Nenhum código, configuração Google ou deploy foi alterado. Domínio público de propriedade verificável ainda deve ser confirmado antes de preencher Branding. [Requisitos oficiais Google](https://developers.google.com/identity/protocols/oauth2/policies). LC‑02 e quotas continuam pendentes; CONDITIONAL GO mantido.


### LC‑04 — publicação pontual das URLs legais autorizada em 23/11/2026

O proprietário respondeu **“autorizado”** à proposta de implementar, validar e publicar somente os acessos públicos. Páginas **https://dealsiftermatch.vercel.app/privacy** e **https://dealsiftermatch.vercel.app/terms** publicadas; homepage **https://dealsiftermatch.vercel.app/**. Reutilizam os componentes e textos existentes; links do footer agora são hyperlinks reais. A inicialização reconhece somente os dois paths legais e limpa o path ao sair por navegação interna, preservando query/hash. Nenhuma regra comercial, autenticação, configuração de segurança, banco ou função alterada. Sem commit/push/migration.

**Validação:** lint direcionado PASS; TypeScript contratos PASS; 10/10 testes existentes do footer/inicialização PASS; build isolado offline e varredura de segredos PASS. Comparação do candidato com o snapshot anterior confirmou mudança exclusivamente em App.jsx e Landing.jsx, textos legais e public assets iguais. Navegador: **18/18** casos locais e **18/18** em Production — duas páginas × EN/PT/ES × desktop/tablet/mobile; acesso anônimo direto, reload, conteúdo/seções, retorno por teclado, links no footer e ausência de overflow horizontal. HTML e assets legais publicados comparados aos hashes do candidato; não se usou apenas HTTP 200 de fallback como prova. Requisições externas e escritas bloqueadas no navegador; zero emails/compras/chamadas pagas. Não houve novo teste autenticado ou aceite visual humano.

**Publicação efetiva:** dpl_Ai7NXQNG4j4KznfQJegX1ZiASMAX, READY, fingerprint d95113d2c7b6cb0a04327b6409515582cdcc5f43c506aea792e0192008f567b9; domínio canônico confirmado pelo projeto Vercel. Rollback preservado: dpl_sMdDKzasEJXwq959SRUpmJNcthn4. Evidências privadas ignoradas: source.json, source-scope.json, production-build.json, browser.json, production.json e production-smoke.json em `.tmp-codex/legal-public-release-20261123/`.

**Bloqueio separado de domínio:** Vercel lista dealsifter.com como domínio associado/verificado, mas sua consulta DNS retorna misconfigured=true. HTTP público de dealsifter.com/ redireciona 301 para o host Vercel; /privacy e /terms retornam 404 no encaminhamento externo. O proprietário confirmou **GoDaddy** como provedor. Verificação Vercel não equivale a comprovação de propriedade Google/Search Console. Nenhum DNS, encaminhamento, MX/TXT, CORS ou configuração OAuth foi alterado. Ainda não se devem apresentar https://dealsifter.com/privacy e /terms como URLs funcionais. Aguardar conferência da tela de Encaminhamento para preparar a operação exata, preservando email e demais registros. [Requisitos Google](https://developers.google.com/identity/protocols/oauth2/policies), [orientação GoDaddy](https://www.godaddy.com/help/remove-my-domain-forwarding-19979).

LC‑02 permanece **PENDENTE**; LC‑04 permanece **OWNER ACTION**. Quotas e aprovação Google não certificadas. **CONDITIONAL GO mantido**, demais gates encerrados preservados.



**Conferência DNS do proprietário — 23/11/2026:** captura mostra A @ — 15.197.225.128 e 3.33.251.168, ambos sem edição disponível; NS ns27/ns28.domaincontrol.com e CNAME www — dealsifter.com. Encaminhamento para o host Vercel confirmado pelo proprietário. Antes de orientar a troca, preflights OPTIONS reais, anônimos e sem payload/dados, verificaram as duas origens https://dealsifter.com e https://www.dealsifter.com: report-mailbox-oauth e report-mail-delivery retornaram 403 sem Access-Control-Allow-Origin; maxxis-analysis-inputs retornou 200 sem esse header; maxxis-chat devolveu 200 com a origem correspondente. Portanto, não orientar remoção do encaminhamento antes de preparar as origens exatas. Isto — uma restrição da mudança de domínio proposta, não regressão confirmada do host canônico já publicado. Proposta para aprovação específica: associar www ao mesmo projeto Production e acrescentar somente as duas origens exatas em MAILBOX_ALLOWED_ORIGINS e PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS, preservando entradas existentes; sem código, scopes, callback, banco ou envio. Depois, orientar no GoDaddy a substituição do encaminhamento pelos A recomendados pela Vercel, preservando NS/MX/TXT e CNAME www. Nenhuma alteração remota executada.



### LC‑04 — preparação de domínio autorizada e concluída, 23/11/2026

O proprietário respondeu **"autorizo"** — preparação exclusiva das duas origens e associação de www. Foram acrescentadas **https://dealsifter.com** e **https://www.dealsifter.com** a MAILBOX_ALLOWED_ORIGINS e PROPERTY_INTELLIGENCE_ALLOWED_ORIGINS em Production, preservando exatamente a origem anterior **https://dealsiftermatch.vercel.app**. O valor anterior foi reconstruído e conferido pelo SHA‑256 remoto antes da escrita, com rollback local. Todos os demais secrets têm hashes preservados; não houve alteração de cliente/segredo Google, scopes, callback, banco, cobrança ou autenticação.

**www.dealsifter.com** associado ao mesmo projeto Vercel, verified=true; associações anteriores e deployment **dpl_Ai7NXQNG4j4KznfQJegX1ZiASMAX** preservados. Não se alteraram DNS/encaminhamento no GoDaddy. A API Vercel confirma A recomendados de prioridade 1 **216.198.79.1** e **64.29.17.1**. Orientação ao proprietário: remover somente o encaminhamento, criar/ajustar os dois A @ recomendados em substituição aos A antigos 15.197.225.128 e 3.33.251.168, preservar CNAME www — dealsifter.com e demais registros NS/MX/TXT. Conferência pública de DNS/HTTPS/paths ainda depende dessa operação manual; não declarar domínio pronto antes dela.

**Validação: 17/17 PASS.** Doze preflights — três origens — quatro funções — aceitaram apenas a origem exata; três preflights de origem hostil não receberam Access-Control-Allow-Origin; dois POST de status sem login foram recusados com 401. Nenhum email, conexão de caixa, consulta privada, compra ou chamada paga foi realizado. Sem alteração de código/novo build/deploy frontend/commit/push/migration.

**Efeito da plataforma:** o POST autorizado de secrets incrementou automaticamente em +1 as versões das 28 funções. O primeiro guard esperava versões imutáveis e interrompeu antes de associar www; a inspeção dos campos ezbr_sha256 e verify_jwt comprovou preservação de código/JWT em todas as 28. A retomada não regravou secrets. O primeiro teste de autenticação usou GET, rejeitado corretamente com 405; corrigido somente o método do teste para POST, que comprovou 401. Nenhum código de produto foi alterado para passar esses checks.

Evidências privadas ignoradas em `.tmp-codex/legal-public-release-20261123/domain-preparation/`: cors-proposal.json, backups de metadados/secrets, function-preservation.json, www-associated.json, initial-check.json, applied.json e domain-dns.json. Stash preservado. **LC‑02 pendente; LC‑04 continua OWNER ACTION — DNS, verificação e quotas Google. CONDITIONAL GO mantido.**



**Conferência após criação dos A — 23/11/2026:** proprietário informou "criados". Consulta direta aos dois servidores autoritativos do GoDaddy (ns27/ns28.domaincontrol.com) confirmou quatro A @: os novos 216.198.79.1 e 64.29.17.1 e os antigos 15.197.225.128 e 3.33.251.168. Os registros antigos continuam efetivamente publicados, além de eventual cache. Na verificação HTTPS, ambos os hosts ainda responderam pelo encaminhamento: homepage 301 para Vercel e paths legais 404. Orientar remoção somente do encaminhamento/antigos A, mantendo os dois novos, CNAME www e demais registros. Nenhuma exclusão/alteração DNS executada pelo agente. Evidência privada: domain-preparation/dns-after-owner-create.json. LC‑04 e decisão CONDITIONAL GO preservados.



### LC‑04 — domínio próprio e URLs legais públicos confirmados, 23/11/2026

Após o proprietário informar **"ok... excluidos"**, ambos os servidores autoritativos ns27/ns28.domaincontrol.com passaram a publicar somente **216.198.79.1** e **64.29.17.1**. Vercel confirmou misconfigured=false/configuredBy=A nos dois hosts. Os testes iniciais ainda receberam respostas do encaminhamento antigo e/ou conexão fechada. A listagem da Vercel não encontrou certificados; foi solicitada a emissão padrão gerenciada para **dealsifter.com** e **www.dealsifter.com**, necessária — conexão HTTPS autorizada, e a CLI confirmou criação com sucesso. Não houve alteração de OAuth, secrets de cliente, scopes, callback, autenticação, código ou dados.

**6/6 páginas públicas PASS no navegador, com validação normal de certificado e sem login:** /, /privacy e /terms em dealsifter.com e www.dealsifter.com. Todos os documentos responderam 200 na mesma origem e com HTML do candidato publicado; páginas legais apresentaram título/conteúdo esperado e reload. Footer apontou para os dois hyperlinks. Bytes do entrypoint efetivamente recebidos pelo navegador nos dois hosts têm SHA‑256 **61311f675c57514c16722770802074785749e0997380feaf88ad14dc6bb1fa39**, igual ao candidato. A consulta auxiliar por transporte independente falhou no gate de hash; mantida em domain-public-smoke-initial.json e substituída por prova explícita dos bytes da rede do navegador, sem alteração de produto. Nenhum pageerror, email, chamada paga ou escrita em dados.

**Links definitivos disponíveis para Branding Google:** homepage **https://dealsifter.com/**; política **https://dealsifter.com/privacy**; termos **https://dealsifter.com/terms**. Configuração desses campos e submissão no Google não foram executadas pelo agente. HTTPS/DNS públicos não equivalem a verificação da marca/escopo Google ou quotas comerciais aprovadas.

Evidências privadas em `.tmp-codex/legal-public-release-20261123/domain-preparation/`: dns-after-owner-delete.json, domain-state-after-dns.json, domain-public-smoke.json, domain-assets.json e domain-ready.json. Deployment frontend preservado **dpl_Ai7NXQNG4j4KznfQJegX1ZiASMAX**; stash preservado; sem commit/push/migration. **Pendência técnica de URLs/DNS/HTTPS encerrada. LC‑02 permanece PENDENTE; LC‑04 segue OWNER ACTION para verificação Google/quotas e compatibilidade comercial. CONDITIONAL GO mantido; demais gates fechados.**



**Homepage histórica Hotmart — 23/11/2026:** proprietário identificou https://dealsifter.hotmart.host/landing-page-dealsifter como vínculo antigo. Leitura pública confirmou uma landing page histórica da Hotmart, em hostname próprio da plataforma, distinta de dealsifter.com. DNS autoritativo atual mantém somente os dois A da Vercel, CNAME www para o domínio raiz e nenhum AAAA; não se alteraram registros. Orientação restrita: em Hotmart Pages — Minhas páginas, localizar essa página e usar o menu de três pontos — Despublicar, preservando o conteúdo; operação não executada pelo agente e ainda não confirmada pelo proprietário. No Branding Google, homepage permanece https://dealsifter.com/. A existência da URL interna antiga não comprova apontamento DNS atual para a Hotmart.



**Despublicação Hotmart confirmada — 23/11/2026:** proprietário informou "OK... despublicada". Conferência pública no navegador confirmou HTTP **404** e mensagem de página inexistente/fora do ar em https://dealsifter.hotmart.host/landing-page-dealsifter. Em paralelo, https://dealsifter.com/privacy e /terms responderam **200** com títulos/conteúdo corretos. Despublicação realizada pelo proprietário, não pelo agente; nenhuma exclusão de conta/produto ou mudança de DNS/código. Evidência privada: domain-preparation/hotmart-unpublished-check.json. Homepage para Branding continua https://dealsifter.com/. LC‑02 e verificação/quotas Google permanecem pendentes; CONDITIONAL GO mantido.



**Branding salvo; comprovação de propriedade Google pendente — 23/11/2026:** captura do proprietário confirma homepage https://dealsifter.com/, política /privacy, termos /terms e aviso de alterações de marca salvas. O painel de problemas da tentativa anterior informa que a homepage não está registrada para o usuário e solicita verificar propriedade e aguardar 24 horas antes de nova tentativa. A opção de contestação estava selecionada na captura; não foi presumida nem executada submissão. Pr"ximo passo: conferir/criar propriedade Domínio dealsifter.com no Google Search Console com conta do projeto e verificar propriedade via DNS, conforme fluxo Google; esta etapa não equivale — validação Vercel já concluída. Nenhum registro TXT, conta Google ou análise foi alterado pelo agente. Proprietário também confirmou que a abertura normal do domínio foi resolvida após teste privado/limpeza do redirecionamento antigo. LC‑02 e quotas continuam pendentes; CONDITIONAL GO mantido.



**Propriedade Google — confirmação do proprietário, 23/11/2026:** após orientação para adicionar a propriedade Domínio dealsifter.com no Search Console, o proprietário informou **"verificação realizada"**. Registrar como confirmação humana da etapa de propriedade, sem inspeção independente de status e sem converter em aprovação de Branding ou gmail.send. A captura anterior determina aguardar 24 horas após a verificação de propriedade antes de repetir a análise de marca; somente depois, usar "Corrigi os problemas" para nova tentativa, em vez de contestar sem nova evidência. Nenhuma submissão/configuração Google foi executada pelo agente. Enquanto isso, permanece autorizada a conferência somente leitura de Gmail API — Cotas e limites do sistema no mesmo projeto. Quotas reais e aceite LC‑02 continuam pendentes; CONDITIONAL GO mantido.



**Branding aprovado/publicado; acesso a dados pendente — 23/11/2026:** nova captura do proprietário comprova a mensagem **"Sua marca foi verificada e está aparecendo para os usuários"**. A etapa de marca/propriedade não exige nova tentativa ou espera adicional com base nesse estado. A outra captura, em Acesso a dados, mostra gmail.send listado como confidencial e **Aprovação necessária**, com banner solicitando análise e botão **Acessar a Central de verificação**. Pr"ximo passo guiado: abrir essa Central e conferir os requisitos de acesso a dados antes de submeter; não remover/substituir gmail.send, alterar cliente/scopes, aguardar Branding já concluído ou declarar Gmail público aprovado. Nenhuma alteração/submissão no Console executada pelo agente. Quotas reais, confirmação da aprovação de dados e aceite LC‑02 ainda pendentes; CONDITIONAL GO mantido.



### LC‑04 — vídeo de demonstração necessário; roteiro preparado, 23/11/2026

Capturas do proprietário confirmam Acesso a dados não verificado; em Prepare-se para a verificação, o bloqueio explícito — **vídeo de demonstração faltando**, enquanto a justificativa de gmail.send está preenchida. Link do vídeo: Não fornecido. Não inferir que esse seja o único requisito posterior da análise Google. Nenhuma submissão foi feita pelo agente.

**Roteiro para gravação real pelo proprietário:** (1) abrir https://dealsifter.com/ com barra do navegador e marca visíveis; (2) mostrar o acesso ao app e, se houver fluxo Google Sign-In no escopo do app/projeto, incluí-lo também; (3) usar um relatório já disponível e sem dados de terceiros, abrir envio Gmail e iniciar/reiniciar conexão pelo recurso existente; (4) mostrar o fluxo OAuth completo e consentimento Google em English, incluindo a permissão Send email on your behalf, com retorno ao app e caixa conectada; não gravar senhas/códigos/tokens; (5) revisar remetente, destinatário próprio, assunto, corpo editável e PDF anexado, mais fotos se escolhidas; (6) somente com confirmação manual do proprietário, efetuar envio de demonstração para caixa própria e mostrar a mensagem/anexo, sem automatizar envio pelo agente; (7) disponibilizar a gravação em YouTube como Não listado e inserir o link no campo exigido. Roteiro não — evidência de execução: nenhuma conexão, reconexão, geração paga ou mensagem foi executada pelo agente; nenhum vídeo foi fabricado ou mockado. Não alterar scopes/clientes para dispensar a gravação.

**Requisitos oficiais:** mostrar o app real, todos os fluxos OAuth pertinentes, consentimento completo em inglês com os mesmos scopes solicitados e funcionalidades que efetivamente usam essas permissões. Narração/legendas ajudam, sem exigência de produção promocional. Refer"ncias: [vídeo Google](https://support.google.com/cloud/answer/13804565), [verificação de scopes sensíveis](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). Ferramenta de Captura do Windows 11 pode gravar região de tela via Win+Shift+R; selecionar uma região que inclua o navegador e a janela OAuth.

Branding permanece concluído. Vídeo, submissão/decisão de acesso a dados, quotas e aceite LC‑02 pendentes; **CONDITIONAL GO mantido**. Nenhum commit/push/deploy/migration ou alteração de código nesta etapa.



### LC‑04 — submissão de acesso a dados recebida pelo Google, 23/11/2026

A captura mais recente mostra Branding verificado/publicado e **"O acesso aos dados do seu app está em análise"**. O painel Progresso da verificação informa que a equipe de Confiabilidade e Segurança recebeu o formulário e poderá contatar o email cadastrado. A tela estima **3 a 5 dias para o primeiro email** e **4 a 6 semanas para a revisão**; são estimativas exibidas nessa solicitação, não garantia de prazo, e a unidade de dias não foi inferida como dias úteis. A tela diz ainda que a última tela de permissão aprovada permanece em uso.

Este estado sucede o bloqueio anterior de vídeo faltante: a submissão foi recebida, mas a captura não comprova aprovação do vídeo, escopo, privacidade ou demais requisitos e não identifica o link eventualmente enviado. Não repetir submissão, alterar configuração ou afirmar que gmail.send foi aprovado por inferência. A ação foi realizada pelo proprietário; nenhum formulário/email foi enviado pelo agente. Orientação: acompanhar o contato cadastrado, responder "s solicitações Google e preservar a configuração submetida enquanto não houver exigência de correção.

Quotas efetivas Gmail API e aceite visual humano LC‑02 continuam pendentes. Classificação Gmail permanece **LIMITED RELEASE provisório**, sem aprovação comercial ampla ou aceite explícito de restrição pelo proprietário; **CONDITIONAL GO mantido**. Nenhum código, commit/push/deploy/migration ou teste com envio nesta atualização.



### LC‑04 — quotas atuais conferidas por captura, 23/11/2026

O proprietário confirmou acesso ao projeto pela conta **tarso.canto71@gmail.com** e forneceu captura de **APIs e serviços → gmail.googleapis.com → Cotas e limites do sistema**, projeto exibido **DealSifter**, API **Ativado**. A tabela contém quatro linhas: **Previous quota: Units per minute = 1.200.000**; **Units per minute = 1.200.000**; **Previous quota: Units per minute per user = 15.000**; **Units per minute per user = 6.000**. Registrar como limites atuais **1.200.000 unidades/minuto/projeto** e **6.000 unidades/minuto/usuário/projeto**. Não somar linhas Previous quota às atuais ou anunciar 15.000 como limite atual por usuário. A captura mostra uso de projeto 0/0%; não estabelece SLA ou capacidade de entrega de emails.

A documentação oficial informa que Gmail API contabiliza unidades por método e que messages.send consome 100 unidades. Não converter a tabela em garantia de emails por minuto/dia: a caixa Gmail possui limites diários e controles próprios. Nenhum ajuste de quota, ativação do ajustador, alteração de faturamento, teste de carga ou envio foi realizado. A captura não mostra um valor diário nem condições de faturamento aplicadas ao projeto; a referência geral de limiar diário não foi promovida a configuração efetiva sem evidência. A confirmação é visual, fornecida pelo proprietário, sem acesso administrativo do agente ao Console.

**Conferência dos limites atuais por minuto encerrada.** Permanecem em aberto a decisão Google de acesso a dados e o aceite humano LC‑02; a classificação Gmail continua LIMITED RELEASE provisório, não aprovado como oferta pública ampla. **Launch Decision: CONDITIONAL GO.** Não reabrir gates encerrados ou alterar o produto. Referências: [quotas Gmail API](https://developers.google.com/workspace/gmail/api/reference/quota), [limites da caixa Gmail](https://support.google.com/mail/answer/22839).
#### Regressão relatada pelo proprietário — identidade do remetente — 23/11/2026

O proprietário relatou que um Gmail já cadastrado só foi reconhecido após reabrir e salvar o onboarding. Consulta dirigida, somente leitura, confirmou que a conta relatada tem Gmail no perfil profissional B, com prioridade `primary`, e email pessoal A vazio. Não se consultaram mensagens ou tokens nem se alterou esse cadastro. Como o proprietário já havia salvado novamente, a consulta não reconstrói o conteúdo anterior ao incidente.

Foi identificada uma falha reproduzível no frontend: o escopo do remetente era derivado de `onboardingInitialTab`, inicializado como `personal`. Assim, antes de visitar o cadastro profissional, o modal consultava A vazio, embora B fosse principal. Abrir a aba profissional mudava o escopo consultado; reescrever o email não era necessário para essa mudança. O defeito afeta o mesmo caminho compartilhado de Basic, PRO e Enterprise.

Correção local restrita: seleção inicial pelo perfil principal da categoria de conta; escolha explícita de perfil preservada e vinculada ao usuário da sessão, com limpeza na transição de usuário. Sem escolher outro perfil por ter Gmail, sem usar email do login e sem recuperar um email explicitamente apagado. As permissões e validações do backend permanecem preservadas. Validação local: **45/45 testes em cinco arquivos**, incluindo Basic/PRO/Enterprise, reload do estado salvo, prioridade, escolha explícita e rejeição de perfil vazio/não Gmail; lint dos quatro arquivos alterados PASS; `tsconfig.contracts.json` PASS (somente contratos); build offline do candidato isolado PASS; `git diff --check` PASS; stash preservado. Recibos: `.tmp-codex/gmail-profile-fix-20261123/validation.json` e `build.json`. Não houve conferência visual autenticada desta correção nem publicação. Nenhum envio, compra, migration, commit, push ou deploy foi executado nesta investigação. A verificação Google continua em análise; LC‑02 continua dependendo de aceite humano e a decisão geral permanece CONDITIONAL GO.

#### Correções autorizadas e preparação de publicação — 24/11/2026

O proprietário solicitou corrigir os lembretes dos botões de salvar em todo o app e, em seguida, realizar commit e deploy geral em Production. Durante o trabalho, acrescentou avatares dos perfis A/B nos badges My Cards da sidebar mobile, preservando o desenho e a disposição existentes. Essa autorização inclui a correção de seleção do perfil Gmail descrita acima. Não autoriza compras ou envios de teste.

O onboarding tinha uma corrida de inicialização: o temporizador da referência inicial podia absorver a primeira edição como se já estivesse salva. A referência agora é estabelecida antes da interação e a diferença é calculada no mesmo render. O efeito foi extraído para um botão compartilhado usado nos salvamentos de perfil, imóveis, serviços, investimento, revisão de comparáveis ARV e confirmação de dados do Maxxis/revisão do imóvel. Alterações do novo registro destacam o botão de adicionar ao portfólio, sem marcar o salvamento de perfil não relacionado. O modal de investimento deixou de indicar alteração permanentemente. Validação recusada preserva o lembrete; desfazer a alteração o remove. Salvamento automático existente permanece automático. Movimento reduzido usa destaque estático.

Na sidebar mobile, os avatares usam a identidade já resolvida de cada My Card, com 34 px como os anúncios redondos da barra rolante. Preservados grid de dois badges, rótulos, contadores, cores e ações; somente altura/padding dos badges foram ajustados. Foto indisponível usa ícone neutro, sem emprestar foto de outro perfil.

Validação: lint completo de `src` PASS, checagem dos contratos TypeScript PASS e regressões direcionadas PASS após corrigir os casos reproduzidos. As execuções concorrentes tiveram timeouts; os casos afetados passaram novamente com um worker e limite de 20 s. Conferência no Edge dos componentes reais renderizados em SSR/CSS: oito casos (320/390/768/1440 px × claro/escuro), animação, destaque estático em movimento reduzido, avatares de 34 px e ausência de overflow nos badges, todos PASS. Essa prova de componentes não substitui o aceite humano LC‑02 nem uma nova sessão autenticada em Production. Um harness Vite de página completa não concluiu a navegação e foi interrompido; não foi contado como PASS. Evidências locais ignoradas em `.tmp-codex/save-reminder-release-20261123/`.

**Publicação efetiva concluída:** dpl_AFHx1AFTwsTuGnXWyV5khESJ23bn, READY, código 4e5cc98b4211e6b412a93b50450cc0dea9aab029, fingerprint 63837bdec969653cdb86bf79f6c3aa7be5c9f9c2ecdb55aa92f2de31c60f0e03. Build offline e varredura de segredos PASS. 6 casos de navegação do build e 6 em Production PASS; HTML e assets comparados ao candidato. Domínios dealsifter.com/www: 6 acessos HTTPS a homepage/privacy/terms PASS, com hashes de Dashboard e Onboarding publicados confirmados. 8 provas visuais de componentes PASS. Funções backend 28/28 preservadas. Commit geral realizado; nenhum push, email, compra, migration ou mudança de configuração nesta rodada. A análise Google de acesso a dados continua pendente; LC‑02 não foi aprovado pelo Codex e a decisão comercial permanece CONDITIONAL GO.

<!-- OWNER_ACCEPTANCE_GMAIL_END -->

### Índice único de evidências e limites

Recibos privados ignorados em `.tmp-codex/launch-final-20261121/`: `marketplace-authenticated.json`, `feed-filters.json`, `marketplace-browser.json`, `scoped-profiles-browser.json`, `normal-unlock.json`, `premium-analysis.json`, `premium-deal.json`, `exclusivity-purchase.json`, `checkout-{p5,pro,cancel}.json`, `replay-{p5,pro}.json`, `webhook-rejections.json`, `subscription-cancel.json`, `stripe-test-retirement.json`, `paid-report-browser.json`, `paid-pro-report-browser.json`, inspeções dos dois PDFs e `external-alert-receipt.json`. Correção/publicação: `.tmp-codex/first-unknown-fix-20261121/`, manifests de source, deploy, delta e smoke. Evidência LC‑05, footer/idiomas/Pricing anterior reutilizada; nenhum redesenho ou bateria geral repetida.

Histórico e stash preservados. Não há commit/push novo; não incluir segredos, PDFs/PNGs de QA ou os 37 commits históricos em publicação indiscriminada. **Nenhum bug conhecido ficou aberto nos casos executados; LC‑02 e LC‑04 continuam ações humanas, não PASS automático.**


<!-- CURRENT_LAUNCH_CLOSEOUT_END -->

<!-- P03R_PRIOR_PROGRESS_HISTORY -->
<details>
<summary>Histórico de progresso anterior ao encerramento P‑03R — não vigente</summary>


## Fechamento vigente — 21/11/2026

### Resumo executivo — decisões para o lançamento

**Decisão técnica atual: NO-GO para lançamento comercial pago irrestrito.** Não foi comprovado um defeito de cobrança; ainda faltam as transações Stripe TEST indispensáveis e a confirmação de recebimento externo do alerta, exigida pelo proprietário. As correções técnicas validadas estão em Production; não há motivo para desfazê-las por esse gate comercial.

Production: https://dealsiftermatch.vercel.app, deployment **`dpl_sMdDKzasEJXwq959SRUpmJNcthn4`**, READY. Base `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262` mais delta isolado, fingerprint **`07e460378a5c3b83ce87511f72efad5d6f8ded7013ba342f7337fbb2fe3ba00d`**. Rollback frontend `dpl_6nbp4AfM2rxL84wXRUL4xECtUhVD`. Não se atribuiu código sem commit ao SHA da base. Branch `fix/production-real-defects`, HEAD documental `21e6b7787f168abadc73388489c328eace387a60`; 37 commits locais históricos sem push; stash preservado. Manifesto sanitizado identifica os 13 arquivos do delta e os hashes.

LC‑05 está encerrado tecnicamente, com evidência recente reaproveitada. O item IN GOD WE TRUST mantém posição e acessibilidade e agora acompanha EN/PT/ES: KJV, Almeida Revista e Corrigida e Reina-Valera 1909. A comparação de planos foi corrigida para os limites que servidor e catálogo já aplicavam: Basic 20 swipes/dia e PRO 15 Matches ativos; preços, permissões e regras não mudaram.

P‑03R foi **autorizado somente no staging/Stripe TEST**. Duas contas e três registros fictícios foram criados; isolamento, publicação, edição e filtros passaram. Unlock normal concorrente debitou uma única vez 1 Nugget. Checkout, plano, exclusividade e aquisição premium continuam pendentes: a reconferência de `.env.local` encontrou somente chaves LIVE, que não foram usadas ou copiadas. O arquivo separado para TEST está preparado e ignorado pelo Git.

P‑05R foi autorizado e executado uma única vez. Frontend e Edge responderam 200; a falha intencional `CONTROLLED_OBSERVABILITY_ALERT` foi gerada. Recebimento externo ainda requer confirmação do proprietário. OAuth Google foi declarado pelo proprietário como **em produção e verificado**; a quota efetiva do projeto permanece sem comprovação. Falta também o aceite visual humano final. Até esses pontos serem encerrados, não certificar vendas irrestritas, alerta externo ou homologação humana; PDF continua alternativa existente ao Gmail.

### Matriz vigente GO/NO-GO

Esta matriz substitui os estados históricos abaixo; os registros antigos foram preservados como histórico.

| Gate | Resultado | Evidência | Bloqueante? | Ação restante |
|---|---|---|---|---|
| LC‑01 | PASS | Alias/READY/fingerprint; HTML e assets reais; quatro bundles backend, Maxxis e worker conferidos | Não no escopo técnico publicado | Manter manifesto; não confundir snapshot com commit/push |
| LC‑02 | OWNER ACTION | Percursos autenticados estimado e parcial/contextual anteriores compatíveis; LC‑05 UI e PDF PASS | Sim para declarar aceite humano | Proprietário executar o checklist único abaixo |
| LC‑03 | NOT VERIFIED | P‑03R autorizado; novas provas reais de RLS/marketplace/filtros e unlock concorrente; Stripe TEST ainda não executado | Sim, indispensável à venda paga | Fornecer chaves TEST; concluir dois checkouts, cancelamento, duplicados e aquisições/exclusividade |
| LC‑04 | OWNER ACTION | Proprietário: Google em produção e verificado; scopes/reconexão existentes preservados | Sim para certificar oferta Gmail sem limites conhecidos | Registrar quota/restrições efetivas do projeto, sem novos scopes ou tokens |
| LC‑05 | PASS | 8.192/8.193 bytes reais, CAS/RLS/contexto/reload/PDF, diagnóstico HTTP 422; backend/publicação compatíveis | Não | Nenhuma repetição de bateria necessária |
| LC‑06 | OWNER ACTION | Health direto dos dois ambientes; Sentry existente; workflow recente; disparo controlado único com probes 200 | Sim: proprietário exige prova externa | Confirmar canal e recebimento externo da execução 44957302667 |

### Provas novas e limites de cobertura

- **Localização tradicional:** 10 testes, lint, TypeScript e builds offline PASS; 15 cenários em Preview e 15 em Production, três idiomas e cinco dimensões, incluindo foco/X/Escape/reduced-motion/axe nos tamanhos previstos. Deployment `dpl_6nbp4AfM2rxL84wXRUL4xECtUhVD`, fingerprint `c5e4fcf1cb30ff46ed62c9610d3dd6e83cbc55a0b0ab79d8f637615783fedb29`. Os arquivos e assets correspondentes foram preservados no delta seguinte; não se repetiu toda a bateria após mudar apenas a tabela Pricing. Fontes das citações: [KJV](https://www.biblegateway.com/passage/?search=Luke+16%3A10&version=KJV), [ARC](https://www.bibliaonline.com.br/arc/lc/16/10), [Reina-Valera 1909](https://www.sbp.org.pe/biblia/RVR09/LUK.16). Usa o trecho positivo solicitado, sem alegar consenso denominacional sobre uma única versão tradicional.
- **Pricing:** defeito reproduzido na página publicada: tabela 10/10 contradizia cartões e função do banco 20/15, tanto em staging como Production. Mudança mínima em `src/pages/Pricing.jsx` e sua suíte; 5 testes, lint, TypeScript, builds offline/scan PASS. Preview `dpl_79zpKDC7LMwS8fUKp6drpDGoZvzP`: https://dealsiftermatch-75st3iavz-deal-sifter-match-s-projects.vercel.app. Seis cenários navegador em cada ambiente (EN/PT/ES × desktop/mobile), preços 49/129 preservados, nenhuma exceção. Conferência final: quatro funções ACTIVE/JWT/hash inalterados, worker e módulo Maxxis reais íntegros. Nenhuma compra ou escrita em Production.
- **P‑03R parcial, API real autenticada:** duas contas novas confirmadas sem email, login por senha e saldo legítimo de cadastro 3 cada. Nenhum admin/SQL para crédito ou entitlement. 28 verificações de sessões, isolamento privado A/B, persistência dos três perfis, edição própria/rejeição de edição alheia e publicação/ocultação/republicação dos dois imóveis e um serviço PASS. Seis verificações de filtros com inventário remoto real e código de aplicação publicado PASS. Esse teste do filtro executa o código real localmente sobre a resposta autenticada; não equivale sozinho à interação visual do filtro.
- **Unlock normal P‑03R:** duas compras concorrentes retornaram o mesmo unlock; custos 1 e 0; repetição sem novo débito. Saldo investidor 3→2, um único registro persistido; contato sintético e imóvel correto no Portfólio canônico. Dez verificações PASS. Apenas notificação interna permitida; zero emails e chamadas pagas. Preservar registros/ledger, sem restaurar saldo por SQL.
- **Limites das fixtures:** a primeira montagem omitiu origem/data da geocodificação manual; completadas somente nessas duas fixtures via JWT do proprietário, sem provedor. A primeira tentativa de navegação da nova conta investidora encontrou o gate legítimo de onboarding: todos os três registros foram atribuídos ao publicador. A aprovação específica para um imóvel adicional do investidor foi concedida e executada; a retomada e os resultados estão registrados na atualização abaixo. Não se desabilitou o gate nem se alterou RLS. Esse resultado é limitação da fixture, não evidência de regressão do produto. Perfis/alternância na UI e o percurso comercial completo ainda não foram certificados por essa rodada.
- **Stripe:** três funções publicadas comparadas entre staging e Production, 13 módulos equivalentes; não foram redeployadas. O módulo de orçamento local difere do publicado: não copiá-lo para o backend financeiro. Zero eventos no ledger nos dois ambientes é ausência de evidência, não bug ou prova de idempotência. Sem chaves/configuração/preços TEST aplicados até este registro; chaves LIVE preservadas e não utilizadas nos testes.
- **Google:** confirmação humana de audiência/verificação registrada; não houve acesso ao Console, alteração de OAuth, refresh tokens ou envio novo. Aceitação pela API e recebimento pelo destinatário continuam fatos distintos; o recebimento/Trello relatado anteriormente pelo proprietário não prova quotas ilimitadas.
- **Operação:** health direto Production Chat 200 e staging Chat 200, com request/release IDs. Run natural [44939898368](https://github.com/DealSifter/DealSifter_Match/actions/runs/44939898368) passou. Run controlado [44957302667](https://github.com/DealSifter/DealSifter_Match/actions/runs/44957302667), 21/11 às 19:33 BRT, terminou em failure **esperado**, após frontend 200/142 ms e Edge 200/1042 ms. Não houve falha real de saúde nesse disparo. Destino e recebimento externos não são inferidos da anotação. O workflow cobre frontend Production e Edge configurado para staging; o probe direto separado confirmou também Edge Production. A configuração de cron não prova cadência/SLA. Evento Sentry natural `9a7e06f8b5484908a7db8c0ee21890fd`, às 21:36:05 UTC, pertence ao release anterior do footer; mecanismo preservado, não alegado como evento do fingerprint atual.

| Cenário comercial | Resultado | Alcance e restante |
|---|---|---|
| B1 — sessão/perfis/isolamento | NOT VERIFIED | Sessões e RLS A/B PASS; três perfis persistidos; falta alternância visual completa |
| B2 — marketplace | NOT VERIFIED | Publicação/edição/visibilidade/RLS e filtros reais PASS; jornada visual integral ainda pendente |
| B3 — Nuggets/unlocks | NOT VERIFIED | Unlock normal concorrente/repetição/débito único PASS; exclusividade e continuidade comercial dependem de TEST |
| B4 — relatórios premium | NOT VERIFIED | Relatórios e retomada Enterprise têm evidência compatível; compras premium/débito único ainda pendentes |
| B5 — Stripe | NOT VERIFIED | Chaves TEST ausentes; nenhum checkout/webhook/cancelamento executado nesta rodada |
| B6 — prestador/FSBO | NOT VERIFIED | Registros sintéticos por escopo, publicação/edição/visibilidade/RLS PASS; falta conferência UI completa; continuam na oferta, sem exclusão implícita |

### Atualização após retorno do proprietário — fixtures e alerta

- **Imóvel adicional autorizado e criado somente no staging:** `dc7e4b01-2eed-4e1d-8e36-44913e45cf41`, **1203 Launch QA Investor Onboarding Avenue**, proprietário investidor QA `d6289e97-c47a-4397-a6dc-f0f530a9ddb1`. Inserção via sessão legítima/RLS; saldo permaneceu 2, sem novo unlock, crédito manual, email ou provider. Total desta rodada: duas contas e quatro registros fictícios (três iniciais mais o adicional expressamente aprovado). Não foi necessário alterar o gate de onboarding.
- **Navegação real retomada: 5/5 PASS**, usando o Preview do fingerprint atual https://dealsiftermatch-75st3iavz-deal-sifter-match-s-projects.vercel.app. Sessão por senha válida, contato **Launch QA Publisher** efetivamente desbloqueado, Portfólio correto, imóvel **1201 Launch QA Investor Avenue** aberto e vínculo preservado após reload. Zero erros JavaScript. HTML/assets publicados conferidos; API de staging real, sem mocks. Providers, pagamentos, emails e autosaves foram bloqueados; isso não certifica compras premium ou envio. Evidência: `marketplace-browser.json` e `additional-investor-property.json`. A falha inicial de onboarding foi resolvida pela fixture autorizada, sem mudança de produto. Alternância completa de perfis na UI permanece separada.
- **Alerta externo:** proprietário informou que **ainda não recebeu** a notificação da execução 44957302667. Geração controlada permanece PASS, recebimento externo não comprovado. O ator do dispatch foi `Tarsox`; a consulta das preferências de assinatura não foi autorizada pelo escopo do token existente (API exige `notifications`). Nenhum escopo ou preferência foi alterado, nenhum segundo disparo foi feito. Conferir configurações pessoais em [GitHub Notifications](https://github.com/settings/notifications), seção Actions, com orientação da [documentação oficial](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications); o recebimento ainda é gate exigido pelo proprietário.
- **Stripe TEST:** proprietário pediu onde obter as chaves. Orientação baseada na [documentação Stripe](https://docs.stripe.com/keys): selecionar sandbox/Test mode e acessar API keys, usar `pk_test_` e `sk_test_` do mesmo ambiente. Aguardando preenchimento do arquivo ignorado `.tmp-codex/launch-final-20261121/stripe-test-setup.local.json`; não copiar chaves LIVE. Não houve checkout, configuração remota Stripe ou novo deploy nesta continuação.

### Conferência humana única — sem recriar o histórico de QA

Usar a conta QA A existente (identificação não sensível `r3-14946805-c4de-48a1-b15e-31f6fd06ff31-a@example.invalid`) no Preview funcional **https://dealsiftermatch-izgrv6mm9-deal-sifter-match-s-projects.vercel.app**. Contato **R3 Fictional QA B**, imóvel **1200 Fictional QA Avenue**, ID `d3f15cc0-f5e5-431f-beeb-d3eb4b2d2a74`. Credenciais ficam no arquivo local ignorado, não neste documento. Esse Preview tem CORS para relatórios e código de relatórios compatível com Production; os deltas posteriores são footer/idiomas/Pricing. A conta fictícia não tem Gmail real.

- [ ] Matches → contato → Portfólio → imóvel correto → Enterprise (ou PRO conforme entitlement legítimo).
- [ ] Maxxis: escolher estimativas com confirmação separada ou continuar parcialmente; mesmo pedido e referência.
- [ ] Reload: contexto privado e premissas persistem; nenhum indicador ausente inventado; snapshot e PDF coerentes, origem/cenário/limitações identificados.
- [ ] Modal contextual: assunto e corpo editáveis, destinatário escolhido/salvo, mesmo PDF após reload; envio Gmail só em conta/perfil real elegível com confirmação própria, sem envio pelo agente.
- [ ] Registrar aceite visual do proprietário, sem converter testes automatizados em aceite humano.

### Evidências e preservação

Recibos privados ignorados: `.tmp-codex/launch-final-20261121/` (reconciliação, source parity, health, Sentry, alerta, fixtures, API/filters/unlock); `.tmp-codex/trust-language-release-20261121/`; `.tmp-codex/pricing-copy-release-20261121/`. Sem credenciais nos documentos versionáveis. Context-capacity e os testes P‑01/P‑02 válidos foram reaproveitados. A bateria Deno conserva 31 diagnósticos anteriores idênticos; não se anunciou um check Deno geral limpo. Nenhuma nova migration, cobrança real, API paga, envio de email ou limpeza destrutiva; stash e histórico preservados. Novos testes não autorizam apagar fixtures antes do aceite.

**Capacidades liberadas tecnicamente nesta publicação:** footer localizado/tradicional e comparação fiel aos limites já aplicados; diagnóstico LC‑05 e relatórios anteriores preservados. **Certificação comercial ainda não concedida:** billing/entitlement/exclusividade ponta a ponta, promessa de alerta externo recebido, quotas Gmail e aceite humano integral. Não anunciar essas pendências como resolvidas nem presumir exclusão de prestadores/FSBO.

</details>


## 1. Estado do Release Candidate

### Histórico — publicação progressiva Classe A anterior

**Production vigente:** https://dealsiftermatch.vercel.app — deployment `dpl_7pEvyrstxbLJok6ZvH9JN72WBzCv`, READY. Inclui a correção LC‑05 e o item institucional **IN GOD WE TRUST ✝**. Base `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262` mais delta isolado, SHA‑256 `993695953e40d2965c003e019bc18568599e6a77bc82850b2b9b68c6a476a78b`. Os dois deltas foram validados e publicados separadamente; os registros abaixo identificam cada etapa.

A política **CONTINUOUS VALIDATED PRODUCTION DELIVERY**, recebida em 21/11/2026, autoriza publicar correções Classe A após validação. Ela substitui a restrição anterior a staging para essas correções; não elimina os gates comerciais nem autoriza mudanças Classe B. **CONDITIONAL GO comercial permanece**, com aceite humano, transações comerciais, audiência Google e acompanhamento de alertas ainda pendentes.

**LC‑05 corrigido e publicado:** frontend Production `dpl_FyvNYNtWUxHFDCoVf4V7i9A2uui9`, READY, em https://dealsiftermatch.vercel.app. Base Git `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262` mais delta isolado, fingerprint SHA‑256 `3b1cd4ac144b690db59bbe68e6b1a42cb69e95c058aa53581337c45a36a10527`. Não se atribuiu o delta sem commit ao SHA da base. Sem push dos commits históricos e sem aplicar o stash.

- Defeito: a rejeição da constraint de `deal_assumptions` acima de 8 KiB aparecia como falha temporária. Agora somente SQLSTATE `23514` junto à constraint exata produz `GAP_CONTEXT_CAPACITY_EXCEEDED`, HTTP 422. Outros erros de persistência não são classificados como capacidade. CAS, input inválido, sessão, acesso e falha de conexão têm tratamentos distintos; falha de rede não promete que a gravação não ocorreu.
- Arquivos de produto: `supabase/functions/maxxis-analysis-inputs/index.ts`, `src/services/maxxisAnalysisInputsService.js`, `src/features/maxxis/intelligence/analysisInputErrors.js` e três chamadas do helper em `src/components/maxxis/MaxxisAssistant.jsx`. Sem migration, truncamento de dados, novo retry, aumento de limite ou mudança de permissões.
- Local: **29/29 testes PASS**, lint e TypeScript de integridade PASS. Deno tem **31 diagnósticos preexistentes, idênticos na base e no delta**, sem novos erros; não se declarou o grafo inteiro limpo.
- Staging: **11/11 checks autenticados de fronteira/CAS/RLS PASS**, mais **18/18 checks no navegador PASS**. 8.192 bytes aceitos e 8.193 rejeitados, medidos por `pg_column_size`; erro novo visível, sem retry automático, revisão/contexto preservados; reload, confirmação separada, mesmo pedido e PDF real gerado. Contexto e snapshot QA restaurados. Ledger de provedores 2→2, entregas 6→6, unlocks 10→10 e saldo QA 5→5.
- Preview validado: https://dealsiftermatch-izgrv6mm9-deal-sifter-match-s-projects.vercel.app, `dpl_GepZ1qqmJgbyiEQMgSis4YG7yYup`. CORS de staging acrescentou somente essa origem às duas listas necessárias, preservando as duas anteriores; 12 verificações OPTIONS PASS. Nenhuma configuração de Production foi alterada.
- Backend publicado: **somente `maxxis-analysis-inputs`**, Production versão 16, JWT preservado, ESZIP SHA‑256 `31f75498cc51268c1b9dd17bfb376784ff8f413d4f4e07a37678ef671e050d4f`, idêntico ao staging. Comparação de 150 módulos recuperados confirmou alteração somente do entrypoint dessa função. Chat, OAuth e Delivery mantiveram seus hashes.
- Production smoke: **PASS**, 24 checks. Deployment READY, assets canônicos e módulo Maxxis conferidos, worker PDF inalterado, homepage renderizada sem exceções, falta de autenticação continua HTTP 401 e CORS canônico correto. Configuração pública e flag preservadas. Sem gravações em dados de Production, cobranças, emails ou chamadas pagas. A rede externa foi bloqueada na inspeção do navegador; não se alegou novo teste de ingestão ou entrega de alerta.
- Rollback específico: frontend `dpl_aQU5cyEmcnKDMx79iK8yvmrGgdgo`; código recuperado da função anterior (versão 15, ESZIP `79db633810c53475c61438208eb25b817e52632f1d65d3a646a730ee4c1d11fd`) em `.tmp-codex/context-capacity-release-20261121/rollback/maxxis-analysis-inputs/source/`. Recibos privados nesse diretório de release. Nenhuma regressão do delta detectada.

### Item institucional — IN GOD WE TRUST ✝ — Production smoke PASS

- Classificação: **A**, frontend isolado. Novo item como **último botão da coluna Empresa/Company**, após Suporte/Support, usando o mesmo mapa, tipografia, cor, espaçamento e hover dos demais. Nenhuma coluna ou footer adicional. Links anteriores preservados nos três idiomas; texto do modal mantido exatamente como fornecido em inglês.
- Arquivos: `src/pages/Landing.jsx` (quatro linhas adicionadas), `src/components/modals/TrustStatementModal.jsx`, `src/components/modals/TrustStatementModal.css` e `src/pages/Landing.trust.test.jsx`. Reutiliza `Modal`, sem alteração do componente compartilhado ou novas dependências. CSS restrito ao novo modal. A homepage mantém seu tema claro obrigatório já existente; o componente usa os tokens compartilhados de tema.
- Abertura e fechamento com 200 ms, sem animação quando `prefers-reduced-motion` está ativo. X, Escape, contenção de foco e retorno ao botão de origem conferidos. O modal usa `role=dialog`, `aria-modal`, nome acessível e conteúdo semântico com `blockquote`, `cite` e declaração em itálico.
- Local: **6/6 testes PASS**, lint, TypeScript de integridade e builds offline staging/Production PASS; scan de segredos PASS. A primeira conferência levou à inclusão da transição de fechamento; o candidato final foi recompilado e reconferido, não se reutilizou a aprovação do artefato anterior.
- Staging/Preview final: `dpl_3VM6pDs7pyJZfGzadmadNbU6afTG`, https://dealsiftermatch-2yztr78jy-deal-sifter-match-s-projects.vercel.app, fingerprint igual ao Production vigente. **7/7 dimensões PASS**, de 1440×900 a 320×320. Inspeção visual desktop/mobile realizada; axe sem violações no modal em desktop e celular; nenhuma exceção de JavaScript.
- Production: `dpl_7pEvyrstxbLJok6ZvH9JN72WBzCv`, READY, **7/7 dimensões e smoke PASS** no domínio canônico. Os seis tamanhos normais não tiveram overflow; em 320×320 a rolagem necessária deu acesso ao texto inteiro. HTML e três assets de entrada/estilo conferidos contra o upload; worker PDF e módulo Maxxis publicados também conferidos por SHA‑256. Alias, metadata e fingerprint reconferidos pela API Vercel.
- Somente frontend publicado nesta etapa. Quatro bundles de funções reconferidos e preservados: Inputs 16, Chat 104, OAuth 2 e Delivery 3, todos ACTIVE e com configuração JWT inalterada. A correção LC‑05 permanece no módulo publicado. **Nenhuma mudança de banco, Auth, Supabase, Stripe, Maxxis, APIs, secrets ou CORS para implementar o item institucional**; a alteração LC‑05 anterior permanece separada acima.
- Os testes do footer bloquearam backend e serviços externos. Não foram usados como homologação de login, pagamentos, envio de email ou outras páginas autenticadas; não houve chamadas pagas nem gravações de dados. O Preview do footer certifica somente essa interface e não recebeu nova origem no CORS. Para conferir o fluxo autenticado de relatórios, usar o Preview LC‑05 identificado acima.
- Rollback do footer: `dpl_FyvNYNtWUxHFDCoVf4V7i9A2uui9`, que conserva LC‑05. Recibos privados em `.tmp-codex/trust-statement-release-20261121/`: `source-scope.json`, `local-validation.json`, `browser.json`, `production-smoke.json` e `final-verification.json`. **Nenhuma regressão detectada; nenhuma pendência técnica desta implementação.** Aceite humano comercial e gates LC‑03/LC‑04/LC‑06 permanecem independentes. Sem commit/push histórico; stash preservado.

### Protocolo P‑03R — autorizado; execução parcial registrada no fechamento vigente

O roteiro FINAL LAUNCH READINESS recebido em 21/11/2026 mantém aprovação específica para pagamentos, dados de QA adicionais e configuração sensível. A reconciliação somente leitura confirmou: Stripe sem secrets no staging; zero linhas em `stripe_webhook_events` nos dois ambientes; três backends Stripe com fontes equivalentes entre staging e Production (13 módulos comparados). Não é necessário redeploy dessas funções para preparar o teste. O módulo local `maxxisExecutionBudget.ts` difere do publicado em dois grafos; não será copiado sobre os backends financeiros. Ausência de eventos não prova bug nem certifica idempotência ponta a ponta.

**Operação P‑03R autorizada pelo proprietário em 21/11/2026. Operações dependentes de chaves TEST continuam pendentes:**

1. Exclusivamente no staging `oqdcnjupquhybwdbeeew`, criar duas novas contas fictícias `launch-20261121-investor@qa.dealsifter.invalid` e `launch-20261121-publisher@qa.dealsifter.invalid`, confirmadas para QA sem email de confirmação, sem privilégios especiais. Usar sessões legítimas para os fluxos do aplicativo; preservar as fixtures R‑3 existentes. Investidor pessoal e publicador com perfis pessoal/profissional/FSBO; até dois imóveis residenciais fictícios e um serviço fictício, via mecanismos existentes e RLS. Nenhum dado real.
2. Configurar somente credenciais **Stripe TEST** e dois produtos/preços TEST que correspondam ao catálogo já anunciado: P5, USD 9, compra única; PRO, USD 49/mês. Reutilizar preços TEST compatíveis se existirem; criar somente esses dois se necessário e autorizado. Nomes de configuração: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_P5`, `STRIPE_PRICE_PLAN_PRO`, chave pública TEST no Preview e apenas origem/retorno desse Preview em `APP_ALLOWED_ORIGINS`/`APP_URL` e CORS de análise quando indispensáveis. Preservar a baseline por comparação de digest; parar antes de substituir qualquer valor não reconstruído. Nunca copiar credenciais/chaves/preços LIVE ou mudar Production.
3. Registrar somente endpoint de webhook **TEST**, se necessário, para a função `stripe-webhook` desse staging. Fazer dois checkouts TEST concluídos (P5 e PRO), um cancelado e duas reapresentações dos eventos TEST já concluídos, além das rejeições de assinatura/corpo inválidos. Verificar crédito único, plano, ledger e ausência de crédito no cancelamento. Sem cartões reais, pagamentos reais, mensagens reais ou chamadas a provedores pagos.
4. Com saldo recebido legitimamente pelo cadastro/checkout TEST, executar um unlock normal de até **1 Nugget**, exclusividade existente de até **20**, aquisição de Analysis de até **3** e Deal Intelligence de até **5**; teto de **29 Nuggets QA** em débitos iniciais. Repetição/concorrência deve custar zero adicional. Reconsultar cada cotação e parar se o valor for maior, saldo insuficiente ou duplicidade detectada. Não creditar saldo manualmente nem conceder entitlement por admin/SQL. Notificações internas ficam limitadas às duas contas fictícias; nenhum envio Gmail/email/WhatsApp.
5. Verificar publicação/edição/visibilidade, filtros, alternância de perfil e isolamento A/B, inclusive prestador e FSBO porque continuam anunciados. Não excluir essas capacidades do lançamento por decisão implícita. Usar apenas os registros desse protocolo. Relatórios permanecem cache-only/determinísticos, sem Gemini/RentCast.
6. Manter a trilha e os registros sintéticos para conferência; não apagar histórico nem restaurar saldos por SQL. Cancelar somente a assinatura TEST criada por esta execução ao encerrar e retirar somente configurações exclusivamente adicionadas após comparação da baseline, se previsto na aprovação. Nenhuma migration, alteração de preços/regras, Auth/RLS, deploy financeiro ou mudança em Production faz parte desta proposta.

**P‑03R AUTORIZADO pelo proprietário em 21/11/2026**, somente staging e Stripe TEST, nos limites acima. Ainda NÃO EXECUTADO. A inspeção local encontrou somente chave Stripe LIVE, que não foi usada. Falta preencher `stripeSecretKey` (`sk_test_…`) e `stripePublishableKey` (`pk_test_…`) em `.tmp-codex/launch-final-20261121/stripe-test-setup.local.json`, confirmado como ignorado pelo Git. A autorização não é prova de PASS dos cenários B1–B6; a configuração TEST é um bloqueio material à execução financeira.

**LC‑04 — confirmação do proprietário:** projeto OAuth em produção e verificado, informado em 21/11/2026. Registrar como evidência humana de audiência/verificação; quotas específicas do projeto e limite operacional de envio ainda não foram fornecidos. Não se atribui a essa informação um novo teste de recebimento.

**P‑05R — alerta externo, preparado e ainda NÃO AUTORIZADO/EXECUTADO:** o proprietário exige comprovação externa antes do lançamento. Propõe-se uma única execução de `.github/workflows/observability-smoke.yml` na branch `main`, com `force_alert=true`, no repositório `DealSifter/DealSifter_Match`. Os probes já existentes rodam primeiro; o workflow falha deliberadamente com `CONTROLLED_OBSERVABILITY_ALERT` e o resumo CRITICAL existente. Não altera código, configuração, produto, banco ou cobrança. Destino: canal de notificações de GitHub Actions já configurado na conta do proprietário; nenhum novo destinatário será inscrito silenciosamente. Guardar URL/run ID/log e exigir confirmação do recebimento externo pelo proprietário. Run FAIL/annotation isoladamente não comprova entrega. Esse disparo controlado depende da aprovação específica exigida pela seção 7 do roteiro; nenhuma falha artificial foi gerada até aqui.

### Registro anterior — fechamento inicial LC/P‑01/P‑02

Os resultados abaixo preservam o histórico anterior à publicação progressiva. Afirmações de Production intocada e capacidade pendente referem-se a essa rodada anterior; o estado vigente de LC‑05 está registrado acima.

**CONDITIONAL GO para prosseguir com a homologação controlada. Ainda não há GO para lançamento comercial pago irrestrito.** P‑01 e P‑02 foram posteriormente autorizados pelo proprietário e executados exclusivamente em staging/Preview. Foi confirmada uma lacuna de diagnóstico no limite de contexto: a persistência é protegida, mas a mensagem exibida identifica incorretamente a rejeição como falha temporária. Nenhuma correção do produto foi aplicada.

O candidato de produto continua sendo `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262`, na branch `fix/production-real-defects`. HEAD documental: `21e6b7787f168abadc73388489c328eace387a60`. Production permanece em `dpl_aQU5cyEmcnKDMx79iK8yvmrGgdgo`, READY. O projeto Vercel e quatro assets canônicos foram reconferidos; source e hashes coincidem com a publicação aprovada.

Foram executados **74 testes locais direcionados em dez suítes, todos PASS**. Eles cobrem contratos e UI com dependências simuladas; não são prova de compra, webhook Stripe, navegação autenticada atual ou recebimento de email. As provas autenticadas anteriores continuam documentadas, sem reapresentá-las como execução nova.

O [manifesto sanitizado](DEALSIFTER_LAUNCH_CANDIDATE_MANIFEST.json) registra source, árvore Git, deployment, rollback, quatro hashes públicos e os **37 commits locais ainda não publicados na branch remota**. Não houve commit ou push nesta execução. O stash `e6871a826f822fa3b42a2c904d901e212c52c89a` permanece intocado.

### Operações efetivamente executadas

- Leituras locais e GETs administrativos Vercel/Sentry/GitHub; GETs de assets públicos; SELECT sintético no staging.
- Dez suítes locais, em dois grupos sequenciais, sem compra, envio, provider ou banco remoto nos testes.
- Correção mínima de `qa/README.md` e aviso de documento histórico em `docs/REPORTS_RELEASE_CURRENT.md`, apontando para o registro vigente no singular. Histórico preservado.
- Manifesto local versionável e evidências sanitizadas em `.tmp-codex/launch-closure-20261121/`.
- Preparação local de um candidato isolado a partir de `git archive` do source exato, com dependências já instaladas, exclusivamente para staging. Situação do build registrada no fechamento abaixo.

Após as autorizações específicas, houve login legítimo QA, gravações CAS e de relatórios sintéticos no imóvel autorizado, com restauração guardada, além de atualização de duas listas CORS no staging. Não foram recriados imóvel, match ou unlock. Não foram alterados código do produto, Edge Functions, schema, preços, saldos, flags de capacidade, OAuth Google ou Production. Não houve instalação de dependências, token transferido entre usuários/ambientes, chamada paga, email, cobrança ou exclusão da fixture.

## 2. Resultados LC‑01 a LC‑06

O status geral de cada LC considera seu aceite completo. Um subteste PASS não fecha uma operação dependente de autorização.

| LC | Status geral | Evidência nova | Dependência restante | Bloqueia o escopo comercial? | Próxima ação / autorização |
|---|---|---|---|---|---|
| LC‑01 | **PASS** no escopo autorizado | Preview `dpl_DcaTcjRU4gy4DXFnwBh93KxRdAJs`, READY, source exato, HTML/assets conferidos; CORS anterior preservado | Push permanece propositalmente não executado, dependendo de decisão própria | Não impede a conferência do candidato; publicação do source remoto continua gate da entrega oficial | Proprietário pode acessar o novo Preview; nenhuma função precisa de redeploy |
| LC‑03 | **BLOCKED**; contratos locais PASS, E2E comercial NOT RUN | 24 testes adicionais de entitlement/ownership/artifact/Pricing; parte dos 50 testes de perfis/Matches | Transações QA legítimas e configuração Stripe test mode, com permissões específicas | Sim para oferta paga irrestrita | Aprovar escopo e P‑03; ausência de evidência não é bug de cobrança |
| LC‑05 | **FAIL no diagnóstico da capacidade; integridade/persistência PASS** | CAS autenticado: 8.192 grava, 8.193 rejeita, estado preservado, corrida 200/409 e RLS A/B; na UI há erro visível e recuperação | Mensagem específica do limite requer correção aprovada; mensagem atual é de falha temporária | Não houve perda/travamento comprovado; impede declarar esse critério integralmente encerrado sem ressalva | Corrigir somente tratamento de erro se autorizado; sem migration ou aumento de limite |
| LC‑02 | **BLOCKED somente para encerramento integral/humano**; percursos automatizados QA PASS | Caminho estimado 17/17 e parcial/contextual 19/19; Matches → Portfólio → Enterprise; reload, mesmo pedido/snapshot, editor e PDF conferidos | Aceite visual do proprietário; Gmail real permanece fora da conta `.invalid` | Sim para declarar homologação humana concluída | Usar o novo Preview e a fixture existente; não recriar desbloqueios |
| LC‑04 | **BLOCKED**; contrato implementado confirmado | Código exige `openid email gmail.send`, Gmail pessoal do perfil, reconexão após expiração | Console Google: audiência, publicação/verificação, test users e quotas não acessíveis com as credenciais disponíveis | Sim se envio geral prometido; pode admitir restrição explícita | Obter metadata pública/sanitizada em P‑04; sem envio real |
| LC‑06 | **BLOCKED** no aceite integral; ingestão e health **PASS** | Dois eventos existentes do release atual e três runs bem-sucedidos do smoke; logs confirmam probes frontend/Edge | Destinatário/recebimento de notificação externa e regras de alerta não certificados | Sim para prometer alerta externo automático; canal Actions e ingestão já operam | Confirmar acompanhamento do canal Actions ou configuração existente em P‑05; não gerar falha artificial |

### LC‑01 — identidade e congelamento

O GET do projeto Vercel confirmou que seu target Production continua no deployment da referência. Os quatro assets lidos em `https://dealsiftermatch.vercel.app` retornaram HTTP 200 e SHA‑256 idêntico ao manifesto do build aprovado:

- `index.html`;
- `assets/index-BqyoosQu.js`;
- `assets/reportPdf.worker-B6Qdecy_.js`;
- `assets/reportPdfCore-b11WEDER.js`.

O arquivo de source isolado foi produzido diretamente do commit `1862ad2`, sem aplicar arquivos do checkout documental sobre o produto. Nenhuma função equivalente foi republicada. A ausência de push permanece explícita: o remoto não é fonte intercambiável com esse candidato.

O Preview registrado anteriormente (`dpl_53JTEub4fxeFkFvtcVsJap8BYxtk`) continua sendo referência histórica. **Preview vigente de conferência:** https://dealsiftermatch-gvx1qoane-deal-sifter-match-s-projects.vercel.app — deployment `dpl_DcaTcjRU4gy4DXFnwBh93KxRdAJs`, READY, source `1862ad2`.

P‑01 preservou a origem anterior e acrescentou somente a nova em `MAXXIS_PREVIEW_ALLOWED_ORIGINS` e `MAILBOX_ALLOWED_ORIGINS` no staging. Os valores anteriores foram reconstruídos e comparados aos digests retornados pela API antes da escrita. Oito verificações OPTIONS (quatro rotas × duas origens) passaram. `MAXXIS_ALLOWED_ORIGINS` e todas as configurações de Production permaneceram intocados.

O HTML obtido do hosting contém a toolbar anexada pelo Vercel: o prefixo do HTML do produto corresponde exatamente ao hash do upload; o sufixo foi identificado como o script de feedback do Vercel. O JavaScript principal e o worker também foram lidos do Preview e conferidos por hash. Os testes usaram esse HTML vivo, cache estático do upload conferido e sessões/backend reais; nenhum retorno de API foi simulado. Isso não certifica acesso anônimo ao Preview protegido pelo Vercel.

### LC‑03 — escopo comercial e provas locais

Escopo encontrado na oferta atual e contratos preservados: contas/perfis; imóveis/feed; Matches/Portfólio e desbloqueios; planos/Nuggets; Basic, PRO e Enterprise, incluindo cobrança única de capacidades não incluídas no plano. A tela Pricing anuncia custos por imóvel e reabertura sem nova cobrança. Serviços/prestadores e FSBO existem no produto; sua exclusão do lançamento não foi decidida pelo proprietário e não foi presumida nesta execução.

Oferta externa de Property Intelligence geral não deve ser adicionada: sua flag no frontend Production permanece false. Gmail deve ser apresentado como capacidade condicionada, não como provedor universal de correio.

Suítes novas desta execução:

| Grupo | Arquivos | Resultado | Alcance |
|---|---|---|---|
| Perfis, Matches e entrega | `matchesEntitlement.test.js`, `unlockAccessState.test.js`, `onboardingProfileValidation.test.js`, `senderProfile.test.ts`, `ReportDeliveryModal.test.jsx`, `propertyReleaseGmail.dom.test.jsx` | 50/50 PASS, 42,37 s | Unidade/DOM, mocks e dados sintéticos; sem autenticação remota |
| Contratos comerciais | `runtimeEntitlement.test.ts`, `maxxisReportOwnership.contract.test.js`, `maxxisReportArtifact.contract.test.js`, `Pricing.intelligenceEconomy.test.jsx` | 24/24 PASS, 8,38 s | Gates por plano/capacidade, contratos de ownership/artefato e apresentação da oferta; parte é inspeção de código/SQL, não execução transacional |

A primeira tentativa do primeiro grupo não iniciou por `spawn EPERM` do esbuild no sandbox. O mesmo comando executou com permissão de subprocesso e passou, sem alteração de produto. Isso não é falha de teste funcional.

**NOT RUN:** publicar/editar no banco; unlock/exclusividade novos; compra concorrente de relatório; crédito de plano/pacote por webhook; replay de evento Stripe; transação de prestador/FSBO. Nenhum desses casos foi marcado PASS por causa dos testes locais.

### LC‑05 — casos sintéticos de capacidade

Consulta somente SELECT em `oqdcnjupquhybwdbeeew`, sem tabelas temporárias, transação de escrita ou alteração de contexto. O payload contém estrutura sintética `r3Completion` e padding determinístico de armazenamento, sem dados reais. A medição é do valor JSONB retornado por PostgreSQL, não de comprimento textual:

| Caso | Padding sintético | `pg_column_size(payload)` | Predicado `<= 8192` |
|---|---:|---:|---|
| Abaixo | 256 caracteres | 368 bytes | true |
| Fronteira | 8.080 caracteres | 8.192 bytes | true |
| Acima | 8.081 caracteres | 8.193 bytes | false |

Evidências locais: `boundary-measurements.sql` e `boundary-measurements.json`. O padding é uma sonda do contrato de storage; não se atribui a ele validade de toda entrada conversacional do endpoint.

**Execução posterior autorizada P‑02:** 11 verificações autenticadas PASS em `boundary-authenticated.json`: medidas, gravação/leitura abaixo e na fronteira, rejeição acima com SQLSTATE 23514/HTTP 400, preservação do estado/revisão após rejeição, corrida CAS com um HTTP 200 e um 409, isolamento A/B. A baseline foi restaurada via CAS, mantendo a revisão monotônica; saldo, unlocks, mail e ledger de provedores não mudaram.

Na interface, um contexto sintético medido em 8.192 bytes foi usado para provocar a rejeição de uma atualização incremental real. O endpoint retornou HTTP 500 / `GAP_RESOLUTION_PERSISTENCE_ERROR`; a UI mostrou **“I had a temporary issue. Please try again or contact human support.”** O contexto anterior permaneceu intacto. Depois de retirar somente o padding sintético pelo CAS autorizado, reload retomou o mesmo pedido e o fluxo continuou. Portanto, proteção de dados e retomada foram comprovadas, mas a mensagem não explica a causa persistente de capacidade. Nenhum limite foi aumentado, payload truncado ou schema alterado.

### LC‑04 — Gmail

O contrato já publicado suporta Gmail/googlemail pessoal e exige caixa correspondente ao email salvo no perfil ativo. O email do login não substitui o perfil. O consentimento usa `gmail.send`, sem permissão de leitura da caixa e sem refresh token persistido. Reconectar ao expirar é comportamento previsto; os tokens não são compartilháveis entre usuários ou ambientes.

Outlook e domínios Workspace não fazem parte do suporte atual desse fluxo. Não houve tentativa de habilitá-los. Não foram acessados nem alterados dados do console OAuth Google; o Client ID público existente não dá permissão de administração desse projeto. Não há sessão de console ou credencial administrativa Google disponível nos mecanismos consultados.

Permanecem NOT VERIFIED: estado Testing/Production, audiência, test users, verificação do escopo e quotas/limites efetivos do projeto. A confirmação anterior de recebimento pelo proprietário continua válida para aquele teste, sem se transformar em autorização geral de audiência.

Delimitação comercial proposta, ainda sujeita ao aceite do proprietário: **“Envio disponível para Gmail pessoal do perfil ativo, mediante autorização Google e elegibilidade da conta. Pode ser necessário reconectar. Download de PDF permanece disponível.”** Enquanto a audiência real não for confirmada, não anunciar “envio Gmail para todos”. ACCEPTED significa aceitação pela API; recebimento na caixa/Trello exige confirmação separada. Nesta execução não houve envio.

### LC‑06 — evidência operacional encontrada

Consultas de leitura, sem criar eventos:

- Evento existente `13ed67a783c94a7b948f17f155a79ca9`, de **21/11/2026 18:25:05 UTC**, com release `modal-layout-1862ad2b8db5` e ambiente `production`.
- Segundo evento existente `16ae5b18361a44088b39dc545f40b1c2`, de **21/11/2026 17:28:12 UTC**, com o mesmo release/ambiente.
- Foram retidos somente IDs, datas e tags técnicas; corpo, usuário, sessão, headers e conteúdo de mensagem não foram registrados. Esses registros comprovam ingestão identificada, não ausência de erros nem entrega de alertas.
- [Run 44900791290](https://github.com/DealSifter/DealSifter_Match/actions/runs/44900791290), concluído com success em 21/11/2026 11:48:03 UTC. Logs: frontend HTTP 200 em 280 ms; maxxis_edge HTTP 200 em 775 ms; ambos `success:true`.
- Runs anteriores `44861387355` e `44830830797` também concluídos com success. Workflow executado em `main`, SHA `16aababd60c92ddf074b8956cb17de8b4bbce364`; isso comprova o health do destino configurado, não que main contenha o candidato atual.
- Destino técnico comprovado do aviso do workflow: falha do job e anotação `::error` no **GitHub Actions**. Regras/destinatários de notificação externa não confirmados. Endpoint de regras do projeto Sentry retornou 404; não se inferiu “nenhuma regra existe” dessa resposta.

Cobertura real: frontend Production e health de Maxxis no staging. Não é monitoramento de todas as transações autenticadas de Production. Não foram alterados workflow, cron, Sentry ou GitHub Settings; não foi feito dispatch nem gerado erro artificial.

Procedimento mínimo de resposta preparado: responsável técnico de release/operação consulta run com falha e evento do release, confere deployment canônico/hashes e o componente afetado, evita retry de compras/envios ambíguos, e submete rollback do componente exato quando necessário. Escalonamento/destinatário humano e aceite de acompanhamento manual ou alerta externo ainda precisam ser confirmados, sem inventar responsável nominal ou prazo.

## 3. Falha de diagnóstico reproduzida e limites dos roteiros

**LC‑05 / diagnóstico de capacidade — confirmado.** Esperado: mensagem compreensível que diferencie limite de armazenamento de indisponibilidade temporária. Observado: constraint 23514 é convertida pelo endpoint em erro genérico de persistência/HTTP 500 e pela UI em falha temporária. Causa localizada no mapeamento de `writeError`/`publicErrorCode` em `maxxis-analysis-inputs/index.ts` e nos catches do Gap Resolver em `MaxxisAssistant.jsx`. Impacto: retry idêntico não resolve contexto cheio. Não houve perda de dados nem necessidade de migration. O caso foi provocado com padding QA deliberado via RPC; não se alegou que uma entrada normal do formulário reproduza o mesmo tamanho.

Correção mínima proposta, **não aplicada**: reconhecer especificamente a constraint `property_arv_review_deal_assumptions_check`, emitir código público próprio e mensagem que explique o limite e a preservação dos dados, sem truncar conteúdo ou modificar CAS. Aceite: teste dirigido da rejeição com estado/revisão preservados, texto específico e retomada após redução legítima do conteúdo. Prioridade P1 de acabamento do gate LC‑05, não P0; impede encerrar esse critério sem ressalva. Alterar/publicar esses componentes equivalentes exige nova autorização explícita, conforme a restrição desta missão.

Ocorrências do roteiro QA, sem alteração de produto: a toolbar do Vercel exigiu comparar o HTML original e seu sufixo separadamente; a primeira tentativa parcial acionou navegação antes de terminar a hidratação e caiu no cadastro, enquanto a repetição após hidratação/reload abriu Matches normalmente; a primeira execução estimada esperou o campo do chat após reload quando o painel estava recolhido. Esses timeouts foram mantidos nos recibos, sem classificá-los como regressões funcionais. A repetição é limitada aos passos afetados, sem repetir a suíte geral.

## 4. Autorizações executadas e propostas ainda pendentes

### P‑01 — publicar somente Preview e origem CORS de staging

**AUTORIZADO E EXECUTADO** pelo proprietário nesta continuação. Recibos: `preview.json` e `cors.json`; resultado e URL em LC‑01 acima.

- **Objeto:** frontend isolado do commit `1862ad2`, projeto Vercel `prj_QPyhaESQ9dpLfgSfwzm4wxirLbs5`, target Preview; Supabase exclusivamente `oqdcnjupquhybwdbeeew`.
- **Configuração local:** chave pública anon apenas do staging, flag Property Intelligence false como Production; sem segredo do Google, service role, preços/chaves LIVE Stripe ou DSN de Production. URL de app usa a origem da própria janela no source existente, evitando callback apontando ao domínio Production.
- **Mutação solicitada:** um deploy Preview e inclusão somente de sua origem exata nos controles CORS de staging necessários a Maxxis e Gmail, preservando origens atuais. Antes de alterar, validar por digest qualquer baseline local de segredo contra metadata remota; se o valor atual não puder ser reconstruído com segurança, parar sem sobrescrevê-lo.
- **Fora do escopo:** deploy de funções, Production, migrations, push, Auth/login, flags remotas, Stripe e envio de email.
- **Aceite:** READY; source/manifest/hashes e Supabase alvo; OPTIONS das origens necessárias, sem chamada paga; Production no mesmo ID. Publicação não autoriza login ou mutação de fixture.
- **Reversão:** retirar somente a origem acrescentada, após confirmação de ausência de outras alterações; manter o Preview histórico até o aceite. Não promover o Preview a Production.

### P‑02 — sessão QA, fronteira e percurso autenticado

**AUTORIZADO E EXECUTADO** dentro dos limites abaixo. Não inclui consentimento/envio Gmail real, compras ou mudança de perfil. Recibos autenticados e de navegador no diretório de evidências; restauração conferida no fechamento.

- **Objeto:** reutilizar QA A e QA B, imóvel `d3f15cc0-f5e5-431f-beeb-d3eb4b2d2a74` e unlock existente. Nenhuma recriação, novo saldo, desbloqueio ou entitlement.
- **Autenticação:** login legítimo QA para sessão de testes; sem service role para contornar RLS e sem alterar identidade de produção.
- **Escritas solicitadas:** exclusivamente contextos privados dessas contas nesse imóvel e os relatórios sintéticos estritamente necessários para estimado/parcial e retomada. Registrar IDs criados pela execução; não excluir relatórios existentes. Para testar storage/CAS, usar RPC autorizada pelo usuário; se for necessário acessar diretamente o contrato da RPC para um payload de storage, registrar que essa parte não certifica a normalização do endpoint.
- **Sequência:** ler e guardar baseline privado/revisão; testar abaixo/próximo/acima; reconsultar após rejeição; disputar duas gravações da mesma revisão e esperar um vencedor/um 409; reload; retomar pedido. Exercitar o endpoint/UI com entradas de aplicação válidas, sem criar escrita “equivalente” em tabela com admin. Nenhuma chamada Gemini/RentCast, email ou débito financeiro.
- **Reversão:** restaurar somente conteúdo sintético alterado por esta execução via CAS com a revisão atual, preservando a monotonicidade. Se houver edição concorrente do proprietário, parar e não sobrescrever. Limpeza somente de novos registros identificados, depois do aceite; fixture original preservada.
- **Aceite:** sem perda da baseline após rejeição, CAS/reload corretos, mensagem compreensível, pedido original retomado, PDF com origem/cenário/limitações. A etapa humana continua sendo do proprietário.
- **Dependência:** P‑01 para a prova no frontend final. Sem migration ou aumento de limite.

### P‑03 — operações comerciais e Stripe test mode

- Primeiro aprovar a oferta inicial, incluindo ou excluindo explicitamente prestadores/FSBO. Não houve decisão unilateral de remover capacidades existentes.
- **Nuggets:** autorizar casos sintéticos finitos de unlock/exclusividade e relatório, com saldo QA já existente e custo reconferido antes; parar se insuficiente ou diferente. Especificar antes IDs, custo e trigger de notificação interna; não adicionar saldo nem desativar triggers. As permissões históricas de um único unlock não são reutilizadas como autorização de novas compras.
- **Stripe:** aprovar separadamente credenciais/price IDs **test mode** apenas no staging para um pacote P5 e um plano PRO mensal; parar se não forem inequivocamente TEST. Nunca alterar credenciais Production. Registrar e preservar baseline de configuração; caso não seja recuperável com segurança, não substituir segredo existente.
- **Casos:** checkout cancelado sem crédito; pacote test pago com evento duplicado sem crédito duplicado; plano test pago com webhook duplicado sem nova concessão; repetição/concorrência de aquisição de relatório com único débito/entitlement e reabertura sem cobrança. Incluir assinatura/corpo de webhook inválidos sem crédito.
- **Reversão:** cancelar apenas assinatura TEST criada e retirar configuração exclusivamente adicionada após comparação de baseline. Transações/ledger não serão apagados nem saldos restaurados por SQL arbitrário; manter trilha sintética e usar somente mecanismos legítimos autorizados. Se saldo/catálogo não permitir, registrar NOT RUN e obter aprovação da operação exata.
- Sem charges reais, email/WhatsApp, mudança de pricing, bypass de autorização ou nova lógica financeira. Nenhuma dessas operações foi executada.

### P‑04 — metadata Google, sem alteração ou envio

O proprietário pode fornecer somente: nome do projeto; estado de publicação; audiência; se a conta de aceite está entre os usuários permitidos; estado de verificação e limites exibidos para Gmail API. Não enviar lista completa de endereços, segredo, credenciais JSON, senha ou token. Alternativamente, autorizar inspeção de uma sessão de console já autenticada, limitada a essas telas, se houver mecanismo disponível.

Verificar o escopo existente `gmail.send`, sem conceder novo escopo ou modificar configuração. Depois, decidir entre corrigir configuração com autorização própria ou aceitar oferta restrita. Consentimento de outra conta/envio real exige etapa própria; não está incluído nesta proposta de leitura.

### P‑05 — confirmar destino e acompanhamento de alerta

Confirmar a configuração existente de notificações de falha do workflow e o destino operacional que será acompanhado. Priorizar recibo/configuração já existente ou aceite explícito do canal GitHub Actions como acompanhamento manual inicial. Nenhum alerta externo foi prometido como entregue.

Se for indispensável um teste controlado, pedir autorização específica para um único disparo e seu destinatário antes de executá-lo; não causar erro no produto, enviar email ou alterar Sentry/GitHub silenciosamente.

## 5. Roteiro do aceite visual do proprietário

P‑01/P‑02 concluídos tecnicamente. Conta investidora existente: `r3-14946805-c4de-48a1-b15e-31f6fd06ff31-a@example.invalid` (QA A). Usar a senha QA já fornecida, sem publicá-la em documentos. O acesso ao Preview pode exigir primeiro a autenticação do proprietário no Vercel.

Os contextos e snapshots anteriores foram restaurados após os testes, mantendo a revisão CAS monotônica. Assim, respostas já existentes podem dispensar perguntas no próximo acesso. Não apagar a fixture para forçar lacunas; para repetir “Não sei” a partir de um estado específico, preparar novamente somente esse contexto QA dentro do escopo P‑02, coordenando o momento para não sobrescrever a conferência humana.

Roteiro do proprietário:

1. No novo Preview identificado no recibo, usar investidor QA A, perfil pessoal; Matches → contato desbloqueado **R3 Fictional QA B** → Portfólio → **1200 Fictional QA Avenue**.
2. Pedir Enterprise pelo fluxo existente. Conferir “Não sei”, as alternativas e a revisão da estimativa antes de confirmar; nenhum valor deve ser adotado sozinho.
3. Confirmar bases/premissas e gerar, ou escolher parcial explicitamente; custo desconhecido não vira zero e ROI/lucro dependentes não são fabricados.
4. Recarregar, conferir inputs persistidos e retomar o mesmo pedido; comparar referência/versão/cenário e PDF, imóvel, fontes e limitações.
5. Abrir entrega do relatório salvo, sem voltar à seleção Basic ou iniciar nova análise. Preparar email não deve disparar download automático.
6. Conferir nomes Basic/PRO/Enterprise, assunto/corpo editáveis e destinatário salvo/escolhido. Preparação preserva o PDF correto e as fotos disponíveis.
7. Para remetente Gmail real, usar somente conta legítima com Gmail salvo no perfil ativo e caixa autorizada correspondente. QA `.invalid` não serve para esse teste. Não enviar sem autorização específica; validação de recebimento é separada de ACCEPTED.
8. Registrar aceite ou uma falha concreta com candidato e passo. **Aceite visual humano: NOT RUN**, somente o proprietário pode concluí-lo.

## 6. Manifesto e rollback

Manifesto versionável: [DEALSIFTER_LAUNCH_CANDIDATE_MANIFEST.json](DEALSIFTER_LAUNCH_CANDIDATE_MANIFEST.json). Contém os commits não publicados e a rastreabilidade dos quatro assets. Evidências auxiliares privadas: `baseline.json`, `boundary-measurements.{json,sql}`, `monitoring.json`, recibos de build e scripts em `.tmp-codex/launch-closure-20261121/`. Não incluir o arquivo tar, dependências, tokens ou artefatos privados de QA no Git.

Rollback preparado, não executado:

- Frontend Production anterior: `dpl_E1HCT53SB3mZjX1jUsgqSJ7Ky82g`. Não altera banco nem tokens; preserva a entrega Gmail editável e precede o ajuste geral dos modais.
- Novo Preview: cancelar/remover somente o candidato novo se autorizado; retirar apenas a origem CORS adicionada com comparação da configuração vigente. Production não participa dessa operação.
- QA: restaurar somente o estado sintético alterado com CAS atual e sem sobrescrever concorrência; não apagar a fixture de aceite.
- Não há rollback de schema/funções a executar nesta tarefa, pois não foram alterados.

## 7. Decisão e checklist final

**CONDITIONAL GO permanece.** P‑01 e P‑02 foram autorizados e executados. Foram concluídos o Preview equivalente, CORS preservado, 11 verificações autenticadas de storage/CAS/RLS, 17 verificações do caminho estimado e 19 do parcial/contextual, além dos 74 testes locais anteriores. A mensagem de capacidade continua pendente, assim como P‑03, P‑04, P‑05 e o aceite visual humano. Não há base para declarar lançamento pago irrestrito nem promover frontend automaticamente.

Condições que admitem exclusão explícita: oferta geral de email pode ficar restrita ao público Google efetivamente permitido, com PDF como alternativa; prestadores/FSBO podem ser retirados da oferta inicial se isso for decidido e refletido honestamente; alerta externo pode dar lugar a acompanhamento manual do canal existente se aprovado. Não excluir billing enquanto se vendem planos/Nuggets, nem declarar R‑3.1 aceito sem o percurso correspondente.

- [x] Source/deployment/rollback identificados; Production preservada.
- [x] Manifesto e inventário local; sem push e sem stash aplicado.
- [x] Índice vigente corrigido sem eliminar histórico.
- [x] 74 testes direcionados PASS; mocks separados de provas autenticadas.
- [x] Tamanhos sintéticos medidos pelo PostgreSQL, sem persistência.
- [x] Eventos existentes do release no Sentry e health real do workflow localizados.
- [x] P‑01: autorização, publicação e verificação do Preview final/CORS.
- [x] P‑02: autorização e execução de sessões/escritas QA; fronteira/CAS e caminhos parcial/contextual verificados.
- [ ] LC‑05: mensagem específica de capacidade corrigida, ou ressalva explicitamente aceita pelo proprietário.
- [ ] P‑03: oferta comercial aprovada e transações essenciais validadas em ambiente seguro.
- [ ] P‑04: audiência/verificação/quota Google confirmadas ou oferta explicitamente limitada.
- [ ] P‑05: destino/acompanhamento operacional de alertas confirmado.
- [ ] Aceite visual do proprietário registrado.
- [ ] Decisão final de GO e eventual autorização de publicação; nenhum deploy geral automático.

### Fechamento do build isolado

Build local do Preview: **PASS**, offline, com 140 assets e scan PASS. Source `1862ad2b8db5e48d5a7e1abb217ccd9a471dc262`; SHA‑256 do archive de source: `541db8a31f33e58ad9107dfe7dfa8a8b4188f4cbcaf1325469871c96380d1fda`. Pacote prebuilt preparado em `.tmp-codex/launch-closure-20261121/preview-upload/`, exclusivamente conectado ao staging. Manifesto dos assets e fingerprint agregados registrados no manifesto de candidato.

Não foram copiadas chaves/preços LIVE Stripe ou credenciais de observabilidade de Production para esse build. Por isso ele está preparado para a homologação R‑3/relatórios, não para certificar checkout antes da configuração TEST autorizada em P‑03. `VITE_APP_URL` vazio usa `window.location.origin` pelo comportamento já existente, sem alteração de código.

Publicação e CORS foram posteriormente autorizados e executados: **PASS**, conforme LC‑01. Build e E2E automatizado não significam aceite visual humano nem autorizam publicação em Production.

### Fechamento dos testes autorizados

- Banco autenticado: **11/11 PASS**, `boundary-authenticated.json`.
- Navegador, estimado: **17/17 PASS**, `browser.json`, depois de corrigir exclusivamente a espera do roteiro para abrir o chat recolhido após reload. Três estimativas só foram adotadas após confirmação; mesmo pedido original; persistência após reload; PDF de quatro páginas com método/origem/limitações.
- Navegador, parcial e entrega contextual: **19/19 PASS**, `browser-partial.json`. ROI/lucro nulos, parcial explícito, mesmo pedido, PDF de três páginas, Enterprise preservado no modal após reload, assunto/corpo editáveis. Abrir email não baixou PDF e não regenerou relatório. O download explícito pelo modal funcionou após reload.
- PDF parcial e contextual têm o mesmo texto extraído em todas as páginas, SHA‑256 textual `6864109dc17c2ba2c3a9e0110eb566fd91ac79be58619d47e513c0f34d3a2824`. Os binários têm mesmo tamanho, mas hashes diferentes; não se alegou identidade binária. Snapshot salvo permaneceu inalterado ao abrir/editar/baixar no modal.
- CORS: oito casos positivos, preservando a origem anterior, e quatro casos negativos sem ACAO para origem não autorizada. Sem wildcard.
- A conta QA `.invalid` corretamente não autorizou envio Gmail. Nenhum consentimento ou envio real foi executado; remetente Gmail real e recebimento continuam separados dessa prova.
- A rede do navegador permitiu o backend de staging e os RPCs de leitura/escrita estritamente necessários. Bloqueou compras, emails, chamadas generativas, tradução externa, gravações de perfil/imóvel/chat e outros efeitos fora de P‑02. Os tiles externos também foram bloqueados. Isso limita o alcance da prova: backend/RLS/persistência/renderer são reais, mas cobertura de mapas online, chat generativo e autosaves fora do escopo não foi certificada.
- Não houve alteração de produto para fazer testes passarem. A lacuna de mensagem de capacidade permanece reproduzida e explicitamente aberta, mesmo com os checks de preservação/retomada PASS.
- Conferência final somente leitura: contexto e snapshots originais restaurados; revisão CAS monotônica; ledger de provedores **2 → 2**, entregas **6 → 6**, unlocks **10 → 10**, soma de saldo das duas contas QA **5 → 5**. O primeiro comparador sinalizou diferença porque a API administrativa serializou `rehab_budget` como string e o REST como número; a comparação com normalização desse campo confirmou igualdade. Não houve correção remota para obter esse resultado.
- Production continua em `dpl_aQU5cyEmcnKDMx79iK8yvmrGgdgo`. Nenhum comando de deploy de função foi executado. A atualização dos secrets CORS foi acompanhada de incremento de versões pela plataforma: staging Chat 82, Inputs 21, OAuth 7 e Delivery 9, todos ACTIVE; a verificação dos bundles após CORS está no recibo `backend-post-cors.json`.


### Histórico da referência anterior à publicação de interface/atividades

Frontend Production **https://dealsifter.com/** (também www e host Vercel), deployment **dpl_AFHx1AFTwsTuGnXWyV5khESJ23bn**, READY; código **4e5cc98b4211e6b412a93b50450cc0dea9aab029**, fingerprint **63837bdec969653cdb86bf79f6c3aa7be5c9f9c2ecdb55aa92f2de31c60f0e03**. Publicação geral autorizada e concluída em 24/11/2026: lembretes de salvamento, remetente Gmail pelo perfil principal/selecionado e avatares mobile A/B de 34 px, além da reconciliação dos deltas anteriores já publicados. Backend Inputs **18** / Chat **106**: versões, hashes e JWT das **28 funções** comparados e preservados; sem redeploy backend, migration ou mudança de secrets nesta rodada. Sem push; stash preservado. Evidências em `.tmp-codex/save-reminder-release-20261123/`; rollback frontend **dpl_Ai7NXQNG4j4KznfQJegX1ZiASMAX**. O manifesto anterior permanece histórico, com esta publicação acrescentada separadamente.


### Referência frontend anterior à correção Maps

Frontend Production **https://dealsifter.com/** (também www e host Vercel), deployment **dpl_6PTzjfCSBJ4Cq3FdZCS7gmgbNubk**, READY; código **7b7048358b467c8a30bca2145bab479764c74cc6**, fingerprint **572fa1da282d3f7556c613084ec5f8808c2851d015b6ad615092afacaf54f972**. Publicação Classe A de interface/atividades concluída em 24/11/2026. Testes 124/124, lint, TypeScript, build, smokes do staging e de Production PASS; 28 funções backend preservadas. A nova verificação de contatos permanece como preparação local e não integra esta publicação. Sem migrations, push, emails ou chamadas pagas; stash preservado. Evidências em `.tmp-codex/ui-localization-release-20261124/`; rollback frontend **dpl_AFHx1AFTwsTuGnXWyV5khESJ23bn**. Gates comerciais e aceite humano permanecem inalterados.
