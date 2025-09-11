// Enhanced PWA service worker for Inti with better error handling
const CACHE_NAME = "inti-v2-uco";
const urlsToCache = [
  "/",
  "/manifest.json"
];

// Utility function to safely cache responses
async function safeCachePut(cache, request, response) {
  try {
    // Only cache if response is valid
    if (!response || response.status === 0 || response.status >= 400) {
      return;
    }
    
    // Don't cache opaque responses or non-basic responses
    if (response.type !== 'basic' && response.type !== 'cors') {
      return;
    }
    
    await cache.put(request, response);
  } catch (error) {
    // Silently handle cache errors
    console.warn('Cache.put failed:', error.message);
  }
}

self.addEventListener("install", (event) => {
  console.log('[ServiceWorker] Install');
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        // Try to cache URLs but don't fail installation if caching fails
        return cache.addAll(urlsToCache).catch(error => {
          console.warn('[ServiceWorker] Failed to cache some resources:', error);
          // Continue with installation even if some resources fail to cache
          return Promise.resolve();
        });
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log('[ServiceWorker] Activate');
  // Claim clients immediately
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[ServiceWorker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients
      clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Skip API calls - don't cache dynamic content
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Network-first strategy with fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Return response and update cache in background
        if (response && response.status === 200) {
          const responseClone = response.clone();
          
          // Update cache in background without blocking response
          caches.open(CACHE_NAME).then((cache) => {
            safeCachePut(cache, event.request, responseClone);
          }).catch(() => {
            // Ignore cache errors
          });
        }
        
        return response;
      })
      .catch((error) => {
        // Network failed, try cache
        console.log('[ServiceWorker] Fetch failed, trying cache:', event.request.url);
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          
          // If it's a navigation request, return the index page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          
          // Return a basic offline response
          return new Response('Offline - resource not cached', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});