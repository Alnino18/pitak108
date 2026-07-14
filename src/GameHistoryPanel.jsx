import { useEffect, useState } from 'react';
import { useLang } from './LangContext';

export default function GameHistoryPanel({ uid }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./statsApi').then(({ subscribeMyHistory }) => {
      if (cancelled) return;
      unsub = subscribeMyHistory(uid, setRows);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid]);

  return (
    <div className="lobby-card">
      {rows === null && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('noHistoryYet')}</p>}
      {rows && rows.length > 0 && (
        <ul className="history-list">
          {rows.map((g) => {
            const myScore = g.players?.[uid]?.score;
            const won = g.winnerId === uid;
            const when = g.finishedAt?.toDate ? g.finishedAt.toDate() : null;
            return (
              <li key={g.id} className={`history-item ${won ? 'won' : ''}`}>
                <div className="history-main">
                  <span className="history-result">{won ? '🏆' : '💀'}</span>
                  <span className="history-winner">{g.winnerName}</span>
                  <span className="muted history-mode">{g.mode === 'quick' ? t('quickModeLabel') : t('classicModeLabel')}</span>
                </div>
                <div className="muted history-meta">
                  {typeof myScore === 'number' && <span>{t('scoreSuffix')}: {myScore}</span>}
                  {when && <span> · {when.toLocaleDateString()}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
