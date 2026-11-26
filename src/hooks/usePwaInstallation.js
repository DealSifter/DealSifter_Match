import { useCallback, useEffect, useRef, useState } from 'react';
import { canOfferInstallation, requestAppInstallation } from '../lib/pwaInstallation';

export function usePwaInstallation(addToast, language) {
  const [prompt, setPrompt] = useState(null);
  const [showInstallAppButton, setVisible] = useState(false);
  const installed = useRef(false);
  useEffect(() => {
    const update = () => setVisible(!installed.current && canOfferInstallation(window));
    const onPrompt = (event) => {
      event.preventDefault();
      if (canOfferInstallation(window)) setPrompt(event);
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
    const result = await requestAppInstallation(window, prompt,
      ({ title, message }) => addToast({ type: 'info', title, message, duration: 6500 }), language);
    setPrompt(null);
    if (result === 'accepted' || result === 'installed') { installed.current = true; setVisible(false); }
  }, [prompt, addToast, language]);
  return { showInstallAppButton, handleInstallApp };
}
