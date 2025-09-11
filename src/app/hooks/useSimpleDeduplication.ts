// Simple Request Deduplication Hook
// Only prevents rapid duplicate requests - no WebSocket changes
// File: src/app/hooks/useSimpleDeduplication.ts

import { useRef, useCallback } from 'react';

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

export function useSimpleDeduplication() {
  const pendingRequests = useRef(new Map<string, PendingRequest>());
  const DEBOUNCE_MS = 200; // 200ms debounce window

  const deduplicatedFetch = useCallback(async (
    url: string,
    options?: RequestInit
  ): Promise<Response> => {
    const key = `${options?.method || 'GET'}:${url}`;
    const now = Date.now();
    
    // Check if same request is already pending
    const pending = pendingRequests.current.get(key);
    if (pending && (now - pending.timestamp) < DEBOUNCE_MS) {
      console.log(`[SIMPLE-DEDUPE] Skipping duplicate request to ${url}`);
      return pending.promise;
    }
    
    // Create new request
    const promise = fetch(url, options);
    pendingRequests.current.set(key, { promise, timestamp: now });
    
    try {
      const response = await promise;
      pendingRequests.current.delete(key);
      return response;
    } catch (error) {
      pendingRequests.current.delete(key);
      throw error;
    }
  }, []);

  return { deduplicatedFetch };
}