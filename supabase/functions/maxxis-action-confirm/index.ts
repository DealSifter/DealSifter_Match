import { handleProfileActionRequest } from '../_shared/maxxis/profileActionHandler.ts';

Deno.serve((req) => handleProfileActionRequest(req, 'confirm'));
