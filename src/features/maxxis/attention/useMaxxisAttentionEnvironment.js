import { useEffect, useState } from 'react';
import { MAXXIS_ATTENTION_DEFAULTS } from './maxxisAttentionRules';

function isEditableElement(element) {
  if (!element || typeof element.matches !== 'function') return false;
  return element.matches('input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]');
}

function readMobileEnvironment() {
  if (typeof window === 'undefined') return { mobileKeyboardOpen: false, mobileViewportCongested: false };
  const viewport = window.visualViewport;
  const mobile = window.matchMedia?.('(max-width: 768px)')?.matches || window.innerWidth <= 768;
  const focusedEditable = isEditableElement(document.activeElement);
  const viewportHeight = Number(viewport?.height || window.innerHeight || 0);
  const keyboardGap = Math.max(0, Number(window.innerHeight || 0) - viewportHeight);
  const mobileKeyboardOpen = Boolean(mobile && focusedEditable && keyboardGap >= 120);
  return {
    mobileKeyboardOpen,
    mobileViewportCongested: Boolean(mobile && (mobileKeyboardOpen || viewportHeight < 500)),
  };
}

function hasExternalCriticalModal() {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
    .some((element) => !element.closest('.maxxis-panel'));
}

export function useMaxxisAttentionEnvironment({ routeKey = '', devOverrides = null } = {}) {
  const normalizedRouteKey = String(routeKey || '');
  const [settledRouteKey, setSettledRouteKey] = useState(normalizedRouteKey);
  const [environment, setEnvironment] = useState(() => ({
    userTyping: false,
    externalCriticalModalOpen: hasExternalCriticalModal(),
    ...readMobileEnvironment(),
  }));

  useEffect(() => {
    const updateFocus = () => {
      const active = document.activeElement;
      setEnvironment((current) => ({
        ...current,
        userTyping: Boolean(isEditableElement(active) && !active?.closest?.('.maxxis-panel')),
        ...readMobileEnvironment(),
      }));
    };
    const updateViewport = () => setEnvironment((current) => ({ ...current, ...readMobileEnvironment() }));
    const updateModal = () => setEnvironment((current) => {
      const externalCriticalModalOpen = hasExternalCriticalModal();
      return current.externalCriticalModalOpen === externalCriticalModalOpen
        ? current
        : { ...current, externalCriticalModalOpen };
    });
    const modalObserver = new MutationObserver(updateModal);
    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });
    document.addEventListener('focusin', updateFocus);
    document.addEventListener('focusout', updateFocus);
    window.visualViewport?.addEventListener?.('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      document.removeEventListener('focusin', updateFocus);
      document.removeEventListener('focusout', updateFocus);
      window.visualViewport?.removeEventListener?.('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      modalObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (settledRouteKey === normalizedRouteKey) return undefined;
    const timer = window.setTimeout(() => {
      setSettledRouteKey(normalizedRouteKey);
    }, MAXXIS_ATTENTION_DEFAULTS.navigationQuietMs);
    return () => window.clearTimeout(timer);
  }, [normalizedRouteKey, settledRouteKey]);

  return Object.freeze({
    ...environment,
    navigationTransition: settledRouteKey !== normalizedRouteKey,
    ...(devOverrides || {}),
  });
}
