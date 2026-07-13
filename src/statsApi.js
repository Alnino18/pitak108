import { doc, updateDoc, increment, collection, query, orderBy, limit, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Игрок сам фиксирует свою победу в своём профиле (users/{uid}) — доверительная модель,
// как и остальная логика игры. Для настоящей защиты от накрутки нужен Cloud Functions.
export async function recordWin(uid) {
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, { wins: increment(1), gamesPlayed: increment(1) });
  } catch (e) {
    // Поля могло не быть — создаём с нуля
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    await setDoc(ref, { ...data, wins: (data.wins || 0) + 1, gamesPlayed: (data.gamesPlayed || 0) + 1 }, { merge: true });
  }
}

export async function recordGamePlayed(uid) {
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, { gamesPlayed: increment(1) });
  } catch (e) {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    await setDoc(ref, { ...data, gamesPlayed: (data.gamesPlayed || 0) + 1 }, { merge: true });
  }
}

export function subscribeLeaderboard(cb) {
  const ref = collection(db, 'users');
  const q = query(ref, orderBy('wins', 'desc'), limit(10));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => (u.wins || 0) > 0));
  });
}
