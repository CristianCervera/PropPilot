import { formatDate, registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localeEs from '@angular/common/locales/es';
import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { en } from './i18n/en';
import { es } from './i18n/es';

export type Lang = 'es' | 'en';
export type TKey = keyof typeof es;
export type TParams = Record<string, string | number | null | undefined>;

export const LANGS: Lang[] = ['es', 'en'];
const DICTS: Record<Lang, Record<TKey, string>> = { es, en };
const LOCALES: Record<Lang, string> = { es: 'es-ES', en: 'en-GB' };
const STORAGE_KEY = 'proppilot.lang';

registerLocaleData(localeEs, 'es-ES');
registerLocaleData(localeEnGb, 'en-GB');

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage unavailable: fall back to the browser language.
  }
  return globalThis.navigator?.language?.toLowerCase().startsWith('es') === false ? 'en' : 'es';
}

/** Module-level so plain helpers (formatters, labels) can read it reactively too. */
const lang = signal<Lang>(initialLang());

export const currentLang = lang.asReadonly();
export const currentLocale = computed(() => LOCALES[lang()]);

/**
 * Looks up a message and fills `{name}` placeholders. A message written as
 * `singular|plural` picks a form from the `n` param.
 */
export function translate(key: TKey, params?: TParams): string {
  let msg: string = DICTS[lang()][key] ?? key;
  if (msg.includes('|') && params?.['n'] != null) {
    const [one, other] = msg.split('|');
    msg = Number(params['n']) === 1 ? one : other;
  }
  return params ? msg.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : msg;
}

/** Translates a dynamic key (e.g. `status.${value}`), falling back to `fallback`. */
export function translateOr(key: string, fallback: string): string {
  return key in es ? translate(key as TKey) : fallback;
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = currentLang;
  readonly locale = currentLocale;
  readonly t = translate;

  constructor() {
    effect(() => {
      const value = lang();
      document.documentElement.lang = value;
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // ignore
      }
    });
  }

  set(value: Lang) {
    lang.set(value);
  }
}

/** `{{ 'nav.home' | t }}` / `{{ 'props.count' | t: { n: total } }}`. Impure so it
 * follows language switches (the lookup is a cheap map access). */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(key: TKey, params?: TParams): string {
    return translate(key, params);
  }
}

/** Dynamic keys built in templates (`'verdict.' + v.verdict | td`); falls back to the last segment. */
@Pipe({ name: 'td', pure: false })
export class TDynPipe implements PipeTransform {
  transform(key: string, params?: TParams): string {
    return key in es ? translate(key as TKey, params) : key.slice(key.lastIndexOf('.') + 1);
  }
}

/** Angular date formats in the current language. Formats are written the
 * Spanish way (`d 'de' MMMM`); the literal `de` is dropped in English. */
export function formatDateLocal(value: string | number | Date, format: string): string {
  const fmt = lang() === 'en' ? format.replace(/'de' /g, '') : format;
  return formatDate(value, fmt, currentLocale());
}

@Pipe({ name: 'd', pure: false })
export class DatePipeI18n implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format: string): string {
    return value == null ? '' : formatDateLocal(value, format);
  }
}

/** Route titles are translation keys; re-applied when the language changes. */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private snapshot?: RouterStateSnapshot;

  constructor() {
    super();
    effect(() => {
      lang();
      if (this.snapshot) this.updateTitle(this.snapshot);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot) {
    this.snapshot = snapshot;
    const key = this.buildTitle(snapshot) as TKey | undefined;
    this.title.setTitle(key ? `${translate(key)} · PropPilot` : 'PropPilot');
  }
}
