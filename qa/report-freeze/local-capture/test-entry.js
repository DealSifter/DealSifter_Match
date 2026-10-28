// Only copied into an isolated test extension; NOT included in the installable extension.
import { startCapture } from './background.js';
globalThis.__testStartCapture = startCapture;
