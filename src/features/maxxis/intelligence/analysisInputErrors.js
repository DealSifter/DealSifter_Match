const messages = {
  GAP_CONTEXT_CAPACITY_EXCEEDED: {
    en: 'This analysis context has reached its storage limit. Your previous data was preserved. Reduce the information added or contact support.',
    pt: 'O contexto desta análise atingiu o limite de armazenamento. Seus dados anteriores foram preservados. Reduza as informações adicionadas ou entre em contato com o suporte.',
    es: 'El contexto de este análisis alcanzó el límite de almacenamiento. Sus datos anteriores se conservaron. Reduzca la información añadida o contacte con soporte.',
  },
  ANALYSIS_REVISION_CONFLICT: {
    en: 'Another session changed the scenario. Reload its context before confirming again.',
    pt: 'Outra sessão alterou o cenário. Recarregue o contexto antes de confirmar novamente.',
    es: 'Otra sesión modificó el escenario. Recargue el contexto antes de confirmar de nuevo.',
  },
  GAP_RESOLUTION_VALIDATION_ERROR: {
    en: 'Review the supplied values before confirming again.',
    pt: 'Revise os valores informados antes de confirmar novamente.',
    es: 'Revise los valores introducidos antes de confirmar de nuevo.',
  },
  AUTH_REQUIRED: {
    en: 'Your session could not be authenticated. Sign in again before continuing.',
    pt: 'Não foi possível autenticar sua sessão. Entre novamente antes de continuar.',
    es: 'No se pudo autenticar su sesión. Inicie sesión de nuevo antes de continuar.',
  },
  GAP_RESOLUTION_ACCESS_DENIED: {
    en: 'Your account does not have permission to save this analysis context.',
    pt: 'Sua conta não tem permissão para salvar o contexto desta análise.',
    es: 'Su cuenta no tiene permiso para guardar el contexto de este análisis.',
  },
  ANALYSIS_INPUT_NETWORK_ERROR: {
    en: 'Saving could not be confirmed because of a connection issue. Check your connection and reload the context before retrying.',
    pt: 'Uma falha de conexão impediu confirmar o salvamento. Confira sua conexão e recarregue o contexto antes de tentar novamente.',
    es: 'Un problema de conexión impidió confirmar el guardado. Revise su conexión y recargue el contexto antes de reintentar.',
  },
};

export function analysisInputErrorMessage(error, language, fallback) {
  const message = messages[error?.code || error?.message];
  return message ? message[language] || message.en : fallback;
}
