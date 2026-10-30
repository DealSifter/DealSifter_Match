import { beforeEach, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
// Fail closed: tests supply their own in-memory transports. No live providers,
// map services, telemetry or database connections are allowed by this suite.
const deny = () => { throw new Error('R1_NETWORK_FORBIDDEN'); };
vi.spyOn(http, 'request').mockImplementation(deny);
vi.spyOn(http, 'get').mockImplementation(deny);
vi.spyOn(https, 'request').mockImplementation(deny);
vi.spyOn(https, 'get').mockImplementation(deny);
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(deny)); });
