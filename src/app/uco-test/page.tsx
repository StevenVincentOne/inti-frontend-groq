'use client';

import React, { useEffect, useState } from 'react';
import { UCOTestDashboard } from '../components/uco/UCOTestDashboard';
import { useUCO } from '../hooks/useUCO';
import { useIntiCommunication } from '../components/IntiCommunicationProvider';
import { mockUCO } from './mockData';

// Switch to enhanced page for better functionality
import EnhancedUCOTestPage from './enhanced-page';
export default EnhancedUCOTestPage;

// Original page code below (commented out)
function OriginalUCOTestPage() {
  const [navigationHistory, setNavigationHistory] = useState<any[]>([]);
  const { 
    uco, 
    loading, 
    error, 
    connected,
    refresh
  } = useUCO();
  
  // Listen for navigation events from WebSocket
  useEffect(() => {
    // Add current page to history on mount
    const currentNav = {
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
      params: Object.fromEntries(new URLSearchParams(window.location.search)),
      from: document.referrer || 'direct'
    };
    setNavigationHistory([currentNav]);
    
    const handleNavigationUpdate = (event: CustomEvent) => {
      console.log('[UCO Test] Navigation event received:', event.detail);
      const navItem = {
        route: event.detail.page || event.detail.route,
        timestamp: event.detail.timestamp || new Date().toISOString(),
        params: event.detail.params || {},
        from: event.detail.from || 'direct'
      };
      
      setNavigationHistory(prev => {
        const newHistory = [...prev, navItem];
        // Keep only last 10 navigation items
        return newHistory.slice(-10);
      });
    };
    
    // Listen for custom navigation events
    window.addEventListener('uco-navigation' as any, handleNavigationUpdate as any);
    
    // Also listen for UCO updates that might contain navigation data
    const handleUCOUpdate = (event: CustomEvent) => {
      if (event.detail?.components?.navigation?.history) {
        console.log('[UCO Test] Navigation history from UCO update:', event.detail.components.navigation.history);
        // Merge server navigation history
        setNavigationHistory(prev => {
          const serverHistory = event.detail.components.navigation.history;
          const merged = [...prev, ...serverHistory];
          // Deduplicate and keep last 10
          const unique = merged.reduce((acc, item) => {
            if (!acc.find((h: any) => h.route === item.route && h.timestamp === item.timestamp)) {
              acc.push(item);
            }
            return acc;
          }, [] as any[]);
          return unique.slice(-10);
        });
      }
    };
    
    window.addEventListener('uco-update' as any, handleUCOUpdate as any);
    
    return () => {
      window.removeEventListener('uco-navigation' as any, handleNavigationUpdate as any);
      window.removeEventListener('uco-update' as any, handleUCOUpdate as any);
    };
  }, []);

  // Build the UCO object structure for the dashboard
  // Use mock data if not connected
  const isConnected = connected && !error;
  const ucoData = isConnected ? uco?.data : mockUCO;
  const components = ucoData?.components || {};
  const metadata = ucoData?.metadata || {};
  
  // Extract navigation data from components or build from current location
  const navigationData = components.navigation || {};
  
  // Add current route information
  if (typeof window !== 'undefined') {
    navigationData.currentRoute = navigationData.currentRoute || window.location.pathname;
    navigationData.params = navigationData.params || Object.fromEntries(new URLSearchParams(window.location.search));
    
    // Use tracked history or server history, merge them
    const serverHistory = navigationData.history || [];
    const combinedHistory = [...serverHistory, ...navigationHistory];
    
    // Deduplicate based on timestamp and route
    const uniqueHistory = combinedHistory.reduce((acc, item) => {
      const key = `${item.route}-${item.timestamp}`;
      if (!acc.some((h: any) => `${h.route}-${h.timestamp}` === key)) {
        acc.push(item);
      }
      return acc;
    }, [] as any[]);
    
    navigationData.history = uniqueHistory.slice(-10); // Keep last 10 items
    
    // Add breadcrumbs based on current path
    if (!navigationData.breadcrumbs) {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      navigationData.breadcrumbs = pathSegments.length > 0 ? pathSegments : ['home'];
    }
    
    // Store previous route from history
    if (navigationData.history.length > 1) {
      const prevItem = navigationData.history[navigationData.history.length - 2];
      navigationData.previousRoute = prevItem.route;
    }
  }
  
  const dashboardUCO = {
    systemStatus: {
      state: connected ? 'connected' : 'disconnected',
      serverType: 'replit-bridge',
      authStatus: metadata.userId ? 'authenticated' : 'unauthenticated',
      capabilities: ['real-time', 'websocket', 'uco-v15', 'navigation-tracking'],
      error: error || undefined
    },
    userState: {
      userId: components.user?.id || metadata.userId,
      email: components.user?.email,
      isAuthenticated: !!metadata.userId,
      sessionId: metadata.sessionId,
      permissions: components.user?.permissions || [],
      name: components.user?.displayName || components.user?.display_name || components.user?.username,
      bio: components.user?.bio,
      intisEarned: components.user?.intis_earned_total,
      metadata: components.user
    },
    // Topic Drafts - all user's drafts
    topicDrafts: components.drafts || components.userDrafts || [],
    
    // Current Draft - the currently loaded/active draft with field subscriptions
    currentDraft: {
      id: components.topic?.uuid || components.topic?.draft_uuid,
      data: components.topic || {},
      subscribedFields: components.topic?.subscribed_fields || 
                       metadata.subscriptions || 
                       [],
      subscriptions: metadata.subscriptions || []
    },
    
    // Active Topic - for backward compatibility
    activeTopic: {
      id: components.topic?.uuid || components.topic?.draft_uuid,
      data: {
        title: components.topic?.title || components.topic?.title_final,
        description: components.topic?.excerpt,
        status: components.topic?.status || components.topic?.stage,
        category: components.topic?.category_name,
        type: components.topic?.topic_type,
        wordCount: components.topic?.word_count,
        version: components.topic?.version,
        uuid: components.topic?.uuid || components.topic?.draft_uuid
      },
      updates: []
    },
    navigation: navigationData,
    metadata: {
      lastUpdate: new Date().toISOString(),
      totalFields: metadata.totalFields,
      confidence: metadata.confidence,
      subscriptions: metadata.subscriptions,
      privacy: metadata.privacy,
      ...metadata
    },
    debug: true
  };

  const handleConnect = () => {
    console.log('[UCO Test] Connect button clicked');
    
    // If no sessionId, create one
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `test-session-${Date.now()}`;
      localStorage.setItem('sessionId', sessionId);
      console.log('[UCO Test] Created test sessionId:', sessionId);
    }
    
    // Force a page reload to reconnect with new sessionId
    window.location.reload();
  };

  const handleDisconnect = () => {
    // Handle disconnect if needed
    console.log('Disconnect requested');
  };

  if (loading && !uco) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Loading UCO Dashboard...</div>
          <div className="text-gray-600">Connecting to WebSocket bridge</div>
        </div>
      </div>
    );
  }

  return (
    <UCOTestDashboard
      uco={dashboardUCO}
      onRefresh={refresh}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
    />
  );
}