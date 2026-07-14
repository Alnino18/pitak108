// Storage'сиз вариант: расмни браузерда кичиклаштириб (canvas орқали),
// base64 матн кўринишида тўғридан-тўғри Firestore профилига сақлаймиз.
// Шунинг учун ҳажми жуда кичик бўлиши керак — ҳар бир ўйинчининг расми
// хона ҳужжатининг ичига ҳам ёзилади (12 та ўйинчигача), шунга мос equilibrium сақлаймиз.

const MAX_DIM = 64; // px — кичик, лекин аватар учун етарли
const MAX_DATA_URL_LENGTH = 20000; // ~15 КБ, хавфсиз захира билан

function resizeImageToDataUrl(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatarPhoto(uid, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужен файл изображения');
  }

  // Пробуем со снижением качества, пока не впишемся в лимит размера.
  const attempts = [
    { dim: MAX_DIM, quality: 0.7 },
    { dim: MAX_DIM, quality: 0.5 },
    { dim: 48, quality: 0.5 },
    { dim: 40, quality: 0.4 }
  ];

  let lastDataUrl = null;
  for (const { dim, quality } of attempts) {
    const dataUrl = await resizeImageToDataUrl(file, dim, quality);
    lastDataUrl = dataUrl;
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  throw new Error('Не удалось сжать изображение до нужного размера — выберите более простое фото');
}
