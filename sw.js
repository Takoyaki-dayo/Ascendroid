// Ascendroid サービスワーカー
// 更新するときは VERSION をアプリのバージョン(index.html の APP_VERSION)と同じ値にする
const VERSION = '0.25.0';
const CACHE = 'tower-' + VERSION;
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'data/parts.js',
  'data/cards.js',
  'data/enemies.js',
  'data/map.js',
  'data/classes.js',
  'data/text.js',
  'js/engine.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'studio/',
  'studio/index.html',
  'studio/gh-db.js',
  'studio/manifest.webmanifest',
];

self.addEventListener('install', e => {
  // ブラウザのHTTPキャッシュを通さずに取る(古いJSが新しい版のキャッシュに混ざらないように)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache:'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tower-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // ページ本体(ゲームと studio/ の工房): ネット優先(更新をすぐ反映)、圏外ならキャッシュ。? 以降は無視して同じページとしてしまう
  if (req.mode === 'navigate') {
    const key = url.origin + url.pathname;
    e.respondWith(
      fetch(req)
        .then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key).then(hit => hit || caches.match(url.pathname.includes('/studio/') ? 'studio/index.html' : 'index.html')))
    );
    return;
  }

  // 同じサイトのファイル(データ・エンジンなど): ネット優先。ページと版がずれないように、圏外のときだけキャッシュ
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req, {cache:'no-cache'})
        .then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req, {ignoreSearch:true}))
    );
    return;
  }

  // フォントだけ: キャッシュ優先、裏で取り直す。ほかのサイト(工房が読み書きする GitHub など)には触らない
  if (!/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
