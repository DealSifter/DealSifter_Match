# P0 — Save-time validation / registro legado 501 — diagnóstico e correção local

**BASELINE:** `f96b409f95e99c532a56f6b1760d326c11a166a0`. Correção isolada em `fix/address-identity-evidence-p0`, HEAD `4a27e2eea3ad3ff233f428a32908683b52ad1401` (implementação `1d9031e`, ajuste de cobertura `4a27e2e`). Sem alterações de cadastro, produção, migrations, RLS, motores financeiros, filtros/listagem, MapView ou renderer PDF.

**PROPERTY ID:** `aecb105e-b113-4775-8afe-a443704b2a06`. owner_id examinado na leitura autorizada e omitido dos artefatos compartilháveis.

**PROPERTY CREATED BEFORE/AFTER RULE:** **ANTES**. Criado em **01/05/2026 20:21:13 UTC**; gatilho `notifyPropertySaved` introduzido no commit `0f99ff8`, implantação registrada em **15/10/2026 15:00:28 UTC** (`qa/smart-property-enrichment/final-integration/production-deployment.json`). Geocode ArcGIS de **09/06/2026**. Atualização mais recente do cadastro: **19/10/2026 21:26:38 UTC**. Não se presume qual caminho de edição produziu essa atualização.

**SAVE-TIME TRIGGER:** **FAIL na base / PASS nos contratos locais corrigidos.** O gatilho explícito excluía publicação e lotes com múltiplos imóveis; o autosave não emitia o evento; o listener dependia do registro já estar hidratado e fazia CHECK cache-only. Agora a base remota é lembrada sem backfill; somente persistências alteradas ou publicação explícita enfileiram CHECK serial e não bloqueante. A aquisição pública mantém flags, intervalo e identificação existentes; RentCast permanece cache-only nesse caminho.

**ADDRESS CHECK — RESULT / ROOT CAUSE:** **INSUFFICIENT_EVIDENCE / identidade postal não comprovada.** Cadastro/geocode antigo apontam a entrada `501 Avenue A Wahneta W|Winter Garden|FL|33881`. Coordenadas/status resolved não comprovam cidade/ZIP. Não há evidência independente utilizável no cache para adotar Winter Haven/33880. Redfin é pista, não fonte canônica nem autorização de scraping. A comparação de situs completo agora verifica também city/state/ZIP, não apenas a rua. Nenhum endereço sobrescrito.

**PROVIDER ACQUISITION AT SAVE:** **UNKNOWN historicamente** — sem recibo de tentativa em maio/outubro. A única revisão persistida foi cache-only (`publicCheckedAt:null`). Ausência atual de cache não prova que nunca houve consulta. Correção registra resultados de aquisição GIS/cache separadamente para futuras verificações, sem compra automática.

**CACHE/FINGERPRINT:** zero entradas em `geocode_cache` e `property_intelligence_cache` para o controle na leitura. Fingerprint de endereço **calculado, não encontrado em cache**: `21e8734b6219ffe9ba761b74357c840f549df98e0efea6ef71d9fb60523992da`. Identity hash atual coincide com o da revisão: `71a6090b46993860eae705ae5fe706695ab3408811259df87b4799fd6a35f762`. Mudanças de identidade não reutilizam evidência incompatível; testes confirmam isolamento.

**EVIDENCE FOUND:** **NO na revisão/cache atuais; UNKNOWN para aquisições históricas não documentadas.** Revisão 1 em **15/10/2026 21:07:57 UTC**, zero candidatos externos, zero decisões, zero notificações.

**RECONCILIATION:** uma revisão publisher-only: lotArea/APN/fiscais indisponíveis; campos informados em NO_ACTION. Isso não é confirmação externa. NOT_CHECKED, NO_MATCH e falha de provedor não viram VERIFIED nem geram triângulo por ausência. Recibos novos usam o estado já persistido da revisão, sem novo armazenamento paralelo.

**WHY NO YELLOW WARNING:** nenhum conflito material qualificado foi persistido. Não se deve fabricar alerta amarelo só pela ausência de consulta ou pela referência Redfin. A revisão de 15/10 não foi atualizada junto da alteração de 19/10; o caminho histórico exato não está documentado.

**LEGACY PROPERTY HANDLING:** **PASS local** — sem recriação/backfill; acesso neutro à página 2 existente e à ação Consultar dados disponíveis. Abrir o modal/hidratar não adquire evidências.

**OWNER NOTIFICATION:** **PASS local** — mesmo RPC atômico, histórico, consenso e deduplicação existentes. Resultado novo atualiza estado acionável; notificações privadas novas atualizam a leitura do proprietário. Mesma evidência resolvida não renotifica.

**PORTFOLIO ICON:** **PASS local** — triângulo/pulsação existentes, exclusivamente para conflitos qualificados; complementos/ausência não geram amarelo. **EDIT PAGE 2:** **PASS local** — mesmo modal, comparação e decisões, sem drawer/popup novo.

**THIRD-PARTY EVIDENCE:** **PASS nos contratos locais / BLOCKED para homologação real A/B.** Aquisição normalizada autorizada e GIS com recibo assinado/situs vinculado usam o mesmo motor e owner_id lido no servidor; preservam outras fontes e decisões. B não escolhe owner/candidatos por request nem recebe estado privado. Recibo forjado não encaminha evidência; nenhum dado de properties é alterado pelo relay. Cache repetido não gera nova aquisição ou notificação. Em falha do relay, a evidência permanece no cache e o CHECK existente permite recuperação; não foi criado outbox/migration.

**MAXXIS MULTI-INTENT:** **PASS local** — controle separa SOLD, bloqueio/estado ARV, terreno, identidade e próxima ação. Consulta não executada não é ausência de resultados. Rota de explicação é cache-only, sem aquisição paga implícita. Não houve mudança de motores SOLD/ARV/Rent.

**CHANGED FILES:** 22 arquivos; `changed-files.txt` e `correction.patch` contêm a relação/diff completos. Principais: App/onboarding, transporte/provider de revisão, sincronização de notificações, runtime/projeção/recibos, relay server-only de evidência já autorizada e rota multi-intent. 256 inserções / 17 remoções incluindo testes.

**TARGETED TESTS:** 46 casos únicos aprovados no escopo direcionado: novos/legados, conflito/ausência, city/ZIP, cache/isolamento, persistência/dedup, privacidade A/B, recibo forjado, UI/decisão e fila pós-gravação. Dois testes inicialmente tinham fixture sem ID de provedor; fixture corrigida e somente os casos afetados reexecutados. Nenhum provider live nos testes.

**BUILD/TYPECHECK:** bundle frontend App e dois entrypoints backend aprovados com esbuild; typecheck TypeScript direcionado aprovado. Não foi executado build Vite global nem suíte geral. `git diff --check` aprovado.

**PRODUCTION VALIDATION:** **BLOCKED** para validar a correção: ela não foi publicada e não se usou sessão autenticada real. A auditoria somente-leitura do registro foi concluída; zero alterações de dados e zero chamadas RentCast/GIS.

**DEPLOY: NO.** Aguardar aprovação. Evidência sanitizada: `501-sanitized-audit.json`. Dados privados de auditoria ficam somente no arquivo local ignorado `*.private.json`.
