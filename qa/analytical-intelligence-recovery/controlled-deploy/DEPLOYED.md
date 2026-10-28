# Entrega 1 — publicação controlada — 19/10/2026

- SHA publicado exclusivamente: `f96b409f95e99c532a56f6b1760d326c11a166a0`.
- Frontend anterior: `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW` (`b989d7bf4de5550d006663ae67c3fc22f7b3fd06`).
- Frontend novo: `dpl_7aGyqibdEhQAqLvunnnvQoy1j1Gk`, READY, promovido e confirmado em https://dealsiftermatch.vercel.app.
- Build isolado: https://dealsiftermatch-bvm2lip4l-deal-sifter-match-s-projects.vercel.app. Preparado com `--prod --skip-domain`, promovido somente depois da publicação/verificação das quatro funções.
- Fonte: extraída por `git archive` do candidato; confronto dos 1.081 hashes de código/configuração enviados com blobs Git aprovado, sem ausências/divergências/extras. Nenhum rascunho ou diagnóstico local foi usado como fonte.

| Edge Function | Anterior | Nova | Estado / autenticação |
| --- | ---: | ---: | --- |
| maxxis-chat | 91 | 92 | ACTIVE / JWT=true |
| property-intelligence | 15 | 16 | ACTIVE / JWT=true |
| property-fact-review | 7 | 8 | ACTIVE / JWT=true |
| arv-visual-comp-review | 15 | 16 | ACTIVE / JWT=true |

## Reconfirmação e compatibilidade

Deployment anterior, versões/timestamps das funções e SHA-256 do diff completo foram reconfirmados antes da publicação, novamente imediatamente antes das funções. O domínio principal ainda apontava ao anterior imediatamente antes da promoção. Quatro funções publicadas do mesmo estágio/commit; autenticação/configuração mantidas. Nenhum comando de alteração de secrets, migration, RLS, banco ou infraestrutura foi executado.

Antes da promoção: as quatro funções responderam OPTIONS=200 com origem permitida correta e POST sem autenticação=401; frontend anterior continuou montando e exibindo formulário de login sem erro de página. Isso confirma inicialização pública e fronteiras de autenticação/CORS, **não** funcionamento de ferramentas autenticadas nem paridade analítica real. `old-frontend-new-backend-smoke.json` usa o SHA candidato como contexto da entrega; o bundle observado nesse teste é o anterior (`maxxisReportPdf-D9m0XmyW.js`, hash `b8da42013f707aa12b1aebd7e63d288b6dbb41ecabffa040da89fcd741054eae`).

## Smoke pós-deploy

- HTTP/React e formulário público de login: aprovados.
- Bundle PDF no domínio principal idêntico ao do candidato: `maxxisReportPdf-_mBhydJj.js`, SHA-256 `22212e67f5d0806e4c0a79d457789aea8a412f0b5439d01c4a65f6c887a7be2f`.
- Renderizador efetivamente publicado gerou e baixou um L3 sintético de seis páginas, 141.307 bytes; sem erro de página. Serviços externos bloqueados no navegador de controle.
- Nenhuma consulta RentCast/GIS; nenhuma sessão real utilizada ou criada. Os quatro PDFs de aceitação não foram regenerados; foi gerado somente o arquivo separado de smoke `published-L3-smoke.pdf`.
- Não executados com sessão real: login completo, navegação interna, conversa Maxxis, abertura/fechamento dos modais de relatórios e geração de L3 com dados reais. Não há declaração de que o congelamento foi definitivamente resolvido.

## Rollback e pendências

Rollback não necessário e não executado: nenhuma regressão crítica foi observada no escopo testado. Frontend anterior e estágio backend `51caae5`/backups permanecem disponíveis conforme PRE_DEPLOY.md. O build apresentou avisos de tamanho/dynamic imports e audit de dependências; nenhuma dependência foi alterada nesta publicação.

Validação final pelo usuário: SOLD/ARV de 4724, Market Rent/Rental Comps, Investment Profile real, paridade Maxxis/PDF, modais/navegação autenticada e responsividade de L3. Cache primeiro; qualquer consulta faturável nova exige autorização específica.

Evidências: `immediate-reconfirmation.json`, `reconfirmed-diff.patch`, `production-source-proof.json`, `frontend-deployment.json`, `backend-deploy.json`, `backend-after.json`, `backend-boundary-smoke.json`, `candidate-smoke.json`, `old-frontend-new-backend-smoke.json`, `post-smoke.json`.

Trabalho encerrado após esta publicação; aguardando os testes do usuário. Nenhuma nova fase iniciada.
