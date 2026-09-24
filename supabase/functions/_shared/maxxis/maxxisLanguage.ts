import type { MaxxisLanguage } from './types.ts';

export function resolveMaxxisLanguage(message: unknown, preferred: unknown = 'auto'): MaxxisLanguage {
  const selected = String(preferred || 'auto').slice(0, 2).toLowerCase();
  if (selected === 'en' || selected === 'pt' || selected === 'es') return selected;
  const normalized = ` ${String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()} `;
  const portuguese = [' voce ', ' ajuda ', ' imovel ', ' negocio ', ' desbloquear ', ' preciso ']
    .filter((word) => normalized.includes(word)).length;
  const spanish = [' usted ', ' puedes ', ' ayuda ', ' inmueble ', ' propiedad ']
    .filter((word) => normalized.includes(word)).length;
  if (portuguese > spanish && portuguese) return 'pt';
  if (spanish > portuguese && spanish) return 'es';
  return 'en';
}
