import {
  doc,
  runTransaction,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { createRoom, addPlayer, startGame, playCard, drawCard, passTurn, startNextRound, autoSkipTurn } from './engine';

const AFK_TIMEOUT_MS = 60000; // если игрок не ходит дольше минуты — ход пропускают автоматически

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function roomRef(code) {
  return doc(db, 'rooms', code.toUpperCase());
}

function handRef(code, uid) {
  return doc(db, 'rooms', code.toUpperCase(), 'hands', uid);
}

function computeHandCounts(hands) {
  const counts = {};
  for (const uid of Object.keys(hands || {})) counts[uid] = (hands[uid] || []).length;
  return counts;
}

// Карты хранятся отдельно от документа комнаты (в подколлекции hands/{uid}), чтобы:
// 1) чужие карты не прилетали в браузер каждого игрока при каждом обновлении (приватность);
// 2) сам документ комнаты был лёгким — быстрее скачивается и синхронизируется.
// engine.js как принимал, так и отдаёт полный объект { ...комната, hands }, поэтому
// его код не меняется — вся сборка/разборка происходит здесь.

export async function createRoomForUser(uid, name, avatar, eliminationScore, mode, photoURL) {
  const code = makeCode();
  const room = createRoom({ code, hostUid: uid, hostName: name, hostAvatar: avatar, hostPhotoURL: photoURL, eliminationScore, mode });
  const { hands, ...meta } = room;
  await setDoc(roomRef(code), { ...meta, handCounts: computeHandCounts(hands), createdAt: serverTimestamp() });
  return code;
}

// Список открытых комнат — виден всем вошедшим в приложение (не только тем, у кого есть код/ссылка).
export function subscribeOpenRooms(cb) {
  const ref = collection(db, 'rooms');
  const q = query(ref, orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(q, (snap) => {
    const rooms = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.status !== 'finished');
    cb(rooms);
  });
}

export async function joinRoom(code, uid, name, avatar, photoURL) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('Комната не найдена');
    const meta = snap.data();
    // В лобби карт ещё нет — раздачи не было, hands можно не читать.
    const updated = addPlayer({ ...meta, hands: {} }, uid, name, avatar, photoURL);
    const { hands, ...updatedMeta } = updated;
    tx.set(roomRef(code), { ...updatedMeta, handCounts: computeHandCounts(hands) });
  });
  return code.toUpperCase();
}

export function subscribeRoom(code, cb) {
  return onSnapshot(roomRef(code), (snap) => cb(snap.exists() ? snap.data() : null));
}

// Подписка на СВОЮ руку — только её видит владелец (см. firestore.rules).
export function subscribeMyHand(code, uid, cb) {
  return onSnapshot(handRef(code, uid), (snap) => cb(snap.exists() ? (snap.data().cards || []) : []));
}

async function transact(code, fn) {
  const rRef = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rRef);
    if (!snap.exists()) throw new Error('Комната не найдена');
    const meta = snap.data();
    const order = meta.order || [];

    // Firestore-транзакции требуют, чтобы все чтения были ДО любых записей —
    // поэтому сначала читаем текущие руки всех игроков комнаты.
    const handSnaps = await Promise.all(order.map((uid) => tx.get(handRef(code, uid))));
    const hands = {};
    order.forEach((uid, i) => {
      const s = handSnaps[i];
      hands[uid] = s.exists() ? (s.data().cards || []) : [];
    });

    const fullRoom = { ...meta, hands };
    const updated = fn(fullRoom);
    const { hands: updatedHands, ...updatedMeta } = updated;

    if (updatedMeta.currentPlayerId !== meta.currentPlayerId) {
      updatedMeta.turnStartedAt = Date.now();
    }

    tx.set(rRef, { ...updatedMeta, handCounts: computeHandCounts(updatedHands) });
    for (const uid of Object.keys(updatedHands || {})) {
      tx.set(handRef(code, uid), { cards: updatedHands[uid] });
    }
    // Игроков, которых нет в новой раздаче (например, выбыли по очкам), явно очищаем —
    // иначе у них в подколлекции останутся старые карты с прошлого раунда.
    for (const uid of order) {
      if (!updatedHands || !(uid in updatedHands)) {
        tx.set(handRef(code, uid), { cards: [] });
      }
    }
  });
}

// Оптимизированная транзакция для обычного хода (playCard/drawCard/passTurn):
// читаем только руку текущего игрока — не нужны все остальные.
// Исключение: если раунд заканчивается (рука опустела), движок сам вызовет transact
// для полного пересчёта очков, где нужны все руки.
async function playTransact(code, currentUid, fn) {
  const rRef = roomRef(code);
  await runTransaction(db, async (tx) => {
    const [snap, myHandSnap] = await Promise.all([
      tx.get(rRef),
      tx.get(handRef(code, currentUid))
    ]);
    if (!snap.exists()) throw new Error('Комната не найдена');
    const meta = snap.data();
    const order = meta.order || [];
    const myCards = myHandSnap.exists() ? (myHandSnap.data().cards || []) : [];

    // Для движка нужны все руки — подставляем пустые для остальных (их карты не изменятся
    // при обычном ходе). Если движок попытается начислить штрафы (конец раунда), он
    // увидит пустые руки других, что приведёт к некорректному пересчёту — ловим это случай.
    const handsForEngine = {};
    for (const uid of order) {
      handsForEngine[uid] = uid === currentUid ? myCards : (meta.handCounts?.[uid] > 0 ? null : []);
    }
    handsForEngine[currentUid] = myCards;

    const fullRoom = { ...meta, hands: handsForEngine };
    const updated = fn(fullRoom);
    const { hands: updatedHands, ...updatedMeta } = updated;

    // Если раунд закончился (кто-то выбыл или победил) — откатываемся к полной транзакции
    if (updatedMeta.roundWinnerId && updatedMeta.roundWinnerId !== meta.roundWinnerId) {
      throw { retryFull: true };
    }

    if (updatedMeta.currentPlayerId !== meta.currentPlayerId) {
      updatedMeta.turnStartedAt = Date.now();
    }

    tx.set(rRef, { ...updatedMeta, handCounts: computeHandCounts(updatedHands) });
    // Записываем только изменившиеся руки (текущий игрок)
    if (updatedHands[currentUid] !== undefined) {
      tx.set(handRef(code, currentUid), { cards: updatedHands[currentUid] });
    }
  });
}

// Умная обёртка: пробуем быструю транзакцию, при конце раунда — полную
async function smartTransact(code, uid, fn) {
  try {
    await playTransact(code, uid, fn);
  } catch (err) {
    if (err?.retryFull) {
      await transact(code, fn);
    } else {
      throw err;
    }
  }
}

export const startGameInRoom = (code) => transact(code, (room) => startGame(room));
export const playCardInRoom = (code, uid, cardId, chosenSuit) =>
  smartTransact(code, uid, (room) => playCard(room, uid, cardId, chosenSuit));
export const drawCardInRoom = (code, uid) =>
  smartTransact(code, uid, (room) => drawCard(room, uid));
export const passTurnInRoom = (code, uid) =>
  smartTransact(code, uid, (room) => passTurn(room, uid));
export const startNextRoundInRoom = (code) => transact(code, (room) => startNextRound(room));

// Проверка на бездействие — любой клиент в комнате может её вызвать (например, раз в 5-10 сек).
// Если ход не менялся дольше AFK_TIMEOUT_MS, текущего игрока пропускают автоматически.
// Безопасно вызывать многократно — если время ещё не вышло, транзакция ничего не делает.
export async function checkAfkSkip(code) {
  const rRef = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rRef);
    if (!snap.exists()) return;
    const meta = snap.data();
    if (meta.status !== 'playing') return;
    const started = meta.turnStartedAt || 0;
    if (Date.now() - started < AFK_TIMEOUT_MS) return;
    const updated = autoSkipTurn(meta);
    tx.set(rRef, { ...updated, turnStartedAt: Date.now() });
  });
}

export function subscribeMessages(code, cb) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function sendMessage(code, uid, name, text) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'messages');
  await addDoc(ref, { uid, name, text, createdAt: serverTimestamp() });
}

export function subscribeReactions(code, cb) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'reactions');
  const q = query(ref, orderBy('createdAt', 'desc'), limit(15));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function sendReaction(code, uid, emoji) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'reactions');
  await addDoc(ref, { uid, emoji, createdAt: serverTimestamp() });
}
