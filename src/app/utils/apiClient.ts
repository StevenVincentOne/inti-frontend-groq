// Enhanced API Client with Smart Deduplication
// Prevents duplicate API calls that cause server redundancies
// File: src/app/utils/apiClient.ts

let pendingRequests = new Map<string, Promise<any>>();
let requestCache = new Map<string, { data: any; timestamp: number; }>();
const DEBOUNCE_MS = 200;
const CACHE_TTL_MS = 2000; // 2 second cache for repeated data

// Generate cache key including request parameters
function generateCacheKey(url: string, method: string, body?: any): string {
  const bodyHash = body ? JSON.stringify(body).slice(0, 100) : '';
  return `${method}:${url}:${bodyHash}`;
}

// Clean expired cache entries
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of requestCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      requestCache.delete(key);
    }
  }
}

export const apiClient = {
  async get(url: string, options?: RequestInit): Promise<any> {
    const key = generateCacheKey(url, 'GET');
    const now = Date.now();
    
    // Check cache first for recent identical requests
    const cached = requestCache.get(key);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`[API] 💾 Cache hit for GET ${url}`);
      return cached.data;
    }
    
    // Check for pending request
    if (pendingRequests.has(key)) {
      console.log(`[API] ⏳ Deduplicating GET request to ${url}`);
      return pendingRequests.get(key);
    }
    
    // Create request
    const promise = fetch(url, { ...options, method: 'GET' })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        // Cache the response for identical future requests
        requestCache.set(key, { data, timestamp: now });
        cleanExpiredCache();
        
        return data;
      })
      .finally(() => {
        // Clean up pending request after short delay
        setTimeout(() => pendingRequests.delete(key), DEBOUNCE_MS);
      });
    
    pendingRequests.set(key, promise);
    return promise;
  },

  async post(url: string, data?: any, options?: RequestInit): Promise<any> {
    const key = generateCacheKey(url, 'POST', data);
    
    // For POST requests, only prevent rapid duplicates, no long-term caching
    if (pendingRequests.has(key)) {
      console.log(`[API] ⏳ Preventing duplicate POST to ${url}`);
      return pendingRequests.get(key);
    }
    
    const promise = fetch(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: data ? JSON.stringify(data) : undefined
    })
    .then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .finally(() => {
      setTimeout(() => pendingRequests.delete(key), DEBOUNCE_MS);
    });
    
    pendingRequests.set(key, promise);
    return promise;
  },

  // Add stats method for monitoring
  getStats() {
    return {
      pendingRequests: pendingRequests.size,
      cachedResponses: requestCache.size
    };
  },

  // Manual cache clearing if needed
  clearCache() {
    requestCache.clear();
    console.log('[API] 🧹 Cache cleared');
  }
};