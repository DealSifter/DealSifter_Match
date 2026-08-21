export type ProviderConversationMessage = {
  sender: 'user' | 'provider';
  text: string;
  createdAt?: string | null;
};

export type ProviderConversationAnalysis = {
  summary: string;
  facts: string[];
  questions: string[];
  requests: string[];
  quotedAmounts: string[];
  availability: string[];
  openItems: string[];
  suggestedReply: string;
  providerReplyFound: boolean;
  messageCount: number;
};

const MAX_ITEMS = 8;
const AMOUNT_RE = /(?:US\$|\$)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\b\d+(?:\.\d{1,2})?\s?(?:dollars|usd)\b/gi;
const AVAILABILITY_RE = /\b(?:available|availability|free|open|can do|works for me|might work|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|am|pm|next week|this week)\b/i;
const REQUEST_RE = /\b(?:send|provide|share|need|needs|can you|could you|please|address|photos?|pictures?|docs?|documents?|details?|access|gate code|lockbox)\b/i;

function cleanText(value: unknown, max = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/https?:\/\/\S*(?:token|signature|sig|expires|x-amz-|x-goog-)\S*/gi, '[private link]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function unique(items: string[], limit = MAX_ITEMS) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items.map((value) => cleanText(value, 240)).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function splitSentences(text: string) {
  return cleanText(text, 1000)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => cleanText(sentence, 260))
    .filter(Boolean);
}

function extractAmounts(messages: ProviderConversationMessage[]) {
  return unique(messages.flatMap((message) => cleanText(message.text, 1200).match(AMOUNT_RE) || []));
}

function extractAvailability(messages: ProviderConversationMessage[]) {
  return unique(messages.flatMap((message) => (
    splitSentences(message.text).filter((sentence) => AVAILABILITY_RE.test(sentence))
  )));
}

function extractQuestions(messages: ProviderConversationMessage[]) {
  return unique(messages.flatMap((message) => splitSentences(message.text).filter((sentence) => sentence.includes('?'))));
}

function extractRequests(messages: ProviderConversationMessage[]) {
  return unique(messages.flatMap((message) => (
    splitSentences(message.text).filter((sentence) => REQUEST_RE.test(sentence) && !sentence.includes('?'))
  )));
}

function isAmbiguousConfirmation(text: string) {
  const normalized = cleanText(text, 400).toLowerCase();
  return /\b(might|maybe|possibly|could|should work|might work|that works\?|i think)\b/.test(normalized)
    || /\bthat might work\b/.test(normalized);
}

function hasExplicitConfirmation(text: string) {
  const normalized = cleanText(text, 400).toLowerCase();
  return /\b(confirmed|we are confirmed|appointment confirmed|agreed|i accept|accepted|yes, confirmed)\b/.test(normalized);
}

function buildSuggestedReply({
  providerMessages,
  questions,
  requests,
  amounts,
}: {
  providerMessages: ProviderConversationMessage[];
  questions: string[];
  requests: string[];
  amounts: string[];
}) {
  if (!providerMessages.length) return '';
  const askedForProtectedContext = [...questions, ...requests].some((item) => /\b(address|gate code|lockbox|access)\b/i.test(item));
  if (askedForProtectedContext) {
    return 'Thanks for the reply. I can provide the next details once we confirm the appropriate next step. What information would you need first to evaluate scope and timing?';
  }
  if (questions.length || requests.length) {
    return 'Thanks for the reply. I’ll review the details and get back to you with the information you requested.';
  }
  if (amounts.length) {
    return 'Thanks for sharing the estimate. I’ll review it against the property details and follow up with any questions.';
  }
  return 'Thanks for the update. I’ll review this and get back to you shortly.';
}

export function analyzeProviderConversation(
  messages: ProviderConversationMessage[],
  question = '',
): ProviderConversationAnalysis {
  const safeMessages = (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      sender: message?.sender === 'provider' ? 'provider' as const : 'user' as const,
      text: cleanText(message?.text, 1200),
      createdAt: message?.createdAt || null,
    }))
    .filter((message) => message.text)
    .slice(-20);
  const providerMessages = safeMessages.filter((message) => message.sender === 'provider');
  const latestProvider = providerMessages[providerMessages.length - 1] || null;

  if (!latestProvider) {
    return {
      summary: 'No provider reply was found in the recent conversation.',
      facts: [],
      questions: [],
      requests: [],
      quotedAmounts: [],
      availability: [],
      openItems: ['Wait for the provider to reply before interpreting their position.'],
      suggestedReply: '',
      providerReplyFound: false,
      messageCount: safeMessages.length,
    };
  }

  const questions = extractQuestions(providerMessages);
  const requests = extractRequests(providerMessages);
  const quotedAmounts = extractAmounts(providerMessages);
  const availability = extractAvailability(providerMessages);
  const latestText = latestProvider.text;
  const facts = unique([
    ...quotedAmounts.map((amount) => `Provider mentioned ${amount}.`),
    ...availability.map((item) => `Provider mentioned availability/timing: ${item}`),
  ]);
  const askedAboutConfirmation = /\b(accepted|confirmed|confirmou|aceitou|agreement|agreed|appointment)\b/i.test(question);
  const ambiguous = isAmbiguousConfirmation(latestText) && !hasExplicitConfirmation(latestText);
  const openItems = unique([
    ...questions,
    ...requests,
    ...(ambiguous || askedAboutConfirmation && !hasExplicitConfirmation(latestText)
      ? ['There is no unequivocal confirmation in the recent provider reply.']
      : []),
  ]);
  const summary = ambiguous || askedAboutConfirmation && !hasExplicitConfirmation(latestText)
    ? 'The provider replied, but the recent message does not contain an unequivocal confirmation.'
    : `The provider replied: "${cleanText(latestText, 220)}"`;

  return {
    summary,
    facts,
    questions,
    requests,
    quotedAmounts,
    availability,
    openItems,
    suggestedReply: buildSuggestedReply({ providerMessages, questions, requests, amounts: quotedAmounts }),
    providerReplyFound: true,
    messageCount: safeMessages.length,
  };
}
