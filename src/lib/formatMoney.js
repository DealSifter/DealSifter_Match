export function formatCompactUsd(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    const label = Number.isInteger(billions) ? String(billions) : billions.toFixed(1).replace(/\.0$/, '');
    return `${sign}$${label}B`;
  }

  if (abs >= 1_000_000 && abs % 1_000_000 === 0) {
    return `${sign}$${(abs / 1_000_000).toLocaleString('en-US')}M`;
  }

  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000).toLocaleString('en-US')}K`;
  }

  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatUsd(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
