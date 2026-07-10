import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import Login from './Login';
import CompleteProfile from './CompleteProfile';
import Lobby from './Lobby';
import Room from './Room';
import InstallPrompt from './InstallPrompt';
import { joinRoom } from './roomApi';

function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  return code ? code.toUpperCase() : null;
}

export default function App() {
  const { user, profile, loading } = useAuth();
  const [roomCode, setRoomCode] = useState(null);
  const [autoJoinCode, setAutoJoinCode] = useState(getRoomCodeFromUrl);
  const [autoJoinError, setAutoJoinError] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);

  // Если в ссылке был код комнаты (?room=XXXXX) — заходим в неё автоматически,
  // как только пользователь вошёл и заполнил профиль. Код из адресной строки убираем,
  // чтобы при обновлении страницы не пытаться зайти повторно.
  useEffect(() => {
    if (!autoJoinCode || !user || !profile || autoJoining) return;
    let cancelled = false;
    setAutoJoining(true);
    setAutoJoinError('');
    (async () => {
      try {
        const code = await joinRoom(autoJoinCode, user.uid, profile.displayName, profile.avatar);
        if (!cancelled) setRoomCode(code);
      } catch (err) {
        if (!cancelled) setAutoJoinError(err.message);
      } finally {
        if (!cancelled) {
          setAutoJoining(false);
          setAutoJoinCode(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.toString());
        }
      }
    })();
    return () => { cancelled = true; };
  }, [autoJoinCode, user, profile, autoJoining]);

  if (loading) return <div className="loading">Загрузка…</div>;

  return (
    <>
      <InstallPrompt />
      {!user ? (
        <Login />
      ) : !profile ? (
        <CompleteProfile />
      ) : autoJoinCode && autoJoining ? (
        <div className="loading">Заходим в комнату {autoJoinCode}…</div>
      ) : roomCode ? (
        <Room code={roomCode} onLeave={() => setRoomCode(null)} />
      ) : (
        <Lobby onEnterRoom={setRoomCode} joinError={autoJoinError} />
      )}
    </>
  );
}
