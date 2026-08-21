import { handleProviderMessageDraftRequest } from '../_shared/maxxis/providerMessageDraft.ts';

Deno.serve((req) => handleProviderMessageDraftRequest(req));
