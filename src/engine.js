import { buildDeck, shuffle, handValue } from './deck';
import { canPlay, drawPenaltyFor, isSkip, penaltyKind, matchesPendingKind } from './rules';

const HAND_SIZE = 6;
const RESET_SCORE = 107; // при таком счёте очки обнуляются
const ELIMINATION_SCORE = 108; // при таком счёте (или больше) игрок выбывает

export function createRoom({ code, hostUid, hostName, hostAvatar }) {
  return {
    code,
    hostId: hostUid,
    status: 'lobby',
    order: [hostUid],
    players: {
      [hostUid]: { name: hostName, avatar: hostAvatar || '🂡', score: 0, eliminated: false }
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
    winnerId: null,
    roundWinnerId: null,
    updatedAt: Date.now()
  };
}

export function addPlayer(room, uid, name, avatar) {
  if (room.status !== 'lobby') throw new Error('Игра уже началась');
  if (room.order.includes(uid)) return room;
  if (room.order.length >= 6) throw new Error('В комнате максимум 6 игроков');
  return {
    ...room,
    order: [...room.order, uid],
    players: {
      ...room.players,
      [uid]: { name, avatar: avatar || '🂡', score: 0, eliminated: false }
    }
  };
}

function dealHands(active, handSize) {
  let deck = shuffle(buildDeck());
  const hands = {};
  for (const uid of active) {
    hands[uid] = deck.slice(0, handSize);
    deck = deck.slice(handSize);
  }
  const discardTop = deck.pop();
  return { deck, hands, discardTop };
}

export function startGame(room) {
  const active = room.order.filter((uid) => !room.players[uid]?.eliminated);
  if (active.length < 2) throw new Error('Нужно минимум 2 игрока');

  const { deck, hands, discardTop } = dealHands(active, HAND_SIZE);

  return {
    ...room,
    status: 'playing',
    deck,
    hands,
    discardPile: [discardTop],
    currentPlayerId: active[0],
    direction: 1,
    activeSuit: null,
    pendingDraw: 0,
    pendingDrawKind: null,
    hasDrawn: false,
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

  // Масть, которую обязан положить следующий игрок: после дамы — выбранная,
  // после восьмёрки — масть самой восьмёрки (строгое совпадение, не по рангу).
  let activeSuit = null;
  if (card.rank === 'Q') activeSuit = chosenSuit;
  else if (card.rank === '8') activeSuit = card.suit;

  // Спецэффекты: 6 -> +1, 7 -> +2, король пик -> +5 (штрафы одного вида не смешиваются)
  const kind = penaltyKind(card);
  if (kind) {
    pendingDraw += drawPenaltyFor(card);
    pendingDrawKind = kind;
  }

  const handEmpty = newHand.length === 0;

  if (handEmpty) {
    // Раунд окончен: считаем штрафы остальным игрокам
    const updatedPlayers = { ...players };
    for (const pid of room.order) {
      if (pid === uid || updatedPlayers[pid].eliminated) continue;
      const pHand = room.hands[pid] || [];
      let penalty;
      if (pHand.length === 1 && pHand[0].rank === 'Q') {
        // Игрок остался с одной дамой на руке — особый штраф
        penalty = pHand[0].suit === '♠' ? 40 : 20;
      } else {
        penalty = handValue(pHand);
      }
      let score = (updatedPlayers[pid].score || 0) + penalty;
      let eliminated = updatedPlayers[pid].eliminated;
      if (score === RESET_SCORE) {
        score = 0;
      } else if (score >= ELIMINATION_SCORE) {
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

    const stillActive = room.order.filter((pid) => !players[pid].eliminated);

    if (stillActive.length <= 1) {
      status = 'finished';
      winnerId = stillActive[0] || uid;
      return {
        ...room,
        hands: { ...room.hands, [uid]: newHand },
        discardPile,
        players,
        status,
        winnerId,
        roundWinnerId: uid,
        activeSuit: null,
        pendingDraw: 0,
        pendingDrawKind: null,
        hasDrawn: false,
        direction
      };
    }

    // Игра продолжается — сразу раздаём карты для следующего раунда,
    // ведёт победитель предыдущего раунда.
    const { deck: newDeck, hands: newHands, discardTop: newDiscardTop } = dealHands(stillActive, HAND_SIZE);

    return {
      ...room,
      deck: newDeck,
      hands: newHands,
      discardPile: [newDiscardTop],
      players,
      status: 'playing',
      winnerId: null,
      roundWinnerId: uid,
      currentPlayerId: uid,
      direction: 1,
      activeSuit: null,
      pendingDraw: 0,
      pendingDrawKind: null,
      hasDrawn: false
    };
  }

  // Туз — следующий игрок пропускает ход
  currentPlayerId = nextPlayer(room, uid, direction);
  if (isSkip(card)) {
    currentPlayerId = nextPlayer(room, currentPlayerId, direction);
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
    hasDrawn: false
  };
}

export function drawCard(room, uid) {
  if (room.status !== 'playing') throw new Error('Игра не идёт');
  if (room.currentPlayerId !== uid) throw new Error('Сейчас не ваш ход');

  const forced = room.pendingDraw > 0;
  if (!forced && room.hasDrawn) {
    throw new Error('Можно взять только одну карту за ход — сыграйте её или пропустите ход');
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

  return {
    ...room,
    deck,
    discardPile,
    hands: { ...room.hands, [uid]: hand },
    pendingDraw: 0,
    pendingDrawKind: null,
    hasDrawn: forced ? false : true,
    currentPlayerId: forced ? nextPlayer(room, uid, room.direction) : room.currentPlayerId
  };
}

export function passTurn(room, uid) {
  if (room.currentPlayerId !== uid) throw new Error('Сейчас не ваш ход');
  return { ...room, currentPlayerId: nextPlayer(room, uid, room.direction), hasDrawn: false };
}

export function startNextRound(room) {
  return startGame({ ...room, status: 'lobby' });
}
