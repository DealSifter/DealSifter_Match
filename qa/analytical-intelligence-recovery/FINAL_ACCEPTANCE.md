# Entrega 1 — aceitação final offline — 19/10/2026

> Atualização de entrega: este registro histórico não é o comprovante dos bytes agora entregues. Consulte [DELIVERY_PROOF.md](delivery-f96b409/DELIVERY_PROOF.md) e [SHA256-AND-PROOF.json](delivery-f96b409/SHA256-AND-PROOF.json). Uma execução única no commit `f96b409f95e99c532a56f6b1760d326c11a166a0` validou os PDFs finais relidos do disco e suas cópias de entrega. A inspeção adicional encontrou `sourceProfile` completo nos projetores; foi corrigido para somente os quatro critérios autorizados. Sem deploy.

**AREA CONSISTENCY:** corrigida a fixture local que alterava `lot` para 7.013, mantendo `lotSizeSqft=5000`. A/C agora usam uma única origem sintética: 5.000 sqft = 0,1147842… ac, exibidos como 0,1148 ac. Tolerância de arredondamento: ±0,00005 ac (2,178 sqft). Nenhum dado armazenado alterado.

**SOLD WORDING:** controles históricos mostram UNKNOWN_EXECUTION, contagens desconhecidas e orientação para consultar/verificar vendas. Não afirmam vendas encontradas. NOT_QUERIED e os estados documentados de resultados/elegibilidade/rejeição permanecem distintos. A frase “Vendas identificadas…” estava no rascunho principal, não na branch fornecida; esse rascunho não entrou no diff.

**PROFILE SCORE COVERAGE:** mantido 100% do motor: 85 pontos obtidos / 85 avaliáveis. Mercado 35, preço 25, tipo 25; estratégia (15) não avaliada. PDF informa 3/4 critérios e exclusão de estratégia, sem modificar pesos/score.

**NO-PROFILE BEHAVIOR:** sem score, gauge numérico ou breakdown fictício; mantém “não disponível”.

**QA PROVENANCE:** os mesmos quatro PDFs (6/6/3/3 páginas) identificam QA/SIMULAÇÃO nas notas da primeira página. Perfil sintético e datas de teste explicitados; nenhuma sessão real ou chamada RentCast/GIS. Metadata técnica separada em `acceptance-verification.json`. Identificação de simulação existe somente no script QA/artefatos.

**PRIVACY:** leitura de perfil existente vinculada ao usuário autenticado. Testes de contrato confirmam rejeição de proprietário diferente e compartilhamento preparado sem payload privado (`reportData:null`). Exportar/compartilhar PDF requer ação explícita e entitlement; o PDF autorizado inclui os critérios exibidos. Não é certificação end-to-end de sessão real.

**DESIGN REGRESSION:** sem alterações no renderer, layout, mapas, gráficos, fotos ou branding nesta correção. Inspecionadas visualmente as páginas 1/2 corrigidas; sem corte dos novos textos. Placeholders/mapas por coordenadas permanecem como nos controles offline existentes.

**TARGETED TESTS:** 21 aprovados (19 contratos analíticos + 2 de propriedade/compartilhamento); 15 testes fora do filtro não executados. Quatro PDFs regenerados com assertions de área, origem QA, score/ausência, aluguel/comparáveis. Zero tentativas de rede; uma chamada a provedor **mock**, seguida de HIT no cache.

**BUILD:** bundle browser do view model alterado aprovado (esbuild). Build global anterior não repetido; isto não representa novo build global ou smoke autenticado. `git diff --check` aprovado.

**FILES CHANGED:** nesta rodada: `reportIntegrityViewModel.ts`, `analyticalDeliveryRecovery.test.js`, `scripts/acceptance-delivery1.mjs`. PDFs e evidência JSON atualizados na pasta deste documento. Diff cumulativo da branch preparado em `integration-delivery1.patch`, sem mudanças locais externas à branch.

**COMMIT:** `05a105decb8002937f5b535a7496f667383c4a24`, branch `fix/analytical-intelligence-delivery1`, sobre `fef0ce4f…`. Base de integração `b989d7bf4de5550d006663ae67c3fc22f7b3fd06`. Produção reconsultada: deployment `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW`, READY, o mesmo registrado para b989 em `qa/report-map-basic/DEPLOY.md`; API não fornece Git SHA, portanto não há confirmação independente do SHA remoto por metadata. Revalidar essa correspondência antes de integrar. **Nenhum deploy realizado.** Validação definitiva em sessão autenticada segue pendente, cache primeiro e autorização específica para chamadas faturáveis.
