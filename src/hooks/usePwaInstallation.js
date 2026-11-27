import { useCallback, useEffect, useRef, useState } from 'react';
import { canOfferInstallation, requestAppInstallation } from '../lib/pwaInstallation';

/** @param {(notice: {type: string, title: string, message: string, duration: number}) => void} addToast @param {string} language */
export function usePwaInstallation(addToast, language) {
  const [prompt, setPrompt] = useState(/** @type {import('../lib/pwaInstallation').DeferredInstallPrompt|null} */ (null));
  const [showInstallAppButton, setVisible] = useState(false);
  const installed = useRef(false);
  const installing = useRef(false);
  useEffect(() => {
    const update = () => setVisible(!installed.current && canOfferInstallation(window));
    /** @param {Event} event */
    const onPrompt = (event) => {
      event.preventDefault();
      if (canOfferInstallation(window)) setPrompt(/** @type {Event & import('../lib/pwaInstallation').DeferredInstallPrompt} */ (event));
      update();
    };
    const onInstalled = () => { installed.current = true; setPrompt(null); setVisible(false); };
    const displayMode = window.matchMedia?.('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode?.addEventListener?.('change', update);
    update();
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode?.removeEventListener?.('change', update);
    };
  }, []);
  const handleInstallApp = useCallback(async () => {
    if (installing.current) return;
    installing.current = true;
    // A legacy prompt is single-use, including while its result is pending.
    setPrompt(null);
    try {
      const result = await requestAppInstallation(window, prompt,
        ({ title, message }) => addToast({ type: 'info', title, message, duration: 6500 }), language);
      if (result === 'accepted' || result === 'installed') { installed.current = true; setVisible(false); }
    } finally { installing.current = false; }
  }, [prompt, addToast, language]);
  return { showInstallAppButton, handleInstallApp };
}
