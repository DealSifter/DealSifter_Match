# Property Release: entrega Gmail com anexos automáticos

## Causa confirmada

O caminho Portfólio → Property Release ainda usava mailto, abria o Outlook e descrevia os arquivos como anexos manuais. A publicação Gmail anterior abrangia somente relatórios salvos L2/L3. O texto Trello era escolhido pelo destinatário e não era a causa do problema. Separadamente, o Portfólio usava o email do perfil como fallback de Para, confundindo remetente e recebedor.

## Candidato publicado somente no staging

- Portfólio L1 abre o mesmo modal de revisão Gmail dos relatórios salvos. Nenhum mailto, download automático para anexação manual ou seleção de remetente no Outlook nesse caminho.
- Remetente: própria caixa Gmail conectada, validada no backend contra o usuário autenticado. Para/Cc/Cco: destinatários salvos da conta ou escolha explícita. Email do perfil não preenche Para; registros salvos intencionalmente não são apagados. Preferências legadas globais não são lidas diretamente pelo Portfólio como destinatários de outra conta.
- PDF obrigatório e fotos opcionais, preparados antes de confirmar o envio. Usa renderer existente; nenhuma aquisição paga, tradução ou nova análise é iniciada para enviar.
- Fotos vêm dos registros property_images do próprio imóvel. Acesso segue propriedade própria ou associação desbloqueada retornada pelo RPC canônico, com leitura RLS pelo JWT do usuário. Não depende de plano de análise paga para o L1.
- Fonte e autorização são reconferidas ao preparar e enviar; registro alterado interrompe a ação. O texto CRM é reconstruído no servidor a partir dos dados atuais do cadastro, sem copiar análises/clientes ou contatos arbitrários do payload.
- Identidade, PDF, limites MIME, remetente, confirmação e idempotência continuam no domínio único. O L1 usa identidade estável da fonte para impedir duplicidade mesmo se metadados de renderização mudarem. As chaves existentes de idempotência L2/L3 foram preservadas.
- O PDF é produzido no navegador. O backend valida formato, acesso, fonte, contexto e hashes, mas não atesta semanticamente cada byte do PDF/fotos de um cliente modificado. Mantém a mesma limitação de confiança documentada para L2/L3.

## Schema aplicado após autorização específica

`docs/proposals/report_mail_delivery_property_release.sql`: acrescenta artifact_type com default SAVED_REPORT, permite report_id nulo somente quando artifact_type=PROPERTY_RELEASE. L1 não cria relatório pago fictício em maxxis_reports. Constraint mantém report_id obrigatório para SAVED_REPORT; preserva FKs existentes, RLS, permissões e linhas. O arquivo termina em ROLLBACK; o dry-run e a aplicação foram autorizados especificamente e registrados nos recibos.

Nenhuma mudança em Production, login, pricing, nuggets, Stripe, motores ou segredos OAuth. Nenhum email enviado. Sem commit/push. O Preview vigente desta correção é o indicado abaixo.

## Verificações locais

22/22 testes finais passaram, incluindo percurso de clique do Portfólio até a revisão Gmail, recusa de acesso à fonte, separação remetente/destinatário, PDF+foto no envelope após confirmação, registro alterado, imagem de outro imóvel, ausência de acesso e idempotência após mudança de metadados de renderização. A execução anterior de regressões teve 110 casos aprovados e uma falha apenas de matcher de teste DOM não instalado; esse matcher foi corrigido e o caso passou na execução final. O teste existente de download real do PDF L1 também passou (execução direcionada anterior: 39/39).

Lint e Deno check da função: PASS. TypeScript do contrato: PASS. Build offline: PASS. Fingerprint: `01da61219f3f0d6b08bcfc07c570f759b3dd58cc2a8ab8ea715032bcf3691e0b`. Sem prova de envio real, recebimento ou aceitação visual nesta rodada.

## Publicação staging autorizada

- Preview READY: https://dealsiftermatch-60x7087fe-deal-sifter-match-s-projects.vercel.app
- Deployment: dpl_8EHkQtFj7kqHVA7cjPC3eU3d9zgg. Fingerprint 01da61219f3f0d6b08bcfc07c570f759b3dd58cc2a8ab8ea715032bcf3691e0b.
- Staging reconfirmado: oqdcnjupquhybwdbeeew. Função report-mail-delivery ACTIVE, JWT obrigatório (recibo imediato v3; baseline anterior v2 comparado antes da atualização). Comparação AST confirmou preservação da função anterior, exceto pela extensão L1 revisada. Backup privado do bundle anterior mantido.
- Dry-run transacional PASS e rollback confirmado antes da aplicação exata. SHA-256 do SQL normalizado: 575e2449c2b70995496270c6cbcbd810f6e24d96f50787f80a9b918f22d70a86. Nenhuma linha de fixture persistida. Verificados campos obrigatórios por tipo, default compatível com clientes antigos, FK, RLS e bloqueio de acesso pelo navegador.
- CORS exato PASS nas quatro funções. Sete probes HTTP negativos PASS; tabela REST anônima 401/backend 200; contagens preservadas. Zero chamadas Google e zero emails enviados pelo agente.
- Varredura de segredos do build PASS. Nenhum segredo OAuth alterado. Production Vercel permaneceu em dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX. HEAD e stash preservados; sem commit/push.
- Recibos privados em .tmp-codex/r32-l1-gmail/.

O proprietário deve usar o novo Preview, entrar com a conta Gmail confirmada, selecionar seu destinatário e conectar/reconferir a própria caixa antes da confirmação de envio. Recebimento real, anexos no destinatário e criação do card Trello continuam pendentes de aceitação pelo proprietário.

Navegador autenticado QA no Preview novo: PASS. Login legítimo HTTP 200 → Matches → contato sintético → Portfólio → imóvel → opção L1 Gmail. Confirmados seletor Gmail, destinatário editável e ausência de instruções de anexo manual; zero erros de página. HTML do Preview e assets conferidos por hash, backend staging real; chamadas externas/tradução bloqueadas. O teste parou antes de preparar/enviar e não modificou destinatários nem gerou relatório. Prova do envelope/anexos continua nos testes offline; recebimento real permanece pendente. Recibo browser.json e captura privada l1-selector.png.

## Correção posterior de continuidade

Preview vigente: https://dealsiftermatch-nx96y4o7m-deal-sifter-match-s-projects.vercel.app. Correção do leitor L1 para a consulta autorizada existente e estado terminal de envio nas três categorias. Evidências e limites em R3_2_MAIL_DELIVERY_CONTINUITY_FIX.md. As URLs anteriores acima são históricas. Sem nova migration, Production ou email enviado pelo agente.
