# CONTRATO DO PIPELINE DE ANÁLISE — Maxxis / DealSifter (v0.9)

1. ORDEM DE AQUISIÇÃO
   DB → cache → ArcGIS/Census → RentCast → Gemini → GapResolver (chat).
   Cada etapa busca só o que a anterior não resolveu. Tentativas
   independentes: a falha de uma não bloqueia as outras. Toda tentativa de
   provedor é registrada com report_id, request_id, origin e
   evidence_outcome.
   Estado atual do ArcGIS: o resolvedor de county (Census) está ativo;
   adaptadores de parcela habilitados apenas em condados fora da Flórida
   (UT Salt Lake, MA Middlesex, NJ Mercer, NC Wake, AR Pulaski, GA Fulton
   parcial). Na Flórida, terreno/APN/zoneamento/impostos vêm do registro do
   RentCast até haver lacuna real que justifique adaptadores de condado.

2. PAPEL DO GEMINI
   Raciocina e redige sobre evidências já apuradas. Nunca cria fato ou
   número. Valores vêm de: fonte (VERIFIED_RECORD), estimativa de provedor
   (ESTIMATED), cálculo determinístico (CALCULATED), usuário confirmado
   (USER_PROVIDED).

3. ESTADO ÚNICO (AnalysisSnapshot por imóvel + usuário)
   Para cada indicador: valor, origem, data, status, motivo de ausência
   (NOT_REQUESTED, NOT_ENTITLED, QUOTA_BLOCKED, PLAN_GATE,
   IDENTITY_MISMATCH, PROVIDER_ERROR, INTERNAL_ERROR, NO_COVERAGE,
   USER_INPUT_REQUIRED), tentativas feitas. Chat e relatório leem o mesmo
   snapshot. O GapResolver escreve nele; qualquer mudança dispara
   recálculo.

4. GAPRESOLVER
   Só pergunta quando todas as fontes aplicáveis ao indicador foram
   tentadas (ou bloqueadas por motivo registrado) e o indicador é
   necessário ao nível/estratégia. Ordena por indicadores desbloqueados.
   Máximo de 3 perguntas por rodada. Informa o que já foi tentado. Oferece
   "não sei" (sem premissas padrão automáticas, o indicador permanece
   pendente). Confirma o valor entendido antes de gravar. Grava como
   USER_PROVIDED com data; editável.

5. PRECEDÊNCIA E CONFLITOS
   Valor do usuário vale só no cenário privado rotulado; nunca sobrescreve
   registro ou cadastro. Divergências mostram ambos os valores. Aluguel
   real, aluguel estimado e premissa do investidor são conceitos
   separados. Alertas de divergência cadastro × provedor do onboarding são
   lidos, não recalculados.

6. CÁLCULOS DETERMINÍSTICOS
   ARV: >=3 vendas elegíveis = principal; 2 = faixa preliminar de baixa
   confiança; <2 = indisponível; a elegibilidade exige a condição-alvo
   confirmada (GapResolver). Sem premissas: rendimento bruto, spread preço
   pedido x AVM/ARV, preço/sqft vs comps. Com entradas disponíveis: NOI,
   Cap Rate, ROI, cash-on-cash, DSCR, em cenário rascunho rotulado. Nenhuma
   premissa padrão automática. Anúncios (comps de AVM e de aluguel) são
   suporte e nunca entram na elegibilidade do ARV; o próprio imóvel é
   excluído dos comps.

7. NÍVEIS E COBRANÇA (vigente no código)
   Desbloqueio único por usuário + imóvel + nível (sem expiração): depois
   de desbloqueado, abrir ou regerar não cobra de novo. Free: L1 grátis; L2
   = 3 nuggets; L3 = 5. PRO: L1 grátis; L2 incluso; L3 = 5. Enterprise:
   L1, L2 e L3 inclusos. Orçamento mensal de chamadas de provedor para
   relatórios por usuário (Pro 8, Enterprise 10); teto global RentCast 45
   (guard em produção: 30 até confirmar a renovação do ciclo do
   fornecedor). Débito antes da aquisição, sem reembolso automático. Sem
   premissas padrão automáticas.
   DECISÃO PENDENTE: manter o desbloqueio único ou migrar para cobrança por
   geração.
   ALVO R-3: a preparação da análise (aquisição + GapResolver) ocorre no
   chat ANTES do desbloqueio/geração; gerar o PDF reaproveita o que foi
   apurado (cache hit).

8. RELATÓRIO
   Seções em ordem fixa; selo de completude relativo ao nível; pendências
   em quadro único com motivo e ação por indicador; sem jargão e sem
   repetição semântica; bloco "Fontes e data" consolidado com todos os
   data_types usados; contatos do publicador e nomes de proprietários fora
   do PDF por padrão; endereço do imóvel visível no PDF do usuário
   (redação só em artefatos de QA).

9. DECISÕES EM ABERTO
   Cobrança: desbloqueio único (atual) vs. por geração.
   Tolerância de metragem (proposta: até 2% consistente, 2% a 10% aviso,
   acima de 10% revisão).
   Comportamento ao esgotar o orçamento mensal do plano (hoje: entrega
   parcial com motivo registrado, sem exceder o orçamento).

10. COBERTURA POR NÍVEL
    Cobertura = campos obrigatórios do nível, aplicáveis ao imóvel, com
    valor e origem rotulada ÷ campos obrigatórios aplicáveis. Mede a
    capacidade do app de informar os dados estipulados; não mede exatidão.
    Campo "indisponível" é lacuna; ARV preliminar rotulado conta como
    preenchido. Duas medidas: automática (DB, cache, ArcGIS, RentCast,
    cálculo) e final (+ respostas do usuário). Campos exclusivos do
    investidor (reforma, seguro, vacância, dívida) contam à parte.
    Metas (campos apurados pelo app): L1 >= 50%; L2 > 85%; L3 > 95%.
    Selo: Completo >= meta; Parcial >= 70% da meta; Preliminar abaixo.

11. AQUISIÇÃO MÍNIMA NO RENTCAST
    Cada endpoint é uma requisição separada; não há chamada única que
    traga tudo. Registro do imóvel (/properties) = terreno, APN,
    zoneamento, descrição legal, impostos, valor avaliado, HOA, histórico;
    valor (/avm/value) = valor, faixa, atributos e comps de ANÚNCIOS de
    venda com coordenadas (observado: 20 comps, 4 ativos); aluguel
    (/avm/rent/long-term) = aluguel, faixa e comps de anúncios de aluguel;
    vendas fechadas = busca em /properties por área, única fonte de preço
    de fechamento (observado: 100 registros com preço, data e
    coordenadas); anúncios avulsos (/listings) e estatísticas de mercado
    (/markets) não são buscados enquanto nenhum campo obrigatório os
    exigir. Plano com cache frio: L2 = aluguel + vendas fechadas + AVM (só
    para os comps de suporte; o valor estimado não é exibido no L2); L3 =
    AVM + aluguel + vendas fechadas + registro do imóvel (quando o cache
    vencer). TTLs efetivos: registro 168h; AVM 72h; vendas 720h; aluguel
    72h; anúncios 24h; mercado 168h.

12. LEASES DE EVIDÊNCIA
    Toda chave de lease deve ter formato UUID (constraint em Production).
    Chaves compostas são convertidas de forma determinística para UUID.

13. COMPATIBILIDADE CÓDIGO × BANCO
    Todo valor enviado pelo código às RPCs e tabelas do ledger, dos leases
    e do cache (provider, operation, data_type, status, outcome, origin,
    chaves) deve ser aceito pelo schema de Production. O
    scripts/schema-compat-check é pré-voo obrigatório antes de qualquer
    chamada live e deve terminar com zero incompatibilidades.
