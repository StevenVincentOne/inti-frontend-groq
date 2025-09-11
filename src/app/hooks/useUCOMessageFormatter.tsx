/**
 * UCO Message Formatter Hook
 * Formats user messages with UCO context for LLM consumption
 * Implements delta-based updates for token efficiency
 */

import { useRef, useCallback, useState } from 'react';
import { useUCO } from './useUCO';

interface FormattedMessage {
  type: 'user_message';
  uco?: any;
  ucoDelta?: any;
  message: string;
  metadata?: {
    triggerType: string;
    isFullRefresh: boolean;
    tokenEstimate?: number;
  };
}

interface TokenStats {
  totalTokens: number;
  lastFullUCOTokens: number;
  tokensSinceFullUCO: number;
  messageCount: number;
}

// Rough token estimation (4 chars = 1 token approximation)
function estimateTokens(content: any): number {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(str.length / 4);
}

// Deep comparison for delta computation
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

// Compute delta between two UCO states
function computeDelta(previous: any, current: any): any {
  if (!previous || !current) return current;
  
  const delta: any = {};
  
  // Check each component for changes
  if (current.components) {
    const componentDelta: any = {};
    
    // User component
    if (!deepEqual(previous.components?.user, current.components.user)) {
      componentDelta.user = current.components.user;
    }
    
    // Topic component
    if (!deepEqual(previous.components?.topic, current.components.topic)) {
      componentDelta.topic = current.components.topic;
    }
    
    // Conversation component
    if (!deepEqual(previous.components?.conversation, current.components.conversation)) {
      componentDelta.conversation = current.components.conversation;
    }
    
    // Navigation component
    if (!deepEqual(previous.components?.navigation, current.components.navigation)) {
      componentDelta.navigation = current.components.navigation;
    }
    
    if (Object.keys(componentDelta).length > 0) {
      delta.components = componentDelta;
    }
  }
  
  // Check metadata changes
  if (!deepEqual(previous.metadata, current.metadata)) {
    delta.metadata = current.metadata;
  }
  
  // Always include facts if they've changed
  if (!deepEqual(previous.facts, current.facts)) {
    delta.facts = current.facts;
  }
  
  return delta;
}

export function useUCOMessageFormatter() {
  const { uco, getCanonicalJSON, getMinimalMarkdown, getFacts, connected, authenticated, loading } = useUCO();
  const lastUCORef = useRef<any>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    totalTokens: 0,
    lastFullUCOTokens: 0,
    tokensSinceFullUCO: 0,
    messageCount: 0
  });
  
  // Configuration
  const FULL_REFRESH_INTERVAL = 20000; // Refresh full UCO every 20k tokens
  const SIGNIFICANT_CHANGE_TRIGGERS = [
    'navigation_change',
    'draft_switch',
    'user_login',
    'session_start',
    'voice_start'
  ];

  /**
   * Check if UCO is ready and contains meaningful data
   */
  const isUCOReady = useCallback((): boolean => {
    // Connection must be established
    if (!connected || !authenticated || loading) {
      return false;
    }

    // UCO object must exist
    const currentUCO = getCanonicalJSON ? getCanonicalJSON() : uco?.data;
    if (!currentUCO) {
      return false;
    }

    // Check for meaningful data in components
    const components = currentUCO.components;
    if (!components) {
      return false;
    }

    // At least one component should have meaningful data
    const hasUserData = components.user && (
      components.user.displayName || 
      components.user.display_name || 
      components.user.id
    );
    
    const hasTopicData = components.topic && (
      components.topic.title || 
      components.topic.uuid || 
      components.topic.topic_uuid
    );

    const hasConversationData = components.conversation && (
      components.conversation.mode || 
      components.conversation.messages
    );

    // Return true if we have at least some meaningful data
    return hasUserData || hasTopicData || hasConversationData;
  }, [connected, authenticated, loading, getCanonicalJSON, uco]);

  /**
   * Get UCO readiness status for debugging
   */
  const getUCOStatus = useCallback(() => {
    const currentUCO = getCanonicalJSON ? getCanonicalJSON() : uco?.data;
    return {
      connected,
      authenticated,
      loading,
      hasUCO: !!currentUCO,
      hasComponents: !!(currentUCO?.components),
      hasUserData: !!(currentUCO?.components?.user?.displayName || currentUCO?.components?.user?.display_name),
      hasTopicData: !!(currentUCO?.components?.topic?.title || currentUCO?.components?.topic?.uuid),
      isReady: isUCOReady()
    };
  }, [connected, authenticated, loading, getCanonicalJSON, uco, isUCOReady]);
  
  /**
   * Format a user message with appropriate UCO context
   * @param userInput - The user's input (transcribed speech or typed text)
   * @param triggerType - What triggered this message (speech, text, navigation, etc.)
   * @param forceFullUCO - Force sending the full UCO regardless of delta logic
   * @param waitForReady - If true, will return special status when UCO not ready
   */
  const formatMessageWithUCO = useCallback((
    userInput: string,
    triggerType: string = 'user_input',
    forceFullUCO: boolean = false,
    waitForReady: boolean = false
  ): FormattedMessage | string | { status: 'not_ready', debug: any } => {
    
    // Check if UCO is ready
    if (!isUCOReady()) {
      const debugInfo = getUCOStatus();
      console.log('[UCOFormatter] UCO not ready:', debugInfo);
      
      if (waitForReady) {
        // Return special status to indicate caller should wait
        return { 
          status: 'not_ready' as const, 
          debug: debugInfo 
        };
      } else {
        // Fallback to plain message
        console.log('[UCOFormatter] UCO not ready, sending plain message');
        return userInput;
      }
    }

    // Get current UCO data (we know it's ready now)
    const currentUCO = getCanonicalJSON ? getCanonicalJSON() : uco?.data;
    
    console.log('[UCOFormatter] UCO is ready, formatting message with context:', {
      triggerType,
      forceFullUCO,
      hasUserData: !!(currentUCO?.components?.user?.displayName || currentUCO?.components?.user?.display_name),
      hasTopicData: !!(currentUCO?.components?.topic?.title || currentUCO?.components?.topic?.uuid),
      userInput: userInput.substring(0, 50) + (userInput.length > 50 ? '...' : '')
    });
    
    // Determine if we need full UCO
    const isFirstMessage = !lastUCORef.current || tokenStats.messageCount === 0;
    const tokenLimitReached = tokenStats.tokensSinceFullUCO >= FULL_REFRESH_INTERVAL;
    const isSignificantChange = SIGNIFICANT_CHANGE_TRIGGERS.includes(triggerType);
    const needsFullUCO = forceFullUCO || isFirstMessage || tokenLimitReached || isSignificantChange;
    
    let formattedMessage: FormattedMessage;
    
    if (needsFullUCO) {
      console.log('[UCOFormatter] Sending full UCO:', {
        reason: isFirstMessage ? 'first_message' : 
                tokenLimitReached ? 'token_limit' : 
                isSignificantChange ? 'significant_change' :
                forceFullUCO ? 'forced' : 'unknown',
        triggerType
      });
      
      // Send full UCO
      formattedMessage = {
        type: 'user_message',
        uco: currentUCO,
        message: userInput,
        metadata: {
          triggerType,
          isFullRefresh: true,
          tokenEstimate: estimateTokens(currentUCO) + estimateTokens(userInput)
        }
      };
      
      // Update token tracking
      const tokens = formattedMessage.metadata.tokenEstimate || 0;
      setTokenStats(prev => ({
        totalTokens: prev.totalTokens + tokens,
        lastFullUCOTokens: prev.totalTokens + tokens,
        tokensSinceFullUCO: 0,
        messageCount: prev.messageCount + 1
      }));
      
      // Store current UCO for delta computation
      lastUCORef.current = JSON.parse(JSON.stringify(currentUCO));
      
    } else {
      // Compute delta
      const delta = computeDelta(lastUCORef.current, currentUCO);
      
      // If no changes, just send the message
      if (!delta || Object.keys(delta).length === 0) {
        console.log('[UCOFormatter] No UCO changes, sending plain message');
        
        const tokens = estimateTokens(userInput);
        setTokenStats(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + tokens,
          tokensSinceFullUCO: prev.tokensSinceFullUCO + tokens,
          messageCount: prev.messageCount + 1
        }));
        
        return userInput;
      }
      
      console.log('[UCOFormatter] Sending UCO delta:', {
        changedComponents: Object.keys(delta.components || {}),
        triggerType
      });
      
      // Send delta update
      formattedMessage = {
        type: 'user_message',
        ucoDelta: delta,
        message: userInput,
        metadata: {
          triggerType,
          isFullRefresh: false,
          tokenEstimate: estimateTokens(delta) + estimateTokens(userInput)
        }
      };
      
      // Update token tracking
      const tokens = formattedMessage.metadata.tokenEstimate || 0;
      setTokenStats(prev => ({
        ...prev,
        totalTokens: prev.totalTokens + tokens,
        tokensSinceFullUCO: prev.tokensSinceFullUCO + tokens,
        messageCount: prev.messageCount + 1
      }));
      
      // Update stored UCO
      lastUCORef.current = JSON.parse(JSON.stringify(currentUCO));
    }
    
    return formattedMessage;
  }, [uco, getCanonicalJSON, tokenStats, isUCOReady, getUCOStatus]);
  
  /**
   * Format a message for display/debugging
   */
  const formatForDisplay = useCallback((message: FormattedMessage | string): string => {
    if (typeof message === 'string') return message;
    
    return JSON.stringify(message, null, 2);
  }, []);
  
  /**
   * Get current token statistics
   */
  const getTokenStats = useCallback((): TokenStats => {
    return tokenStats;
  }, [tokenStats]);
  
  /**
   * Reset the formatter state (use when starting a new conversation)
   */
  const reset = useCallback(() => {
    lastUCORef.current = null;
    setTokenStats({
      totalTokens: 0,
      lastFullUCOTokens: 0,
      tokensSinceFullUCO: 0,
      messageCount: 0
    });
    console.log('[UCOFormatter] Reset formatter state');
  }, []);
  
  return {
    formatMessageWithUCO,
    formatForDisplay,
    getTokenStats,
    reset,
    // UCO readiness checking
    isUCOReady,
    getUCOStatus,
    // Expose configuration for debugging
    config: {
      FULL_REFRESH_INTERVAL,
      SIGNIFICANT_CHANGE_TRIGGERS
    }
  };
}