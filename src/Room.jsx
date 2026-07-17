import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLang } from './LangContext';
import {
  subscribeRoom,
  subscribeMyHand,
  startGameInRoom,
  playCardInRoom,
  drawCardInRoom,
  passTurnInRoom,
  startNextRoundInRoom,
  subscribeReactions,
  sendReaction,
  checkAfkSkip
} from './roomApi';
import { canPlay, matchesPendingKind } from './rules';
import Card from './Card';
import Chat from './Chat';
import VoiceChat from './VoiceChat';
import { playCardSound, drawCardSound, turnSound, winSound, dealSound } from './sounds';
import Avatar from './Avatar';

const SUITS = ['♠', '♥', '♦', '♣'];
const REACTION_EMOJIS = ['⚡', '😂', '👍', '😮', '🔥', '😢'];

export default function Room({ code, onLeave }) {
  const { user, profile } = useAuth();
  const { t } = useLang();
  const [room, setRoom] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [error, setError] = useState('');
  const [pendingQueen, setPendingQueen] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [roundBanner, setRoundBanner] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 400));
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [justDealt, setJustDealt] = useState(false);
  const lastRoundWinner = useRef(null);
  const lastReactionId = useRef(null);
  const wasMyTurn = useRef(false);
  const wasFinished = useRef(false);
  const dealSignature = useRef(null);

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
        await navigator.share({ title: t('brand'), text: t('shareText').replace('{code}', code), url: link });
        return;
      } catch (e) {
        // пользователь закрыл окно "поделиться" — просто предложим скопировать
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus(t('linkCopied'));
    } catch (e) {
      setShareStatus(link);
    }
    setTimeout(() => setShareStatus(''), 2500);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setShareStatus(t('codeCopied'));
    } catch (e) {
      setShareStatus(code);
    }
    setTimeout(() => setShareStatus(''), 2000);
  }

  useEffect(() => {
    function onResize() { setViewportWidth(window.innerWidth); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const unsub = subscribeRoom(code, setRoom);
    return unsub;
  }, [code]);

  // ВРЕМЕННО ОТКЛЮЧЕНО: автопропуск хода бездействующего игрока (AFK) полагался
  // на часы устройства каждого клиента (Date.now()), а не на серверное время.
  // Если у кого-то из игроков часы сбиты (частая ситуация на телефонах), это
  // приводило к тому, что чужие ходы пропускались почти мгновенно, ошибочно.
  // Надёжно это можно сделать только через Cloud Functions (серверное время).
  // useEffect(() => {
  //   if (!room || room.status !== 'playing') return;
  //   const interval = setInterval(() => {
  //     checkAfkSkip(code).catch(() => {});
  //   }, 8000);
  //   return () => clearInterval(interval);
  // }, [code, room?.status]);

  useEffect(() => {
    const unsub = subscribeMyHand(code, user.uid, setMyHand);
    return unsub;
  }, [code, user.uid]);

  useEffect(() => {
    const unsub = subscribeReactions(code, (list) => {
      if (list.length === 0) return;
      const newest = list[0];
      if (newest.id === lastReactionId.current) return;
      const firstLoad = lastReactionId.current === null;
      lastReactionId.current = newest.id;
      if (firstLoad) return; // не показываем всплывающими старые реакции при первом подключении
      const item = { key: `${newest.id}-${Date.now()}`, emoji: newest.emoji };
      setFloatingReactions((prev) => [...prev, item]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.key !== item.key));
      }, 2200);
    });
    return unsub;
  }, [code]);

  useEffect(() => {
    if (!room?.roundWinnerId) return;
    if (room.roundWinnerId === lastRoundWinner.current) return;
    lastRoundWinner.current = room.roundWinnerId;

    // Статистика серии побед по раундам — только если я реально был участником этого раунда.
    if (room.players?.[user.uid]) {
      const won = room.roundWinnerId === user.uid;
      const wonWithQueen = won && room.lastRoundWinCard?.rank === 'Q';
      import('./statsApi').then(({ recordRoundResult }) => recordRoundResult(user.uid, won, wonWithQueen).catch(() => {}));
    }

    if (room.status === 'playing') {
      const name = room.players[room.roundWinnerId]?.name || '?';
      setRoundBanner(`${t('roundWonPrefix')} ${name} ${t('newDealSuffix')}`);
      const timer = setTimeout(() => setRoundBanner(null), 3500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roundWinnerId, room?.status]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const isMyTurnNow = room.currentPlayerId === user.uid;
    if (isMyTurnNow && !wasMyTurn.current) turnSound();
    wasMyTurn.current = isMyTurnNow;
  }, [room?.currentPlayerId, room?.status, user.uid]);

  useEffect(() => {
    if (room?.status === 'finished' && !wasFinished.current) {
      wasFinished.current = true;
      if (room.winnerId === user.uid) {
        winSound();
        import('./statsApi').then(({ recordWin }) => recordWin(user.uid).catch(() => {}));
      } else if (room.players?.[user.uid]) {
        import('./statsApi').then(({ recordGamePlayed }) => recordGamePlayed(user.uid).catch(() => {}));
      }
      // Историю сохраняет только хост — чтобы запись не дублировалась от каждого клиента.
      if (isHost && room.players) {
        const playersSnapshot = {};
        for (const pid of Object.keys(room.players)) {
          playersSnapshot[pid] = { name: room.players[pid].name, score: room.players[pid].score };
        }
        import('./statsApi').then(({ recordGameHistory }) =>
          recordGameHistory({
            roomCode: code,
            mode: room.settings?.mode,
            players: playersSnapshot,
            winnerId: room.winnerId,
            winnerName: room.players[room.winnerId]?.name || '?'
          }).catch(() => {})
        );
      }
    }
    if (room?.status !== 'finished') wasFinished.current = false;
  }, [room?.status, room?.winnerId, user.uid]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const sig = room.discardPile && room.discardPile.length === 1 ? room.discardPile[0].id : null;
    if (!sig || sig === dealSignature.current) return;
    const firstLoad = dealSignature.current === null;
    dealSignature.current = sig;
    if (firstLoad) return; // не проигрываем звук, если просто открыли уже идущую игру
    setJustDealt(true);
    dealSound(6);
    const timer = setTimeout(() => setJustDealt(false), 900);
    return () => clearTimeout(timer);
  }, [room?.discardPile, room?.status]);

  if (!room) return <div className="loading">{t('loadingRoom')}</div>;

  const uid = user.uid;
  const isHost = room.hostId === uid;
  const isMyTurn = room.currentPlayerId === uid;
  const top = room.discardPile?.[room.discardPile.length - 1];
  const amPendingJoiner = (room.pendingJoiners || []).some((p) => p.uid === uid);
  const isSpectator = amPendingJoiner || !!room.players[uid]?.eliminated;

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
    safe(async () => {
      await playCardInRoom(code, uid, card.id, null);
      playCardSound();
    });
  }

  function chooseSuit(suit) {
    const card = pendingQueen;
    setPendingQueen(null);
    safe(async () => {
      await playCardInRoom(code, uid, card.id, suit);
      playCardSound();
    });
  }

  if (room.status === 'lobby') {
    return (
      <div className="room-screen">
        <div className="room-topbar">
          <button className="link" onClick={onLeave} type="button">← {t('back')}</button>
        </div>

        <h2>{t('waitingPlayers')}</h2>

        <div className="invite-box">
          <div className="invite-code">{code}</div>
          <div className="invite-actions">
            <button className="primary" onClick={handleShare} type="button">{t('shareLink')}</button>
            <button className="secondary" onClick={handleCopyCode} type="button">{t('copyCode')}</button>
          </div>
          {shareStatus && <div className="muted invite-status">{shareStatus}</div>}
          <p className="muted">{t('inviteHint')}</p>
        </div>

        <VoiceChat code={code} uid={uid} players={room.players} />

        <ul className="player-list">
          {room.order.map((pid) => (
            <li key={pid}>
              <Avatar photoURL={room.players[pid].photoURL} emoji={room.players[pid].avatar} size={28} className="pl-avatar" />
              <span>{room.players[pid].name}</span>
              {pid === room.hostId && <span className="tag">{t('host')}</span>}
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
            {t('startGame')} ({room.order.length}/12)
          </button>
        ) : (
          <p className="muted">{t('waitingHost')}</p>
        )}
        {error && <div className="error">{error}</div>}

        <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} t={t} />
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="room-screen">
        <div className="room-topbar">
          <button className="link" onClick={onLeave} type="button">← {t('back')}</button>
        </div>
        <h2>🏆 {t('winner')}: {room.players[room.winnerId]?.name}</h2>
        {room.settings?.mode !== 'quick' && <Scoreboard room={room} t={t} />}
        {isHost && (
          <button className="primary" onClick={() => safe(() => startNextRoundInRoom(code))} type="button">
            {t('playAgain')}
          </button>
        )}
        <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} t={t} />
      </div>
    );
  }

  // status === 'playing'
  const legal = room.pendingDraw > 0
    ? myHand.filter((c) => matchesPendingKind(c, room.pendingDrawKind))
    : myHand.filter((c) => canPlay(c, top, room.activeSuit));
  const maxDraws = top && top.rank === '8' ? 3 : 1;
  const drawCount = room.drawCount || 0;
  const canDraw = isMyTurn && (room.pendingDraw > 0 || drawCount < maxDraws);
  const canPass = isMyTurn && room.pendingDraw === 0 && drawCount >= maxDraws;
  const drawsLeft = Math.max(0, maxDraws - drawCount);

  // Остальные игроки, начиная со следующего после меня — раскладываем по дуге сверху стола
  const others = room.order.filter((pid) => pid !== uid);
  const myIndex = room.order.indexOf(uid);
  const orderedOthers = [...room.order.slice(myIndex + 1), ...room.order.slice(0, myIndex)].filter((pid) => others.includes(pid));

  const n = myHand.length;
  const spread = Math.min(22, n * 3); // общий угол веера — заметно мягче, карты почти не заваливаются

  // Размер карты всегда одинаковый — не уменьшается. Подстраивается только нахлёст:
  // чем больше карт, тем плотнее они лежат друг на друге (виден только уголок),
  // чем меньше карт — тем шире веер, как на реальном столе.
  const availableWidth = Math.min(viewportWidth, 480) - 44;
  const small = false;
  const cardW = 148;
  const step = n > 1 ? Math.min(cardW - 4, Math.max(15, (availableWidth - cardW) / (n - 1))) : 0;
  const overlap = cardW - step;

  const penaltyKindLabel = { '6': t('kindSix'), '7': t('kindSeven'), 'K♠': t('kindKing') };

  return (
    <div className="game-felt">
      <div className="room-topbar">
        <button className="link" onClick={onLeave} type="button">← {t('back')}</button>
        <div className="room-code">{t('room')} {code}</div>
        <div className="topbar-actions">
          <button className="chat-toggle" onClick={() => setStatsOpen(true)} type="button" title={t('stats')}>📊</button>
          <button className="chat-toggle" onClick={() => setChatOpen((v) => !v)} type="button">💬</button>
        </div>
      </div>

      {room.players[uid]?.eliminated && (
        <div className="spectator-banner">{t('spectatorBanner')}</div>
      )}
      {amPendingJoiner && (
        <div className="spectator-banner">{t('spectatorWaitingBanner')}</div>
      )}
      {room.pendingJoiners?.length > 0 && !amPendingJoiner && (
        <div className="waiting-joiners-banner">
          {t('waitingToJoinLabel')}: {room.pendingJoiners.map((p) => p.name).join(', ')}
        </div>
      )}

      <VoiceChat code={code} uid={uid} players={room.players} />

      <div className="seats-ring" data-count={orderedOthers.length}>
        {orderedOthers.map((pid) => {
          const p = room.players[pid];
          const cardCount = room.handCounts?.[pid] ?? 0;
          const active = pid === room.currentPlayerId;
          return (
            <div key={pid} className={`seat ${active ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
              <div className="seat-avatar-wrap">
                <div className="seat-avatar"><Avatar photoURL={p.photoURL} emoji={p.avatar} size={30} /></div>
                {!p.eliminated && <span className="seat-mini-count">🂠{cardCount}</span>}
              </div>
              <div className="seat-name">{p.name}</div>
              <div className="seat-meta">
                <span className="seat-score">🏅{p.score}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="turn-arrow turn-arrow-top">↷</div>

      <div className="center-pile">
        <div className="pile-stack" title={`${t('deckTitle')}: ${room.deck?.length ?? 0}`}>
          <Card faceDown small />
          <span className="pile-count">{room.deck?.length ?? 0}</span>
        </div>
        <div className="discard-slot">
          <div className="discard-stack">
            <div className="discard-ghost discard-ghost-2" />
            <div className="discard-ghost discard-ghost-1" />
            {top && <Card card={top} disabled />}
          </div>
        </div>
        {room.activeSuit && (
          <div className={`active-suit-badge suit-${room.activeSuit === '♥' ? 'heart' : room.activeSuit === '♦' ? 'diamond' : room.activeSuit === '♣' ? 'club' : 'spade'}`}>
            {room.activeSuit}
          </div>
        )}
        {isMyTurn && (
          <div className="move-hints">
            {(room.pendingDraw > 0 || drawCount < maxDraws) && <div className="move-hint">{t('takeCard')}</div>}
            {legal.length > 0 && <div className="move-hint">{t('playFromHandHint')}</div>}
          </div>
        )}
      </div>
      <div className="turn-arrow turn-arrow-bottom">↶</div>
      <div className="pile-hints">
        {room.pendingDraw > 0 && (
          <span className="hint-chip danger">
            +{room.pendingDraw} {t('cardsWord')}{room.pendingDrawKind ? ` (${t('fightBackOnly')} ${penaltyKindLabel[room.pendingDrawKind]})` : ''}
          </span>
        )}
      </div>

      <div className="turn-banner">
        {isMyTurn ? <span className="my-turn">{t('yourTurn')}</span> : <span>{t('turnOf')}: {room.players[room.currentPlayerId]?.name}</span>}
      </div>

      {error && <div className="table-error">{error}</div>}
      {roundBanner && !error && <div className="table-error round-banner">{roundBanner}</div>}

      <div className="floating-reactions">
        {floatingReactions.map((r) => (
          <span key={r.key} className="floating-emoji">{r.emoji}</span>
        ))}
      </div>

      <div className="reaction-bar">
        {REACTION_EMOJIS.map((e) => (
          <button key={e} className="reaction-btn" onClick={() => sendReaction(code, uid, e)} type="button">{e}</button>
        ))}
      </div>

      <div className="hand-dock">
        <div className="hand-fan" style={{ '--n': n }}>
          {myHand.map((card, i) => {
            const mid = (n - 1) / 2;
            const offset = i - mid;
            const rot = n > 1 ? (offset / mid) * (spread / 2) : 0;
            const lift = Math.abs(offset) * 1.3;
            return (
              <div
                key={card.id}
                className={`fan-slot ${justDealt ? 'dealt-in' : ''}`}
                style={{
                  '--rot': `${rot}deg`,
                  '--lift': `${lift}px`,
                  '--overlap': `${overlap}px`,
                  animationDelay: justDealt ? `${i * 0.07}s` : '0s',
                  zIndex: i
                }}
              >
                <Card
                  card={card}
                  small={small}
                  large
                  onClick={() => handleCardClick(card)}
                  disabled={!isMyTurn || !legal.some((c) => c.id === card.id)}
                />
              </div>
            );
          })}
        </div>

        {isMyTurn && drawCount > 0 && room.pendingDraw === 0 && (
          <div className="muted hand-hint">
            {drawsLeft > 0
              ? `${t('alreadyDrewHint')} (${t('drawsLeft') || 'осталось попыток'}: ${drawsLeft})`
              : t('alreadyDrewHint')}
          </div>
        )}
      </div>

      <div className="table-footer">
        <div className="footer-profile">
          <Avatar photoURL={room.players[uid]?.photoURL} emoji={room.players[uid]?.avatar} size={34} />
          <span className="footer-name">{room.players[uid]?.name}</span>
        </div>
        <div className="footer-stat">🏅 {room.players[uid]?.score ?? 0}</div>
        <div className="footer-stat">🂠 {myHand.length}</div>
        <div className="footer-actions">
          {canPass && (
            <button className="secondary small" onClick={() => safe(() => passTurnInRoom(code, uid))} type="button">
              {t('skipTurn')}
            </button>
          )}
          <button className="fab fab-sm" disabled={!canDraw} onClick={() => safe(async () => { await drawCardInRoom(code, uid); drawCardSound(); })} type="button">
            🂠<span className="fab-badge">{room.pendingDraw > 0 ? room.pendingDraw : '+1'}</span>
          </button>
        </div>
      </div>

      {pendingQueen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{t('chooseSuit')}</h3>
            <div className="suit-choices">
              {SUITS.map((s) => (
                <button key={s} className={`suit-btn suit-btn-${s === '♥' ? 'heart' : s === '♦' ? 'diamond' : s === '♣' ? 'club' : 'spade'}`} onClick={() => chooseSuit(s)} type="button">
                  {s}
                </button>
              ))}
            </div>
            <button className="link" onClick={() => setPendingQueen(null)} type="button">{t('cancel')}</button>
          </div>
        </div>
      )}

      {statsOpen && (
        <div className="modal-backdrop" onClick={() => setStatsOpen(false)}>
          <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('stats')}</h3>
            <Scoreboard room={room} currentPlayerId={room.currentPlayerId} t={t} />
            <button className="link" onClick={() => setStatsOpen(false)} type="button">{t('close')}</button>
          </div>
        </div>
      )}

      <ChatDrawer code={code} uid={uid} name={profile.displayName} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} t={t} showFab={false} />
    </div>
  );
}

function Scoreboard({ room, compact, currentPlayerId, t }) {
  return (
    <ul className={`scoreboard ${compact ? 'compact' : ''}`}>
      {room.order.map((pid) => {
        const p = room.players[pid];
        const cardCount = room.handCounts?.[pid];
        return (
          <li key={pid} className={`${pid === currentPlayerId ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
            <Avatar photoURL={p.photoURL} emoji={p.avatar} size={26} className="pl-avatar" />
            <span className="pl-name">{p.name}</span>
            <span className="pl-score">{p.score} {t('scoreSuffix')}</span>
            {typeof cardCount === 'number' && <span className="pl-cards">🂠×{cardCount}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ChatDrawer({ open, onToggle, t, showFab = true, ...chatProps }) {
  return (
    <>
      {!open && showFab && (
        <button className="chat-fab" onClick={onToggle} type="button">💬</button>
      )}
      {open && (
        <div className="chat-drawer">
          <div className="chat-drawer-header">
            <span>{t('chat')}</span>
            <button className="link" onClick={onToggle} type="button">{t('close')} ✕</button>
          </div>
          <Chat {...chatProps} />
        </div>
      )}
    </>
  );
}
