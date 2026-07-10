import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Схема в Firestore для голосового чата (WebRTC, mesh-соединения):
// rooms/{code}/voicePeers/{uid}                — кто сейчас включил голос
// rooms/{code}/voiceSignals/{pairKey}          — offer/answer между парой участников
// rooms/{code}/voiceSignals/{pairKey}/candidates/{auto} — ICE-кандидаты (с пометкой "from")
//
// pairKey — это два uid, отсортированные и склеенные через "_", чтобы у каждой пары
// участников была ровно одна сигнальная запись независимо от того, кто инициатор.

export function pairKey(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

export function subscribeVoicePeers(code, cb) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'voicePeers');
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => d.id)));
}

export async function joinVoicePeers(code, uid) {
  const ref = doc(db, 'rooms', code.toUpperCase(), 'voicePeers', uid);
  await setDoc(ref, { joinedAt: serverTimestamp() });
}

export async function leaveVoicePeers(code, uid) {
  const ref = doc(db, 'rooms', code.toUpperCase(), 'voicePeers', uid);
  await deleteDoc(ref).catch(() => {});
}

export async function writeSignal(code, key, data) {
  const ref = doc(db, 'rooms', code.toUpperCase(), 'voiceSignals', key);
  await setDoc(ref, data, { merge: true });
}

export function listenSignal(code, key, cb) {
  const ref = doc(db, 'rooms', code.toUpperCase(), 'voiceSignals', key);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) cb(snap.data());
  });
}

export async function clearSignal(code, key) {
  const ref = doc(db, 'rooms', code.toUpperCase(), 'voiceSignals', key);
  await deleteDoc(ref).catch(() => {});
}

export async function addIceCandidate(code, key, fromUid, candidate) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'voiceSignals', key, 'candidates');
  await addDoc(ref, { from: fromUid, candidate: JSON.stringify(candidate), createdAt: serverTimestamp() });
}

export function listenIceCandidates(code, key, myUid, cb) {
  const ref = collection(db, 'rooms', code.toUpperCase(), 'voiceSignals', key, 'candidates');
  return onSnapshot(ref, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      const data = change.doc.data();
      if (data.from === myUid) return; // не добавляем свои же кандидаты
      try {
        cb(JSON.parse(data.candidate));
      } catch (e) {
        // игнорируем битые данные
      }
    });
  });
}
