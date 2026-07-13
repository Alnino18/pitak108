import { useEffect, useState, Suspense, lazy } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import Login from './Login';
import CompleteProfile from './CompleteProfile';
import Lobby from './Lobby';
import InstallPrompt from './InstallPrompt';
import ConnectionStatus from './ConnectionStatus';

// Room и всё, что ему нужно (движок игры, Firestore-обвязка, чат, голосовой чат),
// грузятся отдельным куском только когда человек реально заходит в комнату —
// это ускоряет самую первую загрузку (экран входа/лобби).
const Room = lazy(() => import('./Room'));

function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('room');
  return code ? code.toUpperCase() : null;
}

export default function App() {
  const { user, profile, loading } = useAuth();
  const { t } = useLang();
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
        // Динамический импорт — движок игры и Firestore-обвязка не грузятся,
        // пока реально не понадобятся (сразу после входа/лобби).
        const { joinRoom } = await import('./roomApi');
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

  if (loading) return <div className="loading">{t('loading') || 'Загрузка…'}</div>;

  return (
    <>
      <ConnectionStatus />
      <InstallPrompt />
      {!user ? (
        <Login />
      ) : !profile ? (
        <CompleteProfile />
      ) : autoJoinCode && autoJoining ? (
        <div className="loading">{(t('joiningRoom') || 'Заходим в комнату')} {autoJoinCode}…</div>
      ) : roomCode ? (
        <Suspense fallback={<div className="loading">{t('loading') || 'Загрузка…'}</div>}>
          <Room code={roomCode} onLeave={() => setRoomCode(null)} />
        </Suspense>
      ) : (
        <Lobby onEnterRoom={setRoomCode} joinError={autoJoinError} />
      )}
    </>
  );
}
