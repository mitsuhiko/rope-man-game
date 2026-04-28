const CACHE_NAME = 'rope-man-app-v35';
const CORE_ASSETS = [
  "./",
  "index.html",
  "service-worker.js",
  "assets/manifest.webmanifest",
  "assets/icons/rope-man-192.png",
  "assets/icons/rope-man-512.png",
  "src/audio.js",
  "src/character-drawing.js",
  "src/character.js",
  "src/game.js",
  "src/menu.js",
  "src/pwa.js",
  "src/state.js",
  "src/ui.js",
  "src/world.js",
  "assets/game-over.mp3",
  "assets/hook-swoosh.wav",
  "assets/hook-release.wav",
  "assets/coin.wav",
  "assets/bing.wav",
  "assets/saw.wav",
  "assets/swing-a.wav",
  "assets/swing-b.wav",
  "assets/swing-c.wav",
  "assets/hats/backward-cap.png",
  "assets/hats/balaclava.png",
  "assets/hats/bandana.png",
  "assets/hats/baseball-cap-side.png",
  "assets/hats/baseball-cap.png",
  "assets/hats/beaded-necklace.png",
  "assets/hats/bird-mask.png",
  "assets/hats/bonnet.png",
  "assets/hats/bucket-hat.png",
  "assets/hats/bushy-mustache.png",
  "assets/hats/cowboy-hat.png",
  "assets/hats/crown.png",
  "assets/hats/curled-mustache.png",
  "assets/hats/curly-hair.png",
  "assets/hats/darth-vader-mask.png",
  "assets/hats/dreadlocks.png",
  "assets/hats/feather-headband.png",
  "assets/hats/flame-hair.png",
  "assets/hats/flame.png",
  "assets/hats/frog-face.png",
  "assets/hats/full-beard.png",
  "assets/hats/gentleman-mustache.png",
  "assets/hats/goatee.png",
  "assets/hats/halo.png",
  "assets/hats/handlebar-mustache.png",
  "assets/hats/headset.png",
  "assets/hats/helmet.png",
  "assets/hats/horned-headband.png",
  "assets/hats/horseshoe-mustache.png",
  "assets/hats/jagged-beard.png",
  "assets/hats/jester-hat.png",
  "assets/hats/long-beard.png",
  "assets/hats/long-hair.png",
  "assets/hats/messy-hair.png",
  "assets/hats/ninja-mask.png",
  "assets/hats/parrot-mask.png",
  "assets/hats/party-hat.png",
  "assets/hats/pirate-hat.png",
  "assets/hats/poop-hat.png",
  "assets/hats/pointed-beard.png",
  "assets/hats/pom-beanie.png",
  "assets/hats/ram-horns.png",
  "assets/hats/samurai-helmet.png",
  "assets/hats/silly-face.png",
  "assets/hats/skull.png",
  "assets/hats/sombrero.png",
  "assets/hats/spiky-hair.png",
  "assets/hats/sunglasses.png",
  "assets/hats/swoop-hair.png",
  "assets/hats/teeth.png",
  "assets/hats/top-hat.png",
  "assets/hats/tv-head.png",
  "assets/hats/viking-beard.png",
  "assets/hats/viking-helmet.png",
  "assets/hats/walrus-mustache.png",
  "assets/hats/wizard-hat.png"
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
  try {
    await cache.put(url, fresh);
  } catch (_) {
    // Cache quota failures should not make update checks fail.
  }
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
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch (_) {}

  try {
    const fresh = await fetch(request);
    if (cache && fresh && fresh.ok) {
      try {
        await cache.put(appUrl('./'), fresh.clone());
      } catch (_) {
        // Keep serving the network response even if Cache Storage is full.
      }
    }
    return fresh;
  } catch (_) {
    const cached = cache && (
      await cache.match(request) ||
      await cache.match(appUrl('./')) ||
      await cache.match(appUrl('index.html'))
    );
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirstAsset(request, event) {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch (_) {}

  const cached = cache ? await cache.match(request) : null;
  const fresh = fetch(request).then(async (response) => {
    if (cache && response && response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (_) {
        // Cache quota failures should not break the request.
      }
    }
    return response;
  });

  if (cached) {
    event.waitUntil(fresh.catch(() => undefined));
    return cached;
  }

  return fresh.catch(async () => {
    if (cache && request.destination === 'document') {
      const fallback = await cache.match(appUrl('./')) || await cache.match(appUrl('index.html'));
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
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
