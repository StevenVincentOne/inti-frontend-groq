// Frontend Request Deduplication Hook
// Eliminates duplicate API calls and WebSocket messages
// File: src/app/hooks/useRequestDeduplication.ts

'use client';

import { useCallback, useRef, useEffect } from 'react';

interface PendingRequest {
  timestamp: number;
  promise: Promise<any>;
}

interface RequestCache {
  data: any;
  timestamp: number;
}

export interface RequestDeduplicationConfig {
  debounceMs: number;    // Minimum time between identical requests
  cacheMs: number;       // How long to cache identical responses
  maxPendingRequests: number; // Maximum number of concurrent requests
  enableLogging: boolean; // Log deduplication actions
}

const DEFAULT_CONFIG: RequestDeduplicationConfig = {
  debounceMs: 100,
  cacheMs: 1000,
  maxPendingRequests: 5,
  enableLogging: process.env.NODE_ENV === 'development'
};

export function useRequestDeduplication(config: Partial<RequestDeduplicationConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const pendingRequests = useRef(new Map<string, PendingRequest>());
  const responseCache = useRef(new Map<string, RequestCache>());
  
  // Generate cache key from request parameters
  const generateKey = useCallback((identifier: string, params?: any): string => {
    const paramString = params ? JSON.stringify(params) : '';
    return `${identifier}:${paramString}`;
  }, []);

  // Clean up expired entries
  const cleanup = useCallback(() => {
    const now = Date.now();
    
    // Clean expired pending requests
    for (const [key, request] of pendingRequests.current.entries()) {
      if (now - request.timestamp > 30000) { // 30 second timeout
        pendingRequests.current.delete(key);
      }
    }
    
    // Clean expired cache entries
    for (const [key, cached] of responseCache.current.entries()) {
      if (now - cached.timestamp > finalConfig.cacheMs) {
        responseCache.current.delete(key);
      }
    }
  }, [finalConfig.cacheMs]);

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(cleanup, 5000); // Clean every 5 seconds
    return () => clearInterval(interval);
  }, [cleanup]);

  // Deduplicated request function
  const deduplicatedRequest = useCallback(async <T>(
    identifier: string,
    requestFn: () => Promise<T>,
    params?: any
  ): Promise<T | null> => {
    const key = generateKey(identifier, params);
    const now = Date.now();
    
    // Check cache first
    const cached = responseCache.current.get(key);
    if (cached && (now - cached.timestamp) < finalConfig.cacheMs) {
      if (finalConfig.enableLogging) {
        console.log(`[DEDUPE] Cache hit for ${identifier}`);
      }
      return cached.data;
    }
    
    // Check if request is already pending
    const pending = pendingRequests.current.get(key);
    if (pending && (now - pending.timestamp) < finalConfig.debounceMs) {
      if (finalConfig.enableLogging) {
        console.log(`[DEDUPE] Skipping duplicate request for ${identifier}`);
      }
      return pending.promise;
    }
    
    // Limit concurrent requests
    if (pendingRequests.current.size >= finalConfig.maxPendingRequests) {
      if (finalConfig.enableLogging) {
        console.warn(`[DEDUPE] Max concurrent requests reached, skipping ${identifier}`);
      }
      return null;
    }
    
    // Make new request
    if (finalConfig.enableLogging) {
      console.log(`[DEDUPE] Making request for ${identifier}`);
    }
    
    const promise = requestFn();
    pendingRequests.current.set(key, { timestamp: now, promise });
    
    try {
      const result = await promise;
      
      // Cache successful result
      responseCache.current.set(key, { data: result, timestamp: now });
      
      return result;
    } catch (error) {
      // Don't cache errors
      if (finalConfig.enableLogging) {
        console.error(`[DEDUPE] Request failed for ${identifier}:`, error);
      }
      throw error;
    } finally {
      // Remove from pending
      pendingRequests.current.delete(key);
    }
  }, [generateKey, finalConfig]);

  // WebSocket message deduplication
  const deduplicatedWebSocketSend = useCallback((
    ws: WebSocket | null,
    message: any,
    identifier?: string
  ): boolean => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const msgId = identifier || message.type || 'unknown';
    const key = generateKey(`ws_${msgId}`, message);
    const now = Date.now();
    
    // Check if same message was sent recently
    const pending = pendingRequests.current.get(key);
    if (pending && (now - pending.timestamp) < finalConfig.debounceMs) {
      if (finalConfig.enableLogging) {
        console.log(`[DEDUPE] Skipping duplicate WebSocket message: ${msgId}`);
      }
      return false;
    }
    
    // Send message
    ws.send(JSON.stringify(message));
    
    // Track sent message
    pendingRequests.current.set(key, { 
      timestamp: now, 
      promise: Promise.resolve() 
    });
    
    if (finalConfig.enableLogging) {
      console.log(`[DEDUPE] Sent WebSocket message: ${msgId}`);
    }
    
    return true;
  }, [generateKey, finalConfig]);

  // Clear cache and pending requests
  const clearCache = useCallback(() => {
    responseCache.current.clear();
    pendingRequests.current.clear();
  }, []);

  // Get cache stats
  const getStats = useCallback(() => {
    return {
      pendingRequests: pendingRequests.current.size,
      cachedResponses: responseCache.current.size
    };
  }, []);

  return {
    deduplicatedRequest,
    deduplicatedWebSocketSend,
    clearCache,
    getStats,
    cleanup
  };
}