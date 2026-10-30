/** Request-scoped transport telemetry. Contains no address, user or provider payload. */
export type ProviderExecution = { providerCalls: number; recorded: boolean; phase: 'BEFORE_HTTP' | 'HTTP_STARTED' | 'HTTP_COMPLETED' };
export const createProviderExecution = (): ProviderExecution => ({ providerCalls: 0, recorded: false, phase: 'BEFORE_HTTP' });
export function trackedProviderFetch(execution: ProviderExecution, transport: typeof fetch = fetch): typeof fetch {
  execution.recorded = true;
  return async (input, init) => {
    execution.providerCalls += 1;
    execution.phase = 'HTTP_STARTED';
    const response = await transport(input, init);
    execution.phase = 'HTTP_COMPLETED';
    return response;
  };
}

