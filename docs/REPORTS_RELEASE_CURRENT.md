# Relatórios / Maxxis — referência da entrega

Atualização: 5 de novembro de 2026. Publicação em produção autorizada pelo proprietário nesta data; em preparação até o recibo de verificação final.

## Escopo da publicação

- Corrigir a contradição da área do terreno sem inventar ou comprovar circularmente dados derivados.
- Separar estimativas mensais de aluguel de referências de valor imobiliário.
- Identificar taxas declaradas pelo anunciante e preservar fontes e datas.
- Melhorar a continuidade de textos e eliminar a sétima página residual no replay L3, preservando o design e o conteúdo.
- Atualizar os exemplos do botão “i” pelo renderer real; o chat continua usando a prévia do PDF canônico.
- Preservar as mensagens específicas de falha de conexão já existentes no trabalho local.

Nenhuma mudança de pricing, Nuggets, Stripe, motores financeiros, provedores ou flags. O ajuste local de CORS do Preview é preservado no código-fonte; não há publicação de funções nesta entrega de frontend.

## O que foi validado

- Replay offline com evidências existentes: L1 com 1 página, L2 com 3, L3 com 6. Dez páginas inspecionadas, sem overflow ou perda de notas, números e fontes.
- Exemplos fictícios do aplicativo regenerados: 1/3/6 páginas, com imagens e mapas locais; nenhum dado ilustrativo é usado como evidência de imóvel real.
- Resultados detalhados e limites de reprodução: [aceite POST-SMOKE](../POST_SMOKE_PDF_AND_R3_ACCEPTANCE.md).
- Artefatos atuais e recibos: [índice QA](../qa/README.md).

## R-3: pendência explícita

O fluxo conversacional integral Report Preflight → complementação financeira → persistência → relatório **não foi homologado**. O checkout ainda não comprova resolução de todos os gaps financeiros nem reconciliação de OPEX agregado. Este release publica correções de geração/apresentação; não anuncia a conclusão do R-3 nem ativa a flag de Property Intelligence.

## Organização dos arquivos

- `src/`: código e exemplos que fazem parte do app.
- `docs/REPORTS_RELEASE_CURRENT.md`: ponto de entrada da entrega e estado de publicação.
- `POST_SMOKE_PDF_AND_R3_ACCEPTANCE.md`: evidências, limitações e decisão funcional.
- `qa/post-smoke-pdf-r3/`: PDFs locais de conferência e recibos seguros. PDFs/PNGs reais e referências privadas de origem ficam fora do Git e do deploy.
- `.qa-archive/2026-11-05/`: arquivo local de 539 PDFs/PNGs históricos, com manifesto privado de caminhos e hashes. Cerca de 225 MB retirados das pastas ativas; evidências não destruídas.
- Referências históricas do golden master, fotos/base cartográfica de exemplo, documentos e scripts reprodutíveis foram preservados. Arquivos gerados do template deixam de ser versionados, permanecendo disponíveis localmente e regeneráveis por `npm run qa:reports:generate`.

Segredos, dados reais de contato, PDFs de QA, PNGs de QA e o arquivo histórico local não entram no pacote de publicação. Somente os PNGs fictícios de exemplo em `src/assets/maxxis/report-previews/` fazem parte do app.

## Publicação e recuperação

Target: projeto Vercel `prj_QPyhaESQ9dpLfgSfwzm4wxirLbs5`, produção `https://dealsiftermatch.vercel.app`; Supabase público `cyeipfskwwisbbayyaca`. A configuração pública foi lida da produção vigente e será mantida, alterando somente o identificador de release.

Ponto de recuperação anterior: deployment `dpl_3kGPL8trni6aNi48PpMVVKsesrnr`, commit `26dc8ff58100af7b1ffa912bf5e7c46c7d427a93`. O stash protegido permanece intacto. Não haverá push Git nesta entrega; os commits são locais e o deploy usa o pacote isolado correspondente ao commit validado.
