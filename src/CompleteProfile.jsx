import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import LangSwitch from './LangSwitch';

const AVATARS = ['🂡', '🃁', '🃑', '🂱', '🎴', '🀄'];

export default function CompleteProfile() {
  const { user, saveProfile, logout } = useAuth();
  const { t } = useLang();
  const [name, setName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await saveProfile(name.trim(), avatar);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <LangSwitch className="lang-switch-top" />
      <h1 className="brand">{t('brand')}</h1>
      <p className="brand-sub">{t('completeProfileTitle')}</p>

      <form onSubmit={submit} className="auth-form">
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
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{t('done')}</button>
        <button className="link" type="button" onClick={logout}>{t('logoutAndRestart')}</button>
      </form>
    </div>
  );
}
