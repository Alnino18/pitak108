import { createContext, useContext, useState } from 'react';
import { translate } from './i18n';

const LangContext = createContext(null);

function getInitialLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ru' || saved === 'uz') return saved;
  } catch (e) {
    // localStorage недоступен (приватный режим и т.п.) — используем язык по умолчанию
  }
  return 'ru';
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  function setLang(next) {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch (e) {
      // игнорируем — не критично
    }
  }

  function t(key) {
    return translate(lang, key);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
