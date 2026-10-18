# Cabeçalhos, categorias e colunas — 18/10/2026

- Removida a faixa repetida de endereço/localização/preço de todas as páginas e categorias. Os dados principais continuam no resumo inicial; os blocos analíticos começam no espaço recuperado, sem um buraco no lugar da faixa.
- O arquivo original da marca foi mantido sem alteração de cores ou proporção. Largura de exibição: 205 → 143,5 pt (redução de 30% em ambas as dimensões). Centro vertical alinhado ao centro do cabeçalho (y = 42 pt).
- Fundo grafite comum do L3 aplicado aos cabeçalhos de todas as categorias. Destaques, preços, ícones e gráficos: L1 turquesa `#19B3B8`, L2 verde `#00915F`, L3 amarelo-ouro `#E7A700`. Alertas amarelos e cores semânticas dos pins preservados. A paleta também vale para continuações de evidências.
- Colunas de dados gerais redistribuídas: publicador 134 → 164 pt; imóvel 134 → 153 pt; terreno 261 → 212 pt. Padding lateral dos três cards: 10 → 7 pt. Terreno mantém duas colunas e descrição legal em largura total. Contatos longos têm mais largura útil, sem quebrar o último dígito por falta de espaço.
- No controle completo, altura dos cards de dados caiu de 209 para 191 pt; mapa/notas cresceram de 107 para 125 pt. Cinco fotos, dados disponíveis, análises e gráficos foram preservados.

Validação: 95 testes passaram em cinco arquivos; TypeScript de relatórios e lint do teste alterado passaram. Nove PDFs de controle (L1/L2/L3 × dados completos, aluguel, ARV) foram gerados, reabertos e rasterizados, com aprovação dos testes de conteúdo, primeira página, evidências, geometria, mapas/tabelas e fotos. Sem mudança de fontes durante a geração; digest `d2683369627f4c5939a41bc9e0a94e1a2f375cf05722a1b7ec787d56fac615bb`.

Inspeção visual cobriu as três categorias, marca centralizada, cores, colunas e página de comparáveis sem faixa repetida. São controles sintéticos, não relatórios autenticados de produção. Nenhum cálculo, backend, provedor, segredo ou dado foi alterado. Nenhuma consulta paga foi realizada.

Publicado em produção: commit de runtime `44b038d556be916798e04f864b8703e7fd158fdf`, enviado à branch `fix/production-real-defects`. Vercel `dpl_FMDyyGRgsRtL2SxWtmkktkfGAB7M` READY com SHA exato e alias `dealsiftermatch.vercel.app` verificados em 18/10/2026 às 15:32 BRT. Build de produção aprovado para este código final. Nenhum deploy de backend foi realizado; esta atualização do comprovante é documental.
