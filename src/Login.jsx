import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import LangSwitch from './LangSwitch';

const AVATARS = ['🂡', '🃁', '🃑', '🂱', '🎴', '🀄'];

export default function Login() {
  const { register, login } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) throw new Error(t('errEnterName'));
        await register(email, password, name.trim(), avatar);
      }
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <LangSwitch className="lang-switch-top" />
      <h1 className="brand">{t('brand')}</h1>
      <p className="brand-sub">{t('brandSub')}</p>

      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
          {t('tabLogin')}
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
          {t('tabRegister')}
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <input placeholder={t('yourName')} value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="avatar-picker">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`avatar-choice ${avatar === a ? 'chosen' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>
          {mode === 'login' ? t('btnLogin') : t('btnCreateAccount')}
        </button>
      </form>
    </div>
  );
}

function translateError(err, t) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return t('errEmailInUse');
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return t('errWrongCreds');
  if (code.includes('weak-password')) return t('errWeakPassword');
  if (code.includes('user-not-found')) return t('errUserNotFound');
  return err.message || t('errGeneric');
}
