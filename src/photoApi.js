import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 МБ

export async function uploadAvatarPhoto(uid, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужен файл изображения');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Файл слишком большой (максимум 4 МБ)');
  }
  const path = `avatars/${uid}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
