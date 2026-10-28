# Entrega 1 — pré-deploy — 19/10/2026

Candidato imutável: `f96b409f95e99c532a56f6b1760d326c11a166a0`, branch `fix/analytical-intelligence-delivery1`, worktree `.tmp-codex/analytical-intelligence-20261019`. Código src/scripts/supabase sem modificações locais. Os 12 artefatos QA previamente modificados foram preservados e não são fonte de publicação.

## Origem e diff

- Produção efetiva no domínio principal: `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW`, READY; SHA de código/configuração confirmado como `b989d7bf4de5550d006663ae67c3fc22f7b3fd06` por comparação independente de **1.078 hashes de arquivos enviados** com blobs Git (equivalência LF/CRLF). Nenhum arquivo ausente, divergente ou extra no escopo de código/build/configuração. Não é inferência baseada somente na metadata.
- Diff completo: `full-production-to-candidate.patch`; 24 arquivos, 552 inserções / 58 remoções. Produção é ancestral do candidato. Preservados hotfixes de tradução/responsividade, carregamento PDF, mapa e selo Basic. A remoção do argumento explícito `cover` mantém o mesmo valor default da função de imagem. Sem alterações em migrations, RLS, config de funções, dependências ou infraestrutura.
- Perfil: três percursos reais passaram — `profiles.professional.investmentProfile`, `legacy.professionalProfile.investmentProfile` e `investmentProfile` no topo. Todos passam pelo extrator/normalizador existentes antes de `reportProfileProjection`, que recebe perfil normalizado, não o envelope persistido. Os quatro critérios foram preservados, campos extras removidos e ausência de perfil preservada. Nenhuma alteração de funcionalidade foi necessária.

## Backend compatível e publicação proposta — NÃO EXECUTADA

Fechamento transitivo sem imports locais não resolvidos: **arv-visual-comp-review, maxxis-chat, property-fact-review, property-intelligence**. Publicar somente maxxis-chat seria incompleto.

Versões atuais: maxxis-chat 91; property-intelligence 15; property-fact-review 7; arv-visual-comp-review 15. Todas ACTIVE / verify_jwt=true. Versões e updated_at coincidem com o registro de publicação imutável do backend `51caae59794ba507696d512042c5de2d840b8b02`; não há diff de funções/config desse commit até b989d7b. Backups ESZIP atuais salvos com SHA-256 em `.cache/analytical-intelligence-recovery/predeploy-backend`; referências em `backend-baseline.json`. A extração pela CLI falhou por Docker ausente e download WASM indisponível; os backups foram obtidos diretamente pela API de gerenciamento, sem executar as funções.

Compatibilidade aprovada em nível de contrato/source: campos opcionais de estado de aluguel/SOLD e projeção de perfil; score/motores preservados. Reaproveitadas verificações aprovadas dos mesmos inputs; três verificações pontuais de formato realizadas agora. Não representa smoke autenticado ou homologação do desempenho real.

Após autorização explícita: criar estágios exclusivamente por `git archive` do candidato; construir frontend em deployment sem promover domínio; publicar **as quatro funções do mesmo candidato** via `supabase functions deploy <slug> --project-ref cyeipfskwwisbbayyaca --workdir <estágio imutável> --use-api`, preservando JWT/config/secrets; conferir versões e concluir smoke antes de promover frontend. Abortá-lo se qualquer função falhar. Reconsultar domínio/versões antes de começar: qualquer mudança invalida esta comparação. Não executar scripts de preflight que instalam dependências ou repetem a suíte geral.

## Rollback pronto — NÃO EXECUTADO

- Frontend: restaurar o deployment atualmente ativo `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW` (`vercel rollback <id> --yes`), não um deployment anterior a ele.
- Backend: estágio já preparado por `git archive` de `51caae59794ba507696d512042c5de2d840b8b02`, em `.cache/analytical-intelligence-recovery/rollback-source-51caae5`; redeploy das quatro funções por `--use-api`, mantendo JWT. Isso cria novas versões com o código anterior, não restaura números de versão. Backups ESZIP preservados para conferência. Nenhum rollback foi ensaiado em produção.
- Em falha crítica: restaurar frontend e as funções já alteradas, confirmar versões/config e funcionamento básico; sem migrations a reverter. Registrar todos os IDs/versões efetivamente publicados.

## Validação autenticada proposta

1. **4724 / SOLD / ARV:** cache primeiro. Registrar estado e execução da busca, candidatos/qualificação/rejeição e motivo do ARV. UNKNOWN_EXECUTION não pode virar FOUND; FOR SALE não pode virar SOLD. Sem evidência atual, informar bloqueio. Nenhuma nova chamada faturável até autorização específica.
2. **Market Rent / Rental Comps:** registrar HIT/MISS/fingerprint/atributos bloqueantes. HIT válido deve produzir estimativa/faixa, até cinco comparáveis com endereços/valores e mesmos pins. MISS ou conflito: parar e pedir autorização específica para aquisição, sem request exploratório ao provedor.
3. **Perfil real:** usar sessão do titular; conferir os quatro critérios, cobertura e score do motor, ausência de campos privados extras no payload do relatório. Conta sem perfil não pode exibir score/breakdown artificial. Não salvar dados pessoais em evidências de QA.
4. **Maxxis/PDF:** comparar mesmos estados, valores, fontes, comparáveis e cobertura do perfil no mesmo snapshot. Separar cache antigo de nova consulta e conflito de conversão de área.
5. **L3 / responsividade:** na sessão real, abrir/fechar prévia, gerar/baixar uma vez e navegar após liberação; registrar preparação/imagens/mapas/tradução/PDF, tarefas bloqueantes, erros e tela de carregamento com o diagnóstico local já autorizado. Se necessário, armar a captura antes da geração. Não afirmar solução definitiva do congelamento com base no smoke offline.

Nenhum PDF regenerado nesta etapa. Nenhuma chamada RentCast/GIS ou alteração de produção. Plano pronto não é autorização para publicar.
