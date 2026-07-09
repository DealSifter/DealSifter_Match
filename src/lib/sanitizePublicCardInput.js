import { SENSITIVE_FIELDS } from './sensitiveFields';

const sensitiveFieldSet = new Set(SENSITIVE_FIELDS);

export function sanitizePublicCardInput(rawInput) {
  if (Array.isArray(rawInput)) {
    return rawInput.map((item) => sanitizePublicCardInput(item));
  }
  if (!rawInput || typeof rawInput !== 'object') return rawInput;

  return Object.entries(rawInput).reduce((sanitized, [key, value]) => {
    if (sensitiveFieldSet.has(key)) return sanitized;
    sanitized[key] = sanitizePublicCardInput(value);
    return sanitized;
  }, {});
}
