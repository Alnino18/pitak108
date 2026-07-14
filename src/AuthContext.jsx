import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function register(email, password, displayName, avatar) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const ref = doc(db, 'users', cred.user.uid);
    const data = {
      displayName,
      avatar: avatar || '🂡',
      email: email.toLowerCase(),
      photoURL: null,
      wins: 0,
      gamesPlayed: 0,
      badges: [],
      createdAt: serverTimestamp()
    };
    await setDoc(ref, data);
    setProfile(data);
    return cred.user;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    return signOut(auth);
  }

  async function saveProfile(displayName, avatar) {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const data = { displayName, avatar, email: (user.email || '').toLowerCase() };
    await setDoc(ref, data, { merge: true });
    setProfile((p) => ({ ...p, ...data }));
  }

  async function savePhotoURL(photoURL) {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { photoURL }, { merge: true });
    setProfile((p) => ({ ...p, photoURL }));
  }

  function refreshProfile(patch) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, register, login, logout, saveProfile, savePhotoURL, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
