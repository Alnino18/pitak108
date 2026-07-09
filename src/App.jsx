import { useState } from 'react';
import { useAuth } from './AuthContext';
import Login from './Login';
import Lobby from './Lobby';
import Room from './Room';
import InstallPrompt from './InstallPrompt';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [roomCode, setRoomCode] = useState(null);

  if (loading) return <div className="loading">Загрузка…</div>;

  return (
    <>
      <InstallPrompt />
      {!user || !profile ? (
        <Login />
      ) : roomCode ? (
        <Room code={roomCode} onLeave={() => setRoomCode(null)} />
      ) : (
        <Lobby onEnterRoom={setRoomCode} />
      )}
    </>
  );
}
