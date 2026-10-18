# Refino de densidade dos relatórios — 18/10/2026

Implementação restrita ao compositor PDF e seus controles. Sem alteração de fatos, cálculos, provedores, permissões ou backend. O PDF usado no preview e na exportação continua sendo o mesmo.

- Títulos de página: 21 → 16 pt; cabeçalhos de seção: 12,5 → 10 pt; ícones de página: 31 → 23 pt; distância entre cards: 9 → 7 pt. Padding lateral: 13 → 10 pt. Fonte dos dados permanece legível, sem reduzir mapas, gráficos, barras ou o gauge.
- A foto principal do hero mantém 174 pt de altura. A galeria preserva cinco imagens, com a primeira duas vezes mais larga que cada uma das outras quatro. Altura útil das cinco fotos: 29 → 82 pt no controle completo. Não são criadas imagens quando o imóvel não as possui.
- Dados do terreno: duas colunas balanceadas para campos curtos; descrição legal em largura total. Dados fiscais, APN, condado e loteamento preservados. No controle completo, mapa/notas passam de 88 para 107 pt de altura de card; a área útil de projeção do mapa passa de 29 para 53 pt e a área de texto das notas, de 43 para 69 pt.
- Mapa dos comparáveis densos: área útil de projeção de 92 → 142 pt. A tabela usa altura conforme o conteúdo, sem um card vazio até o fim da página. Treze referências cabem juntas no controle completo, sem remover linhas nem reduzir fontes de dados.
- L2 permanece com três páginas nos controles. L3 completo com SOLDs e FOR SALEs passa de sete para seis páginas, eliminando a continuação de apenas duas linhas; L3 de aluguel e L3 com ARV permanecem com seis. Notas extensas continuam integralmente em páginas de conteúdo, quando necessárias.
- Preservados: comparáveis, ARV e contexto de preço, aluguel e rent comps, mapas, faixas, gráficos, barras, gauge, riscos, recomendações, lacunas e métricas financeiras existentes. Não foram calculados indicadores novos sem evidência.

Verificação: 90 testes em cinco arquivos passaram, incluindo geometria da galeria, duas colunas em PT/EN/ES, mapa, tamanho do gauge e limites de altura para resumos curtos. TypeScript de relatórios e lint dos arquivos JavaScript alterados passaram. Seis PDFs L2/L3 com cinco fotos passaram nas verificações de conteúdo, evidências, mapas/tabelas, limites e geometria. Controle adicional de notas extensas: oito páginas, sem perda de texto. Não foi identificada regressão visual ou analítica nas verificações realizadas.

Os PDFs são controles sintéticos declarados. As cinco fotos do teste são cinco codificações da mesma imagem de amostra, não cinco vistas documentadas de um imóvel real. Nenhum provedor pago foi consultado. O conjunto final foi validado sem alteração de fontes durante a geração: digest `7db9d059da23ff7dd28a9cb7350f7869db498d6cc849f0dd408c6411d3a4232f`. Os cards de resumos, conclusões e detalhes curtos agora ajustam altura ao conteúdo, sem inflar blocos vazios.

Publicação do frontend pendente de confirmação do commit exato e do alias de produção. Nenhum deploy de backend é necessário.
