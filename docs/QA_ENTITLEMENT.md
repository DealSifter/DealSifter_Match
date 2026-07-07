# QA Entitlement: Owner vs Property Unlock

Objetivo: validar que o app entrega exatamente o acesso comprado, sem cobrar duas vezes pelo mesmo owner e sem exibir paywall genérico em propriedade bloqueada por exclusividade.

## Caso A: desbloquear owner libera portfolio completo

Pre-condições:
- Usuário A tem um card de pessoa/serviço publicado e pelo menos duas propriedades publicadas.
- Usuário B tem nuggets suficientes.
- Nenhuma propriedade do Usuário A está com exclusividade ativa de terceiro.

Passos:
1. Entrar como Usuário B.
2. No Feed, desbloquear o card de pessoa/serviço do Usuário A.
3. Abrir `Matches`.
4. Clicar no owner desbloqueado.
5. Clicar em cada propriedade do portfolio desse owner.

Resultado esperado:
- Email/telefone/WhatsApp do owner aparecem.
- Todas as propriedades do portfolio abrem sem paywall adicional.
- A coluna `Interests` mostra essas propriedades como `Unlocked`.

Onde confirmar:
- Banco: `select ds_get_unlocked_contact_cards('<user_b_id>');`
- O objeto do owner deve conter `unlock_scope = "contact"` e `unlocked_property_ids` com todas as propriedades ativas/publicadas do owner.

## Caso B: desbloquear propriedade libera owner como contato

Pre-condições:
- Usuário A tem pelo menos duas propriedades publicadas.
- Usuário B ainda não desbloqueou o owner.

Passos:
1. Entrar como Usuário B.
2. Desbloquear uma propriedade específica do Usuário A.
3. Abrir `Matches`.
4. Selecionar a propriedade desbloqueada.
5. Selecionar o owner correspondente.
6. Tentar abrir outra propriedade do mesmo owner.

Resultado esperado:
- A propriedade desbloqueada abre sem paywall.
- O contato do owner aparece, pois ele é o contato daquela propriedade.
- As demais propriedades do mesmo owner continuam locked, salvo se também forem desbloqueadas.

Onde confirmar:
- Banco: `select ds_get_unlocked_contact_cards('<user_b_id>');`
- O objeto do owner deve conter `unlock_scope = "property"`.
- `unlocked_property_ids` deve conter somente a propriedade comprada.

## Caso C: exclusividade ativa de terceiro

Pre-condições:
- Usuário C comprou exclusividade ativa em uma propriedade do Usuário A.
- Usuário B não é o comprador dessa exclusividade.

Passos:
1. Entrar como Usuário B.
2. Abrir `Matches` ou Map/Feed e clicar na propriedade exclusiva.
3. Observar a tela de detalhe.
4. Clicar no owner, se disponível, para desbloqueio de contato.

Resultado esperado:
- A propriedade mostra o aviso `Exclusive - available in X days` com cronômetro.
- Nunca aparece paywall genérico `Unlock - X nuggets` para a propriedade exclusiva.
- O owner continua podendo ser desbloqueado como contato, sem liberar a propriedade exclusiva enquanto a exclusividade estiver ativa.

Onde confirmar:
- Banco: verificar `property_unlocks` com `mode in ('total', 'partial')`, `status='active'` e `expires_at > now()`.
- App: o card da propriedade deve exibir badge/aviso de exclusividade, não modal de unlock comum.
