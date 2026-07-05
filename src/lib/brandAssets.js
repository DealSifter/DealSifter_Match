import mobileLightLogo from '../assets/logo-light-theme.jpg';
import mobileDarkLogo from '../assets/logo-dark-theme.jpg';

export function getMobileHeaderLogo(theme) {
  return theme === 'dark' ? mobileDarkLogo : mobileLightLogo;
}

export function getThemeToggleTarget(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
