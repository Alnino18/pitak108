import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import LangSwitch from './LangSwitch';
import Avatar from './Avatar';
import { isSoundOn, setSoundOn } from './sounds';
import { THEMES, CARD_BACKS, getTheme, setTheme, getCardBack, setCardBack } from './prefs';
import Leaderboard from './Leaderboard';
import AchievementsPanel from './AchievementsPanel';
import GameHistoryPanel from './GameHistoryPanel';
import FriendsPanel from './FriendsPanel';

const SCORE_PRESETS = [108, 150, 200];
const THEME_ICONS = { green: '🟢', red: '🔴', blue: '🔵', dark: '⚫' };
const BACK_LABELS = { classic: 'Classic', diamond: 'Diamond', stripes: 'Stripes' };
const TABS = [
  { id: 'profile', icon: '♠' },
  { id: 'open', icon: '♣' },
  { id: 'friends', icon: '♥' },
  { id: 'create', icon: '♦' }
];

export default function Lobby({ onEnterRoom, joinError }) {
  const { user, profile, logout, savePhotoURL } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('profile');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scoreLimit, setScoreLimit] = useState(108);
  const [mode, setMode] = useState('classic');
  const [soundOn, setSoundOnState] = useState(isSoundOn());
  const [theme, setThemeState] = useState(getTheme());
  const [cardBack, setCardBackState] = useState(getCardBack());
  const [openRooms, setOpenRooms] = useState(null); // null = ещё грузится
  const [friendIds, setFriendIds] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    import('./friendsApi').then(({ subscribeFriends }) => {
      if (cancelled) return;
      unsub = subscribeFriends(user.uid, (list) => setFriendIds(list.map((f) => f.uid)));
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user.uid]);

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

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setError('');
    try {
      const { uploadAvatarPhoto } = await import('./photoApi');
      const url = await uploadAvatarPhoto(user.uid, file);
      await savePhotoURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const { createRoomForUser } = await import('./roomApi');
      const code = await createRoomForUser(user.uid, profile.displayName, profile.avatar, scoreLimit, mode, profile.photoURL);
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
      const joinedCode = await joinRoom(code, user.uid, profile.displayName, profile.avatar, profile.photoURL);
      onEnterRoom(joinedCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const publicRooms = (openRooms || []).filter((r) => !friendIds.includes(r.hostId));
  const friendRooms = (openRooms || []).filter((r) => friendIds.includes(r.hostId));

  function RoomList({ rooms }) {
    if (openRooms === null) return <p className="muted">{t('loading')}</p>;
    if (rooms.length === 0) return <p className="muted">{t('noOpenRooms')}</p>;
    return (
      <ul className="open-rooms-list">
        {rooms.map((r) => {
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
    );
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-header">
        <div className="lobby-header-left">
          <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()} type="button" disabled={photoUploading}>
            <Avatar photoURL={profile?.photoURL} emoji={profile?.avatar} size={36} className="lobby-avatar" />
            <span className="avatar-edit-badge">✏️</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
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
      {photoUploading && <p className="muted" style={{ textAlign: 'center' }}>{t('uploadingPhoto')}</p>}

      <div className="lobby-tab-content">
        {tab === 'profile' && (
          <>
            <div className="section-divider"><span>{t('appearanceTitle')}</span></div>
            <div className="lobby-card">
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

            <div className="section-divider"><span>{t('achievementsTitle')}</span></div>
            <AchievementsPanel uid={user.uid} />

            <div className="section-divider"><span>{t('leaderboardTitle')}</span></div>
            <Leaderboard />

            <div className="section-divider"><span>{t('historyTitle')}</span></div>
            <GameHistoryPanel uid={user.uid} />
          </>
        )}

        {tab === 'open' && (
          <>
            <div className="section-divider"><span>{t('openRoomsTitle')}</span></div>
            <div className="lobby-card">
              <RoomList rooms={publicRooms} />
            </div>
          </>
        )}

        {tab === 'friends' && (
          <>
            <div className="section-divider"><span>{t('friendsTitle')}</span></div>
            <FriendsPanel uid={user.uid} />

            <div className="section-divider"><span>{t('openRoomsTitle')}</span></div>
            <div className="lobby-card">
              <RoomList rooms={friendRooms} />
            </div>
          </>
        )}

        {tab === 'create' && (
          <>
            <div className="section-divider"><span>{t('ownRoomTitle')}</span></div>
            <div className="lobby-card">
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
          </>
        )}

        {joinError && (
          <div className="error">{t('linkJoinFailed')}: {joinError}</div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      <nav className="bottom-tabs">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            className={`bottom-tab ${tab === tb.id ? 'active' : ''}`}
            onClick={() => setTab(tb.id)}
            type="button"
          >
            <span className={`bottom-tab-icon ${tb.icon === '♥' || tb.icon === '♦' ? 'red' : ''}`}>{tb.icon}</span>
            <span className="bottom-tab-label">{t('tab_' + tb.id)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
