import { doc, updateDoc, increment, collection, query, orderBy, limit, onSnapshot, setDoc, getDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from './firebase';

// Игрок сам фиксирует свою статистику в своём профиле (users/{uid}) — доверительная модель,
// как и остальная логика игры. Для настоящей защиты от накрутки нужен Cloud Functions.

async function bumpFields(uid, fields) {
  const ref = doc(db, 'users', uid);
  const incFields = {};
  for (const k of Object.keys(fields)) incFields[k] = increment(fields[k]);
  try {
    await updateDoc(ref, incFields);
  } catch (e) {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const merged = { ...data };
    for (const k of Object.keys(fields)) merged[k] = (data[k] || 0) + fields[k];
    await setDoc(ref, merged, { merge: true });
  }
}

export async function recordWin(uid) {
  await bumpFields(uid, { wins: 1, gamesPlayed: 1 });
}

export async function recordGamePlayed(uid) {
  await bumpFields(uid, { gamesPlayed: 1 });
}

// Раунды подряд — стрик считаем прямо в профиле: если выиграл раунд — +1 к текущему стрику
// (и обновляем максимум), если проиграл раунд (кто-то другой выиграл) — сбрасываем в 0.
// wonWithQueen — раунд выигран именно дамой последней картой (для достижений).
export async function recordRoundResult(uid, won, wonWithQueen = false) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const current = won ? (data.currentStreak || 0) + 1 : 0;
  const max = Math.max(data.maxStreak || 0, current);
  const queenWins = (data.queenWins || 0) + (won && wonWithQueen ? 1 : 0);
  await setDoc(ref, { currentStreak: current, maxStreak: max, queenWins }, { merge: true });
}

export function subscribeLeaderboard(cb) {
  const ref = collection(db, 'users');
  const q = query(ref, orderBy('wins', 'desc'), limit(10));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => (u.wins || 0) > 0));
  });
}

export function subscribeMyStats(uid, cb) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : {}));
}

// ===== История игр =====

export async function recordGameHistory({ roomCode, mode, players, winnerId, winnerName }) {
  const ref = collection(db, 'gameHistory');
  const participantIds = Object.keys(players);
  await addDoc(ref, {
    roomCode,
    mode: mode || 'classic',
    players,
    participantIds,
    winnerId,
    winnerName,
    finishedAt: serverTimestamp()
  });
}

export function subscribeMyHistory(uid, cb) {
  const ref = collection(db, 'gameHistory');
  const q = query(ref, where('participantIds', 'array-contains', uid), orderBy('finishedAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
