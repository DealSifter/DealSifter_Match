# Contingências e apresentações simuladas — revisão de 29/10/2026

Status: o usuário autorizou somente os itens **4 e 6**. Eles foram corrigidos nesta revisão. Os itens **1, 2, 3, 5, 7 e 8** permanecem sem alteração por decisão expressa do usuário.

A revisão examinou os caminhos do frontend e os provedores presentes neste repositório. A presença de uma palavra como `fallback` não é, por si só, evidência de dado inventado. Consultas alternativas a dados reais, estados de indisponibilidade, ícones sem foto e simulações financeiras explicitamente solicitadas não foram classificados como dados fictícios.

| Item | Evidência no código | Comportamento encontrado | Alteração proposta para aprovação |
|---|---|---|---|
| 1 | `src/pages/Onboarding.jsx`, `buildPreviewFeedCard`, `autoRating`, `autoReviews`, `autoDeals` | A quantidade de registros gera nota 4,9, avaliações e negócios fictícios no preview. | Remover a geração; mostrar somente métricas comprovadas ou ausência de avaliações. |
| 2 | `src/pages/Landing.jsx`, `LandingProfCard`, `NuggetSwipeDemo` | Pessoas, fotos e históricos de profissionais ilustrativos sem vínculo com usuários reais. | Substituir por apresentação funcional sem identidades ou resultados fictícios. |
| 3 | `src/lib/matchPressure.js`, `getMatchPressure`; uso no onboarding | ID do imóvel produz percentual fictício de acessos entre 15% e 85%, usado no texto e no piscar do botão de fechar negócio. | Retirar percentual e destaque simulados; preservar fechamento do negócio. Só destacar acessos quando houver fonte real. |
| 4 | `src/pages/Settings.jsx`, efeito de `profileSaveState` | “Salvo” aparece por temporizador de 450 ms sem confirmação da persistência. | Aguardar gravação real e mostrar erro/pendência quando necessário. |
| 5 | `src/pages/Landing.jsx`, `LandingPropCard` | Imóvel ilustrativo de Orlando com preço US$ 180 mil e ARV US$ 280 mil fixos. | Substituir por apresentação sem anúncio ou valores fictícios. |
| 6 | `src/pages/MatchesPage.jsx`, caminho de `sendMessage` sem `onSendChatMessage` | Respostas e digitação do interlocutor são simuladas quando o envio real não é fornecido. O App atual fornece o callback real, portanto este é um caminho residual, não confirmado como ativo no fluxo integrado de produção. | Eliminar a resposta inventada e sinalizar indisponibilidade caso a integração real falte. |
| 7 | `src/pages/Dashboard.jsx`, `computeScopeRatingDetails` | Estrelas representam um cálculo de atividade/preenchimento, não avaliações de clientes. Não é um número aleatório, mas pode ser interpretado como reputação recebida. | Manter o cálculo e identificá-lo como índice de atividade, separado de avaliações. |
| 8 | `src/pages/Landing.jsx`, lista do mosaico do hero | Decoração animada inclui nomes, cidades e preços inventados. | Preservar animação com elementos genéricos sem identidades/anúncios/valores fictícios. |

## Caminhos verificados que não exigem retirada de dado fictício em produção

- Cards e imóveis mock de Dashboard, Matches e MapView são condicionados a `import.meta.env.DEV`.
- O mapa exige geocodificação válida; a inclusão de mocks depende de ambiente de desenvolvimento.
- Os provedores imobiliários mock do backend são bloqueados fora de `NODE_ENV=test`.
- O chat integrado recebe `sendChatMessage` do App; o problema residual do item 6 é a contingência no componente.
- Matches resolve contatos por proprietário **e** perfil. O RPC usa `resolved[profile_scope]` para a foto.
- Ícones/iniciais para foto ausente não atribuem a imagem de outra pessoa.

## Correções de imagem e layout já solicitadas, independentes destas aprovações

- Preview to Feed com dimensões do My Card no desktop e controles de perfil no cabeçalho do card.
- Personal, Business/Operations e FSBO usam identidades próprias; rascunhos só substituem o perfil em edição.
- Conversão dos payloads e seleção de fotos impedem fallback de FSBO para a foto genérica de Personal.
- Galerias vinculadas são limitadas ao proprietário e perfil correspondentes; trocar de identidade reinicia a imagem no retrato do perfil.
- Uploads temporários isolados por usuário e ramo do cadastro; proteção contra gravar estado anterior durante a troca de ramo.
