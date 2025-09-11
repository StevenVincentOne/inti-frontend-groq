// Enhanced Inti Communication Provider with Request Deduplication
// Prevents duplicate WebSocket messages and API calls
// File: /frontend/src/app/components/IntiCommunicationProvider-dedupe.tsx

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { DeduplicatedWebSocket } from '../utils/deduplicatedWebSocket';
import { useRequestDeduplication } from '../hooks/useRequestDeduplication';

interface User {
  id: string | number;
  username: string | null;
  displayName: string | null;
  email: string | null;
  profileImage: string | null;
}

interface IntiCommunicationState {
  loading: boolean;
  user: User | null;
  authenticated: boolean;
  error: string | null;
  connected: boolean;
  clientId: string | null;
}

interface IntiCommunicationActions {
  // Connection management
  sendMessage: (type: string, data?: unknown) => void;
  
  // Voice interaction
  sendVoiceTranscription: (transcription: string, audioData?: unknown) => void;
  
  // Auth functionality
  logout: () => void;
  refreshAuth: () => void;
}

type IntiCommunicationContextType = IntiCommunicationState & IntiCommunicationActions;

const IntiCommunicationContext = createContext<IntiCommunicationContextType | undefined>(undefined);

const REPLIT_WS_URL = 'wss://6d3f40b3-1e49-4b09-85e4-36ff422ee88b-00-psvr1owg24vj.janeway.replit.dev/api/inti-ws';

// Helper function to extract profile image from user data
const extractProfileImage = (userData: any): string | null => {
  return userData.profileImage || userData.profile_image_url || userData.profile_image || null;
};

export function IntiCommunicationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IntiCommunicationState>({
    loading: true,
    user: null,
    authenticated: false,
    error: null,
    connected: false,
    clientId: null,
  });

  const wsRef = useRef<DeduplicatedWebSocket | null>(null);
  const connectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize request deduplication
  const { deduplicatedRequest, deduplicatedWebSocketSend, getStats } = useRequestDeduplication({
    debounceMs: 200,    // 200ms debounce for rapid requests
    cacheMs: 2000,      // 2 second cache for repeated data
    enableLogging: true
  });

  // Enhanced sendMessage with deduplication
  const sendMessage = useCallback((type: string, data?: unknown) => {
    if (!wsRef.current) {
      console.warn('[IntiComm] WebSocket not connected, cannot send message');
      return;
    }

    const message = { type, data, timestamp: Date.now() };
    
    // Use deduplicated WebSocket send
    const sent = wsRef.current.send(message);
    if (!sent) {
      console.log(`[IntiComm] Message ${type} was deduplicated or queued`);
    }
  }, []);

  // Enhanced voice transcription sending
  const sendVoiceTranscription = useCallback((transcription: string, audioData?: unknown) => {
    if (!transcription.trim()) {
      console.log('[IntiComm] Empty transcription, skipping send');
      return;
    }

    // Deduplicate based on transcription content
    const messageKey = `voice_transcription_${transcription.substring(0, 50)}`;
    
    deduplicatedRequest(
      messageKey,
      async () => {
        sendMessage('voice_transcription', {
          transcription: transcription.trim(),
          audioData,
          timestamp: Date.now(),
        });
        return true;
      },
      { transcription }
    );
  }, [sendMessage, deduplicatedRequest]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    let parsedData: any;
    
    try {
      parsedData = JSON.parse(event.data);
    } catch (error) {
      console.error('[IntiComm] Failed to parse WebSocket message:', error);
      return;
    }

    const { type, data } = parsedData;
    console.log(`[IntiComm] 📨 Message received: ${type}`, data);

    // Prevent processing duplicate messages
    const messageId = `${type}_${data?.timestamp || Date.now()}`;
    
    deduplicatedRequest(
      `process_${messageId}`,
      async () => {
        switch (type) {
          case 'connection_established':
          case 'connection.established':
            console.log('[IntiComm] ✅ Connection established:', data);
            
            if (data?.authenticated && data?.user && data.user.displayName && data.user.displayName !== 'Replit User') {
              const user: User = {
                id: data.user.id || data.user.userId || 'authenticated_user',
                displayName: data.user.displayName,
                username: data.user.username || data.user.displayName,
                email: data.user.email || null,
                profileImage: extractProfileImage(data.user)
              };

              console.log('[IntiComm] ✅ Successfully authenticated user:', user.displayName);
              
              const authData = { user, authenticated: true };
              localStorage.setItem('inti_auth', JSON.stringify(authData));
              sessionStorage.setItem('inti_auth', JSON.stringify(authData));

              setState(prev => ({
                ...prev,
                loading: false,
                user,
                authenticated: true,
                connected: true,
                clientId: data?.clientId || data?.connectionId || prev.clientId,
                error: null
              }));

              if (authCheckTimeoutRef.current) {
                clearTimeout(authCheckTimeoutRef.current);
                authCheckTimeoutRef.current = null;
              }
            } else {
              setState(prev => ({
                ...prev,
                loading: false,
                connected: true,
                clientId: data?.clientId || data?.connectionId || prev.clientId
              }));
            }
            break;

          case 'auth.response':
          case 'authentication_response':
            console.log('[IntiComm] 🔐 Auth response:', data);
            
            if (data?.authenticated && data.user?.displayName && data.user.displayName !== 'Replit User') {
              const user: User = {
                id: data.user.id || data.user.userId || 'authenticated_user',
                displayName: data.user.displayName,
                username: data.user.username || data.user.displayName,
                email: data.user.email || null,
                profileImage: extractProfileImage(data.user)
              };

              console.log('[IntiComm] ✅ Authentication successful for:', user.displayName);
              
              const authData = { user, authenticated: true };
              localStorage.setItem('inti_auth', JSON.stringify(authData));
              sessionStorage.setItem('inti_auth', JSON.stringify(authData));

              setState(prev => ({
                ...prev,
                loading: false,
                user,
                authenticated: true,
                error: null
              }));
            } else {
              console.log('[IntiComm] ❌ Authentication failed or incomplete');
              setState(prev => ({
                ...prev,
                loading: false,
                authenticated: false,
                error: 'Authentication failed'
              }));
            }
            break;

          default:
            // Handle other message types
            console.log(`[IntiComm] Unhandled message type: ${type}`, data);
            break;
        }
        
        return true;
      },
      { type, messageId }
    );
  }, [deduplicatedRequest]);

  // Initialize WebSocket connection
  const initializeConnection = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    console.log('[IntiComm] 🔌 Initializing WebSocket connection...');
    
    try {
      wsRef.current = new DeduplicatedWebSocket(REPLIT_WS_URL);
      
      wsRef.current.addEventListener('open', (event) => {
        console.log('[IntiComm] ✅ WebSocket connected');
        connectAttemptRef.current = 0;
        
        setState(prev => ({ ...prev, connected: true, error: null }));
        
        // Send authentication request
        sendMessage('auth.request');
        
        // Set auth timeout
        authCheckTimeoutRef.current = setTimeout(() => {
          console.log('[IntiComm] ⏱️ Auth timeout, attempting stored auth check');
          checkStoredAuth();
        }, 3000);
      });
      
      wsRef.current.addEventListener('message', handleMessage);
      
      wsRef.current.addEventListener('error', (event) => {
        console.error('[IntiComm] ❌ WebSocket error:', event);
        setState(prev => ({ ...prev, error: 'Connection error' }));
      });
      
      wsRef.current.addEventListener('close', (event) => {
        console.log('[IntiComm] 🔌 WebSocket closed:', event.code, event.reason);
        setState(prev => ({ ...prev, connected: false }));
        
        // Attempt reconnection
        if (connectAttemptRef.current < maxReconnectAttempts) {
          connectAttemptRef.current++;
          const delay = Math.min(1000 * Math.pow(2, connectAttemptRef.current), 10000);
          console.log(`[IntiComm] 🔄 Attempting reconnect in ${delay}ms (attempt ${connectAttemptRef.current})`);
          
          setTimeout(() => {
            initializeConnection();
          }, delay);
        } else {
          console.error('[IntiComm] ❌ Max reconnection attempts reached');
          setState(prev => ({ ...prev, error: 'Connection failed - max retries exceeded' }));
        }
      });
      
      wsRef.current.connect();
    } catch (error) {
      console.error('[IntiComm] Failed to initialize WebSocket:', error);
      setState(prev => ({ ...prev, error: 'Failed to initialize connection' }));
    }
  }, [sendMessage, handleMessage]);

  // Check for stored authentication
  const checkStoredAuth = useCallback(() => {
    deduplicatedRequest(
      'check_stored_auth',
      async () => {
        try {
          const storedAuth = localStorage.getItem('inti_auth') || sessionStorage.getItem('inti_auth');
          if (storedAuth) {
            const authData = JSON.parse(storedAuth);
            if (authData.authenticated && authData.user) {
              console.log('[IntiComm] 💾 Found stored authentication for:', authData.user.displayName);
              
              setState(prev => ({
                ...prev,
                loading: false,
                user: authData.user,
                authenticated: true,
                error: null
              }));
              return authData;
            }
          }
        } catch (error) {
          console.error('[IntiComm] Error checking stored auth:', error);
        }
        
        setState(prev => ({ ...prev, loading: false }));
        return null;
      }
    );
  }, [deduplicatedRequest]);

  // Logout functionality
  const logout = useCallback(() => {
    console.log('[IntiComm] 🚪 Logging out...');
    
    localStorage.removeItem('inti_auth');
    sessionStorage.removeItem('inti_auth');
    
    setState(prev => ({
      ...prev,
      user: null,
      authenticated: false,
      loading: false,
      error: null
    }));
    
    sendMessage('logout');
  }, [sendMessage]);

  // Refresh authentication
  const refreshAuth = useCallback(() => {
    console.log('[IntiComm] 🔄 Refreshing authentication...');
    setState(prev => ({ ...prev, loading: true }));
    sendMessage('auth.request');
  }, [sendMessage]);

  // Initialize connection on mount
  useEffect(() => {
    checkStoredAuth();
    initializeConnection();
    
    // Cleanup on unmount
    return () => {
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Log deduplication stats periodically in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const statsInterval = setInterval(() => {
        const stats = getStats();
        if (stats.pendingRequests > 0 || stats.cachedResponses > 0) {
          console.log('[DEDUPE] Stats:', stats);
        }
      }, 10000);
      
      return () => clearInterval(statsInterval);
    }
  }, [getStats]);

  const contextValue: IntiCommunicationContextType = {
    ...state,
    sendMessage,
    sendVoiceTranscription,
    logout,
    refreshAuth,
  };

  return (
    <IntiCommunicationContext.Provider value={contextValue}>
      {children}
    </IntiCommunicationContext.Provider>
  );
}

export function useIntiCommunication() {
  const context = useContext(IntiCommunicationContext);
  if (context === undefined) {
    throw new Error('useIntiCommunication must be used within an IntiCommunicationProvider');
  }
  return context;
}