import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeRoom,
  startGameInRoom,
  playCardInRoom,
  drawCardInRoom,
  passTurnInRoom,
  startNextRoundInRoom
} from './roomApi';
import { canPlay, matchesPendingKind } from './rules';
import Card from './Card';
import Chat from './Chat';
import VoiceChat from './VoiceChat';

const SUITS = ['♠', '♥', '♦', '♣'];

export default function Room({ code, onLeave }) {
  const { user, profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [pendingQueen, setPendingQueen] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [roundBanner, setRoundBanner] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const lastRoundWinner = useRef(null);

  function inviteLink() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', code);
    return url.toString();
  }

  async function handleShare() {
    const link = inviteLink();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Акопчила 108', text: `Заходи в игру, код комнаты: ${code}`, url: link });
        return;
      } catch (e) {
        // пользователь закрыл окно "поделиться" — просто предложим скопировать
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus('Ссылка скопирована!');
    } catch (e) {
      setShareStatus(link);
    }
    setTimeout(() => setShareStatus(''), 2500);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setShareStatus('Код скопирован!');
    } catch (e) {
      setShareStatus(code);
    }
    setTimeout(() => setShareStatus(''), 2000);
  }

  useEffect(() => {
    const unsub = subscribeRoom(code, setRoom);
    return unsub;
  }, [code]);

  useEffect(() => {
    if (!room?.roundWinnerId) return;
    if (room.roundWinnerId === lastRoundWinner.current) return;
    lastRoundWinner.current = room.roundWinnerId;
    if (room.status === 'playing') {
      const name = room.players[room.roundWinnerId]?.name || '?';
      setRoundBanner(`Раунд выиграл(а): ${name} — новая раздача`);
      const t = setTimeout(() => setRoundBanner(null), 3500);
      return () => clearTimeout(t);
    }
  }, [room?.roundWinnerId, room?.status]);

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
        </div>

        <h2>Ждём игроков…</h2>

        <div className="invite-box">
          <div className="invite-code">{code}</div>
          <div className="invite-actions">
            <button className="primary" onClick={handleShare} type="button">🔗 Поделиться ссылкой</button>
            <button className="secondary" onClick={handleCopyCode} type="button">Скопировать код</button>
          </div>
          {shareStatus && <div className="muted invite-status">{shareStatus}</div>}
          <p className="muted">Друзья, перешедшие по ссылке, попадут в комнату сразу — код вводить не нужно.</p>
        </div>

        <VoiceChat code={code} uid={uid} players={room.players} />

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
            Начать игру ({room.order.length}/12)
          </button>
        ) : (
          <p className="muted">Ждём, пока хост начнёт игру.</p>
        )}
        {error && <div className="error">{error}</div>}

        <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
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
        <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
      </div>
    );
  }

  // status === 'playing'
  const legal = room.pendingDraw > 0
    ? myHand.filter((c) => matchesPendingKind(c, room.pendingDrawKind))
    : myHand.filter((c) => canPlay(c, top, room.activeSuit));
  const canDraw = isMyTurn && (room.pendingDraw > 0 || !room.hasDrawn);
  const canPass = isMyTurn && room.pendingDraw === 0 && room.hasDrawn;

  // Остальные игроки, начиная со следующего после меня — раскладываем по дуге сверху стола
  const others = room.order.filter((pid) => pid !== uid);
  const myIndex = room.order.indexOf(uid);
  const orderedOthers = [...room.order.slice(myIndex + 1), ...room.order.slice(0, myIndex)].filter((pid) => others.includes(pid));

  const n = myHand.length;
  const spread = Math.min(46, n * 7); // общий угол веера, шире руки — шире угол, но не более 46°

  return (
    <div className="game-felt">
      <div className="room-topbar">
        <button className="link" onClick={onLeave} type="button">← Выйти</button>
        <div className="room-code">Комната {code}</div>
        <div className="topbar-actions">
          <button className="chat-toggle" onClick={() => setStatsOpen(true)} type="button" title="Статистика">📊</button>
          <button className="chat-toggle" onClick={() => setChatOpen((v) => !v)} type="button">💬</button>
        </div>
      </div>

      {room.players[uid]?.eliminated && (
        <div className="spectator-banner">Вы выбыли из игры — можно наблюдать за столом дальше</div>
      )}

      <VoiceChat code={code} uid={uid} players={room.players} />

      <div className="seats-ring" data-count={orderedOthers.length}>
        {orderedOthers.map((pid) => {
          const p = room.players[pid];
          const cardCount = room.hands?.[pid]?.length ?? 0;
          const active = pid === room.currentPlayerId;
          return (
            <div key={pid} className={`seat ${active ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
              <div className="seat-avatar">{p.avatar}</div>
              <div className="seat-name">{p.name}</div>
              <div className="seat-meta">
                <span className="seat-score">{p.score}</span>
                <span className="seat-cards">🂠{cardCount}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="center-pile">
        <div className="pile-stack" title={`В колоде: ${room.deck?.length ?? 0}`}>
          <Card faceDown small />
          <span className="pile-count">{room.deck?.length ?? 0}</span>
        </div>
        <div className="discard-slot">
          {top && <Card card={top} disabled />}
        </div>
        <div className="pile-hints">
          {room.activeSuit && <span className="hint-chip">Масть: {room.activeSuit}</span>}
          {room.pendingDraw > 0 && (
            <span className="hint-chip danger">
              +{room.pendingDraw} карт{room.pendingDrawKind ? ` (отбиться можно только ${
                { '6': 'шестёркой', '7': 'семёркой', 'K♠': 'королём пик' }[room.pendingDrawKind]
              })` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="turn-banner">
        {isMyTurn ? <span className="my-turn">Ваш ход</span> : <span>Ходит: {room.players[room.currentPlayerId]?.name}</span>}
      </div>

      {error && <div className="table-error">{error}</div>}
      {roundBanner && !error && <div className="table-error round-banner">{roundBanner}</div>}

      <div className="hand-dock">
        <div className="hand-fan" style={{ '--n': n }}>
          {myHand.map((card, i) => {
            const mid = (n - 1) / 2;
            const offset = i - mid;
            const rot = n > 1 ? (offset / mid) * (spread / 2) : 0;
            const lift = Math.abs(offset) * 2;
            return (
              <div
                key={card.id}
                className="fan-slot"
                style={{ '--rot': `${rot}deg`, '--lift': `${lift}px`, zIndex: i }}
              >
                <Card
                  card={card}
                  onClick={() => handleCardClick(card)}
                  disabled={!isMyTurn || !legal.some((c) => c.id === card.id)}
                />
              </div>
            );
          })}
        </div>

        <div className="hand-actions">
          <button className="fab" disabled={!canDraw} onClick={() => safe(() => drawCardInRoom(code, uid))} type="button">
            🂠<span className="fab-badge">{room.pendingDraw > 0 ? room.pendingDraw : '+1'}</span>
          </button>
          {canPass && (
            <button className="secondary" onClick={() => safe(() => passTurnInRoom(code, uid))} type="button">
              Пропустить ход
            </button>
          )}
        </div>
        {isMyTurn && room.hasDrawn && room.pendingDraw === 0 && (
          <div className="muted hand-hint">Карту уже взяли — сыграйте её (если подходит) или пропустите ход</div>
        )}
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

      {statsOpen && (
        <div className="modal-backdrop" onClick={() => setStatsOpen(false)}>
          <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Статистика</h3>
            <Scoreboard room={room} currentPlayerId={room.currentPlayerId} />
            <button className="link" onClick={() => setStatsOpen(false)} type="button">Закрыть</button>
          </div>
        </div>
      )}

      <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
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

function ChatDrawer({ open, onToggle, ...chatProps }) {
  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={onToggle} type="button">💬</button>
      )}
      {open && (
        <div className="chat-drawer">
          <div className="chat-drawer-header">
            <span>Чат</span>
            <button className="link" onClick={onToggle} type="button">Закрыть ✕</button>
          </div>
          <Chat {...chatProps} />
        </div>
      )}
    </>
  );
}
