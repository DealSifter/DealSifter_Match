# CONTRATO DO PIPELINE DE ANÁLISE — Maxxis / DealSifter (v0.7)

1. ORDEM DE AQUISIÇÃO
   DB → cache → ArcGIS → RentCast → Gemini → GapResolver (chat). Cada
   etapa busca só o que a anterior não resolveu. Tentativas
   independentes: a falha de uma não bloqueia as outras. Toda tentativa
   de provedor é registrada com report_id, request_id, origin e
   evidence_outcome.

2. PAPEL DO GEMINI
   Raciocina e redige sobre evidências já apuradas. Nunca cria fato ou
   número. Valores vêm de: fonte (VERIFIED_RECORD), estimativa de
   provedor (ESTIMATED), cálculo determinístico (CALCULATED), usuário
   confirmado (USER_PROVIDED).

3. ESTADO ÚNICO (AnalysisSnapshot por imóvel + usuário)
   Para cada indicador: valor, origem, data, status, motivo de ausência
   (NOT_REQUESTED, NOT_ENTITLED, QUOTA_BLOCKED, PLAN_GATE,
   IDENTITY_MISMATCH, PROVIDER_ERROR, NO_COVERAGE, USER_INPUT_REQUIRED),
   tentativas feitas. Chat e relatório leem o mesmo snapshot. O
   GapResolver escreve nele; qualquer mudança dispara recálculo.

4. GAPRESOLVER
   Só pergunta quando todas as fontes aplicáveis ao indicador foram
   tentadas (ou bloqueadas por motivo registrado) e o indicador é
   necessário ao nível/estratégia. Ordena por indicadores desbloqueados.
   Máximo de 3 perguntas por rodada. Informa o que já foi tentado.
   Oferece "não sei" (sem premissas padrão automáticas, o indicador
   permanece pendente). Confirma o valor entendido antes de gravar.
   Grava como USER_PROVIDED com data; editável.

5. PRECEDÊNCIA E CONFLITOS
   Valor do usuário vale só no cenário privado rotulado; nunca
   sobrescreve registro ou cadastro. Divergências mostram ambos os
   valores. Aluguel real, aluguel estimado e premissa do investidor são
   conceitos separados. Alertas de divergência cadastro × provedor do
   onboarding são lidos, não recalculados.

6. CÁLCULOS DETERMINÍSTICOS
   ARV: >=3 vendas elegíveis = principal; 2 = faixa preliminar de baixa
   confiança; <2 = indisponível. Sem premissas: rendimento bruto, spread
   preço pedido x ARV, preço/sqft vs comps. Com entradas disponíveis:
   NOI, Cap Rate, ROI, cash-on-cash, DSCR, em cenário rascunho rotulado.
   Nenhuma premissa padrão automática.

7. NÍVEIS E COBRANÇA (vigente; cobrança por GERAÇÃO)
   Free: L1 grátis; L2 = 3 nuggets por geração; L3 = 5 por geração.
   PRO: L1 grátis; L2 incluso; L3 = 5 nuggets por geração.
   Enterprise: L1, L2 e L3 inclusos na mensalidade.
   Orçamento mensal de chamadas de provedor para relatórios por usuário
   (Pro 8, Enterprise 10) e teto global RentCast de 45.
   Débito antes da aquisição na geração, sem reembolso automático;
   proteção de duplicidade por usuário + imóvel + nível (alcance a
   confirmar). Preço e lógica de cobrança permanecem inalterados.
   ALVO R-3: a preparação da análise (aquisição + GapResolver) ocorre no
   chat ANTES da geração cobrada; gerar o PDF é o ato cobrado e deve
   reaproveitar o que foi apurado (cache hit).

8. RELATÓRIO
   Seções em ordem fixa; selo de completude relativo ao nível;
   pendências em quadro único; sem jargão e sem repetição semântica;
   bloco "Fontes e data"; contatos e nomes fora do PDF por padrão.

9. DECISÕES EM ABERTO
   Tolerância de metragem (proposta: até 2% consistente, 2% a 10% aviso,
   acima de 10% revisão).
   Comportamento ao esgotar o orçamento mensal do plano (a confirmar no
   código e decidir).

10. COBERTURA POR NÍVEL
    Cobertura = campos obrigatórios do nível, aplicáveis ao imóvel, com
    valor e origem rotulada ÷ campos obrigatórios aplicáveis. Mede a
    capacidade do app de informar os dados estipulados; não mede
    exatidão (os dados são pontos de referência). Campo "indisponível"
    é lacuna; ARV preliminar rotulado conta como preenchido.
    Duas medidas: cobertura automática (DB, cache, ArcGIS, RentCast,
    cálculo) e cobertura final (+ respostas do usuário). Campos
    exclusivos do investidor (reforma, seguro, vacância, dívida) contam
    à parte.
    Metas (cobertura final dos campos apurados pelo app): L1 >= 50%;
    L2 > 85%; L3 > 95%.
    Selo: Completo >= meta; Parcial >= 70% da meta; Preliminar abaixo.
    O PDF e o chat exibem a cobertura e o que falta. Cobrança inalterada.

11. AQUISIÇÃO MÍNIMA NO RENTCAST (alvo, a confirmar no código)
    Cada endpoint do RentCast é uma requisição separada; não há chamada
    única que traga tudo. Mapa: registro do imóvel (/properties) =
    terreno, impostos, HOA, histórico; valor (/avm/value) = valor, faixa,
    atributos do imóvel e comps de ANÚNCIOS de venda com coordenadas;
    aluguel (/avm/rent/long-term) = aluguel, faixa e comps de anúncios de
    aluguel; vendas fechadas = busca em /properties por área (única fonte
    de preço de fechamento); anúncios avulsos (/listings) e estatísticas
    de mercado (/markets) não são buscados (os comps de anúncios já vêm
    nas respostas do AVM e do aluguel; mercado não alimenta nenhum campo).
    Plano alvo com cache frio: L2 = aluguel + vendas fechadas + AVM (só
    para os comps de suporte; o valor estimado não é exibido no L2);
    L3 = AVM + aluguel + vendas fechadas (+ registro do imóvel quando o
    ArcGIS não cobrir HOA/impostos). Custo: L2 ~3 chamadas; L3 ~3 a 4.
