import { useEffect, useState } from 'react';
import { useLang } from './LangContext';
import { ACHIEVEMENTS, unlockedAchievements } from './achievements';

export default function AchievementsPanel({ uid }) {
  const { t } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./statsApi').then(({ subscribeMyStats }) => {
      if (cancelled) return;
      unsub = subscribeMyStats(uid, setStats);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid]);

  const unlockedIds = new Set(unlockedAchievements(stats).map((a) => a.id));

  return (
    <div className="lobby-card">
      <h2>🎖️ {t('achievementsTitle')}</h2>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedIds.has(a.id);
          return (
            <div key={a.id} className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`} title={t(a.titleKey)}>
              <span className="achievement-icon">{a.icon}</span>
              <span className="achievement-title">{t(a.titleKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
