import { useEffect, useState } from 'react';
import { useLang } from './LangContext';

export default function FriendsPanel({ uid }) {
  const { t } = useLang();
  const [friends, setFriends] = useState([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./friendsApi').then(({ subscribeFriends }) => {
      if (cancelled) return;
      unsub = subscribeFriends(uid, setFriends);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { addFriendByEmail } = await import('./friendsApi');
      await addFriendByEmail(uid, email.trim());
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(friendUid) {
    const { removeFriend } = await import('./friendsApi');
    await removeFriend(uid, friendUid);
  }

  return (
    <div className="lobby-card">
      <h2>👥 {t('friendsTitle')}</h2>
      <form onSubmit={handleAdd} className="join-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('friendEmailPlaceholder')}
        />
        <button className="primary" type="submit" disabled={busy}>{t('addFriendBtn')}</button>
      </form>
      {error && <div className="error">{error}</div>}

      {friends.length === 0 ? (
        <p className="muted" style={{ marginTop: '0.6rem' }}>{t('noFriendsYet')}</p>
      ) : (
        <ul className="player-list" style={{ marginTop: '0.6rem' }}>
          {friends.map((f) => (
            <li key={f.uid}>
              <span className="pl-avatar">{f.avatar}</span>
              <span>{f.name}</span>
              <button className="link" style={{ marginLeft: 'auto' }} onClick={() => handleRemove(f.uid)} type="button">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
