# R-3.1 — Cenário de aceitação QA

Ambiente exclusivo: staging `oqdcnjupquhybwdbeeew`. Production não foi alterada.

- Preview de conferência atual: https://dealsiftermatch-j0kzva2bg-deal-sifter-match-s-projects.vercel.app
- Investidor: QA A — `r3-14946805-c4de-48a1-b15e-31f6fd06ff31-a@example.invalid`.
- Contato: **R3 Fictional QA B** (publicador sintético).
- Imóvel do publicador: **1200 Fictional QA Avenue**, UUID `d3f15cc0-f5e5-431f-beeb-d3eb4b2d2a74`.
- Senha: credencial QA existente, não armazenada neste documento.

## Diagnóstico e preparação

As contas QA existentes não tinham perfis preenchidos nem desbloqueios. O onboarding impedia a entrada em Matches. As duas propriedades já estavam publicadas. As consultas autenticadas retornaram HTTP 200; a consulta canônica de contatos retornou zero registros, consistente com a ausência de desbloqueios.

Os dois perfis foram completados pelo RPC existente `ds_save_professional_profile`, usando autenticação QA e controle de versão. Os planos Enterprise originais foram preservados, sem concessão de admin ou novos entitlements.

Após autorização específica do proprietário, executou-se um único fluxo `ds_create_unlock_intent` → `ds_purchase_contact_unlock`, autenticado como QA A, para o perfil pessoal de QA B. Foram consumidos 1 nugget QA e criada uma notificação interna QA. Nenhum email, WhatsApp ou pagamento externo foi disparado. O contato e o imóvel aparecem na consulta canônica de desbloqueios; não foi necessário fabricar uma linha na tabela `matches`.

## Percurso de conferência

1. Entrar no Preview com QA A. Se a tela de cadastro permanecer aberta após o primeiro login, recarregar antes de navegar.
2. Abrir **Matches**; manter o filtro **All** ou **Paid**.
3. Selecionar **R3 Fictional QA B** na coluna **People**.
4. No portfólio, abrir **1200 Fictional QA Avenue**.
5. Selecionar **Export** → **MAXXIS ANALYSIS REPORT**.
6. Escolher L2 (**MAXXIS ANALYSIS REPORT**) ou L3 (**MAXXIS DEAL INTELLIGENCE REPORT**), incluídos no Enterprise QA.
7. No Gap Resolver, testar **I don't know / Não sei**, estimativas com confirmação e continuação parcial.
8. Gerar e exportar o PDF no chat.

Os valores financeiros são exclusivamente sintéticos, gravados no cenário privado de QA A sobre o imóvel de QA B. Não representam evidência de mercado ou informação de provedor. Existem lacunas intencionais em custos de manutenção durante a operação, financiamento e venda. O orçamento de reforma e o valor de saída são entradas fictícias do cenário privado.

## Evidências e estado

Evidências de conferência desta execução estão concentradas em `qa/report-r31-acceptance/`: PDFs efetivamente baixados, capturas da navegação, receipt do unlock e resultados. Credenciais, scripts operacionais e snapshots privados permanecem em `.tmp-codex/r31-matches/`, ignorados pelo Git.

Login real, acesso a Matches, contato desbloqueado, associação ao portfólio e abertura dos detalhes: comprovados em navegador Edge, com Supabase staging real e sem mocks de dados.

| Verificação | Resultado |
| --- | --- |
| Login real, Matches, contato, portfólio e imóvel correto | PASS |
| L2 e L3 incluídos pelo Enterprise original | PASS |
| L2 gerado pela seleção no portfólio e PDF baixado | PASS — 3 páginas |
| L3: gaps, Não sei e alternativas | PASS |
| L3: estimativa exige confirmação, sem gravação antecipada | PASS |
| Pedido e inputs persistem após reload | PASS |
| Retomada preserva o ID original e salva o L3 | PASS |
| L3: continuar parcialmente sem ROI/lucro inventados, com PDF baixado | PASS — 3 páginas |
| PDFs L2/L3 parcial: cenário, fontes e limitações | PASS — texto extraído dos downloads reais |
| Exportar PDF após reload durante a conclusão | PASS no novo Preview — L3 com estimativas, 4 páginas |
| Chamadas a provedores durante esta execução | 0 no ledger |

O L2 é gerado dentro do escopo próprio; não precisa percorrer as perguntas financeiras do L3.

Os testes de navegador usam Edge com autenticação por senha QA e APIs/RPCs reais do staging. O HTML é obtido do Preview via CLI autenticada; assets são servidos do cache do artefato publicado, verificados por SHA-256. Nenhum dado, resposta de autenticação ou RPC foi mockado. Funções de email/LLM e destinos externos foram bloqueados; mapas do PDF ficam sem tiles nessa execução. L2 e L3 parcial foram conferidos no candidato imediatamente anterior; a exportação após reload foi reproduzida com falha nesse candidato e revalidada até o download no novo Preview, cuja única mudança funcional é o guard de exportação descrito abaixo.

O bloqueio após reload foi isolado no guard de `handleExportAnalysisPdf` em `MaxxisAssistant.jsx`: ele exigia `analysisExport.onExportPdf`, função transitória que não sobrevive à serialização. O mesmo handler já constrói seu callback a partir do schema salvo e verifica o entitlement na exportação. A correção local remove somente a exigência do callback transitório; preserva schema, entitlement e renderer. O teste de regressão reproduziu a falha antes da mudança e passou depois: 4/4 testes direcionados. TypeScript do relatório e build offline: PASS; fingerprint do candidato `da2738a1a3087d5ef9ab5c0776bf7425d90ac3b1ecbb690e95f6da6c6a32662f`.

Após autorização específica, o candidato foi publicado somente em Preview (`dpl_61KQf6dJCsiA5WZg74MGzMApQ74J`); a origem exata foi liberada no CORS do staging. Ambas as funções existentes responderam OPTIONS 200 com essa origem; seu código não foi implantado novamente. Production permaneceu em `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`. O E2E do novo Preview comprovou: login, contato e imóvel corretos, estimativa sem gravação antecipada, confirmação, reload, mesmo ID do pedido, persistência HTTP 200 e download real do PDF. O texto do PDF contém cenário, fontes, metodologia da estimativa e limitações.

Homologação visual do proprietário: **PENDENTE**. A fixture permanece disponível para essa conferência.

Ao entregar a fixture, os três custos financeiros foram reabertos com CAS, mantendo condição alvo, reforma e parâmetros fictícios explícitos. Valores manuais confirmados por outra sessão são protegidos contra essa preparação.

## Limpeza restrita

A fixture deve permanecer disponível durante a conferência. Nenhum acesso QA adicional ou exceção de RLS foi concedido. A limpeza fica condicionada à aprovação visual e restrita ao unlock `b954e233-7c28-496c-8024-361653187827`, à notificação QA `33d83ff1-29fc-4021-869c-d165b8283394`, aos relatórios/contexto criados por esta execução para o par QA A/imóvel QA B e às alterações de perfil desta execução. As contas, imóveis e demais contextos QA preexistentes devem ser preservados.

Os estados anteriores dos perfis e do contexto estão guardados localmente para comparação antes da limpeza. Não se deve restaurar cegamente sobre alterações feitas pelo proprietário durante a conferência. Não há reembolso ou alteração de saldo planejados sem autorização específica.

Sem commit, push, migration, deploy de funções ou alteração em Production. Publicado somente o novo frontend Preview especificamente autorizado.
