'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { translations as coreT } from '@/data/translations';
import { translations as cmsT } from '@/data/translations.cms';
import { translations as authT } from '@/data/translations.auth';
import { translations as dashboardT } from '@/data/translations.dashboard';
import { translations as marketplaceT } from '@/data/translations.marketplace';
import { translations as bookingT } from '@/data/translations.booking';
import { translations as landingT } from '@/data/translations.landing';

// Merge the core dictionary with the per-area dictionaries into one lookup table.
const translations = {
  en: {
    ...coreT.en,
    ...cmsT.en,
    ...authT.en,
    ...dashboardT.en,
    ...marketplaceT.en,
    ...bookingT.en,
    ...landingT.en,
  },
  hi: {
    ...coreT.hi,
    ...cmsT.hi,
    ...authT.hi,
    ...dashboardT.hi,
    ...marketplaceT.hi,
    ...bookingT.hi,
    ...landingT.hi,
  },
};

const STORAGE_KEY = 'profirmo_lang';
const SUPPORTED = ['en', 'hi'];

const LanguageContext = createContext(null);

function lookup(lang, key, vars) {
  const dict = translations[lang] || translations.en;
  let str = dict[key];
  if (str === undefined) str = translations.en[key];
  if (str === undefined) return key;
  if (vars) {
    Object.keys(vars).forEach((name) => {
      str = str.split(`{${name}}`).join(String(vars[name]));
    });
  }
  return str;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  // Hydrate the saved language after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.includes(saved)) setLangState(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Keep <html lang> in sync.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    const value = SUPPORTED.includes(next) ? next : 'en';
    setLangState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((cur) => {
      const next = cur === 'en' ? 'hi' : 'en';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useCallback((key, vars) => lookup(lang, key, vars), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Safe even if used outside the provider (falls back to English).
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    lang: 'en',
    setLang: () => {},
    toggleLang: () => {},
    t: (key, vars) => lookup('en', key, vars),
  };
}
