/** Provider AVM comparables are listing references, never recorded-sale inputs. */
export function projectProviderListingReferences(input: unknown) {
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  const seen = new Set<string>();
  const normalize = (v: unknown) => text(v).toUpperCase().replace(/[^A-Z0-9#]/g, '');
  return (Array.isArray(input) ? input : []).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>, address = text(row.formattedAddress || row.address || row.addressLine1);
    const price = number(row.price);
    if (row.priceSemantic !== 'PROVIDER_LISTING_PRICE' || !address || price === null || price <= 0) return [];
    const providerPropertyId = text(row.providerPropertyId), assessorId = text(row.assessorId);
    // City aliases are not identity. Require street + state + ZIP + exact
    // coordinates + matching structural attributes; retain unit identifiers.
    const street = text(row.addressLine1), zip = text(row.zipCode), state = text(row.state);
    const geoIdentity = street && zip && state && number(row.latitude) !== null && number(row.longitude) !== null
      && number(row.livingAreaSqft) !== null && number(row.bedrooms) !== null && number(row.bathrooms) !== null
      ? JSON.stringify([normalize(street), normalize(state), zip, row.latitude, row.longitude, row.livingAreaSqft, row.bedrooms, row.bathrooms]) : '';
    const keys = [`address:${normalize(address)}`, ...(providerPropertyId ? [`id:${providerPropertyId}`] : []),
      ...(assessorId && state && zip ? [`apn:${normalize(state)}:${zip}:${normalize(assessorId)}`] : []), ...(geoIdentity ? [`geo:${geoIdentity}`] : [])];
    if (keys.some(key => seen.has(key))) return [];
    keys.forEach(key => seen.add(key));
    return [{ address, providerPropertyId, assessorId, addressLine1: street, zipCode: zip, state, listingStatus: text(row.listingStatus),
      price, priceSemantic: 'PROVIDER_LISTING_PRICE' as const, latitude: number(row.latitude), longitude: number(row.longitude),
      bedrooms: number(row.bedrooms), bathrooms: number(row.bathrooms), livingAreaSqft: number(row.livingAreaSqft),
      distanceMiles: number(row.distanceMiles), providerCorrelation: number(row.providerCorrelation), lastSeenDate: text(row.lastSeenDate) }];
  }).sort((a, b) => (b.providerCorrelation ?? -1) - (a.providerCorrelation ?? -1)).slice(0, 5);
}

/** Presentation ordering only; does not promote supporting evidence into ARV. */
export function rankReportComparables<T extends Record<string, unknown>>(rows: T[]): T[] {
  const score = (row: T) => {
    const raw = row.similarity ?? row.structuralComparabilityScore ?? row.providerCorrelation;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw <= 1 ? raw * 100 : raw : -1;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}

/** Bounded delivery receipt, from actual execution telemetry, not listing counts. */
export function projectSoldDelivery(trace: Record<string, unknown> = {}) {
  const count = (key:string) => typeof trace[key] === 'number' && Number.isFinite(trace[key]) ? Math.max(0, Number(trace[key])) : null;
  const loaded = ['HIT','MISS_REFRESHED'].includes(String(trace.soldEvidence));
  const returned = loaded ? count('soldRawCandidateCount') : null;
  const normalized = loaded ? count('soldNormalizedCandidateCount') : null;
  const eligible = loaded ? count('arvEligibleCount') : null;
  const structural = loaded ? count('structuralCandidateCount') : null;
  const recorded = typeof trace.soldProviderAttempted === 'boolean' || loaded;
  const status = !recorded ? 'UNKNOWN_EXECUTION' : !loaded ? 'NOT_QUERIED' : returned === 0 ? 'NO_PROVIDER_RESULTS'
    : normalized === 0 ? 'NO_SOLD_RECORDS' : structural === 0 ? 'FILTERED_OUT'
      : ['ARV_AVAILABLE','ARV_LIMITED'].includes(String(trace.arvStatus)) && (eligible ?? 0) > 0 ? 'ELIGIBLE_FOR_ARV'
        : trace.targetConditionConfirmed === false || (structural ?? 0) > 0 && eligible === 0 ? 'CONDITION_UNCONFIRMED' : 'INSUFFICIENT_ELIGIBLE_COMPS';
  return Object.freeze({ status, queryExecuted: typeof trace.soldProviderAttempted === 'boolean' ? trace.soldProviderAttempted : loaded ? !Boolean(trace.soldEvidence === 'HIT') : null, cacheHit: trace.soldEvidence === 'HIT',
    reason: String(trace.soldEvidenceReason || 'EXECUTION_NOT_RECORDED'), returned, normalized,
    hardGatePass: loaded ? count('hardGatePassCount') : null, structural, eligible,
    supporting: loaded ? count('supportingCandidateCount') : null, excluded: loaded ? count('excludedCandidateCount') : null,
    arvStatus: String(trace.arvStatus || 'UNAVAILABLE'), blockers: Array.isArray(trace.arvBlockers)?trace.arvBlockers.filter(v=>typeof v==='string'):[] });
}

export function soldDeliveryAnswer(receipt: ReturnType<typeof projectSoldDelivery>, language:string) {
  const i=language==='pt'?0:language==='es'?2:1;
  const reasons:Record<string,string[]>={
    NOT_QUERIED:['Sem resultado rastreável da busca SOLD; não é possível concluir que não existem vendas.','No traceable SOLD search result; this does not establish that no sales exist.','Sin resultado trazable de búsqueda SOLD; no prueba ausencia de ventas.'],
    NO_PROVIDER_RESULTS:['Busca sem registros retornados.','Search returned no records.','Búsqueda sin registros devueltos.'],
    NO_SOLD_RECORDS:['Registros retornados sem vendas fechadas normalizáveis.','Returned records contained no normalizable closed sales.','Registros devueltos sin ventas cerradas normalizables.'],
    FILTERED_OUT:['Vendas rejeitadas pelos critérios estruturais existentes.','Sales rejected by the existing structural criteria.','Ventas rechazadas por criterios estructurales existentes.'],
    CONDITION_UNCONFIRMED:['Condição-alvo e/ou condição comparável não confirmada; ARV não liberado.','Target and/or comparable condition unconfirmed; ARV withheld.','Condición objetivo y/o comparable no confirmada; ARV bloqueado.'],
    INSUFFICIENT_ELIGIBLE_COMPS:['Vendas elegíveis insuficientes para o motor ARV.','Insufficient eligible sales for the ARV engine.','Ventas elegibles insuficientes para el motor ARV.'],
    ELIGIBLE_FOR_ARV:['Vendas elegíveis utilizadas pelo motor ARV.','Eligible sales used by the ARV engine.','Ventas elegibles utilizadas por el motor ARV.'],
  };
  const n=(v:number|null)=>v===null?'—':String(v);
  const blocked:Record<string,string[]>={
    VALUATION_EVIDENCE_CACHE_REQUIRED:['Busca SOLD bloqueada antes do provedor: subject AVM compatível ausente no cache.','SOLD search blocked before provider: compatible AVM subject missing from cache.','Búsqueda SOLD bloqueada antes del proveedor: falta subject AVM compatible en caché.'],
    SOLD_EVIDENCE_CACHE_MISS:['Sem cache SOLD válido neste fluxo de leitura; uma busca atual autorizada é necessária.','No valid SOLD cache in this read flow; an authorized current search is required.','Sin caché SOLD válido en este flujo de lectura; se requiere búsqueda actual autorizada.'],
    PROVIDER_DISABLED:['A consulta está desativada; não se trata de ausência de vendas.','Query disabled; this does not establish an absence of sales.','Consulta deshabilitada; no prueba ausencia de ventas.'],
    PROVIDER_NOT_CONFIGURED:['Provedor não configurado para a busca SOLD.','Provider not configured for SOLD search.','Proveedor no configurado para búsqueda SOLD.'],
    ADDRESS_MISMATCH:['Identidade/endereço do subject rejeitados antes de utilizar as vendas.','Subject identity/address rejected before sales could be used.','Identidad/dirección del subject rechazadas antes de utilizar ventas.'],
    MONTHLY_PROVIDER_LIMIT_REACHED:['Limite de uso bloqueou a aquisição de vendas.','Usage limit blocked sales acquisition.','Límite de uso bloqueó adquisición de ventas.'],
    NOT_REQUESTED:['Busca SOLD não solicitada neste fluxo.','SOLD search not requested in this flow.','Búsqueda SOLD no solicitada en este flujo.'],
    REPORT_LEVEL_NOT_REQUIRED:['Este nível de relatório não solicitou busca SOLD.','This report level did not request a SOLD search.','Este nivel de informe no solicitó búsqueda SOLD.'],
  };
  const source=receipt.cacheHit?['cache válido','valid cache','caché válido'][i]:receipt.queryExecuted?['consulta ao provedor executada','provider queried','proveedor consultado'][i]:['execução não comprovada','execution not evidenced','ejecución no acreditada'][i];
  const counts=[`Retornados: ${n(receipt.returned)}; normalizados: ${n(receipt.normalized)}; filtros estruturais: ${n(receipt.structural)}; elegíveis ARV: ${n(receipt.eligible)}.`,`Returned: ${n(receipt.returned)}; normalized: ${n(receipt.normalized)}; structural candidates: ${n(receipt.structural)}; ARV eligible: ${n(receipt.eligible)}.`,`Devueltos: ${n(receipt.returned)}; normalizados: ${n(receipt.normalized)}; candidatos estructurales: ${n(receipt.structural)}; elegibles ARV: ${n(receipt.eligible)}.`][i];
  return `SOLD: ${source}. ${counts} ${(!receipt.cacheHit && blocked[receipt.reason]?.[i]) || (reasons[receipt.status]||reasons.NOT_QUERIED)[i]}`;
}
