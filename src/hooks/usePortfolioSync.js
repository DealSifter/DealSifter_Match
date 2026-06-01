import { useCallback, useRef, useState } from 'react';

const createInitialPortfolioSyncState = () => ({
  userId: null,
  loaded: false,
  hydrating: false,
  servicesLoadedFromRemote: false,
  propertiesLoadedFromRemote: false,
  propertyImagesLoadedFromRemote: false,
});

export function usePortfolioSync() {
  const portfolioSyncStateRef = useRef(createInitialPortfolioSyncState());
  const portfolioHydrationRetryRef = useRef({ timer: null, attempts: 0 });
  const [isHydratingPortfolio, setIsHydratingPortfolio] = useState(false);
  const [portfolioHydrationCycle, setPortfolioHydrationCycle] = useState(0);

  const clearPortfolioHydrationRetry = useCallback(() => {
    if (portfolioHydrationRetryRef.current.timer) {
      clearTimeout(portfolioHydrationRetryRef.current.timer);
      portfolioHydrationRetryRef.current.timer = null;
    }
  }, []);

  const refreshPortfolioHydration = useCallback(() => {
    setPortfolioHydrationCycle((prev) => prev + 1);
  }, []);

  const resetPortfolioSync = useCallback(() => {
    portfolioSyncStateRef.current = createInitialPortfolioSyncState();
    clearPortfolioHydrationRetry();
    portfolioHydrationRetryRef.current.attempts = 0;
    setIsHydratingPortfolio(false);
  }, [clearPortfolioHydrationRetry]);

  return {
    portfolioSyncStateRef,
    portfolioHydrationRetryRef,
    isHydratingPortfolio,
    setIsHydratingPortfolio,
    portfolioHydrationCycle,
    refreshPortfolioHydration,
    clearPortfolioHydrationRetry,
    resetPortfolioSync,
  };
}
