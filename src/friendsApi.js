import { doc, getDoc, setDoc, onSnapshot, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Друзья хранятся в своём же профиле (users/{uid}.friends) — односторонний список
// ("мои контакты"), не требует прав на запись в чужой документ.

export async function addFriendByEmail(myUid, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Введите почту');

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Пользователь с такой почтой не найден');

  const friendDoc = snap.docs[0];
  if (friendDoc.id === myUid) throw new Error('Это ваша собственная почта');

  const friendData = friendDoc.data();
  const myRef = doc(db, 'users', myUid);
  const mySnap = await getDoc(myRef);
  const myData = mySnap.exists() ? mySnap.data() : {};
  const friends = myData.friends || [];

  if (friends.some((f) => f.uid === friendDoc.id)) {
    throw new Error('Уже есть в друзьях');
  }

  const updated = [...friends, { uid: friendDoc.id, name: friendData.displayName || '?', avatar: friendData.avatar || '🂡' }];
  await setDoc(myRef, { friends: updated }, { merge: true });
  return updated;
}

export async function removeFriend(myUid, friendUid) {
  const myRef = doc(db, 'users', myUid);
  const mySnap = await getDoc(myRef);
  const myData = mySnap.exists() ? mySnap.data() : {};
  const friends = (myData.friends || []).filter((f) => f.uid !== friendUid);
  await setDoc(myRef, { friends }, { merge: true });
  return friends;
}

export function subscribeFriends(myUid, cb) {
  const ref = doc(db, 'users', myUid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? (snap.data().friends || []) : []));
}
