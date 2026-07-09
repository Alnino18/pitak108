import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeRoom,
  startGameInRoom,
  playCardInRoom,
  drawCardInRoom,
  passTurnInRoom,
  startNextRoundInRoom
} from './roomApi';
import { canPlay } from './rules';
import Card from './Card';
import Chat from './Chat';

const SUITS = ['♠', '♥', '♦', '♣'];

export default function Room({ code, onLeave }) {
  const { user, profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [pendingQueen, setPendingQueen] = useState(null);

  useEffect(() => {
    const unsub = subscribeRoom(code, setRoom);
    return unsub;
  }, [code]);

  if (!room) return <div className="loading">Загружаем комнату…</div>;

  const uid = user.uid;
  const isHost = room.hostId === uid;
  const myHand = room.hands?.[uid] || [];
  const isMyTurn = room.currentPlayerId === uid;
  const top = room.discardPile?.[room.discardPile.length - 1];

  async function safe(fn) {
    try {
      setError('');
      await fn();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCardClick(card) {
    if (!isMyTurn) return;
    if (card.rank === 'Q') {
      setPendingQueen(card);
      return;
    }
    safe(() => playCardInRoom(code, uid, card.id, null));
  }

  function chooseSuit(suit) {
    const card = pendingQueen;
    setPendingQueen(null);
    safe(() => playCardInRoom(code, uid, card.id, suit));
  }

  if (room.status === 'lobby') {
    return (
      <div className="room-screen">
        <div className="room-topbar">
          <button className="link" onClick={onLeave} type="button">← Выйти</button>
          <div className="room-code">Код комнаты: <strong>{code}</strong></div>
        </div>

        <h2>Ждём игроков…</h2>
        <ul className="player-list">
          {room.order.map((pid) => (
            <li key={pid}>
              <span className="pl-avatar">{room.players[pid].avatar}</span>
              <span>{room.players[pid].name}</span>
              {pid === room.hostId && <span className="tag">хост</span>}
            </li>
          ))}
        </ul>

        {isHost ? (
          <button
            className="primary"
            disabled={room.order.length < 2}
            onClick={() => safe(() => startGameInRoom(code))}
            type="button"
          >
            Начать игру ({room.order.length}/6)
          </button>
        ) : (
          <p className="muted">Ждём, пока хост начнёт игру.</p>
        )}
        {error && <div className="error">{error}</div>}

        <Chat code={code} uid={uid} name={profile.displayName} />
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="room-screen">
        <div className="room-topbar">
          <button className="link" onClick={onLeave} type="button">← Выйти</button>
        </div>
        <h2>🏆 Победитель: {room.players[room.winnerId]?.name}</h2>
        <Scoreboard room={room} />
        {isHost && (
          <button className="primary" onClick={() => safe(() => startNextRoundInRoom(code))} type="button">
            Играть ещё раз
          </button>
        )}
        <Chat code={code} uid={uid} name={profile.displayName} />
      </div>
    );
  }

  // status === 'playing'
  const legal = room.pendingDraw > 0
    ? myHand.filter((c) => c.rank === '7')
    : myHand.filter((c) => canPlay(c, top, room.activeSuit));
  const canDraw = isMyTurn;
  const noLegalMoves = isMyTurn && legal.length === 0;

  return (
    <div className="room-screen playing">
      <div className="room-topbar">
        <button className="link" onClick={onLeave} type="button">← Выйти</button>
        <div className="room-code">Комната {code}</div>
      </div>

      <Scoreboard room={room} compact currentPlayerId={room.currentPlayerId} />

      <div className="table">
        <div className="discard-area">
          <Card card={top} disabled />
          {room.activeSuit && <div className="active-suit">Заказана масть: {room.activeSuit}</div>}
          {room.pendingDraw > 0 && (
            <div className="pending-draw">Штраф: возьмите {room.pendingDraw} карт(ы) или отбейтесь семёркой</div>
          )}
        </div>

        <div className="turn-indicator">
          {isMyTurn ? <strong>Ваш ход</strong> : <span>Ходит: {room.players[room.currentPlayerId]?.name}</span>}
        </div>

        <div className="my-hand">
          {myHand.map((card) => (
            <Card
              key={card.id}
              card={card}
              onClick={() => handleCardClick(card)}
              disabled={!isMyTurn || !legal.some((c) => c.id === card.id)}
            />
          ))}
        </div>

        <div className="table-actions">
          <button className="secondary" disabled={!canDraw} onClick={() => safe(() => drawCardInRoom(code, uid))} type="button">
            Взять карту{room.pendingDraw > 0 ? ` (${room.pendingDraw})` : ''}
          </button>
          {noLegalMoves && room.pendingDraw === 0 && (
            <button className="secondary" onClick={() => safe(() => passTurnInRoom(code, uid))} type="button">
              Пропустить ход
            </button>
          )}
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      {pendingQueen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Выберите масть</h3>
            <div className="suit-choices">
              {SUITS.map((s) => (
                <button key={s} className={`suit-btn ${s === '♥' || s === '♦' ? 'red' : ''}`} onClick={() => chooseSuit(s)} type="button">
                  {s}
                </button>
              ))}
            </div>
            <button className="link" onClick={() => setPendingQueen(null)} type="button">Отмена</button>
          </div>
        </div>
      )}

      <Chat code={code} uid={uid} name={profile.displayName} />
    </div>
  );
}

function Scoreboard({ room, compact, currentPlayerId }) {
  return (
    <ul className={`scoreboard ${compact ? 'compact' : ''}`}>
      {room.order.map((pid) => {
        const p = room.players[pid];
        const cardCount = room.hands?.[pid]?.length;
        return (
          <li key={pid} className={`${pid === currentPlayerId ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
            <span className="pl-avatar">{p.avatar}</span>
            <span className="pl-name">{p.name}</span>
            <span className="pl-score">{p.score} очк.</span>
            {typeof cardCount === 'number' && <span className="pl-cards">🂠×{cardCount}</span>}
          </li>
        );
      })}
    </ul>
  );
}
