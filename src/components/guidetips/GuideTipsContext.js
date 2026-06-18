import { createContext } from 'react';

export const GuideTipsContext = createContext({
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
});
