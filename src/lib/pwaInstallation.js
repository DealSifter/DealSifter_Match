export const CANONICAL_APP_ORIGIN = 'https://dealsifter.com';
const PUBLIC_ALIASES = new Set(['www.dealsifter.com', 'dealsiftermatch.vercel.app']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @typedef {{location: Pick<Location, 'href'|'assign'>, navigator: Partial<Navigator> & {standalone?: boolean}, matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>}} InstallationWindow */
/** @typedef {{title: string, message: string, unavailable?: string}} InstallationNotice */
/** @typedef {{prompt: () => Promise<unknown>, userChoice: Promise<{outcome?: string}>}} DeferredInstallPrompt */

/** @param {string} href @returns {{kind: 'canonical'}|{kind: 'unavailable'}|{kind: 'redirect', url: string}} */
export function installationTarget(href) {
  let url;
  try { url = new URL(href); } catch { return { kind: 'unavailable' }; }
  if (url.origin === CANONICAL_APP_ORIGIN) return { kind: 'canonical' };
  if (url.protocol !== 'https:' || !PUBLIC_ALIASES.has(url.hostname)) return { kind: 'unavailable' };
  // Carry only known public context; never transfer OAuth fragments, codes or tokens.
  const target = new URL(CANONICAL_APP_ORIGIN);
  if (/^\/(privacy|terms|pricing)\/?$/.test(url.pathname)) target.pathname = url.pathname;
  for (const key of ['property', 'propertyId', 'service', 'serviceId', 'profile', 'profileId']) {
    const value = url.searchParams.get(key);
    if (value && UUID.test(value)) target.searchParams.set(key, value);
  }
  const lang = url.searchParams.get('lang');
  if (lang && ['en', 'pt', 'es'].includes(lang)) target.searchParams.set('lang', lang);
  return { kind: 'redirect', url: target.href };
}

/** @param {InstallationWindow} windowObject */
export function isStandalone(windowObject) {
  return Boolean(windowObject.navigator?.standalone || windowObject.matchMedia?.('(display-mode: standalone)')?.matches);
}

/** @param {InstallationWindow} windowObject */
export function canOfferInstallation(windowObject) {
  return !isStandalone(windowObject) && installationTarget(windowObject.location.href).kind !== 'unavailable';
}

/** @param {Partial<Navigator>} navigatorObject @param {string} language */
export function installationInstructions(navigatorObject, language = 'en') {
  const ua = String(navigatorObject?.userAgent || '');
  const ios = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigatorObject?.maxTouchPoints ?? 0) > 1);
  const kind = ios ? (/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua) ? 'iosOther' : 'ios')
    : /Android/i.test(ua) ? 'android'
      : /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua) ? 'safari' : 'desktop';
  const lang = language.startsWith('pt') ? 'pt' : language.startsWith('es') ? 'es' : 'en';
  const copy = {
    en: { title: 'Add to Home Screen', ios: 'In Safari: Share > Add to Home Screen.', iosOther: 'Open dealsifter.com in Safari, then Share > Add to Home Screen.', android: 'In your browser menu, choose Install app or Add to Home screen, if available.', safari: 'In Safari on Mac: File > Add to Dock, if available.', desktop: 'Use the install icon in the address bar or Install app in your browser menu, if available.', unavailable: 'App installation is available at dealsifter.com. Preview pages remain independent.' },
    pt: { title: 'Adicionar à Tela', ios: 'No Safari: Compartilhar > Adicionar à Tela de Início.', iosOther: 'Abra dealsifter.com no Safari e use Compartilhar > Adicionar à Tela de Início.', android: 'No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial, se disponível.', safari: 'No Safari do Mac: Arquivo > Adicionar ao Dock, se disponível.', desktop: 'Use o ícone de instalação na barra de endereço ou Instalar aplicativo no menu do navegador, se disponível.', unavailable: 'A instalação do aplicativo está disponível em dealsifter.com. As páginas de Preview permanecem independentes.' },
    es: { title: 'Añadir a la pantalla de inicio', ios: 'En Safari: Compartir > Añadir a la pantalla de inicio.', iosOther: 'Abre dealsifter.com en Safari y usa Compartir > Añadir a la pantalla de inicio.', android: 'En el menú del navegador, elige Instalar aplicación o Añadir a la pantalla de inicio, si está disponible.', safari: 'En Safari para Mac: Archivo > Añadir al Dock, si está disponible.', desktop: 'Usa el icono de instalación de la barra de direcciones o Instalar aplicación en el menú del navegador, si está disponible.', unavailable: 'La instalación está disponible en dealsifter.com. Las páginas de Preview permanecen independientes.' },
  }[lang];
  return { title: copy.title, message: copy[kind], unavailable: copy.unavailable };
}

/** @param {InstallationWindow} windowObject @param {DeferredInstallPrompt|null} deferredPrompt @param {(notice: InstallationNotice) => void} notify @param {string} language */
export async function requestAppInstallation(windowObject, deferredPrompt, notify, language) {
  const target = installationTarget(windowObject.location.href);
  if (target.kind === 'redirect') {
    windowObject.location.assign(target.url);
    return 'redirected';
  }
  if (isStandalone(windowObject)) return 'installed';
  const instructions = installationInstructions(windowObject.navigator, language);
  if (target.kind === 'unavailable') {
    notify({ ...instructions, message: instructions.unavailable });
    return 'unavailable';
  }
  if (deferredPrompt) {
    try {
      // Call during the click gesture; do not await any work before prompt().
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch { /* A used/unsupported prompt falls back to browser instructions. */ }
  }
  notify(instructions);
  return 'manual';
}
