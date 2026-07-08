# QA E2E - Contatos Desbloqueados

Objetivo: validar que o entitlement de contatos desbloqueados e propriedades vinculadas é consistente entre desktop, mobile, modal preview, refresh e multiplos devices.

Tempo estimado: 20 minutos.

## Registro Da Execucao

Preencha antes de iniciar:

- Data/hora:
- Executor:
- Ambiente: Producao
- URL:
- Build/commit:
- Navegador desktop:
- Navegador mobile:
- Resultado geral: Passou / Falhou
- Observacoes:

## Dados De Teste

Usuarios necessarios:

- Usuario A: dono do perfil, com email e telefone reais cadastrados no banco.
- Usuario B: comprador/desbloqueador.
- Usuario C: usuario sem unlock.
- Usuario D: comprador de exclusividade.

Dados minimos do Usuario A:

- Perfil publicado.
- Email visivel somente apos unlock.
- Telefone visivel somente apos unlock.
- Pelo menos 2 propriedades publicadas.
- Pelo menos 1 propriedade elegivel para exclusividade.

## Criterios Globais De Aprovacao

- Email, telefone e WhatsApp nunca aparecem para usuario sem unlock valido.
- Desktop, mobile, outra aba e modal preview exibem exatamente os mesmos dados para o mesmo usuario desbloqueado.
- Refresh ou nova sessao nao remove entitlement ja pago.
- Unlock de contato libera portfolio completo do owner sem paywall adicional.
- Unlock de propriedade libera contato do owner apenas no contexto daquela propriedade.
- Exclusividade ativa de terceiro mostra badge/timer especifico, nunca paywall generico.

---

## CENARIO 1 - Unlock Simples De Contato

Pre-condicoes:

- Usuario A tem perfil publicado com email e telefone reais no banco.
- Usuario A possui pelo menos 1 propriedade publicada.
- Usuario B esta logado com saldo suficiente de nuggets.
- Usuario C esta logado em outro navegador/aba e nao desbloqueou A.

Passos:

1. Com Usuario B, abrir o Feed.
2. Localizar o card de contato do Usuario A.
3. Confirmar o custo de unlock.
4. Executar unlock simples do contato.
5. Abrir `Matches > People` no desktop.
6. Selecionar o card do Usuario A.
7. Verificar email e telefone exibidos.
8. Abrir o mesmo Usuario B em mobile ou outra aba.
9. Ir para `Matches > People`.
10. Selecionar o card do Usuario A.
11. Verificar que email e telefone sao identicos aos do desktop.
12. Abrir o modal de preview do Usuario A.
13. Verificar que email e telefone sao identicos aos do desktop.
14. Clicar em uma propriedade vinculada ao Usuario A.
15. Verificar que a propriedade abre sem paywall adicional.
16. Com Usuario C, abrir Feed, Matches ou preview do Usuario A.
17. Verificar que Usuario C nao ve email nem telefone de A.

Resultado esperado:

- B ve email e telefone de A em `Matches > People` no desktop.
- B ve os mesmos dados em mobile/outra aba.
- B ve os mesmos dados no modal preview.
- B acessa propriedades de A sem novo paywall.
- C nao ve email nem telefone de A em nenhum ponto.

Criterio de aprovacao:

- Passa somente se todos os pontos acima estiverem corretos e consistentes.

Resultado:

- Status: Passou / Falhou
- Evidencias:
- Observacoes:

---

## CENARIO 2 - Unlock De Propriedade

Pre-condicoes:

- Usuario A possui pelo menos 2 propriedades publicadas.
- Usuario B ainda nao desbloqueou o contato completo de A.
- Usuario B possui saldo suficiente.

Passos:

1. Com Usuario B, abrir uma propriedade especifica de A.
2. Executar unlock dessa propriedade.
3. Abrir `Matches > Interests`.
4. Selecionar a propriedade desbloqueada.
5. Verificar que os dados de contato de A aparecem no contexto dessa propriedade.
6. Selecionar outra propriedade de A que nao foi desbloqueada.
7. Verificar que essa outra propriedade ainda mostra paywall para B.

Resultado esperado:

- B ve os dados de A no contexto da propriedade desbloqueada.
- Outras propriedades de A continuam bloqueadas para B.
- O sistema nao transforma unlock de propriedade em unlock completo de contato.

Criterio de aprovacao:

- Passa somente se o contato aparece para a propriedade desbloqueada e as demais propriedades permanecem com paywall.

Resultado:

- Status: Passou / Falhou
- Evidencias:
- Observacoes:

---

## CENARIO 3 - Exclusividade Ativa De Terceiro

Pre-condicoes:

- Usuario A possui uma propriedade publicada elegivel para exclusividade.
- Usuario D possui saldo/plano necessario para comprar exclusividade.
- Usuario B nao e o comprador exclusivo dessa propriedade.

Passos:

1. Com Usuario D, comprar exclusividade da propriedade de A.
2. Com Usuario B, abrir a mesma propriedade.
3. Verificar a area de status/acao da propriedade.
4. Com Usuario D, abrir a propriedade exclusiva.
5. Verificar que D acessa normalmente a propriedade.

Resultado esperado:

- B ve badge ou mensagem: `Exclusiva — disponivel em X dias`.
- B nao ve paywall generico de unlock para essa propriedade.
- D ve a propriedade normalmente como comprador exclusivo.

Criterio de aprovacao:

- Passa somente se o bloqueio de B for especifico de exclusividade e D mantiver acesso normal.

Resultado:

- Status: Passou / Falhou
- Evidencias:
- Observacoes:

---

## CENARIO 4 - Consistencia Pos-Refresh

Pre-condicoes:

- Usuario B ja desbloqueou o contato do Usuario A.
- B esta vendo email e telefone de A em Matches.

Passos:

1. Com Usuario B, confirmar que contatos de A aparecem em `Matches > People`.
2. Fechar o app/navegador.
3. Abrir novamente a URL de producao.
4. Fazer login se necessario.
5. Abrir `Matches > People`.
6. Selecionar Usuario A.
7. Conferir email e telefone.

Resultado esperado:

- Os contatos de A continuam visiveis sem novo unlock.
- Os dados sao os mesmos vistos antes do refresh.
- Nao aparece paywall para o contato ja desbloqueado.

Criterio de aprovacao:

- Passa somente se a nova sessao hidratar o entitlement a partir do banco.

Resultado:

- Status: Passou / Falhou
- Evidencias:
- Observacoes:

---

## CENARIO 5 - Consistencia Multi-Device

Pre-condicoes:

- Usuario B esta logado simultaneamente em desktop e mobile.
- Usuario A ainda nao foi desbloqueado por B antes do teste.
- Usuario B tem saldo suficiente.

Passos:

1. No desktop, com Usuario B, desbloquear Usuario A.
2. Confirmar no desktop que email e telefone de A aparecem.
3. No mobile, dar refresh no app.
4. Abrir `Matches > People`.
5. Selecionar Usuario A.
6. Conferir email e telefone.

Resultado esperado:

- Mobile mostra os mesmos contatos de A apos refresh.
- Nao ha diferenca de regra entre devices.
- Nao depende de cache/localStorage do desktop.

Criterio de aprovacao:

- Passa somente se o mobile refletir o unlock feito no desktop apos refresh.

Resultado:

- Status: Passou / Falhou
- Evidencias:
- Observacoes:

---

## Checklist Final

- Cenario 1: Passou / Falhou
- Cenario 2: Passou / Falhou
- Cenario 3: Passou / Falhou
- Cenario 4: Passou / Falhou
- Cenario 5: Passou / Falhou

Resultado final:

- Aprovado para producao: Sim / Nao
- Bloqueadores encontrados:
- Acoes corretivas abertas:
