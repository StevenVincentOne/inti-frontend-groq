// Deduplicated API Client
// Wrapper around fetch with request deduplication and caching
// File: src/app/utils/deduplicatedApiClient.ts

'use client';

interface ApiCache {
  data: any;
  timestamp: number;
  etag?: string;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class DeduplicatedApiClient {
  private cache = new Map<string, ApiCache>();
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly defaultTTL = 5000; // 5 seconds
  private readonly debounceMs = 200;  // 200ms debounce
  
  private generateCacheKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    const headers = JSON.stringify(options?.headers || {});
    return `${method}:${url}:${headers}:${body}`;
  }

  private isRequestCacheable(method: string): boolean {
    return ['GET', 'HEAD'].includes(method.toUpperCase());
  }

  private shouldUseCache(cacheKey: string, ttl: number): ApiCache | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > ttl;
    if (isExpired) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached;
  }

  async request<T = any>(
    url: string, 
    options: RequestInit & { ttl?: number; bypassCache?: boolean } = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, bypassCache = false, ...fetchOptions } = options;
    const method = fetchOptions.method || 'GET';
    const cacheKey = this.generateCacheKey(url, fetchOptions);

    // Check for duplicate request in progress
    const pending = this.pendingRequests.get(cacheKey);
    if (pending && Date.now() - pending.timestamp < this.debounceMs) {
      console.log(`[API] Deduplicating request to ${url}`);
      return pending.promise;
    }

    // Check cache for GET/HEAD requests
    if (!bypassCache && this.isRequestCacheable(method)) {
      const cached = this.shouldUseCache(cacheKey, ttl);
      if (cached) {
        console.log(`[API] Cache hit for ${url}`);
        return cached.data;
      }
    }

    // Make the request
    console.log(`[API] Making request to ${url}`);
    const requestPromise = this.makeRequest<T>(url, fetchOptions);
    
    // Track pending request
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise,
      timestamp: Date.now()
    });

    try {
      const result = await requestPromise;
      
      // Cache GET/HEAD responses
      if (this.isRequestCacheable(method)) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;
    } finally {
      // Remove from pending
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      console.error(`[API] Request failed for ${url}:`, error);
      throw error;
    }
  }

  // Convenience methods
  get<T = any>(url: string, options?: RequestInit & { ttl?: number }): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T = any>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  put<T = any>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  delete<T = any>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  evictCache(pattern?: string): void {
    if (!pattern) {
      this.clearCache();
      return;
    }

    const regex = new RegExp(pattern);
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const apiClient = new DeduplicatedApiClient();
export default apiClient;