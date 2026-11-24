import { inferRecordProfileScope } from './profileScopeResolver';

// Presentation only: stored category IDs, filtering and commercial rules stay intact.
const rows = [
  ['wholesaler', ['Wholesaler'], ['Real estate wholesaling', 'Intermediação imobiliária', 'Intermediación inmobiliaria']],
  ['investor', ['RE Investor', 'Investor'], ['Real estate investor', 'Investidor imobiliário', 'Inversor inmobiliario']],
  ['lender', ['Lender'], ['Real estate financing', 'Financiamento imobiliário', 'Financiación inmobiliaria']],
  ['seller', ['Owner', 'Seller'], ['Property owner', 'Proprietário de imóvel', 'Propietario de inmueble']],
  ['fsbo', ['For Sale By Owner'], ['For sale by owner', 'Venda pelo proprietário', 'Venta por el propietario']],
  ['buyer', ['Cash Buyer'], ['Cash buyer', 'Comprador à vista', 'Comprador al contado']],
  ['ff', ['Fix & Flip'], ['Fix & Flip · renovation & resale', 'Fix & Flip · reforma e revenda', 'Fix & Flip · reforma y reventa'], ['Fix & Flip · resale', 'Reforma e revenda', 'Reforma y reventa']],
  ['ff_gc', ['gc', 'General Contractor', 'GC / Contractor', 'Contractor'], ['General contractor', 'Empreiteiro geral', 'Contratista general']],
  ['ff_rehab', ['Rehab Staff', 'Rehab Specialist'], ['Renovation services', 'Serviços de reforma', 'Servicios de reformas']],
  ['services', ['Services'], ['Professional services', 'Serviços profissionais', 'Servicios profesionales']],
  ['svc_d4d', ['Drive4$', 'Drive for Dollars'], ['Property prospecting', 'Prospecção de imóveis', 'Prospección de inmuebles']],
  ['svc_photo', ['Photography', 'Photographer'], ['Real estate photography', 'Fotografia imobiliária', 'Fotografía inmobiliaria']],
  ['svc_drone', ['Drone Image'], ['Drone photography & video', 'Fotos e vídeos com drone', 'Fotos y vídeos con dron']],
  ['svc_inspection', ['Inspections', 'Inspection'], ['Property inspections', 'Inspeção de imóveis', 'Inspección de inmuebles']],
  ['svc_survey', ['Survey', 'Surveyor'], ['Land surveying', 'Topografia', 'Topografía']],
  ['svc_title', ['Title Company'], ['Title & closing services', 'Titulação e fechamento', 'Títulos y cierre inmobiliario']],
  ['svc_accountant', ['Accountant'], ['Accounting services', 'Contabilidade', 'Contabilidad']],
  ['svc_notary', ['Notary'], ['Notary services', 'Serviços notariais', 'Servicios notariales']],
  ['svc_va', ['Virtual Assistant'], ['Virtual assistance', 'Assistência virtual', 'Asistencia virtual']],
  ['tax', ['Tax Deed / Tax Lien'], ['Tax deeds & liens', 'Imóveis e créditos tributários', 'Inmuebles y créditos fiscales']],
  ['attorney', ['RE Attorney', 'Real Estate Attorney'], ['Real estate attorney', 'Advocacia imobiliária', 'Abogacía inmobiliaria']],
  ['auction', ['R.E Auctions'], ['Real estate auctions', 'Leilões de imóveis', 'Subastas inmobiliarias']],
  ['auction_consultancy', ['R.E Consultancy'], ['Real estate auction consulting', 'Consultoria em leilões', 'Consultoría de subastas']],
  ['auction_advisory', ['R.E Advisory'], ['Real estate auction advisory', 'Assessoria em leilões', 'Asesoría de subastas']],
];
const normalize = value => String(value ?? '').trim().toLowerCase();
const catalog = new Map(rows.flatMap(row => [row[0], ...row[1], ...row[2], ...(row[3] || [])].map(key => [normalize(key), row])));
const localeIndex = language => ({ en: 0, pt: 1, es: 2 }[String(language).toLowerCase().split('-')[0]] ?? 0);

export function activityLabel(value, language = 'en', compact = false) {
  const text = String(value ?? '').trim();
  const row = catalog.get(normalize(text));
  return row ? (compact && row[3] ? row[3] : row[2])[localeIndex(language)] : text;
}

export function activityLabels(values, language = 'en', compact = false) {
  const seen = new Set();
  return (Array.isArray(values) ? values.flat(Infinity) : [values]).filter(value => typeof value === 'string').map(value => activityLabel(value, language, compact)).filter(value => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function profileActivities(profile, language = 'en', compact = false) {
  const generic = /^(professional|business|personal|profile|contact|services)$/i;
  const primary = [profile?.type, profile?.category, profile?.cat].filter(value => value && !generic.test(String(value)));
  const services = profileLinkedServices(profile).map(service => service.category);
  const labels = activityLabels([...primary, ...services], language, compact);
  return labels.length ? labels : activityLabels([profile?.type || profile?.badge], language, compact);
}

export function profileLinkedServices(profile) {
  const scope = inferRecordProfileScope(profile);
  const owner = String(profile?.ownerId || profile?.owner_id || profile?.unlockOwnerId || profile?.id || '');
  return (Array.isArray(profile?.linkedServices) ? profile.linkedServices : []).filter(service => {
    const serviceOwner = String(service?.ownerId || service?.owner_id || '');
    return (!scope || inferRecordProfileScope(service, scope) === scope)
      && (!owner || !serviceOwner || owner === serviceOwner)
      && service?.isActive !== false
      && (service?.publishToConnections ?? service?.publish_to_connections) !== false;
  });
}

export function servicePresentation(service, language = 'en') {
  const fallback = ['Professional service', 'Serviço profissional', 'Servicio profesional'][localeIndex(language)];
  const category = activityLabel(service?.category, language) || fallback;
  const title = String(service?.title || service?.name || '').trim();
  const markets = Array.isArray(service?.markets) ? service.markets.filter(value => typeof value === 'string').join(', ') : '';
  return { title: title || category, category, description: String(service?.description || '').trim(), location: String(service?.location || service?.loc || service?.state || markets || '').trim() };
}
