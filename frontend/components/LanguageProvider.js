'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { translations } from '@/data/translations';

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
