## Situação atual

O Maxxis já existe como um assistente conversacional integrado, mas ainda é principalmente um chat com prompt estático — não um agente conectado aos dados e às operações do DealSifter.

Arquitetura atual:

```text
MaxxisAssistant (React)
  → maxxisService
    → Supabase Edge Function: maxxis-chat
      → Google Gemini generateContent
```

O widget é montado globalmente no `App`, mas só aparece para usuários autenticados. Ele recebe a página atual, idioma e até 10 mensagens anteriores. O histórico existe apenas na memória do navegador: ao recarregar, minimiza sem perder, mas não persiste entre sessões.

## Objetivo atual do Maxxis

Pelo código e documentação, ele deve:

- Guiar o usuário pelos módulos: Feed, MapView, Matches, Onboarding, Pricing, Settings e Admin.
- Explicar Nuggets, unlocks, Spotlight, exclusividade, portfólio e chat.
- Dar contexto educacional sobre Tax Deed, Wholesale e estratégias imobiliárias americanas.
- Redigir/organizar descrições de imóveis e mensagens comerciais sem inventar dados.
- Oferecer botões de navegação interna, por exemplo “Abrir Feed” ou “Criar/editar cards”.
- Encaminhar falhas de cobrança, conta, bugs e suporte humano.

A única função contextual de negócio realmente implementada é a análise de imóvel desbloqueado dentro de Matches. Ela injeta dados do imóvel em um prompt e permite exportar a resposta para PDF.

## O que está bem implementado

- Widget flutuante, arrastável, responsivo, com tema visual integrado.
- PT/EN/ES no frontend e detecção básica de idioma no backend.
- Prompt com regras claras para não inventar recursos e não dar aconselhamento jurídico/fiscal/financeiro.
- Botões internos interpretados por tokens como `[[action:matches|Abrir Matches]]`.
- Limite de histórico e tamanho das mensagens.
- Fallbacks visíveis para chave ausente, quota Gemini e falhas do provedor.
- A análise de oportunidade preserva o resultado no PDF exportado.
- Erros do frontend são enviados ao mecanismo de observabilidade existente.

## Principais falhas e lacunas

### 1. Não há conhecimento real do sistema em tempo de execução

A documentação diz que Maxxis usa os `.md` e o comportamento real do produto como fonte de verdade. Na prática, a Edge Function envia somente um prompt estático grande.

Ele não lê:

- documentação;
- banco Supabase;
- perfil do usuário;
- plano, saldo de Nuggets ou limites;
- cards, Matches, propriedades, Investor Profile;
- regras atuais de unlock/exclusividade;
- tickets ou mensagens de suporte;
- status real de Stripe.

Consequência: responde genericamente e pode ficar desatualizado depois de qualquer alteração no produto.

### 2. Não há ferramentas/actions de negócio

Os “actions” atuais apenas navegam para páginas. O Maxxis não pode:

- abrir um card específico;
- iniciar um onboarding em uma aba/campo específico;
- explicar por que um unlock foi bloqueado usando dados reais;
- verificar se o usuário tem saldo;
- comparar um imóvel com o buy box do investidor;
- criar rascunho de property/service card;
- preencher ou validar Investor Profile;
- localizar Matches relevantes;
- abrir suporte já com contexto técnico anexado.

Para evoluir de guia para copiloto, esse é o maior gap.

### 3. Segurança e controle de uso frágeis

A Edge Function tenta validar o bearer token, mas, se a autenticação falhar, apenas registra um warning e continua atendendo a requisição. Isso permite uso sem sessão válida caso alguém consiga chamar a função.

Também faltam:

- rate limit por usuário/IP;
- limite de custo/token por plano;
- proteção contra abuso;
- auditoria de consultas e respostas;
- retenção e política de dados da conversa;
- detecção de prompt injection;
- controle explícito de quais campos privados podem ir ao Gemini.

O CORS está em `*`, aceitável apenas se a função for efetivamente protegida por autenticação e rate limit — o que hoje não está garantido.

### 4. Privacidade e dados imobiliários

A análise de imóvel envia o texto completo da oportunidade ao Gemini. Isso é útil, mas precisa de uma política explícita:

- quais campos podem sair do Supabase;
- se endereço completo, telefone, e-mail, dados de proprietário e documentos são excluídos;
- consentimento do usuário;
- retenção pelo provedor;
- mascaramento de PII antes do envio.

Hoje há orientação no prompt para não pedir dados sensíveis, mas não há um filtro técnico forte antes da chamada ao provedor.

### 5. Respostas não estruturadas

A resposta é texto livre. Isso limita automações como:

- score de aderência ao buy box;
- checklist de dados faltantes;
- riscos;
- perguntas recomendadas;
- ações sugeridas;
- campos para completar no Investor Profile;
- comparação de preço, ARV, margem, prazo e estratégia.

O ideal é o backend retornar JSON validado para usos específicos, mantendo texto natural para chat comum.

### 6. Modelos e confiabilidade

A função tenta vários modelos Gemini, incluindo aliases “latest” e previews. Isso melhora disponibilidade, mas reduz previsibilidade de qualidade, custo e comportamento.

Além disso:

- não há timeout explícito de fetch;
- não há retry com backoff;
- não há métricas de latência, modelo usado, custo, erro ou taxa de fallback;
- não há testes automatizados da Edge Function;
- não há avaliação de qualidade de respostas por cenário.

### 7. Contexto do usuário é mínimo

Hoje o backend recebe apenas:

```text
message + últimas 10 mensagens + página + idioma
```

Não recebe o papel do usuário, perfil profissional, mercados, buy box, plano, dados permitidos do card, estado do onboarding ou permissões. Por isso não consegue ser verdadeiramente personalizado.

## Interações atuais com o app

| Área | Integração atual | Limitação |
|---|---|---|
| Navegação | Botões para páginas/módulos | Não abre contexto específico |
| Guia de onboarding | Indireta, via navegação/tours | Não sabe o que falta preencher |
| Feed/Map/Matches | Explicação textual | Não consulta cards ou filtros |
| Unlock/Nuggets | Explica regras no prompt | Não consulta saldo, preço ou entitlement |
| Property analysis | Prompt manual vindo de Matches | Não calcula, valida ou compara dados |
| PDF | Exporta a resposta de análise | Sem estrutura/qualidade verificável |
| Suporte | Abre Settings/Communication | Não cria ticket contextualizado |
| Investor Profile | Sem integração | Grande oportunidade para Maxxis |

## Melhor direção de evolução

Eu priorizaria o Maxxis em três camadas:

1. **Maxxis Guide**  
   Respostas sobre uso do app, documentação versionada e navegação contextual. É a camada já existente, mas precisa de RAG/documentação indexada e actions mais específicas.

2. **Maxxis Deal Analyst**  
   Analisa uma oportunidade usando dados estruturados e o Investor Profile:
   - “Este imóvel encaixa no meu buy box?”
   - ARV, margem, preço, rehab, closing e risco;
   - dados faltantes;
   - perguntas ao vendedor;
   - score explicável, nunca recomendação financeira definitiva.

3. **Maxxis Workflow Copilot**  
   Preenche rascunhos, valida cadastros e executa ações seguras com confirmação:
   - completar Investor Profile;
   - sugerir melhorias de card;
   - gerar property release;
   - preparar mensagem para buyer;
   - abrir suporte com contexto;
   - criar checklist de publicação.

O melhor primeiro caso de uso é integrar o novo **Investor Profile / buy box** ao Maxxis. Ele pode identificar campos obrigatórios ausentes, explicar cada critério e comparar propriedades desbloqueadas com Texas/Dallas, Single Family, ARV, margem, cash-only e prazo de closing.

Essa evolução exige uma camada de ferramentas server-side com permissões, dados mínimos e respostas estruturadas — não apenas ampliar o prompt atual.



Você já tem o “cérebro verbal” do Maxxis nos dois arquivos `.md`. O que falta é dar a ele:

1. **acesso controlado aos dados do app**;
2. **funções que ele possa solicitar**;
3. **um algoritmo real de match**;
4. **memória de preferências e interações**;
5. **permissão gradual para executar ações**.

Hoje, provavelmente o fluxo é parecido com:

```text
Usuário pergunta
      ↓
Gemini recebe os arquivos .md
      ↓
Gemini gera uma resposta
```

O objetivo é chegar a:

```text
Usuário faz um pedido
      ↓
Maxxis identifica a intenção
      ↓
Maxxis escolhe uma ferramenta
      ↓
Backend consulta o banco
      ↓
Algoritmo calcula o match
      ↓
Maxxis explica o resultado
      ↓
Usuário confirma uma ação
```

A diferença é enorme: ele deixa de apenas “conversar sobre o app” e passa a **operar dentro do app**.

---

# Visão geral da implementação

Faça a evolução nesta ordem:

```text
Etapa 0 — Preparar a fundação
Etapa 1 — Maxxis Search Assistant
Etapa 2 — Match Score
Etapa 3 — Deal Advisor
Etapa 4 — Agente ativo
```

Não pule direto para a etapa 4. Um agente sem fundação vira um estagiário com acesso ao cartão corporativo. Em cinco minutos, alguém está chorando.

---

# ETAPA 0 — Preparar a fundação

Antes dos quatro estágios, organize o que já existe.

## Passo 1 — Separar seus dois arquivos `.md`

Você já possui:

```text
maxxis-operating-mode.md
maxxis-app-knowledge.md
```

Mantenha os dois, mas atribua funções claras.

## Arquivo 1 — Comportamento do Maxxis

Exemplo:

```text
/maxxis/prompts/maxxis-system.md
```

Ele deve conter:

* personalidade;
* tom de voz;
* objetivos;
* limitações;
* regras de segurança;
* quando fazer perguntas;
* quando chamar ferramentas;
* o que nunca inventar;
* como explicar resultados;
* como distinguir informações gerais de dados internos.

Exemplo de estrutura:

```md
# IDENTIDADE

Você é Maxxis, o assistente inteligente da plataforma.

# OBJETIVO

Ajudar usuários a encontrar oportunidades imobiliárias,
prestadores e potenciais parceiros dentro da plataforma.

# REGRAS

- Nunca invente propriedades, usuários ou prestadores.
- Para dados internos, use exclusivamente as ferramentas disponíveis.
- Não afirme que um usuário é compatível antes de receber o score do backend.
- Não revele contatos sem autorização.
- Não envie mensagens, propostas ou ofertas sem confirmação.
- Sempre informe quando uma resposta for apenas informação geral.
- Sempre diferencie dados internos de conhecimento educacional.

# USO DE FERRAMENTAS

Quando o usuário procurar imóveis, use searchDeals.
Quando procurar serviços, use searchServices.
Quando pedir comparação, use compareDeals.
Quando pedir explicação do match, use explainMatch.
```

## Arquivo 2 — Funcionamento do app

Exemplo:

```text
/maxxis/knowledge/app-knowledge.md
```

Deve conter somente:

* explicação das telas;
* funcionalidades;
* regras de nuggets;
* funcionamento do swipe;
* tipos de usuário;
* tipos de oportunidades;
* serviços disponíveis;
* termos usados no sistema;
* fluxos internos;
* perguntas frequentes.

Não coloque dados vivos nesse arquivo, como:

* oportunidades atuais;
* quantidade de usuários;
* preços atuais;
* nomes de prestadores;
* contatos;
* disponibilidade.

Isso deve vir do banco.

---

## Passo 2 — Criar um terceiro arquivo para ações

Crie:

```text
/maxxis/prompts/maxxis-tools-policy.md
```

Conteúdo sugerido:

```md
# POLÍTICA DE AÇÕES

As ações estão divididas em níveis.

## Nível 1 — Leitura

Pode consultar:
- perfil do usuário;
- oportunidades;
- prestadores;
- serviços;
- matches;
- histórico do próprio usuário.

## Nível 2 — Sugestão

Pode sugerir:
- salvar oportunidade;
- descartar oportunidade;
- comparar oportunidades;
- solicitar contato;
- criar pedido de serviço.

## Nível 3 — Preparação

Pode preparar:
- mensagem;
- solicitação;
- checklist;
- filtros;
- preferência;
- pedido de introdução.

## Nível 4 — Confirmação

Só pode executar após o usuário confirmar:
- enviar mensagem;
- liberar contato;
- criar solicitação;
- alterar preferência;
- publicar demanda;
- consumir nuggets.

## Proibido

- realizar pagamentos;
- assinar documentos;
- enviar ofertas vinculantes;
- alterar preço de anúncio;
- publicar propriedade;
- excluir registros;
- compartilhar contato sem autorização.
```

---

## Passo 3 — Confirmar que existe um backend

O Maxxis não deve consultar o Supabase ou banco diretamente pelo navegador.

Arquitetura segura:

```text
React
  ↓
API do seu backend
  ↓
Serviço do Maxxis
  ↓
Gemini
  ↓
Ferramentas internas
  ↓
Banco de dados
```

Evite:

```text
React → Gemini diretamente
React → chave secreta exposta
Gemini → banco diretamente
```

Se sua chave Gemini estiver dentro de arquivo como:

```env
VITE_GEMINI_API_KEY=...
```

ela pode ficar exposta no navegador.

O ideal é:

```text
Frontend React
    ↓
POST /api/maxxis/chat
    ↓
Backend protegido
    ↓
Gemini API
```

---

# Estrutura de pastas sugerida

Uma estrutura prática:

```text
src/
├── components/
│   └── maxxis/
│       ├── MaxxisChat.tsx
│       ├── MaxxisMessage.tsx
│       ├── MatchCard.tsx
│       ├── DealCard.tsx
│       └── ConfirmationCard.tsx
│
├── services/
│   └── maxxisApi.ts
│
└── types/
    ├── deal.ts
    ├── match.ts
    └── maxxis.ts

server/
├── routes/
│   └── maxxis.routes.ts
│
├── controllers/
│   └── maxxis.controller.ts
│
├── services/
│   └── maxxis/
│       ├── maxxis.service.ts
│       ├── prompt.service.ts
│       ├── tool.service.ts
│       ├── match.service.ts
│       └── preference.service.ts
│
├── tools/
│   ├── searchDeals.tool.ts
│   ├── searchServices.tool.ts
│   ├── getUserProfile.tool.ts
│   ├── saveDeal.tool.ts
│   ├── dismissDeal.tool.ts
│   └── requestIntroduction.tool.ts
│
└── prompts/
    ├── maxxis-system.md
    ├── maxxis-app-knowledge.md
    └── maxxis-tools-policy.md
```

Caso use Supabase Edge Functions, a pasta `server` pode ser substituída por funções do Supabase.

---

# ETAPA 1 — Maxxis Search Assistant

Nesta primeira fase, ele deve fazer somente quatro coisas:

```text
1. Entender o pedido
2. Extrair filtros
3. Pesquisar o banco
4. Mostrar resultados
```

Ainda não precisa “aprender sozinho”.

---

## Passo 1 — Padronizar os dados dos deals

O Maxxis só consegue buscar bem se as oportunidades estiverem organizadas.

Campos mínimos:

```text
id
title
description
deal_type
property_type
state
county
city
zip_code
asking_price
estimated_arv
estimated_rehab
estimated_roi
bedrooms
bathrooms
square_feet
occupancy_status
title_status
seller_id
status
created_at
```

Exemplo de tabela:

```sql
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deal_type TEXT NOT NULL,
    property_type TEXT,
    state TEXT NOT NULL,
    county TEXT,
    city TEXT,
    zip_code TEXT,
    asking_price NUMERIC(12,2),
    estimated_arv NUMERIC(12,2),
    estimated_rehab NUMERIC(12,2),
    estimated_roi NUMERIC(8,2),
    bedrooms NUMERIC(4,1),
    bathrooms NUMERIC(4,1),
    square_feet INTEGER,
    occupancy_status TEXT,
    title_status TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Não precisa criar todos os campos imediatamente. Mas preço, localização, tipo e status são indispensáveis.

---

## Passo 2 — Criar a ferramenta `searchDeals`

Ela não é uma função “da IA”. É uma função normal do backend.

```ts
export type SearchDealsInput = {
  states?: string[];
  cities?: string[];
  dealTypes?: string[];
  propertyTypes?: string[];
  minimumPrice?: number;
  maximumPrice?: number;
  minimumRoi?: number;
  maximumRehab?: number;
  limit?: number;
};

export async function searchDeals(
  input: SearchDealsInput,
  supabase: any
) {
  let query = supabase
    .from("deals")
    .select("*")
    .eq("status", "active");

  if (input.states?.length) {
    query = query.in("state", input.states);
  }

  if (input.cities?.length) {
    query = query.in("city", input.cities);
  }

  if (input.dealTypes?.length) {
    query = query.in("deal_type", input.dealTypes);
  }

  if (input.propertyTypes?.length) {
    query = query.in("property_type", input.propertyTypes);
  }

  if (input.minimumPrice !== undefined) {
    query = query.gte("asking_price", input.minimumPrice);
  }

  if (input.maximumPrice !== undefined) {
    query = query.lte("asking_price", input.maximumPrice);
  }

  if (input.minimumRoi !== undefined) {
    query = query.gte("estimated_roi", input.minimumRoi);
  }

  if (input.maximumRehab !== undefined) {
    query = query.lte("estimated_rehab", input.maximumRehab);
  }

  query = query
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao pesquisar deals: ${error.message}`);
  }

  return data ?? [];
}
```

---

## Passo 3 — Ensinar o Gemini a pedir essa ferramenta

O Gemini deve retornar algo equivalente a:

```json
{
  "tool": "searchDeals",
  "arguments": {
    "states": ["AL"],
    "maximumPrice": 80000,
    "dealTypes": ["tax_deed"],
    "limit": 10
  }
}
```

O backend recebe isso, valida e executa.

Nunca faça algo assim:

```ts
eval(modelResponse);
```

Nem aceite SQL gerado pelo modelo.

Faça um mapa de ferramentas permitidas:

```ts
const toolHandlers = {
  searchDeals,
  searchServices,
  getUserProfile
};
```

Execução controlada:

```ts
type AllowedTool =
  | "searchDeals"
  | "searchServices"
  | "getUserProfile";

export async function executeTool(
  toolName: AllowedTool,
  args: unknown,
  context: {
    supabase: any;
    userId: string;
  }
) {
  switch (toolName) {
    case "searchDeals":
      return searchDeals(args as SearchDealsInput, context.supabase);

    case "searchServices":
      return searchServices(args as any, context.supabase);

    case "getUserProfile":
      return getUserProfile(context.userId, context.supabase);

    default:
      throw new Error("Ferramenta não autorizada.");
  }
}
```

---

## Passo 4 — Primeiro fluxo completo

Usuário escreve:

> Procuro tax deeds no Alabama até US$ 80 mil.

O sistema executa:

```text
1. Front envia a mensagem para /api/maxxis/chat
2. Backend identifica o usuário autenticado
3. Backend envia prompt + ferramentas ao Gemini
4. Gemini pede searchDeals
5. Backend valida os argumentos
6. Backend pesquisa deals
7. Resultado volta ao Gemini
8. Gemini produz a explicação
9. Front mostra cards reais
```

A resposta da API pode ser:

```json
{
  "message": "Encontrei 6 oportunidades compatíveis.",
  "items": [
    {
      "type": "deal",
      "id": "deal-001",
      "title": "Tax Deed em Birmingham",
      "askingPrice": 52000,
      "state": "AL",
      "city": "Birmingham"
    }
  ]
}
```

No frontend, não mostre tudo apenas como texto. Renderize `items` como cards.

---

## Passo 5 — Criar busca de serviços

Tabela mínima:

```sql
CREATE TABLE service_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    service_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    states TEXT[],
    counties TEXT[],
    cities TEXT[],
    minimum_price NUMERIC(12,2),
    maximum_price NUMERIC(12,2),
    remote_available BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Ferramenta:

```text
searchServices
```

Filtros:

```text
serviceType
state
county
city
maximumPrice
remoteAvailable
```

Ao final da etapa 1, o Maxxis deve conseguir:

```text
“Mostre tax deeds no Alabama”
“Quero casas até US$ 100 mil”
“Preciso de title search em Jefferson County”
“Encontre um contractor perto de Birmingham”
```

---

# ETAPA 2 — Match Score

Agora o sistema deixa de apenas filtrar e começa a ranquear.

## Passo 1 — Criar preferências do usuário

Tabela:

```sql
CREATE TABLE user_match_preferences (
    user_id UUID PRIMARY KEY,
    preferred_states TEXT[],
    preferred_cities TEXT[],
    preferred_deal_types TEXT[],
    preferred_property_types TEXT[],
    minimum_budget NUMERIC(12,2),
    maximum_budget NUMERIC(12,2),
    minimum_roi NUMERIC(8,2),
    maximum_rehab NUMERIC(12,2),
    rehab_tolerance TEXT,
    occupancy_preferences TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Não dependa apenas da conversa. O perfil deve ser salvo no banco.

---

## Passo 2 — Criar uma tela de preferências

No perfil do usuário:

```text
Estados de interesse
Faixa de investimento
Tipos de deal
Tipos de propriedade
ROI mínimo
Reforma máxima
Preferência por imóvel ocupado ou vazio
Objetivo: flip, rental, wholesale ou land
```

O Maxxis pode ajudar a preencher, mas o usuário deve poder editar manualmente.

---

## Passo 3 — Criar o cálculo do score

Comece simples e transparente.

```ts
type MatchResult = {
  score: number;
  reasons: {
    key: string;
    label: string;
    points: number;
    matched: boolean;
  }[];
};

export function calculateDealMatch(
  preferences: any,
  deal: any
): MatchResult {
  let score = 0;
  const reasons: MatchResult["reasons"] = [];

  const addReason = (
    key: string,
    label: string,
    points: number,
    matched: boolean
  ) => {
    if (matched) score += points;

    reasons.push({
      key,
      label,
      points: matched ? points : 0,
      matched
    });
  };

  addReason(
    "location",
    "Localização de interesse",
    20,
    preferences.preferred_states?.includes(deal.state)
  );

  addReason(
    "budget",
    "Dentro do orçamento",
    20,
    !preferences.maximum_budget ||
      deal.asking_price <= preferences.maximum_budget
  );

  addReason(
    "deal_type",
    "Tipo de deal desejado",
    15,
    preferences.preferred_deal_types?.includes(deal.deal_type)
  );

  addReason(
    "property_type",
    "Tipo de propriedade desejado",
    10,
    preferences.preferred_property_types?.includes(
      deal.property_type
    )
  );

  addReason(
    "roi",
    "ROI compatível",
    15,
    !preferences.minimum_roi ||
      deal.estimated_roi >= preferences.minimum_roi
  );

  addReason(
    "rehab",
    "Reforma dentro do limite",
    10,
    !preferences.maximum_rehab ||
      deal.estimated_rehab <= preferences.maximum_rehab
  );

  const ageInDays =
    (Date.now() - new Date(deal.created_at).getTime()) /
    86_400_000;

  addReason(
    "recency",
    "Oportunidade recente",
    5,
    ageInDays <= 7
  );

  return {
    score: Math.min(score, 100),
    reasons
  };
}
```

---

## Passo 4 — Calcular score depois da busca

Fluxo:

```ts
const deals = await searchDeals(filters, supabase);
const preferences = await getUserPreferences(userId, supabase);

const rankedDeals = deals
  .map((deal) => ({
    ...deal,
    match: calculateDealMatch(preferences, deal)
  }))
  .sort((a, b) => b.match.score - a.match.score);
```

O Gemini recebe:

```json
{
  "deal": {
    "title": "Property in Birmingham",
    "askingPrice": 52000
  },
  "match": {
    "score": 85,
    "reasons": [
      {
        "label": "Dentro do orçamento",
        "matched": true
      },
      {
        "label": "Reforma dentro do limite",
        "matched": false
      }
    ]
  }
}
```

Ele explica, mas **não calcula**.

---

## Passo 5 — Salvar interações

Crie:

```sql
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    interaction_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipos:

```text
view
like
save
dismiss
contact
compare
share
request_service
```

Cada swipe também deve gerar uma interação.

Exemplo:

```json
{
  "target_type": "deal",
  "target_id": "deal-001",
  "interaction_type": "dismiss",
  "metadata": {
    "reason": "rehab_too_high"
  }
}
```

---

## Passo 6 — Não deixe o algoritmo “aprender” escondido

Primeiro, use o histórico para sugerir mudanças:

> Você descartou cinco propriedades com reforma estimada acima de US$ 40 mil. Deseja definir esse valor como seu limite?

Só altere após confirmação.

Isso é melhor do que modificar silenciosamente o perfil.

---

# ETAPA 3 — Deal Advisor

Agora o Maxxis deixa de apenas mostrar matches e passa a orientar a análise.

## Passo 1 — Criar a ferramenta `getDealDetails`

Ela busca todos os dados permitidos do deal.

```text
getDealDetails(dealId)
```

Deve retornar:

```text
preço
ARV
reforma
impostos
ocupação
tipo de título
descrição
fotos
documentos disponíveis
serviços já vinculados
dados ausentes
```

---

## Passo 2 — Criar o diagnóstico de dados ausentes

Não deixe a IA adivinhar.

No backend:

```ts
export function getMissingDealData(deal: any): string[] {
  const missing: string[] = [];

  if (!deal.asking_price) missing.push("asking_price");
  if (!deal.estimated_arv) missing.push("estimated_arv");
  if (!deal.estimated_rehab) missing.push("estimated_rehab");
  if (!deal.occupancy_status) missing.push("occupancy_status");
  if (!deal.title_status) missing.push("title_status");
  if (!deal.property_taxes) missing.push("property_taxes");

  return missing;
}
```

O Maxxis pode responder:

> Antes de classificar este deal como forte, ainda faltam ARV, situação de ocupação e impostos pendentes.

Isso é muito melhor do que fabricar um parecer.

---

## Passo 3 — Criar cálculo financeiro no backend

Exemplo simplificado:

```ts
export function calculateDealMetrics(input: {
  askingPrice: number;
  rehab: number;
  closingCosts: number;
  holdingCosts: number;
  arv: number;
}) {
  const totalInvestment =
    input.askingPrice +
    input.rehab +
    input.closingCosts +
    input.holdingCosts;

  const estimatedProfit = input.arv - totalInvestment;

  const roi =
    totalInvestment > 0
      ? (estimatedProfit / totalInvestment) * 100
      : 0;

  return {
    totalInvestment,
    estimatedProfit,
    roi
  };
}
```

O Maxxis apenas explica:

> Considerando os valores cadastrados, o investimento total estimado é X, com lucro potencial de Y e ROI de Z%.

Sempre exiba:

```text
Estimativa baseada nos dados fornecidos.
Não constitui avaliação, aconselhamento jurídico ou garantia de retorno.
```

---

## Passo 4 — Criar `compareDeals`

Entrada:

```json
{
  "dealIds": [
    "deal-001",
    "deal-002",
    "deal-003"
  ]
}
```

O backend:

1. busca os três;
2. calcula métricas;
3. calcula match;
4. identifica dados ausentes;
5. devolve uma tabela padronizada.

Exemplo:

```text
Deal A — Match 89 — ROI 24% — Reforma média
Deal B — Match 84 — ROI 29% — Título incerto
Deal C — Match 77 — ROI 18% — Ocupado
```

O Maxxis pode concluir:

> O Deal A é o mais equilibrado. O Deal B possui retorno potencial maior, mas apresenta risco documental superior.

---

## Passo 5 — Criar o vínculo entre deal e serviços

Tabela:

```sql
CREATE TABLE deal_service_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    service_type TEXT NOT NULL,
    reason TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'suggested',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Regras iniciais:

```text
Tax deed
→ title search
→ quiet title attorney
→ property inspection

Imóvel ocupado
→ occupancy verification
→ attorney
→ property manager

Reforma estimada
→ contractor
→ inspector
→ material supplier

Venda futura
→ photographer
→ realtor
→ title company
```

Essas regras devem estar no backend, não apenas no prompt.

---

## Passo 6 — Criar checklists por tipo de operação

Exemplo:

```ts
const checklistTemplates = {
  tax_deed: [
    "Confirmar emissão e registro do tax deed",
    "Verificar redemption period",
    "Solicitar title search",
    "Verificar ocupação",
    "Confirmar impostos pendentes",
    "Avaliar necessidade de quiet title",
    "Realizar inspeção física"
  ],

  wholesale: [
    "Verificar contrato de assignment",
    "Confirmar prazo de fechamento",
    "Validar earnest money",
    "Calcular buyer spread",
    "Confirmar título e liens",
    "Revisar comps e ARV"
  ]
};
```

O Maxxis pode adaptar a explicação, mas não precisa criar todo checklist do zero.

---

# ETAPA 4 — Agente ativo

Nesta fase ele começa a propor e executar ações dentro do app.

Faça isso somente quando as fases anteriores estiverem funcionando.

## Passo 1 — Criar sistema de ações pendentes

Tabela:

```sql
CREATE TABLE maxxis_pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ
);
```

Exemplo:

```json
{
  "action_type": "request_introduction",
  "payload": {
    "deal_id": "deal-001",
    "recipient_user_id": "user-901",
    "nugget_cost": 3
  },
  "status": "pending"
}
```

---

## Passo 2 — Mostrar um cartão de confirmação

No chat:

```text
Solicitar apresentação ao vendedor?

Deal: Birmingham Tax Deed
Custo: 3 nuggets
Ação: liberar solicitação de contato

[Confirmar] [Cancelar]
```

Não aceite apenas “parece que sim” inferido de uma conversa antiga.

A confirmação deve vir de um clique ou mensagem inequívoca:

```text
Confirmar
Pode enviar
Sim, executar
```

---

## Passo 3 — Criar endpoints separados para confirmação

```text
POST /api/maxxis/actions/:id/confirm
POST /api/maxxis/actions/:id/cancel
```

Exemplo:

```ts
app.post(
  "/api/maxxis/actions/:id/confirm",
  requireAuth,
  async (req, res) => {
    const action = await getPendingAction(
      req.params.id,
      req.user.id
    );

    if (!action) {
      return res.status(404).json({
        error: "Ação não encontrada."
      });
    }

    if (action.status !== "pending") {
      return res.status(409).json({
        error: "Ação já processada."
      });
    }

    const result = await executeConfirmedAction(action);

    return res.json({
      success: true,
      result
    });
  }
);
```

---

## Passo 4 — Começar com ações de baixo risco

Primeiras ações recomendadas:

```text
Salvar deal
Descartar deal
Adicionar a comparação
Atualizar preferência após confirmação
Criar pedido de serviço
Solicitar introdução
Criar alerta interno
Preparar mensagem
```

Não automatize inicialmente:

```text
Pagamento
Compra
Oferta vinculante
Assinatura
Alteração de preço
Publicação
Envio externo sem confirmação
```

---

## Passo 5 — Criar alertas de match

Quando um deal for publicado:

```text
Novo deal
   ↓
Sistema filtra compradores elegíveis
   ↓
Calcula scores
   ↓
Salva os melhores matches
   ↓
Gera notificações
```

Tabela:

```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    reasons JSONB NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Inicialmente, não precisa recalcular todos os usuários.

Faça:

```text
Deal no Alabama
→ filtrar apenas usuários interessados no Alabama

Preço de US$ 80 mil
→ filtrar usuários com orçamento compatível

Tax deed
→ filtrar usuários interessados em tax deed
```

Depois calcule os scores nesse grupo reduzido.

---

# Como seus arquivos `.md` passam a ser usados

Seus arquivos não serão eliminados. Eles terão uma função mais correta.

## Antes

```text
Os arquivos explicam tudo
A IA tenta responder tudo
```

## Depois

```text
Arquivo de comportamento
→ como o Maxxis deve agir

Arquivo de conhecimento
→ como o app funciona

Banco de dados
→ o que existe agora

Ferramentas
→ o que o Maxxis pode consultar ou preparar

Algoritmo
→ como os matches são calculados

Backend
→ o que realmente pode ser executado
```

---

# O primeiro MVP técnico que recomendo

Implemente somente estas ferramentas primeiro:

```text
getUserProfile
getUserPreferences
searchDeals
searchServices
getDealDetails
saveDeal
dismissDeal
compareDeals
```

Depois adicione:

```text
updatePreferences
createServiceRequest
requestIntroduction
getRecommendedServices
createDealChecklist
```

Por último:

```text
sendInternalMessage
notifyMatchingUsers
createMatchAlert
consumeNuggets
```

---

# Ordem prática de desenvolvimento

Siga esta sequência, sem mudar:

## Bloco 1 — Banco

```text
1. Revisar tabela de deals
2. Criar user_match_preferences
3. Criar user_interactions
4. Criar matches
5. Criar service_offers
6. Criar maxxis_pending_actions
```

## Bloco 2 — Backend

```text
1. Criar /api/maxxis/chat
2. Carregar os três arquivos .md
3. Criar registro de ferramentas
4. Criar searchDeals
5. Criar searchServices
6. Criar getUserProfile
7. Validar argumentos das ferramentas
```

## Bloco 3 — Algoritmo

```text
1. Criar calculateDealMatch
2. Testar com dados simulados
3. Salvar score e reasons
4. Ordenar resultados
5. Exibir explicação
```

## Bloco 4 — Interface

```text
1. Melhorar o chat
2. Criar DealCard
3. Criar ServiceCard
4. Criar MatchScore
5. Criar botões Salvar e Descartar
6. Criar Compare Deals
7. Criar ConfirmationCard
```

## Bloco 5 — Inteligência ativa

```text
1. Registrar interações
2. Detectar padrões
3. Sugerir atualização de preferências
4. Recomendar serviços
5. Criar checklist
6. Criar ações pendentes
7. Exigir confirmação
```

---

# Como usar o Codex no VS Code

Não peça tudo de uma vez. Ele pode refatorar metade do projeto e transformar a outra metade em arqueologia digital.

Use prompts pequenos.

## Prompt 1 — Mapear o projeto

```text
Analise este projeto sem alterar nenhum arquivo.

Identifique:

1. Framework do frontend.
2. Existência e tecnologia do backend.
3. Forma atual de integração com a API Gemini.
4. Local dos arquivos .md usados pelo Maxxis.
5. Estrutura das tabelas ou modelos de dados.
6. Fluxo atual do chat.
7. Riscos de segurança, especialmente exposição de API keys.

Entregue um relatório com:
- arquitetura atual;
- arquivos envolvidos;
- problemas encontrados;
- plano mínimo de refatoração.

Não escreva código ainda.
```

---

## Prompt 2 — Proteger a API

```text
Com base na análise anterior, mova a chamada da API Gemini
para o backend.

Requisitos:

- A chave da API não pode ficar exposta no frontend.
- Criar endpoint POST /api/maxxis/chat.
- Manter o funcionamento atual do chat.
- Não alterar o layout.
- Adicionar tratamento de erros.
- Listar todos os arquivos criados ou modificados.
- Fornecer o código completo de cada arquivo modificado.
```

---

## Prompt 3 — Criar a primeira ferramenta

```text
Implemente uma ferramenta interna chamada searchDeals.

Ela deve:

- consultar apenas deals com status active;
- aceitar state, city, dealType, maximumPrice e limit;
- validar todos os argumentos;
- impedir SQL gerado pela IA;
- respeitar o usuário autenticado;
- retornar JSON padronizado;
- registrar erros sem expor dados sensíveis.

Integre essa ferramenta ao Maxxis.

Não implemente ainda score de match.
Forneça o código completo.
```

---

## Prompt 4 — Criar o score

```text
Implemente um serviço determinístico de match entre o
perfil do usuário e deals.

Pontuação:

- localização: 20;
- orçamento: 20;
- tipo de deal: 15;
- tipo de propriedade: 10;
- ROI: 15;
- reforma: 10;
- recência: 5;
- histórico de interesse: 5.

Requisitos:

- o modelo de IA não deve calcular o score;
- retornar score e reasons;
- incluir testes unitários;
- ordenar os deals pelo score;
- não alterar o banco ainda.

Forneça todos os arquivos completos.
```

---

## Prompt 5 — Registrar swipes e preferências

```text
Implemente o registro de interações do usuário com deals.

Tipos:
view, like, save, dismiss, compare e contact.

Requisitos:

- criar migration para user_interactions;
- criar endpoint seguro;
- integrar com os botões existentes;
- evitar registros duplicados indevidos;
- não atualizar preferências automaticamente;
- apenas registrar dados para uso posterior.

Forneça migrations, backend e frontend completos.
```

---

# Critério de conclusão de cada fase

## Etapa 1 estará pronta quando:

```text
O usuário escreve uma busca em linguagem natural.
O Maxxis encontra dados reais.
Os resultados aparecem como cards.
Nenhum resultado é inventado.
```

## Etapa 2 estará pronta quando:

```text
Cada resultado recebe um score.
O score vem do backend.
O usuário entende os motivos.
Likes e descartes são registrados.
```

## Etapa 3 estará pronta quando:

```text
O Maxxis compara deals.
Aponta dados ausentes.
Calcula métricas.
Sugere serviços.
Cria checklist.
```

## Etapa 4 estará pronta quando:

```text
O Maxxis prepara ações.
O usuário confirma.
O backend executa.
Tudo fica registrado.
Ações sensíveis permanecem bloqueadas.
```

---

# Minha orientação mais direta

Seu próximo passo não é melhorar os dois `.md`.

Seu próximo passo é criar este primeiro circuito:

```text
Mensagem do usuário
      ↓
Identificação de intenção
      ↓
searchDeals
      ↓
Banco
      ↓
Cards de resultado
```

Quando isso funcionar, implemente:

```text
Perfil
      ↓
Score
      ↓
Motivos
      ↓
Interações
```

Só depois:

```text
Análise
      ↓
Comparação
      ↓
Serviços
      ↓
Ações confirmadas
```

Os `.md` continuarão sendo o manual do Maxxis. Mas o verdadeiro salto acontecerá quando ele ganhar **ferramentas, banco estruturado e algoritmo determinístico**. Aí ele deixa de ser um FAQ simpático e começa a se tornar o diferencial central do SaaS.

# REGRAS PARA IMPLEMENTAÇÃO

- Adaptar a solução à arquitetura atual. (Não adapte o projeto à força ao desenho teórico e quebrando o app e acarretando problemas de funcionamento.)
- Não substituir bibliotecas sem necessidade.
- Não criar um segundo backend se já existir um.
- Não mover arquivos sem justificativa.
- Não alterar interfaces públicas sem mapear dependências.
- Implementar uma fase por vez.
- Fornecer migrations reversíveis.
- Criar testes para regras críticas.
- Não expor chaves de API no frontend.
- Não permitir SQL ou código gerado pelo modelo.
- Toda ação sensível exige confirmação.
- O score deve ser determinístico.
- A IA interpreta e explica, mas não calcula regras financeiras.

