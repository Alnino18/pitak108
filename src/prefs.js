export const THEMES = ['green', 'red', 'blue', 'dark'];
export const CARD_BACKS = ['classic', 'diamond', 'stripes'];

export function getTheme() {
  try {
    const v = localStorage.getItem('theme');
    if (THEMES.includes(v)) return v;
  } catch (e) {}
  return 'green';
}

export function setTheme(theme) {
  try { localStorage.setItem('theme', theme); } catch (e) {}
  applyTheme(theme);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function getCardBack() {
  try {
    const v = localStorage.getItem('cardBack');
    if (CARD_BACKS.includes(v)) return v;
  } catch (e) {}
  return 'classic';
}

export function setCardBack(back) {
  try { localStorage.setItem('cardBack', back); } catch (e) {}
}
