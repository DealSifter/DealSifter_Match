import { handleProviderMessageSendRequest } from '../_shared/maxxis/providerMessageSend.ts';

Deno.serve((req) => handleProviderMessageSendRequest(req, 'cancel'));
