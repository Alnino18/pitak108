import { useEffect, useState } from 'react';
import { useLang } from './LangContext';

export default function Leaderboard() {
  const { t } = useLang();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./statsApi').then(({ subscribeLeaderboard }) => {
      if (cancelled) return;
      unsub = subscribeLeaderboard(setRows);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return (
    <div className="lobby-card">
      <h2>🏆 {t('leaderboardTitle')}</h2>
      {rows === null && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('noWinsYet')}</p>}
      {rows && rows.length > 0 && (
        <ul className="leaderboard-list">
          {rows.map((r, i) => (
            <li key={r.id} className="leaderboard-item">
              <span className="lb-rank">#{i + 1}</span>
              <span className="lb-avatar">{r.avatar || '🂡'}</span>
              <span className="lb-name">{r.displayName || '?'}</span>
              <span className="lb-wins">🏆 {r.wins || 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
