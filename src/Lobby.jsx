import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import LangSwitch from './LangSwitch';
import { isSoundOn, setSoundOn } from './sounds';

const SCORE_PRESETS = [108, 150, 200];

export default function Lobby({ onEnterRoom, joinError }) {
  const { user, profile, logout } = useAuth();
  const { t } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scoreLimit, setScoreLimit] = useState(108);
  const [soundOn, setSoundOnState] = useState(isSoundOn());

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundOnState(next);
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const { createRoomForUser } = await import('./roomApi');
      const code = await createRoomForUser(user.uid, profile.displayName, profile.avatar, scoreLimit);
      onEnterRoom(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { joinRoom } = await import('./roomApi');
      const code = await joinRoom(joinCode.trim(), user.uid, profile.displayName, profile.avatar);
      onEnterRoom(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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

      {joinError && (
        <div className="error">{t('linkJoinFailed')}: {joinError}</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
