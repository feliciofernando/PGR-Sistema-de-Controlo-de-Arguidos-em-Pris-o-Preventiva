// ============================================================
// PGR Angola - Service Worker
// Handles push notifications, background sync, and caching
// SECURITY: Main page (/) is NEVER cached — always fetched from network
// ============================================================

var CACHE_NAME = 'pgr-angola-v4';
var STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-192x192.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// ============================================================
// INSTALL & ACTIVATE
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Do NOT cache '/' — login page must always be fresh
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

  // Skip API calls and Supabase
  if (url.pathname.indexOf('/api/') === 0 || url.hostname.indexOf('supabase') !== -1) {
    return;
  }

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Main page + page routes: ALWAYS network-first, no cache fallback
  // This ensures the login page is always fresh (security requirement)
  if (url.pathname === '/' || url.pathname.indexOf('/_next/data') === 0) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          return response;
        })
        .catch(function() {
          // If offline, try cache but warn
          return caches.match(request).then(function(cached) {
            if (cached) return cached;
            if (request.mode === 'navigate') return caches.match('/');
            return new Response('Sem ligação à internet', { status: 503, statusText: 'Service Unavailable' });
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

  // Determine if this is a categorized summary notification
  var isSummary = !!(data.summary && data.summary.total > 0);

  // Build notification options
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
    // SUMMARY NOTIFICATION FORMAT — clean with line breaks
    var s = data.summary;

    // Title always: PGR ANGOLA
    options.title = '⚖️ PGR ANGOLA';

    // Build body with clean line breaks (supported by Windows Action Center & Android)
    var bodyParts = [];
    if (s.expirados > 0) bodyParts.push('⛔  ' + s.expirados + ' Prazo(s) Expirado(s)');
    if (s.criticos > 0) bodyParts.push('🚨  ' + s.criticos + ' Caso(s) Crítico(s)');
    if (s.atencao > 0) bodyParts.push('⚠️  ' + s.atencao + ' Caso(s) em Atenção');
    if (s.normal > 0) bodyParts.push('✅  ' + s.normal + ' Caso(s) Normal');
    bodyParts.push('📊  Total: ' + s.total + ' caso(s)');
    options.body = bodyParts.join('\n');

    // Rich actions for summary notifications
    options.actions = [
      { action: 'view', title: '🔎 Ver Alertas' },
      { action: 'dashboard', title: '📊 Dashboard' },
    ];

    // Higher urgency vibration for critical
    if (s.expirados > 0 || s.criticos > 0) {
      options.vibrate = [300, 100, 300, 100, 300, 200, 300];
    }
  } else {
    // STANDARD NOTIFICATION FORMAT (simple title + body)
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
// NOTIFICATION CLICK — Handle user actions
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var action = event.action;
  var notifData = event.notification.data || {};
  var targetUrl = notifData.url || '/?view=alertas';
  var summary = notifData.summary;

  // Handle specific actions
  if (action === 'dismiss') return;
  if (action === 'dashboard') targetUrl = '/';
  if (action === 'view' && summary) targetUrl = '/?view=alertas';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      // Focus existing window
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ============================================================
// NOTIFICATION CLOSE
// ============================================================
self.addEventListener('notificationclose', function() {
  // Track dismissed if needed
});

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
