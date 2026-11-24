import { calculatePropertyMatch } from '../../supabase/functions/_shared/maxxis/calculatePropertyMatch.ts';
import { inferRecordProfileScope, normalizeProfileScope, resolveScopedProfile } from './profileScopeResolver';
import { activityLabel } from './activityLabels';

const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const text = value => String(value || '').trim().toLowerCase();
const requestedRoles = {
  'private lenders': ['lender'],
  'cash buyers': ['buyer'],
  wholesalers: ['wholesaler'],
  contractors: ['ff_gc', 'gc', 'ff_rehab'],
  'jv partners': ['investor', 'ff'],
  borrowers: ['investor', 'ff', 'buyer'],
};

export function buildFeedMatchProfile(scope, profiles) {
  const normalized = normalizeProfileScope(scope);
  const professional = profiles.professionalProfile || {};
  const personal = profiles.personalProfile || {};
  const identity = resolveScopedProfile(normalized, profiles);
  const investment = professional.profiles?.[normalized]?.investmentProfile
    || (normalized === 'personal' ? professional.investmentProfile : normalized === 'professional' ? professional.investmentProfileB : personal.investmentProfileFsbo)
    || {};
  const markets = normalized === 'professional' ? professional.marketsB
    : normalized === 'fsbo' ? personal.marketsFsbo : professional.markets;
  return {
    ...investment,
    targetMarkets: list(investment.targetMarkets).length ? investment.targetMarkets : [...list(markets), identity?.loc].filter(Boolean),
  };
}

function propertyScore(profile, property) {
  return calculatePropertyMatch(profile, property).score;
}

function scopedPublishedPortfolio(card, items, kind) {
  const owner = String(card.ownerId || card.owner_id || card.id || '');
  const scope = inferRecordProfileScope(card, '');
  return list(items).filter(property => (
    String(property.ownerId || property.owner_id || '') === owner
    && (!scope || inferRecordProfileScope(property, '') === scope)
    && property.publishToShowcase !== false && property.publish_to_showcase !== false
    && property.isActive !== false && property.is_active !== false && property.dealClosed !== true && property.deal_closed !== true
    && (kind !== 'service' || (property.publishToConnections !== false && property.publish_to_connections !== false))
  ));
}

// Compatibility, not popularity: only saved profile criteria and published card data.
// Missing criteria stay unknown; no synthetic percentages are assigned to cards.
export function getFeedProfileMatch(card, profile) {
  if (!card || !profile) return null;
  const kind = text(card.cardKind || card.kind || card.itemType);
  if (kind === 'property' || kind === 'deal' || (!kind && card.address)) return propertyScore(profile, card);

  const market = propertyScore({ targetMarkets: profile.targetMarkets }, {
    city: card.city, state: card.state || card.loc, markets: list(card.markets),
  });
  const canonicalRole = value => text(activityLabel(value, 'en'));
  const wanted = list(profile.lookingFor).flatMap(role => requestedRoles[text(role)] || []).map(canonicalRole);
  const services = scopedPublishedPortfolio(card, card.linkedServices, 'service');
  const offered = [card.cat, card.category, card.categoryId, card.subcategory, ...list(card.skills), ...services.map(service => service.category)].map(canonicalRole).filter(Boolean);
  let points = market === null ? 0 : market * 0.35;
  let weight = market === null ? 0 : 35;
  if (wanted.length && offered.length) {
    points += offered.some(role => wanted.includes(role)) ? 65 : 0;
    weight += 65;
  }
  const direct = weight ? Math.round(points / weight * 100) : null;
  const scores = [direct, ...scopedPublishedPortfolio(card, card.linkedProperties, 'property').map(property => propertyScore(profile, property))].filter(value => value !== null);
  return scores.length ? Math.max(...scores) : null;
}
