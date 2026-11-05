# Referência atual de QA — relatórios / Maxxis

Atualizado em 5 de novembro de 2026. Este índice identifica a rodada POST-SMOKE; não substitui os recibos de outras funcionalidades.

**Estado da entrega e publicação:** [REPORTS_RELEASE_CURRENT.md](../docs/REPORTS_RELEASE_CURRENT.md). A preparação de produção foi autorizada após o aceite POST-SMOKE. Esse documento distingue a geração/exportação validada do R-3 ainda pendente.

## Arquivos que devem ser usados nesta conferência

| Item | Referência | Situação |
|---|---|---|
| Aceite e limitações | [POST_SMOKE_PDF_AND_R3_ACCEPTANCE.md](../POST_SMOKE_PDF_AND_R3_ACCEPTANCE.md) | Documento principal desta rodada |
| Basic / L1 | [post-smoke-pdf-r3/L1.pdf](post-smoke-pdf-r3/L1.pdf) | Replay offline validado, 1 página |
| PRO / L2 | [post-smoke-pdf-r3/L2.pdf](post-smoke-pdf-r3/L2.pdf) | Replay offline validado, 3 páginas |
| Enterprise / L3 | [post-smoke-pdf-r3/L3.pdf](post-smoke-pdf-r3/L3.pdf) | Replay offline validado, 6 páginas |
| Testes, build e integridade | [validation-summary.json](post-smoke-pdf-r3/validation-summary.json) | 179 testes; TypeScript e build aprovados |
| Preview localizado | [preview-identification.json](post-smoke-pdf-r3/preview-identification.json) | Identidade e acesso HTTP 200 conferidos; não equivale a aceite R-3 |

As imagens correspondentes são `L1-page-1.png`, `L2-page-1.png` a `L2-page-3.png` e `L3-page-1.png` a `L3-page-6.png`, todas em `post-smoke-pdf-r3/`.

## Versões que não devem ser confundidas

- **Correções locais atuais:** base `26dc8ff58100af7b1ffa912bf5e7c46c7d427a93` mais alterações sem commit. São as que produziram os três PDFs acima; não estão publicadas.
- **Preview localizado na Vercel:** [abrir Preview protegido](https://dealsiftermatch-kuj9heeat-deal-sifter-match-s-projects.vercel.app), deployment `dpl_4hwiUxZ2rG6fFpTphPW3VaseHX94`, branch `release/maxxis-report-v1`, criado em 3 de novembro de 2026. O bundle confere com o recibo `maxxis-reconciled-fe9aff373fc4d2e3`. O commit de origem do recibo local é `d5bca41775080dbac581eff4fe487bb9a24bcc16`; a API não fornece SHA Git nesse deployment.
- **Production localizada:** `26dc8ff58100af7b1ffa912bf5e7c46c7d427a93`, deployment `dpl_3kGPL8trni6aNi48PpMVVKsesrnr`. Não contém as correções locais POST-SMOKE.

Os cinco smoke tests permanecem PASS informado pelo proprietário. A ligação entre essa aprovação e um deployment específico não foi comprovada. O Preview localizado é anterior aos PDFs fornecidos; não deve receber automaticamente essa homologação. A ausência de marcadores textuais de Preflight nos bundles inspecionados também não substitui um teste funcional autenticado.

## Histórico e limpeza

As demais pastas não são referência desta rodada. Algumas guardam evidências históricas de fases e funcionalidades distintas; sua presença não comprova aprovação da versão atual. Após autorização de limpeza, 539 PDFs/PNGs históricos foram movidos para `.qa-archive/2026-11-05/`, com verificação de hashes. O arquivo é local e ignorado pelo Git. As referências visuais exigidas por testes e os insumos de geração foram mantidos. Dezoito recibos regenerados foram guardados nesse arquivo, preservando na pasta ativa suas versões históricas commitadas. Resumo seguro: [cleanup-summary.json](post-smoke-pdf-r3/cleanup-summary.json).

**R-3 funcional continua não aceito:** lacunas de resolução financeira/OPEX no checkout e percurso autenticado Preview → chat → persistência → relatório ainda não comprovado. Nenhuma publicação, alteração de flag ou chamada paga foi realizada para resolver a identificação.
