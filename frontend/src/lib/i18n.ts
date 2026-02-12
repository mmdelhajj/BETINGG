// i18n configuration for CryptoBet
// Supports 19 languages with lazy loading

export type Locale =
  | 'en' | 'es' | 'de' | 'it' | 'fr' | 'sv' | 'nl' | 'el' | 'hu'
  | 'tr' | 'id' | 'pl' | 'pt' | 'pt-BR' | 'ru' | 'ko' | 'ja' | 'th' | 'vi';

export const LOCALES: { code: Locale; name: string; nativeName: string; rtl?: boolean }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
];

export const DEFAULT_LOCALE: Locale = 'en';

// Translation cache
const translationCache: Partial<Record<Locale, Record<string, string>>> = {};

// Load translations for a locale
export async function loadTranslations(locale: Locale): Promise<Record<string, string>> {
  if (translationCache[locale]) return translationCache[locale]!;

  try {
    const translations = await import(`@/locales/${locale}.json`);
    translationCache[locale] = translations.default || translations;
    return translationCache[locale]!;
  } catch {
    // Fallback to English
    if (locale !== 'en') return loadTranslations('en');
    return {};
  }
}

// Translation function
export function createTranslator(translations: Record<string, string>) {
  return function t(key: string, params?: Record<string, string | number>): string {
    let text = translations[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, String(v));
      });
    }
    return text;
  };
}

// Currency formatting per locale
const CURRENCY_FORMATS: Partial<Record<Locale, { style: string; currency: string }>> = {
  en: { style: 'currency', currency: 'USD' },
  es: { style: 'currency', currency: 'EUR' },
  de: { style: 'currency', currency: 'EUR' },
  fr: { style: 'currency', currency: 'EUR' },
  'pt-BR': { style: 'currency', currency: 'BRL' },
  ja: { style: 'currency', currency: 'JPY' },
  ko: { style: 'currency', currency: 'KRW' },
  th: { style: 'currency', currency: 'THB' },
  vi: { style: 'currency', currency: 'VND' },
  tr: { style: 'currency', currency: 'TRY' },
  ru: { style: 'currency', currency: 'RUB' },
  pl: { style: 'currency', currency: 'PLN' },
  hu: { style: 'currency', currency: 'HUF' },
  sv: { style: 'currency', currency: 'SEK' },
};

export function formatLocalCurrency(amount: number, locale: Locale): string {
  const fmt = CURRENCY_FORMATS[locale] || CURRENCY_FORMATS.en!;
  try {
    return new Intl.NumberFormat(locale, {
      style: fmt.style as any,
      currency: fmt.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatLocalDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Get browser locale
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const browserLang = navigator.language;
  const match = LOCALES.find(l => l.code === browserLang || browserLang.startsWith(l.code));
  return match?.code || DEFAULT_LOCALE;
}
