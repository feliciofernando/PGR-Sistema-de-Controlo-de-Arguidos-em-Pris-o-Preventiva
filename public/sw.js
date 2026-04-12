// ============================================================
// PGR Angola - Service Worker v5
// Handles push notifications, background sync, and offline caching
// SECURITY: Main page (/) is NEVER cached — always fetched from network
// ============================================================

var CACHE_NAME = 'pgr-angola-v5';
var STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-192x192.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/insignia-pgr.png',
];

// API responses to cache for offline access (stale-while-revalidate)
var CACHEABLE_API_PATTERNS = [
  '/api/stats',
  '/api/arguidos/search-public',
];

// ============================================================
// INSTALL & ACTIVATE
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {
        console.log('[SW] Static cache partially failed, continuing...');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// ============================================================
// FETCH — Strategy per route type
// ============================================================
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip Supabase and external domains
  if (url.hostname.indexOf('supabase') !== -1 || url.origin !== self.location.origin) return;

  // API routes: network-first with cache fallback for cacheable endpoints
  if (url.pathname.indexOf('/api/') === 0) {
    var isCacheableApi = CACHEABLE_API_PATTERNS.some(function(pattern) {
      return url.pathname.indexOf(pattern) === 0;
    });

    if (isCacheableApi) {
      event.respondWith(
        fetch(request)
          .then(function(response) {
            if (response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(function() {
            return caches.match(request).then(function(cached) {
              return cached || new Response(JSON.stringify({ error: 'Sem ligação', offline: true }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
          })
      );
      return;
    }

    // Non-cacheable API: network only
    return;
  }

  // Main page: ALWAYS network-first, no cache fallback (security)
  if (url.pathname === '/' || url.pathname.indexOf('/_next/data') === 0) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          return response;
        })
        .catch(function() {
          return caches.match(request).then(function(cached) {
            if (cached) return cached;
            if (request.mode === 'navigate') return caches.match('/offline.html');
            return new Response('Sem ligação à internet', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // JS/CSS bundles: stale-while-revalidate (fast load, update in background)
  if (url.pathname.indexOf('/_next/static') === 0) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(request).then(function(cached) {
          var fetchPromise = fetch(request).then(function(response) {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(function() {
            return cached;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Other static assets: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
        }
        return response;
      })
      .catch(function() {
        return caches.match(request).then(function(cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/');
          return new Response('Sem ligação à internet', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// ============================================================
// PUSH NOTIFICATIONS — Rich categorized summary format
// ============================================================
self.addEventListener('push', function(event) {
  var data = {
    title: 'PGR ANGOLA',
    body: '',
    bodyCompact: '',
    url: '/?view=alertas',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/maskable-icon-192x192.png',
    summary: null,
  };

  if (event.data) {
    try {
      var parsed = event.data.json();
      data = Object.assign({}, data, parsed);
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  var isSummary = !!(data.summary && data.summary.total > 0);

  var options = {
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/?view=alertas',
      timestamp: Date.now(),
      summary: data.summary,
    },
    tag: data.tag || 'pgr-notification-' + Date.now(),
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    silent: false,
  };

  if (isSummary) {
    var s = data.summary;
    options.title = '⚖️ PGR ANGOLA';
    var bodyParts = [];
    if (s.expirados > 0) bodyParts.push('⛔  ' + s.expirados + ' Prazo(s) Expirado(s)');
    if (s.criticos > 0) bodyParts.push('🚨  ' + s.criticos + ' Caso(s) Crítico(s)');
    if (s.atencao > 0) bodyParts.push('⚠️  ' + s.atencao + ' Caso(s) em Atenção');
    if (s.normal > 0) bodyParts.push('✅  ' + s.normal + ' Caso(s) Normal');
    bodyParts.push('📊  Total: ' + s.total + ' caso(s)');
    options.body = bodyParts.join('\n');
    options.actions = [
      { action: 'view', title: '🔎 Ver Alertas' },
      { action: 'dashboard', title: '📊 Dashboard' },
    ];
    if (s.expirados > 0 || s.criticos > 0) {
      options.vibrate = [300, 100, 300, 100, 300, 200, 300];
    }
  } else {
    options.title = data.title;
    options.body = data.body || data.bodyCompact;
    options.actions = [
      { action: 'view', title: '🔎 Ver Detalhes' },
      { action: 'dismiss', title: '✕ Ignorar' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var action = event.action;
  var notifData = event.notification.data || {};
  var targetUrl = notifData.url || '/?view=alertas';
  var summary = notifData.summary;

  if (action === 'dismiss') return;
  if (action === 'dashboard') targetUrl = '/';
  if (action === 'view' && summary) targetUrl = '/?view=alertas';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', function() {});

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-alertas') {
    event.waitUntil(
      fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      }).then(function() {
        console.log('[SW] Background sync: alertas checked');
      }).catch(function() {
        console.log('[SW] Background sync failed, will retry');
      })
    );
  }
});

// ============================================================
// PUSH SUBSCRIPTION CHANGE
// ============================================================
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(function(subscription) {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription,
            endpoint: subscription.endpoint,
            keys: {
              p256dh: Array.from(new Uint8Array(subscription.getKey('p256dh'))).join(''),
              auth: Array.from(new Uint8Array(subscription.getKey('auth'))).join(''),
            },
          }),
        });
      })
  );
});
