# Publicação controlada — mapa de localização e Basic

Publicado em 19/10/2026. URL: https://dealsiftermatch.vercel.app

- SHA anterior: `6cefdb1ac4b54b6b4734bbd401667043e226acf1`.
- Novo commit local isolado: `b989d7bf4de5550d006663ae67c3fc22f7b3fd06`.
- Deployment anterior: `dpl_71SwYhD5fiVSQgzxinSJZumiyJFp`.
- Deployment promovido e confirmado no domínio principal: `dpl_GwdT5vyhpd5cGfnSAgm7XMRhyXDW`.
- Rollback: `vercel rollback dpl_71SwYhD5fiVSQgzxinSJZumiyJFp --yes`.

## Diff publicado

Base: worktree limpa do SHA de produção anterior, branch `fix/report-map-basic-20261019`. Dois arquivos, 61 inserções e oito remoções:

- `src/features/maxxis/export/referenceReportPdf.ts`: selo visível Basic; mapa de localização em cover ocupando o quadro inteiro, título sobreposto, bordas arredondadas e atribuição preservadas; diagrama de coordenadas mantém indicação correta quando a imagem não está disponível.
- `src/features/maxxis/export/referenceReportLayout.test.js`: cinco controles novos e medição de texto no mock.

Não foram publicadas alterações analíticas pendentes, extensão/monitor de diagnóstico, backend, migrations, RLS, provedores ou configuração de infraestrutura. O diretório principal com alterações locais não foi usado como fonte do deploy.

## Verificações

- 17 testes de layout passaram na worktree isolada, inclusive o teste de Match Score que falhava com as alterações analíticas locais ainda não publicadas.
- Build remoto de produção concluído. Candidato criado com `--prod --skip-domain`, validado e depois promovido.
- Candidato: inicialização não autenticada e geração/download de PDFs Basic (uma página), Pro (três páginas) e Enterprise (seis páginas). Imagem sintética de mapa, sem chamadas a provedores. Todas as gerações retornaram RENDERED; nenhuma exceção JavaScript de página capturada.
- Inspeção visual do PDF Basic efetivamente renderizado confirmou mapa preenchendo o quadro e título sobreposto.
- Pós-deploy no domínio principal: HTTP 200, root React montado sem autenticação, geração/download Basic concluídos, título e selo corretos, nenhuma exceção JavaScript de página capturada.
- Bundle PDF do domínio principal idêntico ao candidato: `maxxisReportPdf-D9m0XmyW.js`, SHA-256 `b8da42013f707aa12b1aebd7e63d288b6dbb41ecabffa040da89fcd741054eae`.

Evidências locais: `.cache/report-map-basic-release/candidate-smoke.json`, `post-smoke.json`, PDFs e imagens correspondentes. Esses controles não acessam a sessão autenticada do usuário, não validam o congelamento real e não declaram o travamento resolvido. A metadata Vercel não forneceu githubCommitSha no novo deploy; a referência SHA acima identifica o commit da worktree isolada enviada, não um campo retornado pela API.

Para conferir: recarregar o aplicativo e gerar um PDF novo; arquivos PDF já baixados não são atualizados pela publicação.
