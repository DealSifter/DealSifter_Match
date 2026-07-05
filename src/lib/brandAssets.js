export function getMobileHeaderLogo(theme) {
  return theme === 'dark' ? '/logo%20tema%20preto.png' : '/logo%20tema%20branco.png';
}

export function getThemeToggleTarget(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
