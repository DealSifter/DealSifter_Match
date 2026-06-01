import { useCallback, useRef, useState } from 'react';

export function useProfileSync({ addToast, markLocalWrite } = {}) {
  const profileSaveDebounceRef = useRef({ personal: null, professional: null, services: null, properties: null });
  const pendingFlushRef = useRef({ personal: null, professional: null, services: null, properties: null });
  const profileSyncPendingRef = useRef(0);
  const syncErrorThrottleRef = useRef(0);
  const [profileSyncStatus, setProfileSyncStatus] = useState('idle');

  const beginProfileSync = useCallback(() => {
    markLocalWrite?.();
    profileSyncPendingRef.current += 1;
    setProfileSyncStatus('syncing');
  }, [markLocalWrite]);

  const endProfileSync = useCallback((withError = false) => {
    profileSyncPendingRef.current = Math.max(0, profileSyncPendingRef.current - 1);
    if (withError) {
      setProfileSyncStatus('error');
      const now = Date.now();
      if (now - syncErrorThrottleRef.current > 30000) {
        syncErrorThrottleRef.current = now;
        addToast?.({
          type: 'error',
          title: 'Falha na sincronizacao',
          message: 'Seus dados locais estao salvos, mas houve um erro ao sincronizar com o servidor. Tentaremos novamente.',
        });
      }
      return;
    }
    if (profileSyncPendingRef.current === 0) {
      setProfileSyncStatus('synced');
    }
  }, [addToast]);

  const clearProfileSaveDebounces = useCallback((keys = ['personal', 'professional', 'services', 'properties']) => {
    keys.forEach((key) => {
      if (profileSaveDebounceRef.current[key]) {
        clearTimeout(profileSaveDebounceRef.current[key]);
        profileSaveDebounceRef.current[key] = null;
      }
    });
  }, []);

  const resetProfileSync = useCallback(() => {
    profileSyncPendingRef.current = 0;
    setProfileSyncStatus('idle');
    clearProfileSaveDebounces();
  }, [clearProfileSaveDebounces]);

  return {
    profileSaveDebounceRef,
    pendingFlushRef,
    profileSyncPendingRef,
    profileSyncStatus,
    beginProfileSync,
    endProfileSync,
    clearProfileSaveDebounces,
    resetProfileSync,
  };
}
