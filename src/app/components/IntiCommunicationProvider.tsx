'use client';

// Combined Inti Communication and Authentication Provider
// FIXED: Always connects to WebSocket even with stored auth
// File: /frontend/src/app/components/IntiCommunicationProvider.tsx

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

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

const WEBSOCKET_URL = 'wss://inti.intellipedia.ai/ws';

// Helper function to extract profile image from user data with proper field mapping
const extractProfileImage = (userData: any): string | null => {
  // Handle multiple possible field names from the backend
  return userData.profileImage || userData.profile_image_url || userData.profile_image || null;
};

export function IntiCommunicationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IntiCommunicationState>({
    loading: true,
    user: null,
    authenticated: false,
    error: null,
    connected: false,
    clientId: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStateRef = useRef<boolean>(false);

  // Derive the HTTP base for Replit from the WS URL
  const getReplitHttpBase = () => {
    try {
      const u = new URL(WEBSOCKET_URL);
      u.protocol = (u.protocol === 'wss:') ? 'https:' : 'http:';
      u.pathname = '';
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      // Fallback: replace wss/ws with https/http and strip path
      return WEBSOCKET_URL
        .replace(/^wss:/, 'https:')
        .replace(/^ws:/, 'http:')
        .replace(/\/api\/inti-ws.*$/, '');
    }
  };

  // Preflight cookie-based whoami to set initial auth state
  const preflightWhoami = useCallback(async () => {
    const whoamiUrl = `${getReplitHttpBase()}/api/session/whoami`;
    try {
      const res = await fetch(whoamiUrl, { credentials: 'include', mode: 'cors' });
      if (!res.ok) {
        console.log('[IntiComm] whoami not authenticated:', res.status);
        return false;
      }
      const body = await res.json();
      const u = body?.user;
      if (u && (u.displayName || u.display_name)) {
        const user: User = {
          id: u.id || 'authenticated_user',
          displayName: u.displayName || u.display_name,
          username: u.username || (u.displayName || u.display_name) || null,
          email: u.email || null,
          profileImage: extractProfileImage(u)
        };
        const authData = { user, authenticated: true };
        localStorage.setItem('inti_auth', JSON.stringify(authData));
        sessionStorage.setItem('inti_auth', JSON.stringify(authData));
        setState(prev => ({ ...prev, loading: false, user, authenticated: true, error: null }));
        authStateRef.current = true;
        console.log('[IntiComm] whoami authenticated:', user.displayName);
        return true;
      }
    } catch (e) {
      console.log('[IntiComm] whoami error:', e);
    }
    return false;
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;

      // Store clientId if provided
      if (message.clientId) {
        setState(prev => ({ ...prev, clientId: message.clientId }));
      }

      switch (type) {
        case 'connection_established':
        case 'connection.established': {
          const establishedAuth = data?.authenticated ?? message.authenticated;
          const establishedUser = data?.user ?? message.user;
          console.log('[IntiComm] ✅ Connection established:', { authenticated: establishedAuth, user: establishedUser });
          
          // Check if we have authentication info  
          if (establishedAuth && establishedUser && establishedUser.displayName && establishedUser.displayName !== 'Replit User') {
            const user: User = {
              id: establishedUser.id || establishedUser.userId || 'authenticated_user',
              displayName: establishedUser.displayName,
              username: establishedUser.username || establishedUser.displayName,
              email: establishedUser.email || null,
              profileImage: extractProfileImage(establishedUser)
            };

            console.log('[IntiComm] ✅ Successfully authenticated user:', user.displayName);
            console.log('[IntiComm] Profile image extracted:', user.profileImage);
            
            const authData = { user, authenticated: true };
            localStorage.setItem('inti_auth', JSON.stringify(authData));
            sessionStorage.setItem('inti_auth', JSON.stringify(authData));

            setState(prev => ({
              ...prev,
              loading: false,
              user,
              authenticated: true,
              connected: true,
              clientId: data?.clientId || data?.connectionId || message.clientId || prev.clientId,
              error: null
            }));
            authStateRef.current = true;

            if (authCheckTimeoutRef.current) {
              clearTimeout(authCheckTimeoutRef.current);
              authCheckTimeoutRef.current = null;
            }
          } else {
            setState(prev => ({
              ...prev,
              loading: false,
              connected: true,
              clientId: data?.clientId || data?.connectionId || message.clientId || prev.clientId
            }));
          }
          // Request explicit auth resolution if not authenticated
          try { wsRef.current?.send(JSON.stringify({ type: 'auth.resolve' })); } catch {}
          break; }

        case 'userState': {
          // Be tolerant: only flip to unauthenticated on explicit negative; otherwise update when a valid user payload is present.
          const payload = data ?? message.data;
          const candidate = payload?.user ?? payload;
          const authFlag = payload?.authenticated;
          console.log('[IntiComm] 👤 User state received:', payload);

          const displayName = candidate?.displayName || candidate?.display_name;
          if (displayName && displayName !== 'Replit User') {
            const user: User = {
              id: candidate.userId || candidate.id || 'authenticated_user',
              displayName,
              username: candidate.username || displayName,
              email: candidate.email || null,
              profileImage: extractProfileImage(candidate)
            };
            console.log('[IntiComm] ✅ Authenticated user (userState):', user.displayName);
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
            authStateRef.current = true;

            if (authCheckTimeoutRef.current) {
              clearTimeout(authCheckTimeoutRef.current);
              authCheckTimeoutRef.current = null;
            }
          } else if (authFlag === false) {
            // Explicit unauthenticated
            console.log('[IntiComm] User state indicates unauthenticated');
            setState(prev => ({ ...prev, loading: false, user: null, authenticated: false, error: null }));
          } else {
            // Ignore ambiguous updates to avoid overriding a valid authenticated state
            console.log('[IntiComm] Ignoring ambiguous userState (no displayName/auth flag)');
          }
          break; }

        case 'ping':
          // Respond to ping with pong
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          break;

        case 'auth.logout_success':
          console.log('[IntiComm] ✅ Logout successful:', data);
          // Clear all auth data
          localStorage.removeItem('inti_auth');
          sessionStorage.removeItem('inti_auth');
          localStorage.removeItem('sessionId');
          sessionStorage.removeItem('sessionId');
          
          setState(prev => ({
            ...prev,
            loading: false,
            user: null,
            authenticated: false,
            error: null
          }));
          authStateRef.current = false;
          
          // Dispatch logout event for other components
          window.dispatchEvent(new CustomEvent('inti-logout', { detail: { success: true } }));
          break;

        case 'auth.user_logged_out':
          console.log('[IntiComm] 🚪 User logged out from another client:', data);
          // Clear all auth data
          localStorage.removeItem('inti_auth');
          sessionStorage.removeItem('inti_auth');
          localStorage.removeItem('sessionId');
          sessionStorage.removeItem('sessionId');
          
          setState(prev => ({
            ...prev,
            loading: false,
            user: null,
            authenticated: false,
            error: null
          }));
          authStateRef.current = false;
          
          // Dispatch logout event for other components
          window.dispatchEvent(new CustomEvent('inti-logout', { 
            detail: { success: true, remote: true, loggedOutBy: data?.loggedOutBy } 
          }));
          break;

        case 'auth.logout_error':
          console.error('[IntiComm] ❌ Logout error:', data);
          // Still clear local state even on error
          localStorage.removeItem('inti_auth');
          sessionStorage.removeItem('inti_auth');
          localStorage.removeItem('sessionId');
          sessionStorage.removeItem('sessionId');
          
          setState(prev => ({
            ...prev,
            loading: false,
            user: null,
            authenticated: false,
            error: null
          }));
          
          // Dispatch logout event for other components
          window.dispatchEvent(new CustomEvent('inti-logout', { 
            detail: { success: false, error: data?.error } 
          }));
          break;

        case 'auth.response': {
          const respAuth = (data?.authenticated ?? message.authenticated) as boolean | undefined;
          const respUser = (data?.user ?? message.user) as any;
          console.log('[IntiComm] 🔐 Auth response received:', { authenticated: respAuth, user: respUser });
          if (respAuth && respUser && respUser.displayName && respUser.displayName !== 'Replit User') {
            const user: User = {
              id: respUser.id || respUser.userId || 'authenticated_user',
              displayName: respUser.displayName,
              username: respUser.username || respUser.displayName,
              email: respUser.email || null,
              profileImage: extractProfileImage(respUser)
            };

            console.log('[IntiComm] ✅ Successfully authenticated user from auth.response:', user.displayName);
            console.log('[IntiComm] Profile image extracted:', user.profileImage);
            
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

            if (authCheckTimeoutRef.current) {
              clearTimeout(authCheckTimeoutRef.current);
              authCheckTimeoutRef.current = null;
            }
          } else {
            console.log('[IntiComm] Auth response indicates user not authenticated or invalid data');
            // Be conservative: only downgrade if we are not already authenticated
            setState(prev => {
              if (authStateRef.current) {
                return { ...prev, loading: false, error: null };
              }
              authStateRef.current = false;
              return { ...prev, loading: false, user: null, authenticated: false, error: null };
            });
          }
          break; }

        case 'uco.app_loaded': {
          // Reduce log noise for UCO bootstrap messages
          return;
        }

        default:
          // Keep as debug-only for unexpected message types
          // console.debug('[IntiComm] Unhandled message type:', type);
          return;
      }
    } catch (error) {
      console.error('[IntiComm] Error parsing message:', error);
    }
  }, []);

  // Send message via WebSocket - FIXED to include clientId
  const sendMessage = useCallback((type: string, data?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Updated to match Replit Agent's expected format
      const message = { 
        type, 
        clientId: state.clientId || 'unknown',
        data: data || {}, 
        timestamp: Date.now() 
      };
      wsRef.current.send(JSON.stringify(message));
      console.log('[IntiComm] Sent message:', message);
    } else {
      console.warn('[IntiComm] Cannot send message - WebSocket not connected:', { type, data });
    }
  }, [state.clientId]);

  // Connect to WebSocket (prefer server-side resolution; include sessionId only if explicitly available)
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[IntiComm] Already connected');
      return;
    }

    console.log('[IntiComm] Connecting to WebSocket...');

    // Resolve session only if explicitly available (URL param). Avoid synthesizing.
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session') || urlParams.get('sessionId');
    const wsUrl = sessionFromUrl
      ? `${WEBSOCKET_URL}?clientType=PWA&sessionId=${encodeURIComponent(sessionFromUrl)}`
      : `${WEBSOCKET_URL}?clientType=PWA`;

    console.log('[IntiComm] WebSocket URL:', wsUrl.replace(/sessionId=[^&]+/, 'sessionId=[REDACTED]'));

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[IntiComm] ✅ WebSocket connected successfully');
        setState(prev => ({ ...prev, connected: true }));
        try { ws.send(JSON.stringify({ type: 'auth.resolve' })); } catch {}
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('[IntiComm] WebSocket closed:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          connected: false,
          clientId: null,
          error: event.reason || 'Connection closed'
        }));
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds if not intentionally closed
        if (event.code !== 1000) {
          setTimeout(() => {
            console.log('[IntiComm] Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error('[IntiComm] WebSocket error:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          connected: false,
          error: 'WebSocket connection failed'
        }));
      };

    } catch (error) {
      console.error('[IntiComm] Error creating WebSocket:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        connected: false,
        error: 'Failed to create WebSocket connection'
      }));
    }
  }, [handleMessage]);

  // Check for stored authentication first
  const checkStoredAuth = useCallback(() => {
    console.log('[IntiComm] Checking for stored authentication...');
    
    const storedAuth = localStorage.getItem('inti_auth') || 
                      sessionStorage.getItem('inti_auth');
    
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        if (parsed.user && parsed.authenticated && parsed.user.displayName && parsed.user.displayName !== 'Replit User') {
          console.log('[IntiComm] Found valid stored authentication:', parsed.user.displayName);
          // Also extract profile image from stored auth in case it was saved with the old field name
          if (parsed.user && !parsed.user.profileImage && (parsed.user.profile_image_url || parsed.user.profile_image)) {
            parsed.user.profileImage = extractProfileImage(parsed.user);
            console.log('[IntiComm] Updated stored auth with extracted profile image:', parsed.user.profileImage);
            // Re-save the updated auth data
            localStorage.setItem('inti_auth', JSON.stringify(parsed));
            sessionStorage.setItem('inti_auth', JSON.stringify(parsed));
          }
          setState(prev => ({
            ...prev,
            loading: false,
            user: parsed.user,
            authenticated: true,
            error: null
          }));
          authStateRef.current = true;
          return true;
        } else {
          console.log('[IntiComm] Stored auth is invalid or contains bypass user, clearing...');
          localStorage.removeItem('inti_auth');
          sessionStorage.removeItem('inti_auth');
        }
      } catch {
        console.log('[IntiComm] Invalid stored auth data, clearing...');
        localStorage.removeItem('inti_auth');
        sessionStorage.removeItem('inti_auth');
      }
    }
    
    return false;
  }, []);

  // Send voice transcription
  const sendVoiceTranscription = useCallback((transcription: string, audioData?: unknown) => {
    sendMessage('voice.transcription', { transcription, audioData, timestamp: Date.now() });
  }, [sendMessage]);

  // Logout function
  const logout = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[IntiComm] Sending logout request');
      wsRef.current.send(JSON.stringify({
        type: 'auth.logout',
        clientType: 'PWA',
        timestamp: Date.now()
      }));
    } else {
      console.log('[IntiComm] No active WebSocket connection for logout');
    }
  }, []);

  // Refresh auth function  
  const refreshAuth = useCallback(() => {
    // Clear stored auth and reconnect
    localStorage.removeItem('inti_auth');
    sessionStorage.removeItem('inti_auth');
    setState(prev => ({ ...prev, loading: true, user: null, authenticated: false }));
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  // Initialize connection on mount - FIXED: Always connect for real-time features
  useEffect(() => {
    console.log('[IntiComm] Provider mounted, initializing...');
    (async () => {
      // Prefer canonical cookie-based resolution
      const ok = await preflightWhoami();
      if (!ok) {
        // Fallback to stored auth to minimize user friction
        checkStoredAuth();
      }
    })();

    // ALWAYS connect to WebSocket for real-time features (chat, updates, etc.)
    console.log('[IntiComm] Establishing WebSocket connection for real-time features...');
    connect();

    // Cleanup on unmount
    return () => {
      console.log('[IntiComm] Provider unmounting, cleaning up...');
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Empty deps to run only on mount

  const contextValue: IntiCommunicationContextType = {
    ...state,
    sendMessage,
    sendVoiceTranscription,
    logout,
    refreshAuth
  };

  return (
    <IntiCommunicationContext.Provider value={contextValue}>
      {children}
    </IntiCommunicationContext.Provider>
  );
}

export function useIntiCommunication() {
  const context = useContext(IntiCommunicationContext);
  if (!context) {
    throw new Error('useIntiCommunication must be used within IntiCommunicationProvider');
  }
  return context;
}

// Alias for backward compatibility
export const useAuth = useIntiCommunication;
