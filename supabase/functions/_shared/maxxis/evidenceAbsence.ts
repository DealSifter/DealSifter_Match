/** One public reason vocabulary; internal diagnostics never become user-facing text. */
export const EVIDENCE_ABSENCE_REASONS = ['NOT_REQUESTED', 'NOT_ENTITLED', 'QUOTA_BLOCKED', 'PLAN_GATE',
  'IDENTITY_MISMATCH', 'PROVIDER_ERROR', 'NO_COVERAGE', 'USER_INPUT_REQUIRED'] as const;
export type EvidenceAbsenceReason = typeof EVIDENCE_ABSENCE_REASONS[number];
export function evidenceAbsenceReason(value: unknown, fallback: EvidenceAbsenceReason = 'PROVIDER_ERROR'): EvidenceAbsenceReason {
  const code = typeof value === 'string' ? value.toUpperCase() : '';
  if (EVIDENCE_ABSENCE_REASONS.includes(code as EvidenceAbsenceReason)) return code as EvidenceAbsenceReason;
  if (/CHECK_FAILED|READ_FAILED|STATE_READ_FAILED|EXECUTION_FAILED|PERSISTENCE_FAILED/.test(code)) return 'PROVIDER_ERROR';
  if (/ADDRESS_COHERENCE|ADDRESS_CONFIRMATION|ADDRESS_REQUIRED|INVALID_PROPERTY_LOOKUP|SUBJECT_|UNIT_CONTEXT|REVIEW_|CONDITION|INPUT_|ATTRIBUTES|COORDINATES|UNSUPPORTED.*TYPE|VALUATION_EVIDENCE_CACHE_REQUIRED/.test(code)) return 'USER_INPUT_REQUIRED';
  if (/ADDRESS_MISMATCH|PROPERTY_ADDRESS_CHANGED|CACHE_INVALID|IDENTITY|FINGERPRINT/.test(code)) return 'IDENTITY_MISMATCH';
  if (/ENTITLEMENT|NOT_AUTHORIZED|CAPABILITY_NOT_AUTHORIZED/.test(code)) return 'NOT_ENTITLED';
  if (/BUDGET|MONTHLY_PROVIDER_LIMIT|USAGE_BLOCKED|COOLDOWN|CREDITS|RATE_LIMIT/.test(code)) return 'QUOTA_BLOCKED';
  if (/PLAN_|PROVIDER_DISABLED|PROVIDER_NOT_CONFIGURED|CONFIG_DISABLED|BACKEND_UNAVAILABLE|CACHE_ONLY|FORBIDDEN/.test(code)) return 'PLAN_GATE';
  if (/PROPERTY_NOT_FOUND|NO_RESULT|NO_COVERAGE|DID_NOT_RETURN|INSUFFICIENT_COMPS/.test(code)) return 'NO_COVERAGE';
  if (/NOT_REQUESTED|NOT_QUERIED|NOT_REQUIRED|NOT_APPLICABLE|REPORT_LEVEL_NOT_REQUIRED/.test(code)) return 'NOT_REQUESTED';
  // A cache miss does not prove absence at the source or that no query ran.
  return fallback;
}
const COPY: Record<EvidenceAbsenceReason, [string, string, string]> = {
  NOT_REQUESTED: ['Esta informação não foi consultada. Gere uma nova análise para solicitá-la.', 'This information was not queried. Generate a new analysis to request it.', 'Esta información no fue consultada. Genere un nuevo análisis para solicitarla.'],
  NOT_ENTITLED: ['Seu acesso não inclui esta informação. Habilite o relatório correspondente e tente novamente.', 'Your access does not include this information. Unlock the corresponding report and try again.', 'Su acceso no incluye esta información. Habilite el informe correspondiente e inténtelo de nuevo.'],
  QUOTA_BLOCKED: ['O limite de consultas foi atingido. Use os dados já disponíveis ou aguarde a renovação do limite.', 'The query allowance has been reached. Use available data or wait for the allowance to renew.', 'Se alcanzó el límite de consultas. Use los datos disponibles o espere su renovación.'],
  PLAN_GATE: ['A consulta está desativada ou não está incluída neste acesso. Verifique a disponibilidade com o suporte.', 'The query is disabled or not included in this access. Check availability with support.', 'La consulta está desactivada o no está incluida en este acceso. Consulte la disponibilidad con soporte.'],
  IDENTITY_MISMATCH: ['O endereço não corresponde aos dados encontrados. Revise e confirme o endereço antes de tentar novamente.', 'The address does not match the returned data. Review and confirm the address before trying again.', 'La dirección no coincide con los datos encontrados. Revise y confirme la dirección antes de intentarlo de nuevo.'],
  PROVIDER_ERROR: ['Não foi possível obter ou confirmar esta informação. Tente novamente; se persistir, contate o suporte.', 'This information could not be obtained or confirmed. Try again; contact support if the problem persists.', 'No se pudo obtener o confirmar esta información. Inténtelo de nuevo; contacte con soporte si persiste.'],
  NO_COVERAGE: ['A fonte consultada não retornou dados suficientes. Confira o endereço ou forneça documentação verificável.', 'The queried source did not return sufficient data. Check the address or supply verifiable documentation.', 'La fuente consultada no devolvió datos suficientes. Compruebe la dirección o aporte documentación verificable.'],
  USER_INPUT_REQUIRED: ['Revise e confirme cidade, estado, ZIP Code e características do imóvel para continuar a análise.', 'Review and confirm the city, state, ZIP Code and property details to continue the analysis.', 'Revise y confirme ciudad, estado, ZIP Code y características del inmueble para continuar el análisis.'],
};
export function evidenceAbsenceCopy(reason: EvidenceAbsenceReason, language = 'en'): string {
  return COPY[reason][/^pt/i.test(language) ? 0 : /^es/i.test(language) ? 2 : 1];
}
