const METHOD_CONFIG = {
  call: { key: 'call', icon: 'phone' },
  sms: { key: 'sms', icon: 'sms' },
  whatsapp: { key: 'whatsapp', icon: 'whatsapp' },
  telegram: { key: 'telegram', icon: 'telegram' },
  email: { key: 'email', icon: 'email' },
  chat: { key: 'chat', icon: 'chat' },
};

export function normalizeContactMethod(method) {
  const normalized = String(method || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('whatsapp')) return 'whatsapp';
  if (normalized.includes('telegram')) return 'telegram';
  if (normalized.includes('mail')) return 'email';
  if (normalized.includes('chat')) return 'chat';
  if (normalized.includes('sms')) return 'sms';
  if (normalized.includes('call') || normalized.includes('phone')) return 'call';
  return null;
}

function buildMethodValueMap(source, fallbackSource) {
  const primaryPhone =
    source?.primaryPhone ||
    source?.phone ||
    fallbackSource?.primaryPhone ||
    fallbackSource?.phone ||
    '';
  const secondaryPhone =
    source?.secondaryPhone ||
    source?.whatsapp ||
    fallbackSource?.secondaryPhone ||
    fallbackSource?.whatsapp ||
    primaryPhone ||
    '';
  const tertiaryPhone =
    source?.tertiaryPhone ||
    fallbackSource?.tertiaryPhone ||
    secondaryPhone ||
    '';
  const email =
    source?.email ||
    fallbackSource?.email ||
    '';

  return {
    call: primaryPhone,
    sms: primaryPhone,
    whatsapp: secondaryPhone,
    telegram: tertiaryPhone,
    email,
    chat: '',
  };
}

function buildMethodRows(source, fallbackSource, labels) {
  const methods = Array.isArray(source?.contactMethods) && source.contactMethods.length
    ? source.contactMethods
    : Array.isArray(fallbackSource?.contactMethods)
      ? fallbackSource.contactMethods
      : [];
  const values = buildMethodValueMap(source, fallbackSource);
  const usedPairs = new Set();

  return methods.reduce((acc, method, index) => {
    const normalized = normalizeContactMethod(method);
    const config = METHOD_CONFIG[normalized];
    const val = values[normalized];
    if (!config || !val) return acc;
    const pairKey = `${normalized}:${val}`;
    if (usedPairs.has(pairKey)) return acc;
    usedPairs.add(pairKey);
    acc.push({
      key: `${normalized}-${index + 1}`,
      icon: config.icon,
      label: labels[normalized] || method,
      val,
      priority: index + 1,
    });
    return acc;
  }, []);
}

function buildFallbackRows(source, fallbackSource, labels) {
  const values = buildMethodValueMap(source, fallbackSource);
  return [
    { key: 'call-1', icon: 'phone', label: labels.call, val: values.call, priority: values.call ? 1 : null },
    { key: 'whatsapp-2', icon: 'whatsapp', label: labels.whatsapp, val: values.whatsapp, priority: values.whatsapp ? 2 : null },
    { key: 'email-3', icon: 'email', label: labels.email, val: values.email, priority: values.email ? 3 : null },
  ].filter((contact) => contact.val);
}

export function buildDisplayContacts(source, fallbackSource, labels) {
  const prioritizedRows = buildMethodRows(source, fallbackSource, labels);
  if (prioritizedRows.length) return prioritizedRows;
  return buildFallbackRows(source, fallbackSource, labels);
}
