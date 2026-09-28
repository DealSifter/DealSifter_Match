const STATUS_COPY = Object.freeze({
  ARV_AVAILABLE: {
    label: 'AVAILABLE',
    statement: 'The current evidence supports the estimated ARV range shown below.',
    nextAction: 'Review the supporting evidence and limitations before using this reference.',
  },
  ARV_LIMITED: {
    label: 'LIMITED CONFIDENCE',
    statement: 'The current evidence supports only a limited ARV reference.',
    nextAction: 'Review additional condition-compatible recorded sales before relying on this estimate.',
  },
  ARV_UNAVAILABLE: {
    label: 'NOT AVAILABLE YET',
    statement: 'The available evidence does not yet support an ARV range.',
    nextAction: 'Review additional comparable properties and confirm their condition compatibility.',
  },
});

const STATUS_COPY_PT = Object.freeze({
  ARV_AVAILABLE: { label: 'DISPONÍVEL', statement: 'As evidências atuais sustentam a faixa estimada de ARV abaixo.', nextAction: 'Revise as evidências de apoio e as limitações antes de usar esta referência.' },
  ARV_LIMITED: { label: 'CONFIANÇA LIMITADA', statement: 'As evidências atuais sustentam apenas uma referência limitada de ARV.', nextAction: 'Revise mais vendas registradas compatíveis em condição antes de usar esta estimativa.' },
  ARV_UNAVAILABLE: { label: 'AINDA NÃO DISPONÍVEL', statement: 'As evidências disponíveis ainda não sustentam uma faixa de ARV.', nextAction: 'Confirme a condição-alvo, o rehab e revise os comparáveis de apoio.' },
});

const EXPLANATIONS = Object.freeze({
  INSUFFICIENT_CONDITION_COMPATIBLE_COMPS: 'There is insufficient condition-compatible comparable evidence.',
  INSUFFICIENT_PRICE_PER_SQFT_EVIDENCE: 'There is insufficient recorded price-per-square-foot evidence.',
  MISSING_SUBJECT_LIVING_AREA: 'The subject living area is unavailable.',
  EXTREME_VALUATION_DISPERSION: 'Comparable evidence is too dispersed to support a defensible range.',
  MONETARY_ADJUSTMENTS_INACTIVE: 'Condition-based monetary adjustments are not active or calibrated.',
  TRANSACTION_QUALITY_UNKNOWN: 'Transaction condition verification is limited.',
  VALUATION_DISPERSION_WARNING: 'Comparable valuation evidence has material dispersion.',
  POSSIBLE_UNMODELED_FACTOR: 'Additional property factors may not be fully captured.',
  CENTRAL_REFERENCE_DIVERGENCE: 'The median and weighted diagnostic references materially diverge.',
  LOW_COMP_COUNT: 'Only a limited number of condition-compatible comparables is available.',
  UNKNOWN_TRANSACTION_QUALITY: 'One or more transaction-quality fields remain unknown.',
  UNKNOWN_CONDITION: 'One or more comparable condition reviews remain unknown.',
  CONDITION_MATCH: 'Strong structural similarity and compatible user-reviewed condition.',
  PARTIAL_CONDITION_MATCH: 'Condition is only partially compatible with the confirmed target.',
  SUPERIOR_TO_TARGET: 'Reviewed condition is superior to the confirmed target.',
  INFERIOR_TO_TARGET: 'Reviewed condition is inferior to the confirmed target.',
  DIFFERENT_PRODUCT_CLASS: 'Different product class.',
  NOT_COMPARABLE: 'User review marked this property as not comparable.',
  CONDITION_UNKNOWN: 'Condition review is pending or unknown.',
  MAXIMUM_CORE_COMP_COUNT: 'The deterministic core-comparable limit was reached.',
  FAILED_HARD_GATE: 'Required structural eligibility checks did not pass.',
  INSUFFICIENT_COMPLETENESS: 'Comparable evidence is incomplete.',
  INSUFFICIENT_STRUCTURAL_SCORE: 'Structural similarity is below the policy threshold.',
  TRANSACTION_NOT_ARMS_LENGTH: 'The transaction is not verified as arm’s length.',
  CORRUPT_OR_AMBIGUOUS_RECORD: 'The recorded-sale evidence is ambiguous or corrupt.',
  MISSING_STABLE_COMP_IDENTITY: 'A stable comparable identity is unavailable.',
  MISSING_RECORDED_SALE_PRICE: 'Recorded sale price is unavailable.',
  MISSING_RECORDED_SALE_DATE: 'Recorded sale date is unavailable.',
  MISSING_LIVING_AREA: 'Comparable living area is unavailable.',
  DUPLICATE_COMP_IDENTITY: 'Duplicate comparable evidence was excluded.',
});

const EXPLANATIONS_PT = Object.freeze({
  INSUFFICIENT_CONDITION_COMPATIBLE_COMPS: 'Não há comparáveis suficientes com condição compatível.',
  INSUFFICIENT_PRICE_PER_SQFT_EVIDENCE: 'Não há evidência registrada suficiente de preço por pé quadrado.',
  MISSING_SUBJECT_LIVING_AREA: 'A área útil do imóvel não está disponível.',
  EXTREME_VALUATION_DISPERSION: 'As evidências comparáveis estão dispersas demais para sustentar uma faixa defensável.',
  MONETARY_ADJUSTMENTS_INACTIVE: 'Os ajustes monetários por condição não estão ativos ou calibrados.',
  TRANSACTION_QUALITY_UNKNOWN: 'A verificação das condições das transações é limitada.',
  VALUATION_DISPERSION_WARNING: 'As evidências de avaliação apresentam dispersão relevante.',
  LOW_COMP_COUNT: 'Há poucos comparáveis compatíveis em condição.',
  UNKNOWN_TRANSACTION_QUALITY: 'Um ou mais campos de qualidade da transação permanecem desconhecidos.',
  UNKNOWN_CONDITION: 'A condição de um ou mais comparáveis ainda não foi revisada.',
  CONDITION_MATCH: 'A semelhança estrutural e a condição revisada sustentam a inclusão.',
  PARTIAL_CONDITION_MATCH: 'A condição é apenas parcialmente compatível com o alvo confirmado.',
  CONDITION_UNKNOWN: 'A revisão da condição está pendente ou desconhecida.',
  FAILED_HARD_GATE: 'Os critérios estruturais obrigatórios não foram atendidos.',
  INSUFFICIENT_COMPLETENESS: 'As evidências do comparável estão incompletas.',
  INSUFFICIENT_STRUCTURAL_SCORE: 'A semelhança estrutural está abaixo do limite da política.',
  MISSING_RECORDED_SALE_PRICE: 'O preço da venda registrada não está disponível.',
  MISSING_RECORDED_SALE_DATE: 'A data da venda registrada não está disponível.',
  MISSING_LIVING_AREA: 'A área útil do comparável não está disponível.',
});

function explain(code, fallback = 'Evidence limitation recorded by the deterministic valuation policy.', language = 'en') {
  return (language === 'pt' ? EXPLANATIONS_PT[String(code || '')] : null) || EXPLANATIONS[String(code || '')] || fallback;
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function presentationWarnings(evaluation, language = 'en') {
  const warnings = [...(evaluation.warnings || [])];
  if (Number(evaluation.eligibleCompCount || 0) < 3) warnings.push('LOW_COMP_COUNT');
  if ((evaluation.limitations || []).includes('TRANSACTION_QUALITY_UNKNOWN')) {
    warnings.push('UNKNOWN_TRANSACTION_QUALITY');
  }
  if ((evaluation.valuationSet || []).some((comp) => comp.conditionCompatibility === 'UNKNOWN'
    || comp.conditionCompatibility === 'UNREVIEWED' || comp.exclusionReason === 'CONDITION_UNKNOWN')) {
    warnings.push('UNKNOWN_CONDITION');
  }
  return unique(warnings).map((code) => ({ code, message: explain(code, undefined, language) }));
}

function comparableEvidence(comp, language = 'en') {
  const included = comp.valuationEligibility === 'INCLUDED';
  const reasonCode = included ? comp.inclusionReason : comp.exclusionReason;
  return {
    compIdentifier: comp.compIdentifier,
    address: comp.address,
    recordedSalePrice: comp.recordedSalePrice,
    recordedSaleDate: comp.recordedSaleDate,
    distanceMiles: comp.distanceMiles,
    structuralComparabilityScore: comp.structuralComparabilityScore,
    dataCompletenessScore: comp.dataCompletenessScore,
    conditionCompatibility: comp.conditionCompatibility,
    valuationWeight: comp.valuationWeight,
    valuationRole: comp.valuationRole,
    valuationEligibility: comp.valuationEligibility,
    reasonCode: reasonCode || (included ? 'CONDITION_MATCH' : 'INSUFFICIENT_EVIDENCE'),
    reason: explain(reasonCode, included
      ? 'Structural eligibility and the user-reviewed condition support inclusion.'
      : 'This comparable did not satisfy the deterministic valuation-set policy.', language),
    provenance: {
      recordedSale: comp.recordedSaleEvidenceStatus || 'UNAVAILABLE',
      conditionReview: comp.conditionEvidenceStatus || 'UNAVAILABLE',
      pricePerSqft: comp.pricePerSqftEvidenceStatus || 'UNAVAILABLE',
    },
  };
}

export function createArvExplanationContext(evaluation, language = 'en', options = {}) {
  if (!evaluation || !STATUS_COPY[evaluation.status]) return null;
  const copy = (language === 'pt' ? STATUS_COPY_PT : STATUS_COPY)[evaluation.status];
  const valuationSet = (evaluation.valuationSet || []).map((comp) => comparableEvidence(comp, language));
  const usedComps = valuationSet.filter((comp) => comp.valuationEligibility === 'INCLUDED');
  const notIncludedComps = valuationSet.filter((comp) => comp.valuationEligibility !== 'INCLUDED');
  const supportingCount = Math.max(0, Number(options.supportingCount || 0));
  const explainForCurrentSet = (code) => code === 'INSUFFICIENT_CONDITION_COMPATIBLE_COMPS' && supportingCount > 0
    ? language === 'pt'
      ? `${supportingCount} ${supportingCount === 1 ? 'venda estruturalmente semelhante permanece como comparável' : 'vendas estruturalmente semelhantes permanecem como comparáveis'} de apoio; nenhuma atende ainda a todos os critérios determinísticos do ARV.`
      : language === 'es'
        ? `${supportingCount} ${supportingCount === 1 ? 'venta estructuralmente similar permanece' : 'ventas estructuralmente similares permanecen'} como comparables de apoyo; ninguna cumple todavía todos los criterios determinísticos del ARV.`
        : `${supportingCount} structurally similar sale${supportingCount === 1 ? '' : 's'} remain as supporting comps; none yet meets every deterministic ARV criterion.`
    : explain(code, undefined, language);
  const limitations = unique(evaluation.limitations || []).map((code) => ({ code, message: explainForCurrentSet(code) }));
  const confidenceReasons = unique(evaluation.confidenceReasons || []).map((code) => ({ code, message: explainForCurrentSet(code) }));
  const available = evaluation.status !== 'ARV_UNAVAILABLE';
  const provider = evaluation.providerAvmCrossCheck;
  const providerEstimate = provider?.evidenceStatus === 'ESTIMATED' && Number(provider.value) > 0 ? {
    value: provider.value,
    source: 'RentCast',
    type: 'Provider Estimate',
    evidenceStatus: 'ESTIMATED',
    crossCheckStatus: provider.status,
  } : null;
  const why = [];
  if (usedComps.length) {
    why.push(language === 'pt' ? `${usedComps.length} ${usedComps.length === 1 ? 'venda registrada compatível em condição passou' : 'vendas registradas compatíveis em condição passaram'} pela política de avaliação.` : `${usedComps.length} condition-compatible recorded sale${usedComps.length === 1 ? '' : 's'} passed the valuation policy.`);
    why.push(language === 'pt' ? 'Os preços das vendas registradas foram usados como evidência.' : 'Recorded sale prices were used as evidence.');
    why.push(language === 'pt' ? 'A semelhança estrutural foi avaliada antes da estimativa.' : 'Structural similarity was evaluated before valuation.');
  } else {
    why.push(explainForCurrentSet(evaluation.confidenceReasons?.[0]));
  }
  if (evaluation.status === 'ARV_LIMITED' && usedComps.length === 2) {
    why.unshift(language === 'pt' ? 'Há apenas dois comparáveis compatíveis em condição.' : 'Only two condition-compatible comparables are available.');
  }

  return {
    version: 'MAXXIS_ARV_RESULT_EXPERIENCE_V1',
    status: evaluation.status,
    statusLabel: copy.label,
    statement: copy.statement,
    range: available ? { low: evaluation.arvRangeLow, high: evaluation.arvRangeHigh } : null,
    centralReference: available ? evaluation.centralReference : null,
    confidence: evaluation.confidence,
    eligibleCompCount: evaluation.eligibleCompCount,
    why: unique(why),
    limitations,
    warnings: presentationWarnings(evaluation, language),
    nextAction: copy.nextAction,
    usedComps,
    notIncludedComps,
    providerEstimate,
    methodology: {
      policyVersion: evaluation.policyVersion,
      methodologyVersion: evaluation.methodologyVersion,
      rangeMethod: evaluation.rangeMethod,
      adjustmentStatus: evaluation.adjustmentStatus,
    },
    diagnostics: {
      medianBasedReference: evaluation.medianBasedReference,
      weightedReference: evaluation.weightedReference,
      medianPricePerSqft: evaluation.medianPricePerSqft,
      weightedPricePerSqft: evaluation.weightedPricePerSqft,
      dispersion: evaluation.dispersion,
      confidenceReasons,
    },
    provenance: {
      recordedSale: evaluation.evidenceSummary?.recordedSale || 'UNAVAILABLE',
      structuralScore: evaluation.evidenceSummary?.structuralScore || 'UNAVAILABLE',
      conditionReview: evaluation.evidenceSummary?.conditionReview || 'UNAVAILABLE',
      arv: evaluation.evidenceSummary?.arv || 'UNAVAILABLE',
      confidence: evaluation.evidenceSummary?.confidence || 'UNAVAILABLE',
      providerAvm: providerEstimate?.evidenceStatus || 'UNAVAILABLE',
    },
  };
}
