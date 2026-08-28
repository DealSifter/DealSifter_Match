export const MAXXIS_KNOWLEDGE_VERSION = '2026-08-27.1';

export type MaxxisKnowledgeTopic =
  | 'app'
  | 'dashboard'
  | 'feed'
  | 'mapview'
  | 'matches'
  | 'profile'
  | 'nuggets'
  | 'providers'
  | 'messaging'
  | 'maxxis';

type KnowledgeSection = {
  topic: MaxxisKnowledgeTopic;
  text: string;
  keywords: string[];
  pages: string[];
};

// Compact runtime authority compiled from the current UI, backend contracts and
// operational docs. It deliberately excludes prices, secrets, PII and rollout
// claims that can change independently of the deployed code.
export const MAXXIS_KNOWLEDGE_SECTIONS: readonly KnowledgeSection[] = [
  {
    topic: 'app',
    pages: ['dashboard'],
    keywords: ['dealsifter', 'app', 'platform', 'home', 'inicio', 'start'],
    text: 'DealSifter Match connects real-estate people, services and published opportunities. The main surfaces are Dashboard/Feed for discovery, MapView for geographic discovery, Matches for relationships and conversations, Onboarding/Profile for published cards and portfolios, Pricing for plans and nuggets, and Settings for account and Maxxis preferences.',
  },
  {
    topic: 'dashboard',
    pages: ['dashboard'],
    keywords: ['dashboard', 'home', 'tela inicial', 'pagina inicial', 'painel'],
    text: 'Dashboard is the discovery hub. It can show people and services, highlighted cards and the business showcase, with role/category/state filters. Card actions can dismiss, favorite/match or continue to unlock; protected contact and property data remain locked until the server confirms entitlement.',
  },
  {
    topic: 'feed',
    pages: ['feed'],
    keywords: ['feed', 'card', 'cards', 'swipe', 'favorite', 'favorito', 'destaque', 'spotlight', 'showcase', 'vitrine'],
    text: 'Feed presents ordered decks of connection cards and published showcase properties. Filters and the active profile scope change what is visible. Dismiss, favorite and match are discovery actions; a favorite is not an unlock, and hidden contact or property details require server-confirmed access.',
  },
  {
    topic: 'mapview',
    pages: ['map', 'mapview'],
    keywords: ['map', 'mapa', 'mapview', 'pin', 'pins', 'cluster', 'sidebar', 'my pins'],
    text: 'MapView discovers published people and deals geographically through pins and clusters. Users can switch cards/filters, select a canonical card, filter people or properties, show only their pins or unlocked items, and resize the desktop/tablet sidebar. Saved map UI state restores user customization; selecting a pin does not unlock it.',
  },
  {
    topic: 'matches',
    pages: ['matches'],
    keywords: ['match', 'matches', 'connection', 'connections', 'conexao', 'conexoes', 'interest', 'interesse', 'portfolio'],
    text: 'Matches organizes People and Interests, with filters for access/state and an active relationship context. After selecting an authorized contact or property, users can view linked portfolio items and use the conversation panel. Locked records still require the existing unlock flow; Matches never infers access from a favorite alone.',
  },
  {
    topic: 'profile',
    pages: ['onboarding', 'profile'],
    keywords: ['profile', 'perfil', 'onboarding', 'card publication', 'publicar', 'investment profile', 'investor profile'],
    text: 'Onboarding/Profile creates and edits personal, professional, FSBO, property and service records. The Investment Profile supplies authorized preferences such as target markets, property types, strategies and price range for personalized matching. Profile completeness improves relevance but does not guarantee a deal or expose private account data.',
  },
  {
    topic: 'nuggets',
    pages: ['pricing'],
    keywords: ['nugget', 'nuggets', 'balance', 'saldo', 'pricing', 'plan', 'plano', 'upgrade', 'subscription'],
    text: 'Nuggets are the in-app unit used by protected paid interactions such as eligible unlock or visibility flows. The current cost and balance must come from server-authoritative UI at confirmation time. Pricing shows the plans and packs currently available; Maxxis must not invent a price, debit, refund or entitlement.',
  },
  {
    topic: 'providers',
    pages: ['property-details', 'matches'],
    keywords: ['provider', 'providers', 'service', 'services', 'servico', 'servicos', 'contractor', 'attorney', 'inspector', 'title company', 'quem pode ajudar', 'who can help'],
    text: 'Published service cards can represent providers such as contractors, attorneys, title companies, inspectors and other property services. Service matching is calculated by backend tools from authorized property needs and provider data. A match is informational; contact access, availability, price and engagement must never be invented.',
  },
  {
    topic: 'messaging',
    pages: ['matches'],
    keywords: ['message', 'messaging', 'mensagem', 'chat', 'conversation', 'conversa', 'reply', 'respondeu'],
    text: 'Messaging lives in the authorized Matches relationship context. The backend derives the recipient and validates access. Maxxis may explain a conversation state or prepare supported text, but sending requires the existing explicit confirmation and server checks; proactive insights never send automatically.',
  },
  {
    topic: 'maxxis',
    pages: ['settings'],
    keywords: ['maxxis', 'assistant', 'assistente', 'ai', 'proactive', 'proativo', 'memory', 'memoria', 'autonomy', 'autonomia'],
    text: 'Maxxis Deal AI is a contextual copilot, not an autonomous agent. Gemini understands and explains; deterministic backend tools remain authoritative for metrics, matching, workflow, eligibility, unlocks and service fit. Maxxis can read, explain, compare, suggest and prepare supported actions, but protected mutations require fresh explicit confirmation. Proactive insights are dismissible, preference/flag controlled and never execute an action automatically.',
  },
] as const;

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function selectMaxxisKnowledge(message: string, page = 'dashboard', limit = 2) {
  const normalizedMessage = normalize(message);
  const normalizedPage = normalize(page);
  const ranked = MAXXIS_KNOWLEDGE_SECTIONS.map((section, index) => {
    const pageMatch = section.pages.some((candidate) => normalize(candidate) === normalizedPage);
    const keywordMatches = section.keywords.reduce(
      (count, keyword) => count + (normalizedMessage.includes(normalize(keyword)) ? 1 : 0),
      0,
    );
    return { section, index, score: (pageMatch ? 2 : 0) + (keywordMatches * 4) };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Math.min(3, limit)))
    .map((item) => item.section);

  if (ranked.length) return ranked;
  return MAXXIS_KNOWLEDGE_SECTIONS.filter((section) => section.topic === 'app');
}

export function buildMaxxisKnowledgeInstruction(sections: readonly KnowledgeSection[]) {
  const selected = sections.slice(0, 3);
  return `RUNTIME KNOWLEDGE ${MAXXIS_KNOWLEDGE_VERSION}\n${selected
    .map((section) => `[${section.topic}] ${section.text}`)
    .join('\n')}`;
}
