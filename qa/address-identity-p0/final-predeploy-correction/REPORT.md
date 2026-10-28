# P0 — final pre-deploy correction (local only)

BASELINE/HEAD: `4a27e2eea3ad3ff233f428a32908683b52ad1401`.
Branch: `fix/address-identity-evidence-p0`.
Worktree: `.tmp-codex/address-identity-p0`.
13 arquivos preparados no índice; sem novo commit, integração ou deploy. O patch desta pasta é incremental à baseline acima. Worktrees e rascunhos externos preservados.

ADDRESS CONFLICT ACTIONABLE: PASS nos contratos locais.
O status deixou de ser somente metadata. Prova postal qualificada gera uma linha privada address no mesmo snapshot, hash, histórico e RPC de revisão. A summary aciona o triângulo atual do Portfólio e a página 2 do modal de edição existente. Cadastro, alternativa e autoridade da fonte aparecem juntos. KEEP, ACCEPT e REVIEW_LATER persistem ator, original, provenance e decisão. ACCEPT preenche o rascunho do editor; o Salvar existente continua necessário para modificar o cadastro. Nenhuma alteração automática ou por Gemini.

OWNER NOTIFICATION: PASS nos contratos locais.
O RPC existente recebe notify=true, owner_id e snapshot acionável. A notificação privada existente hidrata o estado via READ e abre o modal existente; o usuário B não recebe a revisão privada. Mesma evidência decidida não renotifica. SQL/RLS existentes inspecionados, não alterados nem executados em banco real nestes testes.

NO FALSE WARNINGS: PASS nos contratos locais.
O recibo/resposta pública já autorizado não basta sozinho: exigem-se fonte habilitada/licenciada, situs completo com provenance pública, rua e estado compatíveis, APN correspondente em evidência externa independente da mesma county, não conflitante e utilizável. A associação geométrica sozinha, situs incompleto, fonte não confirmada, APN/county/rua distintos ou evidência expirada não provam conflito. Não se ativou fonte nova. Os testes postais usam fonte sintética identificada como QA; não comprovam identidade nem cobertura GIS live de Winter Haven.

FAILED CHECK RECOVERY: FAIL para garantia durável; recuperação limitada local PASS.
Causa confirmada: notifyPropertySaved avançava a deduplicação antes do CHECK concluir. Agora apenas resposta válida concluída, sem falha temporária de aquisição, avança a base concluída. Há single-flight e, após falha, no máximo uma tentativa adicional no próximo salvamento persistido da mesma versão. Depois disso continua disponível o CTA existente Consultar dados disponíveis. Nenhum timer ou retry ao renderizar/abrir modal. Falha GIS persistida não inicia a janela de seis horas de verificação bem-sucedida.

LIMITAÇÃO NÃO RESOLVIDA: a fila e os marcadores são memória da aba. Encerramento/reload/crash pode perder trabalho pendente; a hidratação não inicia backfill e não garante retomar automaticamente esse trabalho. O usuário pode consultar explicitamente pelo modal existente. Não há outbox/job durável entre salvar properties e entregar CHECK. Uma garantia automática exigiria mecanismo persistido adicional, fora desta autorização. Não declarar PASS irrestrito nem liberar deploy com essa garantia pendente.

NO PROVIDER FAN-OUT: PASS local.
Nenhum endpoint de aquisição novo, nenhum request ao renderizar e nenhuma chamada paga. Mesma aquisição usa o APN de cache obtido no próprio CHECK sem segunda consulta. RentCast permanece cache-only neste caminho; GIS conserva flags/política existentes. Zero chamadas live de provedores nos testes.

TARGETED TESTS: 20 casos únicos novos aprovados em execuções filtradas somente desta correção; 46 verificações anteriores preservadas, não repetidas.
Cobertura: prova→persistência/notify→hidratação→alerta→modal→ACCEPT; KEEP/REVIEW_LATER e não renotificação; privacidade B; 11 rejeições/ausência de falso conflito; falha de transporte e falha GIS persistida→novo save→sucesso/dedup; limite de tentativas e CTA explícito; APN do mesmo CHECK; janela de sucesso não consumida por falha.
As primeiras fixtures foram ajustadas para simular uma fonte autorizada sem ativar fonte FL real. Os testes positivos e negativos afetados foram executados novamente. Não se executou suíte geral.

BUILD/TYPECHECK: PASS.
Typecheck direcionado de addressReview, runtime, ownerEvidence e canonicalEvidenceTool com tsc --noEmit; bundle esbuild do App e dos entrypoints property-fact-review/maxxis-chat aprovados; git diff --cached --check aprovado. Não é declaração de build Vite global ou homologação autenticada.

FILES CHANGED:
- src/features/propertyFacts/PropertyFactReviewProvider.jsx
- src/features/propertyFacts/PropertyFactReviewProvider.test.jsx (somente adaptação do mock ao novo export)
- src/features/propertyFacts/copy.js
- src/features/propertyFacts/editReviewDraft.js
- src/features/propertyFacts/finalPredeployCorrection.test.jsx
- src/services/propertyFactReviewService.js
- supabase/functions/_shared/maxxis/canonicalEvidenceTool.ts (excluir linha privada do caminho de candidatos)
- supabase/functions/_shared/property-fact-reconciliation/addressReview.ts
- supabase/functions/_shared/property-fact-reconciliation/model.ts
- supabase/functions/_shared/property-fact-reconciliation/ownerEvidence.ts (excluir linha privada do relay de candidatos)
- supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js
- supabase/functions/_shared/property-fact-reconciliation/runtime.ts
- supabase/functions/property-fact-review/index.ts

DESIGN/FINANCIAL ENGINES/DATABASE: preservados. A linha postal privada não entra nos motores de consenso/financeiros nem na projeção pública. Nenhuma migration, alteração de RLS, consulta live, modificação de cadastro real ou deploy.

DEPLOY READY: NO — falta garantia durável do CHECK, explicitamente registrada acima. Homologação final autenticada não realizada.
