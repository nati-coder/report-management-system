import { useCallback, useState } from 'react';

/** Reads the class the pre-paint script in index.html already applied, so there's no mismatch on first render. */
export default function useTheme() {
  const [theme, setThemeState] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

  const setTheme = useCallback((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('rms_theme', next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return { theme, setTheme, toggle };
}
