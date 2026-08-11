import { handleProviderConversationAnalysisRequest } from '../_shared/maxxis/providerConversationAnalysis.ts';

Deno.serve((req) => handleProviderConversationAnalysisRequest(req));
