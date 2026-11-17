# Continuidade da entrega Gmail — L1/L2/L3

Estado: correção publicada somente no staging; conferência autenticada do novo Preview concluída até a revisão de entrega, sem envio.

## Causa e evidência

No L1, a leitura direta de properties com JWT legítimo do investidor retornava HTTP 200 com zero linhas, apesar do desbloqueio válido. A leitura direta de property_images também era vazia. O Portfólio obtém os dados por RPC autorizado. O novo serviço de entrega não usava esse mesmo caminho. A mensagem genérica convertia o erro de acesso em REPORT_PDF_RENDER_FAILED, antes de alcançar o renderer.

Correção: quando a linha não é própria, usar ds_get_public_property_details para dados sanitizados/imagens e ds_get_unlocked_contact_cards para validar a associação desbloqueada com o imóvel. Não usa service_role para adquirir a fonte, não altera RLS, Auth, entitlements ou RPCs. Propriedade própria continua pelo acesso normal da tabela. Frontend e backend usam o mesmo leitor; endereço/coordenadas ocultos permanecem ocultos.

Os dados autorizados retornados alimentam a preparação L1. A fonte é reconferida antes de enviar. Campos residenciais são omitidos para terreno, com validação explícita. Erros de fonte/acesso/destinatários recebem mensagens da etapa correta; não se apresentam como falha do PDF.

## Outras categorias e estado de envio

A tentativa apresentada pelo proprietário no chat consta no ledger como ACCEPTED, com um PDF no envelope. Nenhuma repetição foi feita. Aceitação Gmail não prova recebimento ou criação de card Trello. O botão passa a mostrar Enviado pelo Gmail após ACCEPTED e continua desabilitado para evitar duplicidade; não mantém Confirmar envio. Se o snapshot não contém fotos, a interface informa isso, sem sugerir anexos perdidos ou inventar imagens.

## Verificação

- 58/58 testes finais offline: fonte via RPC com tabela oculta, vínculo de unlock, ausência de acesso, propriedade própria, privacidade, separação de erros, MIME/anexos/idempotência e revisão/estado terminal L1/L2/L3.
- Sessão QA legítima no staging com código de serviço real: leitura + handoff + validação backend local + renderer real, sem mocks do backend: L1 1 página/135672 bytes; L2 3 páginas/147908 bytes; L3 4 páginas/157135 bytes. PDFs preparados em memória, sem nova geração cobrada, sem salvar relatório ou enviar email. Fontes/imagens externas não foram adquiridas nessa conferência. Não substitui prova de recebimento no destino ou consentimento Gmail real.
- Lint e Deno check PASS. TypeScript do contrato PASS. Build offline PASS. Fingerprint ffb670d558b35cb72e5be09dd0487f465eb2116be80cac3654f23ca9161c293e.
- Recibos privados de diagnóstico e testes: .tmp-codex/r32-l1-gmail/live-handoff-probe.json, live-all-reports.json, source-fix-final-tests.json. Dados/credenciais privados não entram neste documento.

Sem nova migration/schema, Production, pricing, nuggets, Stripe, motores, commit ou push. Mantém autorização staging/Preview da correção L1. Nenhum envio real executado pelo agente.

## Publicação

Preview READY: https://dealsiftermatch-nx96y4o7m-deal-sifter-match-s-projects.vercel.app, deployment dpl_53JTEub4fxeFkFvtcVsJap8BYxtk. Staging oqdcnjupquhybwdbeeew reconfirmado. Função report-mail-delivery atualizada com JWT obrigatório (recibo imediato v5), sem outra função ou schema alterado nesta rodada. Backup privado da versão anterior salvo antes.

CORS exato nas quatro funções: PASS. Sete probes negativos reais: PASS; REST de ledger bloqueado ao anônimo (401) e disponível ao backend (200). Contagens de entregas/conexões preservadas; nenhum email enviado. Varredura de segredos PASS. Production Vercel permanece em dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX. Recibos em .tmp-codex/r32-mail-flow-fix/.

## Conferência do navegador publicado

PASS com sessão QA legítima, backend staging real, HTML do Preview e assets idênticos aos publicados por hash. Percursos: Matches → contato sintético → Portfólio → L1 → revisão Gmail com fonte validada; Maxxis → menu → Meus Relatórios → Email L2; mesmo percurso para L3. Ambos preservaram nível e snapshot; L3 estava salvo em português e L2 em inglês, mantidos. Zero erros de página. A caixa fictícia não foi conectada nem teve envio habilitado; isso não é prova de consentimento Gmail nem recebimento. Preferências de destinatários da fixture restauradas ao valor anterior, sem modificar a conta real do proprietário. Nenhum PDF novo foi salvo/cobrado nessa navegação, nenhum email enviado e nenhuma chamada paga. Recibo privado browser.json. Os PDFs reais das três categorias foram conferidos separadamente conforme a seção de verificação.

As duas primeiras tentativas do teste de navegação tiveram erros no seletor do roteiro (Meus Relatórios fica no menu de preferências; L3 tem legenda em português). Ajustes apenas no roteiro de QA; o teste final passou sem mudança adicional no produto.
