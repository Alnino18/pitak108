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
import { createRoom, addPlayer, startGame, playCard, drawCard, passTurn, startNextRound } from './engine';

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

export async function createRoomForUser(uid, name, avatar, eliminationScore, mode) {
  const code = makeCode();
  const room = createRoom({ code, hostUid: uid, hostName: name, hostAvatar: avatar, eliminationScore, mode });
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

export async function joinRoom(code, uid, name, avatar) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('Комната не найдена');
    const meta = snap.data();
    // В лобби карт ещё нет — раздачи не было, hands можно не читать.
    const updated = addPlayer({ ...meta, hands: {} }, uid, name, avatar);
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

export const startGameInRoom = (code) => transact(code, (room) => startGame(room));
export const playCardInRoom = (code, uid, cardId, chosenSuit) =>
  transact(code, (room) => playCard(room, uid, cardId, chosenSuit));
export const drawCardInRoom = (code, uid) => transact(code, (room) => drawCard(room, uid));
export const passTurnInRoom = (code, uid) => transact(code, (room) => passTurn(room, uid));
export const startNextRoundInRoom = (code) => transact(code, (room) => startNextRound(room));

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
