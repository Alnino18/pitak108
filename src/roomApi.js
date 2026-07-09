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

export async function createRoomForUser(uid, name, avatar) {
  const code = makeCode();
  const ref = doc(db, 'rooms', code);
  const room = createRoom({ code, hostUid: uid, hostName: name, hostAvatar: avatar });
  await setDoc(ref, room);
  return code;
}

export async function joinRoom(code, uid, name, avatar) {
  const ref = doc(db, 'rooms', code.toUpperCase());
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Комната не найдена');
    const room = snap.data();
    const updated = addPlayer(room, uid, name, avatar);
    tx.set(ref, updated);
  });
  return code.toUpperCase();
}

export function subscribeRoom(code, cb) {
  const ref = doc(db, 'rooms', code.toUpperCase());
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}

async function transact(code, fn) {
  const ref = doc(db, 'rooms', code.toUpperCase());
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Комната не найдена');
    const room = snap.data();
    const updated = fn(room);
    tx.set(ref, updated);
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
