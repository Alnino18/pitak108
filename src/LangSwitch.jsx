import { useLang } from './LangContext';

export default function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className}`}>
      <button
        className={lang === 'ru' ? 'active' : ''}
        onClick={() => setLang('ru')}
        type="button"
      >
        РУ
      </button>
      <button
        className={lang === 'uz' ? 'active' : ''}
        onClick={() => setLang('uz')}
        type="button"
      >
        ЎЗ
      </button>
    </div>
  );
}
