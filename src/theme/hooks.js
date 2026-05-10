import { useContext } from 'react';
import ThemeContext from './context';
import { C } from './colors';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const useC = () => {
  useTheme(); // subscribe to theme changes
  return C;
};

export const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
