# QA E2E - Fluxos Financeiros Criticos

Objetivo: validar manualmente, antes de producao, os fluxos que afetam dinheiro, saldo de nuggets, unlocks, exclusividade, delecao de conta e integridade de historico.

Ambiente recomendado:
- Frontend em ambiente de staging ou producao controlada.
- Stripe em modo test.
- Supabase apontando para banco de teste/staging, quando possivel.
- AdminDashboard acessivel para conferencia operacional.
- Dois usuarios de teste com emails diferentes.

Regra geral: qualquer saldo, pagamento, unlock, exclusividade ou cancelamento deve ser confirmado no backend/Stripe. A UI sozinha nao e fonte de verdade.

## 1. Compra de Pack de Nuggets

### Pre-condicoes

- Usuario A cadastrado e logado.
- Usuario A com saldo de nuggets igual a zero.
- Usuario A sem checkout pendente aberto.
- Stripe configurado em modo test.
- Webhook Stripe apontando para a Edge Function correta.
- AdminDashboard acessivel.

### Passos Exatos

1. Entrar no app como Usuario A.
2. Confirmar visualmente que o saldo de nuggets exibido e zero.
3. Abrir o modulo `Pricing`.
4. Selecionar um pack de nuggets.
5. Prosseguir para o checkout Stripe em modo test.
6. Concluir o pagamento usando cartao de teste aprovado do Stripe.
7. Aguardar retorno ao app.
8. Atualizar a tela do app uma vez.
9. Abrir o AdminDashboard.
10. Conferir no Stripe Dashboard o pagamento/checkout em modo test.
11. Conferir no banco as tabelas de compra/saldo relacionadas ao usuario.

### Resultado Esperado

- O checkout deve abrir sem erro.
- O pagamento deve aparecer como concluido no Stripe Dashboard.
- O saldo do Usuario A deve aumentar somente depois que o webhook for recebido e processado.
- O saldo nao deve aumentar apenas por clicar no pack, abrir checkout ou voltar para o app.
- A compra deve gerar registro persistido no banco.
- O AdminDashboard deve refletir a compra somente depois do evento real do Stripe/webhook.

### Onde Confirmar

- App: saldo de nuggets do Usuario A.
- Stripe Dashboard: checkout/session/payment em modo test.
- Banco Supabase:
  - tabela de compras de nuggets, por usuario;
  - saldo atual do usuario;
  - logs/eventos Stripe processados.
- AdminDashboard:
  - KPI de checkout/pagamentos;
  - alertas de webhook Stripe skipped/falhos.

### Validacao Negativa

1. Repetir o fluxo com Usuario A ainda com saldo controlado.
2. Abrir `Pricing`.
3. Selecionar um pack.
4. Abrir checkout Stripe.
5. Fechar a aba/janela do checkout antes de concluir o pagamento.
6. Voltar ao app.
7. Atualizar a tela.
8. Conferir app, banco, Stripe Dashboard e AdminDashboard.

### Resultado Esperado da Validacao Negativa

- O saldo nao deve aumentar.
- Nao deve existir compra concluida para esse checkout.
- O Stripe pode mostrar checkout/session incompleto, expirado ou abandonado, mas nao pagamento aprovado.
- O AdminDashboard nao deve contar esse fluxo como pagamento concluido.

## 2. Unlock com Custo Snapshot

### Pre-condicoes

- Usuario A cadastrado, logado e com nuggets suficientes.
- Usuario B cadastrado com contato/card publicado no feed.
- Usuario B possui portfolio publicado associado ao contato.
- O custo de unlock deve ser maior que zero e calculavel pela soma do portfolio ativo/publicado.
- Usuario A ainda nao desbloqueou Usuario B.
- Existe acesso admin ou direto ao banco para alterar o portfolio do Usuario B durante o teste.

### Passos Exatos

1. Entrar no app como Usuario A.
2. Abrir o feed onde o card do Usuario B aparece.
3. Abrir o card/acao de unlock do Usuario B.
4. Verificar o custo exibido no modal de confirmacao.
5. Nao confirmar ainda.
6. Em outra aba, com acesso admin, alterar o portfolio ativo/publicado do Usuario B:
   - adicionar um item publicado; ou
   - remover/despublicar um item existente.
7. Voltar ao modal aberto do Usuario A.
8. Confirmar o unlock usando o valor antigo ainda exibido.

### Resultado Esperado

- O unlock nao deve completar com o valor antigo.
- O backend deve rejeitar a confirmacao por token/custo divergente.
- A UI deve apresentar erro do tipo `UnlockCostChanged` ou mensagem equivalente.
- A mensagem deve informar que o valor mudou e indicar o novo custo para nova confirmacao.
- Nenhum nugget deve ser debitado nessa tentativa rejeitada.
- Nenhum unlock deve ser criado nessa tentativa rejeitada.

### Onde Confirmar

- App: modal de unlock e saldo do Usuario A.
- Banco Supabase:
  - tabela de `unlock_intents`;
  - tabela de unlocks;
  - saldo/nuggets do Usuario A;
  - portfolio ativo/publicado do Usuario B.
- AdminDashboard:
  - ausencia de unlock concluido na tentativa rejeitada;
  - ausencia de evento financeiro indevido.

### Passos Para Confirmar com Novo Valor

1. No app do Usuario A, aceitar/abrir nova confirmacao com o novo valor.
2. Confirmar o unlock com o novo snapshot/token.
3. Aguardar resposta do app.
4. Atualizar a tela.
5. Conferir saldo, contato desbloqueado e registros no banco.

### Resultado Esperado com Novo Valor

- O unlock deve completar.
- O saldo deve ser debitado exatamente pelo novo valor confirmado.
- O contato deve aparecer como desbloqueado.
- O banco deve registrar o unlock com custo correto.
- O AdminDashboard deve refletir o unlock concluido.

## 3. Exclusividade com Conflito

### Pre-condicoes

- Usuario A e Usuario C cadastrados, logados e com nuggets suficientes.
- Usuario B possui uma propriedade publicada e elegivel para exclusividade.
- A propriedade ainda nao possui exclusividade ativa.
- Usuario A e Usuario C podem acessar a mesma propriedade ao mesmo tempo em duas abas, navegadores ou devices diferentes.
- Ambos os usuarios ainda nao compraram exclusividade dessa propriedade.

### Passos Exatos

1. Abrir o app como Usuario A na aba/device 1.
2. Abrir o app como Usuario C na aba/device 2.
3. Em ambos, localizar a mesma propriedade do Usuario B.
4. Em ambos, abrir o modal/fluxo de compra de exclusividade da mesma propriedade.
5. Garantir que ambos estejam na tela de confirmacao antes de concluir.
6. Confirmar a compra de exclusividade quase ao mesmo tempo nos dois devices.
7. Aguardar a resposta dos dois fluxos.

### Resultado Esperado

- Apenas um usuario deve completar a compra de exclusividade.
- O usuario vencedor deve ter saldo debitado corretamente.
- A propriedade deve ficar marcada como exclusiva para o usuario vencedor.
- O segundo usuario deve receber erro `ExclusivityAlreadyActive` ou mensagem equivalente.
- O segundo usuario nao deve ter saldo debitado.
- O segundo usuario nao deve receber exclusividade.

### Onde Confirmar

- App Usuario A e Usuario C:
  - status da propriedade;
  - saldo de nuggets;
  - mensagem de erro/sucesso.
- Banco Supabase:
  - tabela de exclusividade/property unlocks;
  - saldo dos dois usuarios;
  - ausencia de duplicidade ativa para a mesma propriedade.
- AdminDashboard:
  - apenas uma exclusividade concluida;
  - ausencia de evento duplicado.

## 4. Delecao e Recriacao de Conta

### Pre-condicoes

- Usuario A cadastrado e logado.
- Usuario A possui plano ativo no Stripe em modo test.
- Usuario A possui saldo, historico, cards publicados e/ou unlocks suficientes para verificar limpeza.
- Stripe Dashboard acessivel.
- Banco Supabase acessivel para conferencia.

### Passos Exatos - Deletar Conta

1. Entrar no app como Usuario A.
2. Confirmar que o Usuario A possui plano ativo.
3. Confirmar que existe assinatura ativa no Stripe Dashboard.
4. Acessar a area de configuracoes/conta.
5. Acionar o fluxo de deletar conta.
6. Confirmar a delecao.
7. Aguardar conclusao do app.
8. Sair/atualizar a tela.

### Resultado Esperado - Delecao

- A conta deve ser desativada/anonomizada pelo backend.
- A assinatura Stripe ativa deve ser cancelada.
- Dados pessoais devem ser anonimizados.
- Cards/portfolio do usuario devem ser despublicados/inativados.
- Registros de auditoria devem permanecer sem expor dados pessoais.
- O usuario nao deve continuar logado com acesso normal.

### Onde Confirmar - Delecao

- Stripe Dashboard:
  - assinatura do Usuario A deve aparecer cancelada.
- Banco Supabase:
  - tabela `account_deletions`;
  - usuario/perfil anonimizado;
  - cards/portfolio com publicacao desativada;
  - owner_id mantido em registros de auditoria/unlock quando aplicavel;
  - ausencia de dados pessoais expostos.
- AdminDashboard:
  - assinatura/usuario refletidos conforme esperado;
  - ausencia de erro operacional.

### Passos Exatos - Recriar Conta com Mesmo Email

1. Abrir o app em sessao limpa ou janela anonima.
2. Criar uma nova conta usando o mesmo email original do Usuario A.
3. Confirmar email, se o fluxo exigir.
4. Fazer login com a nova conta.
5. Entrar no onboarding/perfil inicial.
6. Conferir feed, saldo, historico e cards.

### Resultado Esperado - Recriacao

- A nova conta deve iniciar do zero.
- Saldo deve ser zero.
- Nao deve haver historico anterior reidratado.
- Nao deve haver cards antigos publicados no feed.
- Nao deve haver "cards fantasmas".
- Unlocks/exclusividades antigos nao devem aparecer como dados pessoais da nova conta.
- Registros antigos de auditoria podem permanecer no banco, mas sem expor dados pessoais e sem reidratar a nova conta.

### Onde Confirmar - Recriacao

- App:
  - saldo zero;
  - onboarding limpo;
  - feed sem cards antigos do usuario deletado;
  - Matches sem historico antigo.
- Banco Supabase:
  - novo `user_id` para a nova conta;
  - ausencia de vinculo ativo com cards antigos;
  - historico antigo preservado apenas como auditoria anonimizada.
- Stripe Dashboard:
  - nenhuma assinatura antiga reativada automaticamente.
- AdminDashboard:
  - novo usuario sem historico financeiro herdado;
  - ausencia de anomalias de KPI.

## Criterio Final de Aprovacao

Os quatro cenarios devem passar sem excecoes antes de abrir producao ampla.

Se qualquer teste falhar:
- registrar usuario, horario, ambiente e passo exato;
- capturar prints do app;
- capturar evento Stripe relacionado, se houver;
- capturar registros relevantes do banco;
- bloquear divulgacao ate corrigir e repetir o roteiro completo do cenario afetado.
