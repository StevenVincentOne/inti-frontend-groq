// Enhanced UCO Hook with Request Deduplication
// Prevents duplicate UCO requests and WebSocket messages
// File: src/app/hooks/useUCO-dedupe.tsx

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRequestDeduplication } from './useRequestDeduplication';
import { apiClient } from '../utils/deduplicatedApiClient';

// Security: Sanitize user content to prevent prompt injection
function sanitizeUserContent(content: any): any {
  if (typeof content !== 'string') return content;
  
  const dangerous = [
    /^(system|assistant|instruction):/i,
    /\[INST\]/,
    /<\|.*?\|>/,
    /###\s*(System|Instruction)/i,
    /ignore previous instructions/i,
    /disregard above/i
  ];
  
  for (const pattern of dangerous) {
    if (pattern.test(content)) {
      return '[Content filtered for security]';
    }
  }
  
  return content;
}

// Extract atomic facts for better retrieval/embedding
function extractFacts(components: any): string[] {
  const facts: string[] = [];
  const user = components?.user?.data || components?.user || {};
  const topic = components?.topic?.data || components?.topic || {};
  const conversation = components?.conversation || {};
  
  // User facts (atomic, concise)
  if (user.displayName || user.display_name) {
    facts.push(`User is ${user.displayName || user.display_name}`);
  }
  if (user.bio) facts.push(`User role: ${user.bio}`);
  if (user.intis_earned_total) facts.push(`${user.intis_earned_total} Intis earned`);
  if (user.github_username) facts.push(`GitHub: ${user.github_username}`);
  if (user.currentDraftUuid || user.current_draft_uuid) facts.push(`Has active draft`);
  
  // Topic facts
  if (topic.title || topic.title_final) {
    facts.push(`Working on: ${topic.title || topic.title_final}`);
  }
  if (topic.status || topic.stage) {
    facts.push(`Topic status: ${topic.status || topic.stage}`);
  }
  
  return facts;
}

export interface UCOState {
  components: any;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  subscribed: boolean;
  websocket: any;
}

export interface UCOActions {
  subscribe: () => void;
  unsubscribe: () => void;
  refreshData: () => void;
  getContext: (maxTokens?: number) => any;
  getFacts: () => string[];
}

export function useUCO(websocket?: any): UCOState & UCOActions {
  const [state, setState] = useState<UCOState>({
    components: {},
    loading: true,
    error: null,
    lastUpdated: 0,
    subscribed: false,
    websocket: websocket
  });

  const subscriptionRef = useRef(false);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Initialize request deduplication with UCO-specific settings
  const { deduplicatedRequest, deduplicatedWebSocketSend, clearCache } = useRequestDeduplication({
    debounceMs: 300,    // Longer debounce for UCO updates
    cacheMs: 5000,      // 5 second cache for UCO data
    enableLogging: true
  });

  // Deduplicated WebSocket message sender
  const sendWSMessage = useCallback((type: string, data?: any) => {
    if (!websocket || !websocket.send) {
      console.warn('[UCO] WebSocket not available');
      return false;
    }

    const message = { type, data, timestamp: Date.now() };
    
    // Use deduplication for WebSocket messages
    return deduplicatedRequest(
      `ws_${type}`,
      async () => {
        if (typeof websocket.send === 'function') {
          websocket.send(JSON.stringify(message));
        } else {
          // Fallback for different WebSocket implementations
          websocket.send?.(type, data);
        }
        return true;
      },
      { type, data }
    );
  }, [websocket, deduplicatedRequest]);

  // Deduplicated subscription
  const subscribe = useCallback(() => {
    if (subscriptionRef.current) {
      console.log('[UCO] Already subscribed');
      return;
    }

    deduplicatedRequest(
      'uco_subscribe',
      async () => {
        console.log('[UCO] 🔔 Subscribing to UCO updates');
        
        subscriptionRef.current = true;
        setState(prev => ({ ...prev, subscribed: true }));

        // Send subscription message
        await sendWSMessage('uco.subscribe', {
          components: ['user', 'topic', 'conversation', 'memory'],
          realtime: true
        });

        // Request initial state
        await sendWSMessage('uco.get_state', {
          include_all: true
        });

        return true;
      }
    );
  }, [deduplicatedRequest, sendWSMessage]);

  // Deduplicated unsubscription
  const unsubscribe = useCallback(() => {
    deduplicatedRequest(
      'uco_unsubscribe',
      async () => {
        console.log('[UCO] 🔕 Unsubscribing from UCO updates');
        
        subscriptionRef.current = false;
        setState(prev => ({ ...prev, subscribed: false }));

        await sendWSMessage('uco.unsubscribe');
        return true;
      }
    );
  }, [deduplicatedRequest, sendWSMessage]);

  // Deduplicated data refresh
  const refreshData = useCallback(() => {
    deduplicatedRequest(
      'uco_refresh',
      async () => {
        console.log('[UCO] 🔄 Refreshing UCO data');
        setState(prev => ({ ...prev, loading: true, error: null }));

        await sendWSMessage('uco.get_state', {
          include_all: true,
          force_refresh: true
        });

        return true;
      }
    );
  }, [deduplicatedRequest, sendWSMessage]);

  // Message handler with deduplication
  const handleMessage = useCallback((event: MessageEvent) => {
    let data: any;
    
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch (error) {
      console.error('[UCO] Failed to parse message:', error);
      return;
    }

    const { type, data: messageData } = data;
    
    // Deduplicate message processing
    const messageId = `${type}_${messageData?.timestamp || Date.now()}`;
    
    deduplicatedRequest(
      `process_${messageId}`,
      async () => {
        console.log(`[UCO] 📨 Processing message: ${type}`);

        switch (type) {
          case 'uco.state':
          case 'uco_state_response':
            setState(prev => ({
              ...prev,
              components: sanitizeUserContent(messageData || {}),
              loading: false,
              error: null,
              lastUpdated: Date.now()
            }));
            break;

          case 'uco.component_updated':
          case 'uco_component_update':
            if (messageData?.component && messageData?.data) {
              setState(prev => ({
                ...prev,
                components: {
                  ...prev.components,
                  [messageData.component]: {
                    ...prev.components[messageData.component],
                    ...sanitizeUserContent(messageData.data)
                  }
                },
                lastUpdated: Date.now()
              }));
            }
            break;

          case 'uco.error':
            setState(prev => ({
              ...prev,
              loading: false,
              error: messageData?.error || 'UCO error occurred'
            }));
            break;

          case 'uco.subscribed':
            setState(prev => ({ ...prev, subscribed: true }));
            break;

          case 'uco.unsubscribed':
            setState(prev => ({ ...prev, subscribed: false }));
            break;

          default:
            // Ignore unhandled UCO messages
            break;
        }

        return true;
      },
      { type, messageId }
    );
  }, [deduplicatedRequest]);

  // Setup WebSocket message listener
  useEffect(() => {
    if (!websocket) return;

    // Remove previous listener if exists
    if (messageHandlerRef.current && websocket.removeEventListener) {
      websocket.removeEventListener('message', messageHandlerRef.current);
    }

    // Add new listener
    messageHandlerRef.current = handleMessage;
    
    if (websocket.addEventListener) {
      websocket.addEventListener('message', handleMessage);
    } else if (websocket.on) {
      // Handle different WebSocket implementations
      websocket.on('message', handleMessage);
    }

    // Auto-subscribe when WebSocket is available
    if (websocket.readyState === WebSocket.OPEN) {
      subscribe();
    }

    return () => {
      if (messageHandlerRef.current && websocket.removeEventListener) {
        websocket.removeEventListener('message', messageHandlerRef.current);
      }
      messageHandlerRef.current = null;
    };
  }, [websocket, handleMessage, subscribe]);

  // Get context for LLM with deduplication
  const getContext = useCallback((maxTokens: number = 4000) => {
    return deduplicatedRequest(
      `get_context_${maxTokens}`,
      async () => {
        const components = state.components;
        const user = components?.user?.data || components?.user || {};
        const topic = components?.topic?.data || components?.topic || {};
        const conversation = components?.conversation || {};

        const context = {
          user: {
            name: user.displayName || user.display_name || 'User',
            bio: user.bio,
            activity: user.currentActivity || user.current_activity,
            earned: user.intis_earned_total
          },
          topic: topic.loaded ? {
            uuid: topic.uuid || topic.topic_uuid,
            title: topic.title || topic.title_final,
            stage: topic.stage || topic.status,
            hasContent: !!topic.content
          } : null,
          conversation: {
            mode: conversation.mode || 'text',
            recent: (conversation.recent || []).slice(-10),
            intent: conversation.intent
          },
          facts: extractFacts(components),
          timestamp: Date.now()
        };

        // Truncate if needed (rough token estimation)
        const contextString = JSON.stringify(context);
        const estimatedTokens = Math.ceil(contextString.length / 4);
        
        if (estimatedTokens > maxTokens) {
          // Truncate recent conversation
          const truncatedRecent = conversation.recent?.slice(-5) || [];
          context.conversation.recent = truncatedRecent;
        }

        return context;
      },
      { maxTokens, components: state.components }
    );
  }, [state.components, deduplicatedRequest]);

  // Get facts with memoization
  const getFacts = useCallback(() => {
    return extractFacts(state.components);
  }, [state.components]);

  // Update websocket reference when prop changes
  useEffect(() => {
    if (websocket !== state.websocket) {
      setState(prev => ({ ...prev, websocket }));
    }
  }, [websocket, state.websocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    refreshData,
    getContext,
    getFacts
  };
}