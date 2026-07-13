import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import LangSwitch from './LangSwitch';
import { isSoundOn, setSoundOn } from './sounds';
import { THEMES, CARD_BACKS, getTheme, setTheme, getCardBack, setCardBack } from './prefs';
import Leaderboard from './Leaderboard';

const SCORE_PRESETS = [108, 150, 200];
const THEME_ICONS = { green: '🟢', red: '🔴', blue: '🔵', dark: '⚫' };
const BACK_LABELS = { classic: 'Classic', diamond: 'Diamond', stripes: 'Stripes' };

export default function Lobby({ onEnterRoom, joinError }) {
  const { user, profile, logout } = useAuth();
  const { t } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scoreLimit, setScoreLimit] = useState(108);
  const [mode, setMode] = useState('classic');
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [theme, setThemeState] = useState(getTheme());
  const [cardBack, setCardBackState] = useState(getCardBack());
  const [openRooms, setOpenRooms] = useState(null); // null = ещё грузится

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./roomApi').then(({ subscribeOpenRooms }) => {
      if (cancelled) return;
      unsub = subscribeOpenRooms(setOpenRooms);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundOnState(next);
  }

  function chooseTheme(th) {
    setTheme(th);
    setThemeState(th);
  }

  function chooseCardBack(cb) {
    setCardBack(cb);
    setCardBackState(cb);
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const { createRoomForUser } = await import('./roomApi');
      const code = await createRoomForUser(user.uid, profile.displayName, profile.avatar, scoreLimit, mode);
      onEnterRoom(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doJoin(code) {
    setBusy(true);
    setError('');
    try {
      const { joinRoom } = await import('./roomApi');
      const joinedCode = await joinRoom(code, user.uid, profile.displayName, profile.avatar);
      onEnterRoom(joinedCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    doJoin(joinCode.trim());
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-header">
        <div>
          <span className="lobby-avatar">{profile?.avatar}</span>
          <span className="lobby-name">{profile?.displayName}</span>
        </div>
        <div className="lobby-header-actions">
          <button className="sound-toggle" onClick={toggleSound} type="button" title={t('sound')}>
            {soundOn ? '🔊' : '🔇'}
          </button>
          <LangSwitch />
          <button className="link" onClick={logout} type="button">{t('logout')}</button>
        </div>
      </div>

      <h1 className="brand">{t('brand')}</h1>

      <div className="lobby-card">
        <h2>{t('ownRoomTitle')}</h2>
        <p className="muted">{t('ownRoomDesc')}</p>

        <div className="mode-presets">
          <div className="preset-row">
            <button
              type="button"
              className={`preset-chip wide ${mode === 'classic' ? 'chosen' : ''}`}
              onClick={() => setMode('classic')}
            >
              {t('classicModeLabel')}
            </button>
            <button
              type="button"
              className={`preset-chip wide ${mode === 'quick' ? 'chosen' : ''}`}
              onClick={() => setMode('quick')}
            >
              {t('quickModeLabel')}
            </button>
          </div>
        </div>

        {mode === 'classic' && (
          <div className="score-presets">
            <span className="muted">{t('scoreLimitLabel')}:</span>
            <div className="preset-row">
              {SCORE_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`preset-chip ${scoreLimit === v ? 'chosen' : ''}`}
                  onClick={() => setScoreLimit(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="primary" onClick={handleCreate} disabled={busy} type="button">
          {t('createRoom')}
        </button>
      </div>

      <div className="lobby-card">
        <h2>{t('haveCodeTitle')}</h2>
        <form onSubmit={handleJoin} className="join-form">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t('roomCodePlaceholder')}
            maxLength={5}
          />
          <button className="primary" type="submit" disabled={busy}>{t('joinBtn')}</button>
        </form>
      </div>

      <div className="lobby-card">
        <h2>{t('openRoomsTitle')}</h2>
        {openRooms === null && <p className="muted">{t('loading')}</p>}
        {openRooms && openRooms.length === 0 && <p className="muted">{t('noOpenRooms')}</p>}
        {openRooms && openRooms.length > 0 && (
          <ul className="open-rooms-list">
            {openRooms.map((r) => {
              const playerCount = (r.order?.length || 0) + (r.pendingJoiners?.length || 0);
              const isPlaying = r.status === 'playing';
              return (
                <li key={r.id} className="open-room-item">
                  <div className="open-room-info">
                    <span className="open-room-code">{r.id}</span>
                    <span className={`open-room-status ${isPlaying ? 'live' : ''}`}>
                      {isPlaying ? t('statusPlaying') : t('statusLobby')}
                    </span>
                    <span className="muted open-room-count">👥 {playerCount}</span>
                  </div>
                  <button className="secondary" onClick={() => doJoin(r.id)} disabled={busy} type="button">
                    {isPlaying ? t('watchBtn') : t('joinBtn')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="lobby-card">
        <h2>🎨 {t('appearanceTitle')}</h2>
        <p className="muted">{t('themeLabel')}:</p>
        <div className="preset-row">
          {THEMES.map((th) => (
            <button
              key={th}
              type="button"
              className={`preset-chip ${theme === th ? 'chosen' : ''}`}
              onClick={() => chooseTheme(th)}
            >
              {THEME_ICONS[th]}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: '0.6rem' }}>{t('cardBackLabel')}:</p>
        <div className="preset-row">
          {CARD_BACKS.map((cb) => (
            <button
              key={cb}
              type="button"
              className={`preset-chip ${cardBack === cb ? 'chosen' : ''}`}
              onClick={() => chooseCardBack(cb)}
            >
              {BACK_LABELS[cb]}
            </button>
          ))}
        </div>
      </div>

      <Leaderboard />

      {joinError && (
        <div className="error">{t('linkJoinFailed')}: {joinError}</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
