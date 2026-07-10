import { useState } from 'react';
import { useAuth } from './AuthContext';
import { createRoomForUser, joinRoom } from './roomApi';

export default function Lobby({ onEnterRoom, joinError }) {
  const { user, profile, logout } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const code = await createRoomForUser(user.uid, profile.displayName, profile.avatar);
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
        <button className="link" onClick={logout} type="button">Выйти</button>
      </div>

      <h1 className="brand">Акопчила 108</h1>

      <div className="lobby-card">
        <h2>Своя комната</h2>
        <p className="muted">Создайте комнату и отправьте код друзьям — стол приватный, никто чужой не зайдёт.</p>
        <button className="primary" onClick={handleCreate} disabled={busy} type="button">
          Создать комнату
        </button>
      </div>

      <div className="lobby-card">
        <h2>Есть код?</h2>
        <form onSubmit={handleJoin} className="join-form">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Код комнаты"
            maxLength={5}
          />
          <button className="primary" type="submit" disabled={busy}>Войти</button>
        </form>
      </div>

      {joinError && (
        <div className="error">Не удалось войти по ссылке: {joinError}</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
