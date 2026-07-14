import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ЗАМЕНИТЕ на конфиг вашего проекта из Firebase Console
// (Project settings -> General -> Your apps -> SDK setup and configuration)
const firebaseConfig = {
  apiKey: 'AIzaSyAzeebhto-4D6PAB8gT4l1HDpIHzZSALq4',
  authDomain: 'igra-11e65.firebaseapp.com',
  projectId: 'igra-11e65',
  storageBucket: 'igra-11e65.firebasestorage.app',
  messagingSenderId: '1055266967318',
  appId: '1:1055266967318:web:68a0a37094927baed44a37',
  measurementId: 'G-LLWJQSS1CP'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
