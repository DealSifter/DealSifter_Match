# Relatórios / Maxxis — referência da entrega

Atualização: 5 de novembro de 2026. **Correções de relatórios publicadas em produção**, conforme autorização do proprietário. R-3 conversacional continua sem aceite funcional.

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
- Validação de entrega: 399/399 testes de exportação, previews, recuperação e CORS com mocks; TypeScript direcionado e build de produção PASS. O teste antigo que exigia uma promessa de chat foi atualizado para proibi-la enquanto R-3 não estiver homologado.
- Worker compilado em navegador com CPU reduzida a 1/4: L1/L2/L3 renderizados em aproximadamente 2–3 segundos com interface responsiva e zero requisições externas. Tempos são das fixtures locais, não promessa para toda aquisição real.

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

Target: projeto Vercel `prj_QPyhaESQ9dpLfgSfwzm4wxirLbs5`, produção `https://dealsiftermatch.vercel.app`; Supabase público `cyeipfskwwisbbayyaca`. A configuração pública foi lida da produção vigente e mantida, alterando somente o identificador de release. A flag de Property Intelligence permanece `false`.

Código publicado: `6048598b96c756c5eb7128513ea6bdf237e6633e`. Commit de limpeza/documentação: `69e10b6c525dacbd33ac9e29eae8aadddbd51c23`. Deployment: `dpl_7d6TWLVQT6ji4GtbnE9zaK6bhrCX`, READY, HTTP 200. Release stamp: `maxxis-post-smoke-6048598b96c7`.

Os hashes do entrypoint, de sete módulos de runtime e das dez páginas de exemplo conferem com o pacote de 138 arquivos. PDFs reais, arquivos de QA, sourcemaps e segredos foram excluídos do pacote. O frontend publicado é o pacote isolado do commit de código; commits posteriores de documentação não alteram esse runtime.

**Pós-deploy: PASS.** Abertura em desktop/mobile sem erros de runtime ou falhas de assets; L1/L2/L3 gerados pelo worker efetivamente servido em produção; download real do Basic validado com worker disponível e bloqueado, preservando a descrição completa e a responsividade. Fixtures fictícias, sem conta autenticada, sem débito e sem chamadas aos provedores. Não se trata de certificação do percurso autenticado R-3. Recibo consolidado: [release-verification.json](../qa/post-smoke-pdf-r3/release-verification.json).

Ponto de recuperação anterior: deployment `dpl_3kGPL8trni6aNi48PpMVVKsesrnr`, commit `26dc8ff58100af7b1ffa912bf5e7c46c7d427a93`. O stash protegido permanece intacto. Não houve push Git nesta entrega; os commits são locais e o deploy usa o pacote isolado correspondente ao commit validado.
