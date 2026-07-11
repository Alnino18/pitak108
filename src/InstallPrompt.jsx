import { useEffect, useState } from 'react';
import { useLang } from './LangContext';

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function InstallPrompt() {
  const { t } = useLang();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferredPrompt && !isIos()) return null;

  async function handleClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setShowIosHint(true);
  }

  return (
    <div className="install-banner">
      <span>{t('installBanner')}</span>
      <div className="install-actions">
        <button className="primary small" onClick={handleClick} type="button">{t('install')}</button>
        <button className="link" onClick={() => setDismissed(true)} type="button">{t('hide')}</button>
      </div>

      {showIosHint && (
        <div className="modal-backdrop" onClick={() => setShowIosHint(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('iosInstallTitle')}</h3>
            <p className="muted">{t('iosInstallHint')}</p>
            <button className="link" onClick={() => setShowIosHint(false)} type="button">{t('gotIt')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
