# Gmail: entrega do relatório com anexos — candidato publicado no staging

## Problema confirmado pelo proprietário

O botão anterior abria `mailto:`. O cliente Outlook escolhia a conta remetente local, independentemente do login DealSifter. Uma fixture QA `.invalid` não possui caixa real. O corpo continha somente referência e instrução de anexo manual; isso não atende à alimentação de CRM/Trello. A conexão OAuth publicada anteriormente não implementava envio. A entrega por API foi autorizada separadamente e publicada somente no staging, conforme recibo abaixo.

## Mudanças publicadas no staging

- Entrega contextual L2/L3 sem `mailto:` ou abertura de Outlook. Conta sem Gmail confirmado/conectado não envia; download do PDF permanece disponível. A caixa deve ser do mesmo usuário autenticado, validada novamente no backend.
- Modal com tipografia explícita, cores do tema, campos compactos, Cc/Cco em duas colunas no desktop, botões no padrão turquesa e layout responsivo. Capturas de fixture visual offline em `.tmp-codex/r32-mailbox/visual/desktop.png` e `mobile.png`; fontes de 14px, sem transbordamento horizontal em 1280px e 390px. Não são prova de autenticação ou de envio real.
- Preparar e revisar antes de confirmar. PDF do mesmo renderer e snapshot salvo, sem novas aquisições, análise ou cobrança. Fotos preparadas do mesmo imóvel (até cinco, limite explícito igual à preparação de mídia atual); se alguma não puder ser obtida, o envio é bloqueado até nova tentativa ou desmarcação explícita das fotos. Nenhuma substituição de imagem.
- PDF e fotos anexados automaticamente em MIME UTF-8. PDF sempre obrigatório; fotos opcionais. Limite total de 6 MiB de anexos, conferido no cliente e servidor. Assunto com endereço e nível; corpo em texto com campos do cadastro disponíveis, descrição, notas, evidências textuais salvas, links de todas as fotos públicas e referência de relatório/cenário. Zero valores inventados ou premissas novas.
- Remetente fixado no servidor a partir da caixa OAuth do próprio usuário; o cliente não escolhe `From`. Destinatários separados, recuperados das preferências existentes e validados contra injeção de cabeçalho. Não há leitura de caixa nem scope novo.
- Função candidata `report-mail-delivery`: autenticação JWT no gateway e no código, origem exata, leitura do relatório via RLS do solicitante e RPC existente de acesso ao imóvel. Comparação de relatório, imóvel, nível, versão, cenário, idioma e fingerprint antes do envio. Não chama RPC de débito/unlock nem provedores de inteligência.
- Tabela privada proposta em `docs/proposals/report_mail_delivery.sql`, fora das migrations automáticas e terminando em ROLLBACK. Sem policies/acesso direto de navegador. Guarda somente identificadores, hashes, estado e resposta técnica; não guarda destinatários em claro, corpo, PDF, fotos ou tokens.
- Reserva única antes do HTTP Gmail evita duplicação por clique, reload, aba nova e nova codificação do mesmo relatório. Resultado incerto/timeout permanece INDETERMINATE, sem retry. Nova tentativa só para rejeição definida FAILED, após confirmação explícita e compare-and-set atômico de FAILED para SENDING.
- Gmail aceitou a mensagem não significa destinatário recebeu ou Trello criou o card. Mensagens da interface distinguem aceitação, rejeição e resultado indeterminado.

## Limites de confiança dos anexos

O PDF é renderizado no navegador pelo renderer existente e os mesmos bytes revisados são enviados ao backend; o backend confere acesso, snapshot atual, formato/tamanho, parse do PDF e hashes de anexos. Não há renderer PDF novo no servidor, nem assinatura que ateste semanticamente todo o conteúdo de um PDF arbitrário enviado por cliente modificado. Não apresentar o recibo como tal atestação. As fotos também são preparadas no cliente a partir da mídia do snapshot; o backend limita quantidade, tipo e tamanho, mas não busca outra vez cada foto para comparação binária. O usuário autenticado autoriza deliberadamente o envio pela própria caixa.

O texto de CRM usa somente o snapshot salvo. Não promete mapeamento automático de campos customizados do Trello, que dependerá do board/parser do destinatário; o teste real deve comprovar recebimento de texto, PDF e fotos no destino escolhido pelo proprietário. O PDF continua contendo a análise completa e suas limitações.

## Verificação

96/96 testes em sete arquivos passaram, offline. Incluem: autorização e identidade Gmail, contexto alterado, mailbox ausente/expirada/divergente, PDF inválido, anexos, MIME Unicode, texto CRM com fatos canônicos e conflitos, remetente correto, header injection, duplo clique/reload, falha/timeout sem retry, confirmação explícita de nova tentativa, preferência de destinatários, conta QA bloqueada e confirmação separada do envio.

Lint dos arquivos JS/JSX alterados, Deno check da função com SDK/parser real, TypeScript do contrato e build offline final passaram. Fingerprint final: `c8c506102cf6c76ebeddd1801922be6b468362c18fdfda8cb4c0a924e0175424`. Nenhuma mensagem real foi enviada pelo agente. A tabela e a função de entrega foram publicadas somente no staging após autorização específica; Production permanece intocada.

Preparar email não chama o serviço de tradução/IA: usa texto salvo/cache e prepara somente a mídia necessária ao mesmo renderer. O fluxo de download existente foi preservado. A proposta usa as configurações OAuth já instaladas, sem novos scopes ou segredos.

O parser do endpoint também leu offline o PDF L3 sintético já produzido pelo renderer real: quatro páginas, 155.765 bytes, sem criptografia. Isso comprova compatibilidade de leitura desse artefato; não comprova envio/recebimento. Relatório de testes: `.tmp-codex/r32-mailbox/delivery-tests.json`.

## Publicação autorizada e conferência pendente

O proprietário autorizou o dry-run/aplicação da tabela privada, a função de entrega e o novo Preview com CORS exato. Execução concluída somente em staging `oqdcnjupquhybwdbeeew`.

- Preview READY: https://dealsiftermatch-82shz5lo6-deal-sifter-match-s-projects.vercel.app
- Deployment: `dpl_EX6rMYa6uHHhu924VHYcfz2MNFea`.
- Função `report-mail-delivery` v1 ACTIVE, verify_jwt=true. OAuth existente não foi republicado.
- Dry-run transacional passou e rollback foi confirmado antes da aplicação exata. SHA-256 SQL normalizado: `a3c672004258b7a3e6d5782c762714f0a5f14ba65137a94589ff35ebb93f56c2`.
- Verificados: RLS, ausência de privilégios browser, permissões backend, duplicidade, estados, retry CAS, bloqueio de retry incerto e FK. Nenhuma fixture persistida na nova tabela.
- CORS exato passou para entrega, OAuth e as duas funções Maxxis existentes. Sete probes negativos reais passaram: JWT ausente/inválido/anônimo, origem divergente, método incorreto, confirmação ausente e conta QA sem Gmail. REST da tabela: anônimo 401, backend 200. Contagens preservadas.
- Varredura de segredos do build passou. Nenhum valor OAuth foi publicado no frontend ou neste documento.
- Production Vercel permaneceu em `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`. Sem commit/push ou mudanças em Auth/cobrança/motores.
- Recibos privados: `.tmp-codex/r32-gmail-delivery/` (schema, função, Preview, segurança e navegador).

Conferência real pendente: o proprietário deve entrar com sua conta Gmail confirmada no staging, abrir um relatório salvo L2/L3, conectar a própria caixa, revisar destinatários/corpo/anexos e confirmar o envio na interface. Nenhum envio automático de teste foi executado. Recebimento e criação de card no CRM não foram homologados; aceitação Gmail não comprova entrega no destinatário. QA .invalid não pode enviar.

A proposta SQL permanece fora das migrations automáticas e termina em ROLLBACK para revisão segura. O recibo registra sua aplicação autorizada no staging; futura promoção exige reconciliar o histórico, sem reaplicação automática. O fluxo genérico legado L1 não foi convertido nesta publicação contextual L2/L3.

Smoke autenticado no novo Preview: PASS. Login legítimo da fixture QA por senha HTTP 200, Matches e contato sintético visíveis, zero erros de página. HTML do Preview com assets conferidos por hash e backend staging real; rede externa/rotas de tradução bloqueadas. Nenhum relatório foi gerado e nenhum email foi enviado nesse smoke. Essa prova não substitui o consentimento Gmail nem a confirmação visual e o recebimento pelo proprietário. Lint e Deno check foram reconferidos após a publicação: PASS. HEAD e hash do stash preservados.

## Acesso do proprietário ao cenário QA

Desbloqueio único autorizado separadamente para a conta real indicada pelo proprietário, exclusivamente no staging. O processo reconheceu uma sessão autenticada cujo ID e email foram validados por auth/v1/user contra a conta esperada; não houve criação de sessão administrativa, troca de senha ou impersonação. A janela não foi vista pelo proprietário, portanto não usar isso como prova de aceitação visual.

RPCs existentes de intenção e compra executados uma vez após reconferir custo de 1 nugget e saldo suficiente. Recibo: custo 1, saldo 979; contato R3 Fictional QA B e imóvel 1200 Fictional QA Avenue retornados pelo RPC canônico. Pós-checagem independente somente leitura confirmou exatamente um unlock pessoal, contato e item do portfólio disponíveis. Nenhum segundo débito, email, alteração de saldo manual ou mudança em Production. Recibos privados gmail-owner-unlock.json e gmail-owner-unlock-postcheck.json. Conferência visual continua pendente no navegador habitual do proprietário.

## Atualização posterior: Property Release/L1

A extensão L1 e a remoção do email de perfil como fallback de destinatário foram publicadas mediante autorização específica. Preview vigente: https://dealsiftermatch-60x7087fe-deal-sifter-match-s-projects.vercel.app. Detalhes, schema e evidências em R3_2_PROPERTY_RELEASE_GMAIL_FIX.md. As URLs de publicações anteriores acima são históricas. Nenhum email real enviado pelo agente.

## Correção posterior de continuidade

Preview vigente: https://dealsiftermatch-nx96y4o7m-deal-sifter-match-s-projects.vercel.app. Correção do leitor L1 para a consulta autorizada existente e estado terminal de envio nas três categorias. Evidências e limites em R3_2_MAIL_DELIVERY_CONTINUITY_FIX.md. As URLs anteriores acima são históricas. Sem nova migration, Production ou email enviado pelo agente.
