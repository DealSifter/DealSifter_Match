# Politica de Dados e Delecao LGPD

## Objetivo

Esta politica define como o DealSifter trata dados pessoais quando um usuario solicita delecao de conta. A regra de producao e soft-delete com auditoria: preservamos rastros minimos de operacao financeira/KPI, mas removemos dados pessoais e arquivos publicos.

## Buckets de Storage usados

| Bucket | Uso | Acesso atual | Politica na delecao |
| --- | --- | --- | --- |
| `profile-images` | Avatar e fotos de perfil, incluindo `avatar.jpg`, `photo-a.jpg`, `photo-b.jpg` | Publico | Remocao imediata de todos os objetos com prefixo `userId/` |
| `property-images` | Fotos de propriedades e imagens de servicos, incluindo `userId/propertyId/index.jpg` e `userId/services/serviceId/index.jpg` | Publico | Remocao imediata de todos os objetos com prefixo `userId/` |

Como esses buckets sao publicos, qualquer URL antiga continuaria acessivel se o objeto permanecesse em Storage. Por isso, a delecao de conta remove os objetos publicos em vez de apenas limpar as referencias no banco.

## Fluxo de delecao de conta

1. A Edge Function `delete-account` autentica o usuario.
2. Assinaturas Stripe ativas, trialing ou past_due sao canceladas.
3. A RPC `delete_user_account` cria um registro em `account_deletions` e anonimiza dados pessoais.
4. A Edge Function lista recursivamente os objetos em:
   - `profile-images/userId/`
   - `property-images/userId/`
5. Os objetos encontrados sao removidos do Supabase Storage.
6. O registro em `account_deletions` recebe:
   - `files_deleted`
   - `files_failed`
   - `storage_cleanup_completed_at`
   - detalhes em `metadata.storageCleanup`
7. O usuario do Supabase Auth e anonimizado e banido para impedir reutilizacao da sessao antiga.

## Regra para imagens em unlocks pagos

Unlocks, compras de nuggets, exclusividades e eventos financeiros permanecem no banco para auditoria, reconciliacao e KPIs. Esses registros nao devem depender de imagens publicas do usuario deletado.

Politica adotada:

- Remover a imagem do Storage imediatamente.
- Manter o registro financeiro/unlock.
- Renderizar placeholder quando a imagem original nao existir mais.
- Nao reexpor avatar, fotos de propriedade ou imagens de servico do usuario deletado.

Essa escolha evita vazamento de PII e ainda preserva a trilha operacional necessaria para suporte, auditoria e conciliacao financeira.

## Auditoria operacional

Para verificar uma delecao:

```sql
select
  user_id,
  deleted_at,
  files_deleted,
  files_failed,
  storage_cleanup_completed_at,
  metadata->'storageCleanup' as storage_cleanup
from public.account_deletions
where user_id = '<USER_ID>'
order by deleted_at desc;
```

Se `files_failed > 0`, revisar `metadata.storageCleanup.failed` e `metadata.storageCleanup.listingFailures`. O operador deve remover manualmente os caminhos pendentes no Supabase Storage e atualizar o registro de auditoria, se necessario.

## Cadastro posterior com o mesmo email

Uma nova conta criada com o mesmo email nao deve reidratar dados antigos. O historico anterior permanece anonimizado e vinculado apenas ao `user_id` antigo para auditoria.
