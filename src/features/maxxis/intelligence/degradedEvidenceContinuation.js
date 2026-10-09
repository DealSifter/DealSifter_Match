import { getSafeLang } from '../../../services/chatTranslation';
export function buildDegradedEvidenceContinuation({ property = {}, snapshot = null, language = 'en' } = {}) {
  const lang = getSafeLang(language), locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  const money = value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value));
  const price = Number(property.price ?? property.askingPrice), sqft = Number(property.sqft ?? property.livingAreaSqft);
  const known = [property.address, property.type, property.objective].filter(Boolean).join(' · ');
  const metrics = [];
  if (price > 0) metrics.push(`${lang === 'pt' ? 'Preço pedido' : lang === 'es' ? 'Precio solicitado' : 'Asking price'}: ${money(price)}.`);
  if (price > 0 && sqft > 0) metrics.push(`${lang === 'pt' ? 'Preço por sqft' : lang === 'es' ? 'Precio por sqft' : 'Price per sqft'}: ${money(price / sqft)} (${sqft.toLocaleString(locale)} sqft).`);
  const profileFit = snapshot?.matchScore?.score ?? snapshot?.matchScore?.matchScore;
  if (Number.isFinite(profileFit)) metrics.push(`${lang === 'pt' ? 'Aderência ao perfil, não qualidade do negócio' : lang === 'es' ? 'Afinidad con el perfil, no calidad del negocio' : 'Profile fit, not deal quality'}: ${profileFit}%.`);
  const intro = lang === 'pt' ? 'A revisão de ARV não tem comparáveis utilizáveis neste momento. Isso não impede a análise dos dados cadastrados.' : lang === 'es' ? 'La revisión de ARV no tiene comparables utilizables en este momento. Esto no impide analizar los datos registrados.' : 'ARV review has no usable comparables at this time. That does not prevent analysis of registered data.';
  const limitation = lang === 'pt' ? 'Não atualizei dados externos nem calculei um ARV. A avaliação por vendas exige evidências identificadas e dentro do prazo; preço pedido e cap rate informado não validam o valor de mercado.' : lang === 'es' ? 'No actualicé datos externos ni calculé ARV. La valoración por ventas requiere evidencia identificada y vigente; el precio solicitado y el cap rate informado no validan el valor de mercado.' : 'I did not refresh external data or calculate ARV. Sales valuation requires identifiable, timely evidence; asking price and reported cap rate do not validate market value.';
  const next = /sub[ -]?to|subject[ -]?to/i.test(property.objective || '')
    ? (lang === 'pt' ? 'Próximo passo: confirme o saldo da dívida existente para avaliar a aquisição subject-to.' : lang === 'es' ? 'Próximo paso: confirma el saldo de la deuda existente para evaluar la adquisición subject-to.' : 'Next step: confirm the existing loan balance to evaluate the subject-to acquisition.')
    : (lang === 'pt' ? 'Próximo passo: confirme o custo de aquisição e a reforma necessária para avaliar um cenário com premissas explícitas.' : lang === 'es' ? 'Próximo paso: confirma el costo de adquisición y la reforma necesaria para evaluar un escenario con supuestos explícitos.' : 'Next step: confirm acquisition cost and required rehab to evaluate a scenario with explicit assumptions.');
  return [intro, known, metrics.join('\n'), limitation, next].filter(Boolean).join('\n\n');
}
