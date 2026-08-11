import { handleProviderContactUnlockRequest } from '../_shared/maxxis/providerContactUnlock.ts';

Deno.serve((req) => handleProviderContactUnlockRequest(req, 'cancel'));
