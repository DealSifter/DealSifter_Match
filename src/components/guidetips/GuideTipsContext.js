import { createContext } from 'react';

export const GuideTipsContext = createContext({
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
  activeTour: 'feed',
  setActiveTour: () => {},
  stepIndex: 0,
  setStepIndex: () => {},
  startTour: () => {},
  completeTour: () => {},
  mandatory: false,
  cycleCompleted: false,
  onboardingComplete: false,
});
