// Offline support for the XFire / Ironclad / Underworks pages.
// On first visit the whole game is stored in the browser; later visits
// load from that copy even without a connection. Bump VERSION whenever a
// game file changes so browsers pick up the new files (the same rule as
// the ?v= values in index.html).
const VERSION = '20261014e';
const CACHE = 'xfire-offline-' + VERSION;

const FILES = [
  './',
  'index.html',
  'ironclad.html',
  'underworks.html',
  'manifest.json',
  'styles.css?v=' + VERSION,
  'constants.js?v=' + VERSION,
  'audio.js?v=' + VERSION,
  'sfx.js?v=' + VERSION,
  'spriteGenerator.js?v=' + VERSION,
  'terrain.js?v=' + VERSION,
  'render.js?v=' + VERSION,
  'game-engine.js?v=' + VERSION,
  'assets/sprites/survivors.bundle.js?v=' + VERSION,
  'assets/sprites/evolved.bundle.js?v=' + VERSION,
  'assets/sprites/series9.bundle.js?v=' + VERSION,
  'assets/mainmenu-bg.png',
  'music/intro.mp3',
  'music/background.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('xfire-offline-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve a byte range out of a cached full file (audio seeks with Range requests).
async function rangeResponse(cached, range) {
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return cached;
  let start = m[1] === '' ? buf.byteLength - Number(m[2]) : Number(m[1]);
  let end = m[2] === '' || m[1] === '' ? buf.byteLength - 1 : Math.min(Number(m[2]), buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const range = req.headers.get('range');
    if (hit && range) return rangeResponse(hit, range);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && !range) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});
