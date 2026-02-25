import { createContext, useContext, useState } from 'react';
import ru from '../lang/ru';
import tj from '../lang/tj';

const DICTS = { ru, tj };

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('dental_lang') || 'ru';
  });

  function switchLang(l) {
    setLang(l);
    localStorage.setItem('dental_lang', l);
  }

  function t(key) {
    const dict = DICTS[lang] || ru;
    return dict[key] !== undefined ? dict[key] : (ru[key] !== undefined ? ru[key] : key);
  }

  return (
    <LangContext.Provider value={{ lang, switchLang, t, dict: DICTS[lang] || ru }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
