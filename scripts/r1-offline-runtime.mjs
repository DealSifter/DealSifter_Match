import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
const deny = () => { throw new Error('R1_NETWORK_FORBIDDEN'); };
globalThis.fetch = deny;
http.request = deny; http.get = deny;
https.request = deny; https.get = deny;
syncBuiltinESMExports();
