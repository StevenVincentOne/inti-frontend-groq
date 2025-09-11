'use client';

import React, { useState, useEffect } from 'react';
import { useUCO } from '../hooks/useUCO';
import { UCOComponentSelector } from '../components/uco/UCOComponentSelector';
import { UCOFieldMonitor } from '../components/uco/UCOFieldMonitor';
import { UCOLLMIntegrationTest } from '../components/uco/UCOLLMIntegrationTest';
import { mockUCO } from './mockData';

export default function EnhancedUCOTestPage() {
  const { uco, loading, error, connected, authenticated, refresh } = useUCO();
  const [selectedComponents, setSelectedComponents] = useState<string[]>(['user', 'topic']);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  // Connected means authenticated and socket connected; avoid mock if authenticated but syncing
  const isConnected = !!authenticated && !!connected && !error;
  const isSyncing = !!authenticated && connected && !uco; // waiting for first uco.state
  const ucoData = isConnected ? uco?.data : (isSyncing ? undefined : mockUCO);
  const components = ucoData?.components || {};
  
  // Add metadata and system to components for monitoring
  if (ucoData?.metadata) {
    components.metadata = ucoData.metadata;
  }
  
  components.system = {
    connected: isConnected,
    loading,
    error,
    lastUpdate: new Date().toISOString()
  };

  // Build available components list
  const availableComponents = Object.keys(components);

  // Update time on client side only
  useEffect(() => {
    setLastUpdateTime(new Date().toLocaleTimeString());
  }, [ucoData]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh && isConnected) {
      const interval = setInterval(() => {
        refresh();
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isConnected, refresh]);

  // Simulate updates in mock mode
  useEffect(() => {
    if (!isConnected && autoRefresh) {
      const interval = setInterval(() => {
        // Simulate field updates
        if (mockUCO.components.topic) {
          mockUCO.components.topic.word_count = Math.floor(Math.random() * 2000) + 500;
          mockUCO.components.topic.updated_at = new Date().toISOString();
        }
        if (mockUCO.components.user) {
          mockUCO.components.user.intis_earned_total = Math.floor(Math.random() * 200) + 100;
        }
        // Force re-render
        setSelectedComponents(prev => [...prev]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isConnected, autoRefresh]);

  return (
    <div className="uco-test-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>UCO Field Monitor</h1>
          <p>Real-time monitoring of Unified Context Object fields</p>
        </div>
        <div className="header-status">
          <div className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : (isSyncing ? '🟡 Syncing…' : '🔴 Mock Mode')}
          </div>
          <div className="last-update">
            Last update: {lastUpdateTime || 'Loading...'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <button onClick={refresh} className="btn-primary" disabled={!isConnected}>
          🔄 Refresh
        </button>
        <label className="auto-refresh">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh {!isConnected && '(simulated)'}
        </label>
        {!isConnected && !isSyncing && (
          <button 
            onClick={() => window.location.reload()} 
            className="btn-secondary"
          >
            Retry Connection
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Component Selector */}
        <div className="selector-panel">
          <UCOComponentSelector
            availableComponents={availableComponents}
            selectedComponents={selectedComponents}
            onSelectionChange={setSelectedComponents}
          />
        </div>

        {/* Field Monitor */}
        <div className="monitor-panel">
          <div className="monitor-header">
            <h2>Field Values</h2>
            <span className="field-count">
              Monitoring {selectedComponents.length} component{selectedComponents.length !== 1 ? 's' : ''}
            </span>
          </div>
          <UCOFieldMonitor
            components={components}
            selectedComponents={selectedComponents}
          />
        </div>
        
        {/* LLM Integration Test */}
        <div className="test-section">
          <UCOLLMIntegrationTest />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      <style jsx>{`
        .uco-test-page {
          min-height: 100vh;
          background: #f9fafb;
          padding: 1rem;
        }

        .page-header {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .header-content p {
          margin: 0.25rem 0 0;
          color: #6b7280;
        }

        .header-status {
          text-align: right;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .status-badge.connected {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.disconnected {
          background: #fee2e2;
          color: #991b1b;
        }

        .last-update {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .controls-bar {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .btn-primary, .btn-secondary {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .auto-refresh {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #4b5563;
          font-size: 0.875rem;
        }

        .auto-refresh input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }

        .main-content {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr;
          }
        }

        .selector-panel {
          height: fit-content;
        }

        .monitor-panel {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .monitor-header {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .monitor-header h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .field-count {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .test-section {
          margin-top: 1rem;
        }

        .error-banner {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.75rem;
          border-radius: 6px;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
