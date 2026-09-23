"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, localeMeta, locales, type DictKey, type Locale } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "edu-air:locale";

function isLocale(value: string | null): value is Locale {
  return !!value && (locales as string[]).includes(value);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // starts at "fr" to match the server-rendered HTML exactly (avoids a text
  // hydration mismatch), then corrects to the stored locale right after
  // mount — a deliberate, one-time client-only read of localStorage.
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the useState call
      if (isLocale(stored) && stored !== locale) setLocaleState(stored);
    } catch {
      // localStorage unavailable (private mode, etc.) — keep default locale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dir = localeMeta[locale].dir;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failure — locale still applies for this session
    }
  }, []);

  const t = useCallback(
    (key: DictKey) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key,
    [locale],
  );

  const value = useMemo(() => ({ locale, dir, setLocale, t }), [locale, dir, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
