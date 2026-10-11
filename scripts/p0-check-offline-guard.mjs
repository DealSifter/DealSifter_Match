import './p0-network-guard.mjs';
import net from 'node:net';
import assert from 'node:assert/strict';

assert.throws(() => net.connect({ host: '127.0.0.1', port: 9 }), /P0_NETWORK_BLOCKED/);
assert.throws(() => new net.Socket().connect([{ host: '127.0.0.1', port: 9 }]), /P0_NETWORK_BLOCKED/);
await assert.rejects(() => fetch('https://example.invalid'), /P0_NETWORK_BLOCKED/);
console.log('P0_OFFLINE_GUARD_PASS: direct TCP, normalized TCP, external fetch blocked');
