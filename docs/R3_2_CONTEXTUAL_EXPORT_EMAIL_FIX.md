# R-3.2 — Entrega contextual de relatórios

## Escopo e diagnóstico comprovado

Ambiente de homologação: staging `oqdcnjupquhybwdbeeew` (`maxxis-migration-validation`). Production não é alvo desta fase. As fixtures A/B e o desbloqueio legítimo existentes são reutilizados, sem novos créditos, desbloqueios ou usuários.

1. **L3 virava L1:** `MatchesPortfolio.startMaxxisAnalysis` transportava um callback `onEmail` que reabria o exportador genérico do Portfólio. O confirmador desse exportador chama `generateReleasePdf`, cujo schema é sempre `PROPERTY_RELEASE`. Nenhum identificador do L3 preparado orientava essa entrega.
2. **Download inesperado:** o preparo genérico selecionava `exportPdfWithEmail` automaticamente; `generateReleasePdf` executa download. Separadamente, `emailSavedReport` chamava `downloadSavedReport` antes de abrir `mailto:`.
3. **Nova análise:** ao retornar ao seletor genérico, escolher L3 dispara uma nova solicitação; não recuperava o relatório anterior.
4. **Email real:** os relatórios usavam apenas `mailto:`. Não havia envio de PDF anexado pelo backend, nem confirmação de recebimento. `send-support-email` usa Resend para tickets de suporte, com destinatários e autorização próprios, e não aceita anexos de relatórios. Esse endpoint não foi reaproveitado indevidamente.
5. **Remetente:** a URL define destinatários, assunto e corpo; não controla a conta remetente do Outlook/Gmail. A escolha efetiva dessa conta pertence ao cliente externo. Não foi demonstrado qual conta o cliente do proprietário selecionou, nem por que escolheu essa conta. Nenhuma entrega anterior foi presumida.

## Correção e contrato de continuidade

- `MaxxisAssistant` mantém a entrega contextual no Maxxis, tanto para mensagens novas/restauradas quanto para Meus Relatórios. Remove-se o retorno ao seletor L1 para email do L2/L3.
- `reportDelivery.js` cria uma referência com usuário, imóvel, relatório, tipo, versão, solicitação, cenário/versão, idioma e SHA-256 canônico do schema + solicitação. O schema inclui as opções de divulgação e os dados aprovados. Ordenação de chaves JSONB não muda o hash.
- Reutiliza-se `maxxis_reports`; não foi criada tabela, bucket ou persistência paralela de PDFs. Apenas referências e hashes, sem snapshot privado nem destinatários, ficam em `sessionStorage`, separados por usuário, para sobreviver ao reload da aba. Os destinatários são uma preferência privada separada, descrita abaixo.
- O snapshot salvo é recuperado por `readMaxxisReportForDelivery`: `auth.getUser()` no servidor, leitura por ID/usuário sob RLS, exclusão lógica respeitada e RPC existente `ds_has_maxxis_analysis_context_access`. A concessão persistida válida autoriza a entrega sem RPC de cobrança/desbloqueio.
- Após a leitura autenticada, todos os identificadores e o hash são comparados com a referência original. Como a persistência existente pode substituir o payload de uma mesma linha, mudança de cenário/schema/solicitação interrompe a entrega. A referência não é um token de autorização: a autorização continua no backend. O hash é verificado pelo cliente contra o snapshot recém-lido; não existe novo endpoint servidor de envio/assinatura.
- Há revalidação na abertura, em cada ação e após renderização, antes do download. A troca de conta ou fechamento durante uma operação impede a divulgação tardia.
- O modal identifica o imóvel e fixa o nível. Não oferece seletor, preflight, novas estimativas ou geração de análise. Cancelar mantém o relatório. Reload recupera a referência e exige novamente a leitura autorizada.
- PDF ainda não materializado usa o renderer/cache existentes com o snapshot salvo e seu idioma. Não executa aquisição, Gap Resolver, cálculos novos ou débito. Não altera o design aprovado.
- Clique repetido é bloqueado por lock síncrono durante a operação; no modal, a mesma ação concluída fica desabilitada. Para nova ação voluntária, o usuário pode reabrir a entrega.
- O navegador revelou uma janela entre a resposta da RPC e a atualização do ID salvo na mensagem. Exportar/preparar email ficam desabilitados até a confirmação de persistência, inclusive na geração iniciada diretamente pelo texto do chat. Downloads indisponíveis no histórico exibem orientação em vez de uma rejeição sem tratamento.

## Modalidades: o que realmente acontece

| Ação | Comportamento | O que não se afirma |
|---|---|---|
| `DOWNLOAD_REPORT` | Clique explícito materializa/reutiliza o PDF correto e solicita download | Não equivale a email enviado |
| `PREPARE_EMAIL_DRAFT` | Valida até 10 destinatários, sem quebras de linha/injeção de cabeçalhos, e solicita abertura do cliente externo | Não envia, não anexa PDF, não confirma sequer que um cliente esteja instalado |
| `SEND_REPORT_EMAIL` | Não disponibilizada: inexiste backend de anexos de relatórios | Sem sucesso de envio ou entrega simulado |

O modal explica que o remetente é selecionado no cliente externo. Não define `From` ou `Reply-To`. O corpo contém apenas referência/nível e a instrução de anexação manual, sem copiar a análise privada inteira. O usuário baixa o PDF por botão separado, anexa e envia no seu aplicativo.

O screenshot do Outlook enviado durante a conferência revelou um defeito adicional: `URLSearchParams` aplicava codificação de formulário (`+` para espaços) e incluía Cc/Bcc vazios. O construtor passa a usar RFC 6068 (`encodeURIComponent`, espaços `%20`, novas linhas CRLF) e omite cabeçalhos opcionais vazios. O teste cobre espaços, alias com `+`, destinatários com cópia e ausência de cópias vazias. A conta exibida em “De” continua pertencendo ao Outlook, não ao campo “Para”.

O exportador genérico do Portfólio permanece disponível para L1/L2/L3 conforme os acessos existentes. Na opção de email, os downloads de PDF/fotos começam desmarcados, inclusive se preferências antigas os marcavam. Os controles dizem explicitamente “baixar para anexar manualmente”; somente essa escolha explícita pode baixar arquivos durante o preparo genérico. A ação principal é “Abrir rascunho”, e a descrição deixa claro o limite do cliente externo. Destinatários são validados antes de preparar arquivos.

### Destinatários registrados e recuperação do Trello

O cadastro original não tinha persistência remota desses endereços: usava somente `ds_export_mail_defaults`. Além de a chave ser limpa no logout, havia uma remoção explícita no saneamento inicial do App. Isso pode explicar o desaparecimento observado; não prova o histórico do navegador específico do proprietário.

O modal contextual e o genérico agora recuperam primeiro `users.settings_payload.userPreferences.reportEmailRecipients`, usando a sessão real, leitura RLS e filtro do próprio usuário. As caixas ficam em carregamento enquanto essa leitura ocorre. O remetente esperado é obtido de `auth.getUser().email`, separadamente de Para/Cc/Bcc; isso não muda a conta remetente do Outlook.

Depois da validação dos destinatários, o salvamento remoto é confirmado antes de solicitar o rascunho. A normalização de preferências preserva esse campo, e um evento interno por usuário mantém o editor de Configurações sincronizado. A RLS do campo existente foi testada no staging: A lê seu cadastro; B não lê o `settings_payload` de A. Nenhuma migration ou nova política foi necessária.

Um endereço antigo ainda presente no navegador pode ser recuperado somente quando seu proprietário corresponde à conta atual. A limpeza inicial deixa de apagar essa preferência real. Uma chave sem proprietário confiável não é importada para outra conta. Se o endereço do Trello já tiver sido apagado e nunca salvo no servidor, não é possível reconstruí-lo nem recuperá-lo automaticamente de outra origem/Preview. Não há endereço inventado como substituto. Os próximos salvamentos persistem por conta e sobrevivem à troca de Preview/login.

## Segurança e limites

- Sem `service_role` no frontend; sem alteração de RLS ou cobrança. O teste A/B usa sessões legítimas, não mocks de autenticação.
- O acesso ao artefato e sua concessão são os mecanismos existentes. Contatos/opções permanecem exatamente no snapshot autorizado; a entrega não amplia o conteúdo.
- Sem URL pública permanente, logs de PDF privado, JWT, senha ou conteúdo de relatório real.
- Nenhum email externo deve ser enviado sem caixa QA e autorização específica. Os testes desta fase não tentam comprovar entrega em `.invalid`.
- Financeiro, pricing, Nuggets, Stripe, renderers e R-3.1 não foram alterados nesta fase. Alterações anteriores desses módulos no working tree pertencem às fases anteriores.

## Validação

Evidências de execução ficam em `qa/report-r32-acceptance/`; artefatos intermediários/credenciais ficam ignorados em `.tmp-codex/r32-delivery/`. Credenciais não fazem parte deste documento.

Preview final: https://dealsiftermatch-5rrt8ujhv-deal-sifter-match-s-projects.vercel.app

Fonte do build: `b50c5b598d721d667365b4ce1cb3c442e5819d8a0cdd0fdd3d60e0ab79e6cfed`. Deployment de Preview: `dpl_5EuwEN1k6pnknLctvjrTYNRY3aPU`. Production permaneceu em `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`.

- **123/123 testes direcionados** em 17 arquivos; lint dos módulos alterados sem avisos; TypeScript do contrato PDF e build offline PASS. As falhas intermediárias de teste foram corrigidas/reexecutadas; uma execução durante build excedeu o tempo do teste e foi repetida sem concorrência de build. Não se trata de checagem TypeScript irrestrita de todo o repositório.
- E2E real com login/senha da fixture A, backend staging e RLS reais: Matches → contato QA B efetivamente desbloqueado → Portfólio → L3 → modal contextual → rascunho → reload → PDF; L2 pelo histórico e fluxo genérico L1 também conferidos. Os assets são bytes do Preview verificados por SHA-256; a proteção Vercel é atravessada pelo cliente CLI autorizado. Não há mock de backend/autenticação. A CSP do harness bloqueia clientes de email externos; codificação do URI é conferida separadamente por teste. Isso não comprova envio ou recebimento.
- Na geração: 2 preflights, 1 persistência do relatório. Depois disso, entrega/reload/histórico não repetiram essas operações. Nenhum unlock/cobrança foi solicitado; 2 downloads, ambos explícitos, um por PDF. Duplo clique no download L3 produziu um arquivo. Os 3 salvamentos de destinatários correspondem às 3 ações distintas de rascunho, sem repetição involuntária.
- Depois de apagar `ds_export_mail_defaults` e `ds_user_preferences` da sessão automatizada, o destinatário registrado foi recuperado do servidor após reload. A preferência sintética do teste foi removida ao final, sob condição de ainda conter exatamente Para/Cc/Bcc do teste; nenhum destinatário real é sobrescrito. As fixtures, relatórios e desbloqueio permanecem disponíveis.
- **L3:** 4 páginas, 155.765 bytes, cabeçalho correto e imóvel QA correto, sem cabeçalho L1. **L2:** 3 páginas, 147.923 bytes, tipo e imóvel corretos. Ambos com assinatura `%PDF-`, sem texto `undefined`; cenário L3 vinculado à revisão 16 na referência/snapshot. O viewport mobile de 390 px não apresentou overflow do modal.
- Isolamento real: A lê seu relatório, B recebe zero linhas para o relatório de A; anônimo recebe 401. Para as preferências privadas, A recebe seu cadastro e B recebe zero linhas do cadastro de A. Ledger de provedores no período da execução: vazio. RentCast, Gemini, Graph e Resend: nenhuma chamada de envio/aquisição executada pelo agente.

| Teste | Resultado e limite |
|---|---|
| T1 — L3 do chat → email | PASS para entrega contextual/rascunho do L3 salvo; não gera L1 |
| T2 — email sem download | PASS; rascunhos sem download automático |
| T3 — reutilização | PASS; mesmo snapshot, sem repetir preflight, análise ou cobrança |
| T4 — cancelar | PASS; reabertura preserva relatório |
| T5 — reload | PASS; mesma referência e destinatários recuperados do servidor |
| T6 — L1/L2 | PASS; L1 PDF com renderer real no teste DOM; L1 rascunho e L2 histórico/PDF também no navegador |
| T7 — remetente/destinatário | Campos separados e remetente esperado vindo do login: PASS. Garantia de envio pela caixa do login: PENDENTE OAuth |
| T8 — rascunho versus envio | Rascunho: PASS. Envio efetivo/entrega pelo backend: NÃO IMPLEMENTADOS/NÃO COMPROVADOS |
| T9 — PDF | PASS de integridade, tipo, imóvel e vínculo de snapshot/cenário; design preservado |
| T10 — duplicidade | PASS dos cliques repetidos; nenhuma cobrança; envio backend não se aplica |
| T11 — segurança | PASS de testes de contexto alterado/concessão e isolamento real A/B/anônimo |
| T12 — R-3.1 | PASS das regressões de Não sei, estimativas, parcial, confirmação, CAS e retomada |

Evidência vigente: `qa/report-r32-acceptance/README.md`, `summary.json`, PDFs, PNGs e auditorias. Não confundir testes unitários com navegação autenticada, aceitação técnica com aprovação visual do proprietário, nem rascunho com envio efetivo. A aprovação visual final permanece pendente.

## Dependência concreta para envio pela caixa do usuário

O proprietário confirmou que o remetente deve ser a caixa do usuário logado e autorizou preparar OAuth. Isso substitui a proposta de envio por remetente do domínio do sistema: Resend para suporte não concede permissão de envio como uma caixa do usuário. A decisão vigente é **somente Gmail, sem contratar Azure nem adicionar custos**; ver [R3_2_GMAIL_OAUTH.md](R3_2_GMAIL_OAUTH.md). A conexão tem candidato local com testes offline; ainda não está publicada/operacional e o envio com PDF permanece pendente. Aguardam registro Google, configuração, autorização específica de schema/publicação em staging e identificação da conta Gmail real autorizada para teste. Nenhuma autorização ou entrega foi simulada.

Não há migration, commit, push ou publicação em Production nesta fase. A homologação visual pelo proprietário continua pendente até sua conferência.
