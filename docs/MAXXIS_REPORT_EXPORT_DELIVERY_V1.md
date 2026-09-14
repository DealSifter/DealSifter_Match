# Maxxis Report Export + Delivery Experience v1

## Escopo

Fundação estrutural para transformar um `MaxxisReportSchema` autorizado em um **Maxxis Investment Intelligence Document** auditável. Nenhum PDF binário, email ou link público é gerado nesta fase.

## Tipos e permissões

| Plano | Property Release | Maxxis Analysis | Deal Intelligence |
| --- | --- | --- | --- |
| Free | Permitido | Disponível com upgrade | Disponível com upgrade |
| Pro | Permitido | Permitido | Disponível com upgrade |
| Enterprise | Permitido | Permitido | Permitido |

Cada canal (`PDF`, `EMAIL`, `SHARE`) exige um `ReportExportEntitlement` correspondente ao tipo do relatório. A validação reutiliza o controle de acesso canônico e falha fechada.

## PDF / document foundation

`MaxxisReportRenderer` recebe schema e autorização PDF. A saída preparada contém capa, estrutura das páginas, cabeçalho e rodapé auditáveis. A capa usa endereço, tipo, estratégia, tipo de relatório, data e somente a imagem principal já existente no portfólio. `binary` e `downloadUrl` permanecem nulos.

Todas as páginas registram:

- DealSifter Match e MAXXIS AI;
- “Evidence-based investment intelligence”;
- página, data e versão;
- disclaimer de análise baseada em evidências.

## Preview e UX

As ações `Export PDF`, `Send Email` e `Share` são exibidas junto ao relatório. A prévia apresenta tipo, quantidade de páginas, inteligência incluída e nível de acesso. A confirmação apenas emite intenção local de preparação; não realiza entrega.

## Email foundation

`ReportEmailRequest` inclui recipient, subject, reportType, propertyId e message, além da validação interna de propriedade. O estado final desta fase é `PREPARED_NOT_SENT`, sem anexo ou delivery ID.

## Share foundation

`SharedReport` inclui id, reportType, ownerId, createdAt, expiresAt, accessLevel e status. Somente o próprio dono pode preparar o compartilhamento. URL, token e conteúdo do relatório permanecem nulos; o estado é `PREPARED_NOT_PUBLISHED`.

## Segurança e futuras integrações

- Relatório premium nunca é renderizado ou pré-visualizado sem entitlement compatível.
- Preview bloqueado não recebe conteúdo, páginas ou inteligência premium.
- Não há chamadas RentCast, Stripe, Nuggets, email ou publicação de links.
- Não há alteração dos motores ARV, Comp, Match, Deal Metrics ou Property Evidence.
- Geração definitiva, armazenamento, entrega, revogação e auditoria de links exigem fases futuras específicas.
