import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

// Test-only preload: block TCP, retain named-pipe IPC used by worker processes.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let address = args[0];
  // Node's net.connect normalizes arguments into an array before Socket.connect.
  while (Array.isArray(address)) address = address[0];
  if (typeof address === 'number' || (address && typeof address === 'object' && 'port' in address)
    || (typeof address === 'string' && /^\d+$/.test(address))) throw new Error('P0_NETWORK_BLOCKED');
  return connect.apply(this, args);
};
syncBuiltinESMExports();
globalThis.fetch = async () => { throw new Error('P0_NETWORK_BLOCKED: mock external HTTP in deterministic tests'); };
