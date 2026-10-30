import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

/** Parsing proposes a value; only the user's explicit confirmation permits a write. */
export function confirmParsedAnalysisInputs(values, language = 'en', confirm = globalThis.window?.confirm?.bind(globalThis.window)) {
  const copy = language === 'pt' ? ['Entendi os seguintes valores:', 'Confirma gravar estas informações?']
    : language === 'es' ? ['Entendí los siguientes valores:', '¿Confirmas guardar esta información?']
      : ['I understood these values:', 'Confirm saving this information?'];
  const labels = { targetCondition: language === 'pt' ? 'Condição-alvo' : language === 'es' ? 'Condición objetivo' : 'Target condition',
    rehabBudget: language === 'pt' ? 'Orçamento de reforma (USD)' : language === 'es' ? 'Rehabilitación (USD)' : 'Rehab budget (USD)' };
  const flat = { ...values, ...values?.dealAssumptions }; delete flat.dealAssumptions;
  const echo = Object.entries(flat).map(([key, value]) => `${labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${typeof value === 'string' ? localizeMaxxisValue(value, language) : JSON.stringify(value)}`).join('\n');
  return Boolean(echo && typeof confirm === 'function' && confirm(`${copy[0]}\n\n${echo}\n\n${copy[1]}`) === true);
}

export async function persistConfirmedAnalysisInputs(values, language, persist, confirm) {
  if (!confirmParsedAnalysisInputs(values, language, confirm)) return false;
  await persist();
  return true;
}
