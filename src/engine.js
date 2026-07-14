import { buildDeck, shuffle, handValue } from './deck';
import { canPlay, drawPenaltyFor, isSkip, mustPlayAgain, penaltyKind, matchesPendingKind } from './rules';

const MAX_PLAYERS = 12;
const HAND_SIZE = 6;
const DEFAULT_ELIMINATION_SCORE = 108; // при таком счёте (или больше) игрок выбывает по умолчанию

function scoreLimits(room) {
  const eliminationScore = room?.settings?.eliminationScore || DEFAULT_ELIMINATION_SCORE;
  return { eliminationScore, resetScore: eliminationScore - 1 };
}

export function createRoom({ code, hostUid, hostName, hostAvatar, eliminationScore, mode }) {
  return {
    code,
    hostId: hostUid,
    status: 'lobby',
    order: [hostUid],
    players: {
      [hostUid]: { name: hostName, avatar: hostAvatar || '🂡', score: 0, eliminated: false }
    },
    settings: {
      eliminationScore: eliminationScore || DEFAULT_ELIMINATION_SCORE,
      mode: mode === 'quick' ? 'quick' : 'classic' // 'classic' — до eliminationScore очков, 'quick' — 36 карт, один раунд
    },
    deck: [],
    discardPile: [],
    hands: {},
    currentPlayerId: null,
    direction: 1,
    activeSuit: null,
    pendingDraw: 0,
    pendingDrawKind: null,
    hasDrawn: false,
    drawCount: 0,
    pendingJoiners: [], // подключились посреди игры — играют со следующего раунда
    winnerId: null,
    roundWinnerId: null,
    updatedAt: Date.now()
  };
}

export function addPlayer(room, uid, name, avatar) {
  if (room.order.includes(uid) || (room.pendingJoiners || []).some((p) => p.uid === uid)) return room;
  const total = room.order.length + (room.pendingJoiners || []).length;
  if (total >= MAX_PLAYERS) throw new Error(`В комнате максимум ${MAX_PLAYERS} игроков`);

  if (room.status === 'lobby' || room.status === 'finished') {
    // Игра не идёт — присоединяемся сразу как полноценный игрок.
    return {
      ...room,
      order: [...room.order, uid],
      players: {
        ...room.players,
        [uid]: { name, avatar: avatar || '🂡', score: 0, eliminated: false }
      }
    };
  }

  // Игра уже идёт — становимся зрителем и вступаем в игру со следующего раунда.
  return {
    ...room,
    pendingJoiners: [...(room.pendingJoiners || []), { uid, name, avatar: avatar || '🂡' }]
  };
}

function dealHands(active, handSize, mode, leaderUid) {
  // Классический режим — 2+ комплекта по 36 карт (масштабируется под число игроков).
  // Быстрый режим ('quick') — ровно одна колода 36 карт, если игрокам хватает места,
  // иначе тоже подстраховываемся дополнительной колодой.
  const needed = active.length * handSize + 24; // +запас на добор картами во время игры
  let numDecks;
  if (mode === 'quick' && active.length * handSize + 4 <= 36) {
    numDecks = 1;
  } else {
    numDecks = Math.max(2, Math.ceil(needed / 36));
  }
  let deck = shuffle(buildDeck(numDecks));
  const hands = {};
  for (const uid of active) {
    hands[uid] = deck.slice(0, handSize);
    deck = deck.slice(handSize);
  }
  // Ведущий игрок (leaderUid) автоматически выкладывает одну карту из своей руки —
  // именно она открывает раунд. У ведущего остаётся handSize-1 карт, у остальных — handSize.
  const leader = leaderUid && hands[leaderUid] ? leaderUid : active[0];
  const leaderHand = hands[leader];
  const discardTop = leaderHand[0];
  hands[leader] = leaderHand.slice(1);
  return { deck, hands, discardTop, leader };
}

function afterInOrder(list, uid) {
  const idx = list.indexOf(uid);
  if (idx === -1) return list[0];
  return list[(idx + 1) % list.length];
}

// Автоматически выложенная ведущим открывающая карта раунда действует так же,
// как если бы её сыграл обычный игрок: 6/7/король пик — штраф, туз — пропуск хода,
// дама — сама выбирает масть (раз выбирать некому, продолжаем в её собственной масти).
function openingEffect(discardTop, activeList, leader) {
  let currentPlayerId = afterInOrder(activeList, leader);
  let pendingDraw = 0;
  let pendingDrawKind = null;
  let activeSuit = null;

  const kind = penaltyKind(discardTop);
  if (kind) {
    pendingDraw = drawPenaltyFor(discardTop);
    pendingDrawKind = kind;
  }
  if (isSkip(discardTop)) {
    currentPlayerId = afterInOrder(activeList, currentPlayerId);
  }
  if (discardTop.rank === 'Q') {
    activeSuit = discardTop.suit;
  }

  return { currentPlayerId, pendingDraw, pendingDrawKind, activeSuit };
}

export function startGame(room) {
  const active = room.order.filter((uid) => !room.players[uid]?.eliminated);
  if (active.length < 2) throw new Error('Нужно минимум 2 игрока');

  const mode = room.settings?.mode || 'classic';
  const leaderUid = active[0];
  const { deck, hands, discardTop, leader } = dealHands(active, HAND_SIZE, mode, leaderUid);
  const opening = openingEffect(discardTop, active, leader);

  return {
    ...room,
    status: 'playing',
    deck,
    hands,
    discardPile: [discardTop],
    currentPlayerId: opening.currentPlayerId,
    direction: 1,
    activeSuit: opening.activeSuit,
    pendingDraw: opening.pendingDraw,
    pendingDrawKind: opening.pendingDrawKind,
    hasDrawn: false,
    drawCount: 0,
    winnerId: null,
    roundWinnerId: null
  };
}

function nextPlayer(room, fromUid, direction) {
  const active = room.order.filter((uid) => !room.players[uid]?.eliminated);
  const idx = active.indexOf(fromUid);
  const nextIdx = (idx + direction + active.length) % active.length;
  return active[nextIdx];
}

function topCard(room) {
  return room.discardPile[room.discardPile.length - 1];
}

function reshuffleIfNeeded(deck, discardPile) {
  if (deck.length > 0) return { deck, discardPile };
  if (discardPile.length <= 1) return { deck, discardPile }; // nothing to reshuffle
  const top = discardPile[discardPile.length - 1];
  const rest = discardPile.slice(0, -1);
  return { deck: shuffle(rest), discardPile: [top] };
}

export function playCard(room, uid, cardId, chosenSuit) {
  if (room.status !== 'playing') throw new Error('Игра не идёт');
  if (room.currentPlayerId !== uid) throw new Error('Сейчас не ваш ход');

  const hand = room.hands[uid] || [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new Error('Такой карты нет на руке');

  const top = topCard(room);

  if (room.pendingDraw > 0) {
    if (!matchesPendingKind(card, room.pendingDrawKind)) {
      const names = { '6': 'шестёркой', '7': 'семёркой', 'K♠': 'королём пик' };
      throw new Error(`Сначала возьмите ${room.pendingDraw} карт(ы) или отбейтесь ${names[room.pendingDrawKind] || 'такой же картой'}`);
    }
  } else if (!canPlay(card, top, room.activeSuit)) {
    throw new Error('Эта карта не подходит по масти/достоинству');
  }
  if (card.rank === 'Q' && !chosenSuit) {
    throw new Error('Для дамы нужно выбрать масть');
  }

  const newHand = hand.filter((c) => c.id !== cardId);
  const discardPile = [...room.discardPile, card];
  let players = room.players;
  let status = room.status;
  let winnerId = room.winnerId;
  let currentPlayerId = uid;
  let direction = room.direction;
  let pendingDraw = room.pendingDraw > 0 ? room.pendingDraw : 0;
  let pendingDrawKind = room.pendingDraw > 0 ? room.pendingDrawKind : null;

  // Масть, которую обязан положить следующий игрок, назначает только дама (выбранная игроком).
  // Восьмёрку теперь закрывает не масть, а другая восьмёрка (или дама) — см. canPlay в rules.js.
  let activeSuit = card.rank === 'Q' ? chosenSuit : null;

  // Спецэффекты: 6 -> +1, 7 -> +2, король пик -> +5 (штрафы одного вида не смешиваются)
  const kind = penaltyKind(card);
  if (kind) {
    pendingDraw += drawPenaltyFor(card);
    pendingDrawKind = kind;
  }

  const handEmpty = newHand.length === 0;

  if (handEmpty && (room.settings?.mode === 'quick')) {
    // Быстрый режим: раунд один, очки не считаем — кто первый вышел, тот и выиграл.
    return {
      ...room,
      hands: { ...room.hands, [uid]: newHand },
      discardPile,
      status: 'finished',
      winnerId: uid,
      roundWinnerId: uid,
      lastRoundWinCard: { rank: card.rank, suit: card.suit },
      activeSuit: null,
      pendingDraw: 0,
      pendingDrawKind: null,
      hasDrawn: false,
      drawCount: 0,
      direction
    };
  }

  if (handEmpty) {
    // Если раунд завершён карой 6/7/королём пик — следующий игрок обязан взять
    // положенный штраф ПЕРЕД тем, как очки будут подсчитаны (штрафные карты входят в подсчёт).
    let deckForDraw = room.deck;
    let discardForDraw = discardPile;
    let extraDrawUid = null;
    let extraDrawnCards = [];
    if (kind) {
      extraDrawUid = nextPlayer(room, uid, direction);
      const drawCount = drawPenaltyFor(card);
      for (let i = 0; i < drawCount; i++) {
        ({ deck: deckForDraw, discardPile: discardForDraw } = reshuffleIfNeeded(deckForDraw, discardForDraw));
        if (deckForDraw.length === 0) break;
        extraDrawnCards.push(deckForDraw[deckForDraw.length - 1]);
        deckForDraw = deckForDraw.slice(0, -1);
      }
    }

    // Раунд окончен: считаем штрафы остальным игрокам
    const { eliminationScore, resetScore } = scoreLimits(room);
    const updatedPlayers = { ...players };
    for (const pid of room.order) {
      if (pid === uid || updatedPlayers[pid].eliminated) continue;
      let pHand = room.hands[pid] || [];
      if (pid === extraDrawUid && extraDrawnCards.length > 0) {
        pHand = [...pHand, ...extraDrawnCards];
      }
      let penalty;
      if (pHand.length === 1 && pHand[0].rank === 'Q') {
        // Игрок остался с одной дамой на руке — особый штраф
        penalty = pHand[0].suit === '♠' ? 40 : 20;
      } else {
        penalty = handValue(pHand);
      }
      let score = (updatedPlayers[pid].score || 0) + penalty;
      score = Math.max(0, score);
      let eliminated = updatedPlayers[pid].eliminated;
      if (score === resetScore) {
        score = 0;
      } else if (score >= eliminationScore) {
        eliminated = true;
      }
      updatedPlayers[pid] = { ...updatedPlayers[pid], score, eliminated };
    }

    // Бонус победителю раунда, если раунд завершён дамой
    if (card.rank === 'Q') {
      const bonus = card.suit === '♠' ? 40 : 20;
      const winnerScore = Math.max(0, (updatedPlayers[uid].score || 0) - bonus);
      updatedPlayers[uid] = { ...updatedPlayers[uid], score: winnerScore };
    }

    players = updatedPlayers;

    // Игроки, подключившиеся посреди игры (зрители), вступают в игру именно сейчас —
    // на старте нового раунда. В классическом режиме им ставится счёт на 1 больше,
    // чем у лидера по очкам — чтобы не давать несправедливое преимущество "с нуля".
    let order = room.order;
    const pendingJoiners = room.pendingJoiners || [];
    if (pendingJoiners.length > 0) {
      const { eliminationScore } = scoreLimits(room);
      const isQuick = room.settings?.mode === 'quick';
      const maxScore = order.reduce((m, pid) => Math.max(m, players[pid]?.score || 0), 0);
      const startScore = isQuick ? 0 : Math.min(eliminationScore - 1, maxScore + 1);
      for (const pj of pendingJoiners) {
        order = [...order, pj.uid];
        players = { ...players, [pj.uid]: { name: pj.name, avatar: pj.avatar, score: startScore, eliminated: false } };
      }
    }

    const stillActive = order.filter((pid) => !players[pid].eliminated);

    if (stillActive.length <= 1) {
      status = 'finished';
      winnerId = stillActive[0] || uid;
      return {
        ...room,
        order,
        hands: { ...room.hands, [uid]: newHand },
        discardPile,
        players,
        status,
        winnerId,
        roundWinnerId: uid,
      lastRoundWinCard: { rank: card.rank, suit: card.suit },
        activeSuit: null,
        pendingDraw: 0,
        pendingDrawKind: null,
        hasDrawn: false,
        drawCount: 0,
        pendingJoiners: [],
        direction
      };
    }

    // Игра продолжается — сразу раздаём карты для следующего раунда,
    // ведёт (и автоматически открывает раунд одной картой) победитель предыдущего раунда.
    const { deck: newDeck, hands: newHands, discardTop: newDiscardTop, leader } = dealHands(stillActive, HAND_SIZE, room.settings?.mode, uid);
    const opening = openingEffect(newDiscardTop, stillActive, leader);

    return {
      ...room,
      order,
      deck: newDeck,
      hands: newHands,
      discardPile: [newDiscardTop],
      players,
      status: 'playing',
      winnerId: null,
      roundWinnerId: uid,
      lastRoundWinCard: { rank: card.rank, suit: card.suit },
      currentPlayerId: opening.currentPlayerId,
      direction: 1,
      activeSuit: opening.activeSuit,
      pendingDraw: opening.pendingDraw,
      pendingDrawKind: opening.pendingDrawKind,
      hasDrawn: false,
      drawCount: 0,
      pendingJoiners: []
    };
  }

  // Туз — следующий игрок пропускает ход; 8 — ходит тот же игрок ещё раз
  if (mustPlayAgain(card)) {
    currentPlayerId = uid;
  } else {
    currentPlayerId = nextPlayer(room, uid, direction);
    if (isSkip(card)) {
      currentPlayerId = nextPlayer(room, currentPlayerId, direction);
    }
  }

  return {
    ...room,
    hands: { ...room.hands, [uid]: newHand },
    discardPile,
    players,
    currentPlayerId,
    direction,
    activeSuit,
    pendingDraw,
    pendingDrawKind,
    hasDrawn: false,
    drawCount: 0
  };
}

export function drawCard(room, uid) {
  if (room.status !== 'playing') throw new Error('Игра не идёт');
  if (room.currentPlayerId !== uid) throw new Error('Сейчас не ваш ход');

  const forced = room.pendingDraw > 0;
  const top = topCard(room);
  // После восьмёрки разрешаем до 3 попыток добрать нужную карту (вместо обычной одной).
  const maxDraws = top && top.rank === '8' ? 3 : 1;
  const currentDrawCount = room.drawCount || 0;

  if (!forced && currentDrawCount >= maxDraws) {
    throw new Error(`Можно взять максимум ${maxDraws} карт(ы) за ход — сыграйте подходящую карту или пропустите ход`);
  }

  const count = forced ? room.pendingDraw : 1;
  let { deck, discardPile } = reshuffleIfNeeded(room.deck, room.discardPile);

  const drawn = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    drawn.push(deck[deck.length - 1]);
    deck = deck.slice(0, -1);
    if (deck.length === 0) {
      ({ deck, discardPile } = reshuffleIfNeeded(deck, discardPile));
    }
  }

  const hand = [...(room.hands[uid] || []), ...drawn];
  const newDrawCount = forced ? 0 : currentDrawCount + 1;

  return {
    ...room,
    deck,
    discardPile,
    hands: { ...room.hands, [uid]: hand },
    pendingDraw: 0,
    pendingDrawKind: null,
    hasDrawn: forced ? false : true,
    drawCount: newDrawCount,
    currentPlayerId: forced ? nextPlayer(room, uid, room.direction) : room.currentPlayerId
  };
}

export function passTurn(room, uid) {
  if (room.currentPlayerId !== uid) throw new Error('Сейчас не ваш ход');
  return { ...room, currentPlayerId: nextPlayer(room, uid, room.direction), hasDrawn: false, drawCount: 0 };
}

// Системный пропуск хода — вызывается автоматически, если игрок долго бездействует.
// В отличие от passTurn, не требует совпадения uid (это не действие самого игрока).
export function autoSkipTurn(room) {
  if (room.status !== 'playing' || !room.currentPlayerId) return room;
  return {
    ...room,
    currentPlayerId: nextPlayer(room, room.currentPlayerId, room.direction),
    hasDrawn: false,
    drawCount: 0
  };
}

export function startNextRound(room) {
  return startGame({ ...room, status: 'lobby' });
}
