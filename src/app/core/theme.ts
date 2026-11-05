import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'proppilot.theme';
// Matches --color-ink-950 of each theme, for the browser chrome.
const THEME_COLOR: Record<Theme, string> = { dark: '#0b0818', light: '#f5f3fb' };

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Storage unavailable: fall back to the OS preference.
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Light/dark theme. The palette lives in styles.css, keyed on `<html data-theme>`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    effect(() => {
      const value = this.theme();
      document.documentElement.dataset['theme'] = value;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[value]);
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // ignore
      }
    });
  }

  toggle() {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
