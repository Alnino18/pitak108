import { useEffect, useState } from 'react';
import { useLang } from './LangContext';

export default function ConnectionStatus() {
  const { t } = useLang();
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="connection-banner">
      ⚠️ {t('offlineBanner')}
    </div>
  );
}
