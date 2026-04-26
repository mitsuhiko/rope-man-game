// Progressive Web App registration, offline cache refresh, and menu-time updates.

(function () {
  const SERVICE_WORKER_URL = 'service-worker.js';
  const UPDATE_RELOAD_KEY = 'ropeManUpdateReloadingV1';
  const UPDATE_CHECK_THROTTLE_MS = 20 * 1000;
  let registrationPromise = null;
  let updateCheckPromise = null;
  let lastUpdateCheckAt = 0;
  let reloadWhenUpdateReady = false;
  let reloadStarted = false;
  let hadController = serviceWorkersAvailable() && Boolean(navigator.serviceWorker.controller);

  function serviceWorkersAvailable() {
    return 'serviceWorker' in navigator && window.isSecureContext;
  }

  function online() {
    return navigator.onLine !== false;
  }

  function startScreenVisible() {
    const shell = document.querySelector('.game-shell');
    return Boolean(shell && shell.classList.contains('is-starting'));
  }

  function reloadFromMainMenu() {
    if (reloadStarted || !startScreenVisible()) return;
    if (sessionStorage.getItem(UPDATE_RELOAD_KEY) === '1') return;
    reloadStarted = true;
    sessionStorage.setItem(UPDATE_RELOAD_KEY, '1');
    window.location.reload();
  }

  window.addEventListener('pageshow', () => {
    sessionStorage.removeItem(UPDATE_RELOAD_KEY);
  });

  async function unregisterPreviousSrcServiceWorker(currentRegistration) {
    if (!navigator.serviceWorker.getRegistrations || !currentRegistration) return;
    try {
      const previousSrcScope = new URL('src/', window.location.href).href;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => {
        if (registration.scope === previousSrcScope && registration.scope !== currentRegistration.scope) {
          return registration.unregister();
        }
        return undefined;
      }));
    } catch (err) {
      console.warn('[pwa] stale service worker cleanup failed', err);
    }
  }

  async function registerServiceWorker() {
    if (!serviceWorkersAvailable()) return null;
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: './' }).then(async (registration) => {
        await unregisterPreviousSrcServiceWorker(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        return registration;
      }).catch((err) => {
        console.warn('[pwa] service worker registration failed', err);
        return null;
      });
    }
    return registrationPromise;
  }

  function askServiceWorkerToRefresh(registration) {
    return new Promise((resolve) => {
      const worker = (registration && registration.active) || navigator.serviceWorker.controller;
      if (!worker) {
        resolve(false);
        return;
      }

      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(false), 20000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve(Boolean(event.data && event.data.updated));
      };
      worker.postMessage({ type: 'CHECK_FOR_UPDATES' }, [channel.port2]);
    });
  }

  async function checkForAppUpdate(options = {}) {
    if (!serviceWorkersAvailable() || !online()) return false;
    reloadWhenUpdateReady = reloadWhenUpdateReady || Boolean(options.reloadWhenReady);

    const now = Date.now();
    if (updateCheckPromise) return updateCheckPromise;
    if (now - lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return false;
    lastUpdateCheckAt = now;

    updateCheckPromise = (async () => {
      const registration = await registerServiceWorker();
      if (!registration) return false;

      try {
        await registration.update();
      } catch (err) {
        console.warn('[pwa] service worker update check failed', err);
      }

      let readyRegistration = registration;
      try {
        readyRegistration = await navigator.serviceWorker.ready;
      } catch (_) {
        // Fall back to the registration we already have.
      }

      const updated = await askServiceWorkerToRefresh(readyRegistration);
      if (updated && reloadWhenUpdateReady) reloadFromMainMenu();
      return updated;
    })().finally(() => {
      updateCheckPromise = null;
    });

    return updateCheckPromise;
  }

  if (serviceWorkersAvailable()) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloadWhenUpdateReady || startScreenVisible()) reloadFromMainMenu();
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'APP_UPDATE_READY' && data.updated && reloadWhenUpdateReady) {
        reloadFromMainMenu();
      }
    });
    registerServiceWorker();
  }

  window.addEventListener('online', () => {
    if (startScreenVisible()) checkForAppUpdate({ reloadWhenReady: true });
  });

  window.checkForAppUpdate = checkForAppUpdate;
}());
