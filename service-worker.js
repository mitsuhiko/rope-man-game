const CACHE_NAME = 'rope-man-app-v1';
const CORE_ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/rope-man-192.png",
  "icons/rope-man-512.png",
  "game.js",
  "src/audio.js",
  "src/character-drawing.js",
  "src/character.js",
  "src/menu.js",
  "src/pwa.js",
  "src/state.js",
  "src/ui.js",
  "src/world.js",
  "game-over.wav",
  "hook-swoosh.wav",
  "hook-release.wav",
  "hats/backward-cap.png",
  "hats/balaclava.png",
  "hats/bandana.png",
  "hats/baseball-cap-side.png",
  "hats/baseball-cap.png",
  "hats/beaded-necklace.png",
  "hats/bird-mask.png",
  "hats/bonnet.png",
  "hats/bucket-hat.png",
  "hats/bushy-mustache.png",
  "hats/chin-mask.png",
  "hats/cowboy-hat.png",
  "hats/crown.png",
  "hats/curled-mustache.png",
  "hats/curly-hair.png",
  "hats/dreadlocks.png",
  "hats/feather-headband.png",
  "hats/flame-hair.png",
  "hats/flame.png",
  "hats/frog-face.png",
  "hats/full-beard.png",
  "hats/gentleman-mustache.png",
  "hats/goatee.png",
  "hats/grand-mustache-goatee.png",
  "hats/halo.png",
  "hats/handlebar-mustache.png",
  "hats/headset.png",
  "hats/helmet.png",
  "hats/horned-headband.png",
  "hats/horseshoe-mustache.png",
  "hats/jagged-beard.png",
  "hats/jester-hat.png",
  "hats/long-beard.png",
  "hats/long-hair.png",
  "hats/messy-hair.png",
  "hats/ninja-mask.png",
  "hats/parrot-mask.png",
  "hats/party-hat.png",
  "hats/pirate-hat.png",
  "hats/pointed-beard.png",
  "hats/pom-beanie.png",
  "hats/ram-horns.png",
  "hats/samurai-helmet.png",
  "hats/silly-face.png",
  "hats/skull.png",
  "hats/sombrero.png",
  "hats/spiky-hair.png",
  "hats/sunglasses.png",
  "hats/swoop-hair.png",
  "hats/top-hat.png",
  "hats/tv-head.png",
  "hats/viking-beard.png",
  "hats/viking-helmet.png",
  "hats/walrus-mustache.png",
  "hats/wizard-hat.png"
];

function appUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function sameOriginAppRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.href.startsWith(self.registration.scope);
}

async function responseBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

async function responsesDiffer(cached, fresh) {
  if (!cached) return true;

  const cachedEtag = cached.headers.get('etag');
  const freshEtag = fresh.headers.get('etag');
  if (cachedEtag && freshEtag) return cachedEtag !== freshEtag;

  const cachedModified = cached.headers.get('last-modified');
  const freshModified = fresh.headers.get('last-modified');
  const cachedLength = cached.headers.get('content-length');
  const freshLength = fresh.headers.get('content-length');
  if (cachedModified && freshModified && cachedLength && freshLength) {
    return cachedModified !== freshModified || cachedLength !== freshLength;
  }

  const [cachedBytes, freshBytes] = await Promise.all([
    responseBytes(cached.clone()),
    responseBytes(fresh.clone()),
  ]);
  if (cachedBytes.byteLength !== freshBytes.byteLength) return true;
  for (let i = 0; i < cachedBytes.byteLength; i += 1) {
    if (cachedBytes[i] !== freshBytes[i]) return true;
  }
  return false;
}

async function refreshAsset(cache, asset) {
  const url = appUrl(asset);
  const request = new Request(url, { cache: 'no-store' });
  const fresh = await fetch(request);
  if (!fresh || !fresh.ok) return false;

  const cached = await cache.match(url);
  const changed = await responsesDiffer(cached, fresh.clone());
  await cache.put(url, fresh);
  return changed;
}

async function refreshCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(CORE_ASSETS.map((asset) => refreshAsset(cache, asset)));
  return results.some((result) => result.status === 'fulfilled' && result.value);
}

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS.map(appUrl));
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put(appUrl('./'), fresh.clone());
    }
    return fresh;
  } catch (_) {
    return (
      await cache.match(request) ||
      await cache.match(appUrl('./')) ||
      await cache.match(appUrl('index.html'))
    );
  }
}

async function cacheFirstAsset(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((response) => {
    if (response && response.ok) return cache.put(request, response.clone()).then(() => response);
    return response;
  });

  if (cached) {
    event.waitUntil(fresh.catch(() => undefined));
    return cached;
  }

  return fresh.catch(async () => {
    if (request.destination === 'document') return cache.match(appUrl('./'));
    return undefined;
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCoreAssets().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !sameOriginAppRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request, event));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type === 'CHECK_FOR_UPDATES') {
    event.waitUntil((async () => {
      const updated = await refreshCoreAssets();
      const message = { type: 'APP_UPDATE_CHECKED', updated };
      if (event.ports && event.ports[0]) event.ports[0].postMessage(message);
      if (event.source) event.source.postMessage({ type: 'APP_UPDATE_READY', updated });
    })());
  }
});
