'use client';

import React, { useState } from 'react';
import { useUCOMessageFormatter } from '../../hooks/useUCOMessageFormatter';

export function UCOLLMIntegrationTest() {
  const { 
    formatMessageWithUCO, 
    isUCOReady, 
    getUCOStatus,
    getTokenStats 
  } = useUCOMessageFormatter();
  
  const [testMessage, setTestMessage] = useState('What is my name?');
  const [testResult, setTestResult] = useState<any>(null);
  const [lastTest, setLastTest] = useState<string>('');

  const runUCOTest = () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[UCO Test] Running UCO-LLM integration test at ${timestamp}`);
    
    // Get current UCO status
    const status = getUCOStatus();
    const tokenStats = getTokenStats();
    
    // Try to format a message with UCO context
    const formattedMessage = formatMessageWithUCO(testMessage, 'test_trigger', true, true);
    
    const result = {
      timestamp,
      status,
      tokenStats,
      formattedMessage,
      isReady: isUCOReady(),
      testMessage
    };
    
    setTestResult(result);
    setLastTest(timestamp);
    
    // Also log to console for debugging
    console.log('[UCO Test] Test results:', result);
  };

  const getStatusColor = (status: any) => {
    if (!status) return 'bg-gray-100';
    if (status.isReady) return 'bg-green-100';
    if (status.connected && status.authenticated) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusText = (status: any) => {
    if (!status) return 'Unknown';
    if (status.isReady) return '✅ Ready';
    if (status.connected && status.authenticated && status.loading) return '🔄 Loading';
    if (status.connected && status.authenticated) return '⚠️ No Data';
    if (status.connected) return '🔐 Not Authenticated';
    return '❌ Not Connected';
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        UCO-LLM Integration Test
      </h3>
      
      {/* Test Controls */}
      <div className="mb-4 space-y-2">
        <div>
          <label htmlFor="testMessage" className="block text-sm font-medium text-gray-700 mb-1">
            Test Message:
          </label>
          <input
            id="testMessage"
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Enter test message..."
          />
        </div>
        
        <button
          onClick={runUCOTest}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
        >
          Run UCO Test
        </button>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">Last Test: {lastTest}</div>
          
          {/* Status Summary */}
          <div className={`p-3 rounded ${getStatusColor(testResult.status)}`}>
            <div className="font-medium text-sm">
              Status: {getStatusText(testResult.status)}
            </div>
            {testResult.status && (
              <div className="text-xs mt-1 space-y-1">
                <div>Connected: {testResult.status.connected ? '✅' : '❌'}</div>
                <div>Authenticated: {testResult.status.authenticated ? '✅' : '❌'}</div>
                <div>Has UCO: {testResult.status.hasUCO ? '✅' : '❌'}</div>
                <div>Has User Data: {testResult.status.hasUserData ? '✅' : '❌'}</div>
                <div>Has Topic Data: {testResult.status.hasTopicData ? '✅' : '❌'}</div>
              </div>
            )}
          </div>

          {/* Formatted Message Preview */}
          <div className="border rounded p-3">
            <div className="font-medium text-sm mb-2">Formatted Message Result:</div>
            {typeof testResult.formattedMessage === 'string' ? (
              <div className="bg-yellow-50 p-2 rounded text-xs">
                <strong>Plain Text:</strong> {testResult.formattedMessage}
              </div>
            ) : testResult.formattedMessage?.status === 'not_ready' ? (
              <div className="bg-orange-50 p-2 rounded text-xs">
                <strong>Status:</strong> UCO Not Ready - Will retry automatically
              </div>
            ) : (
              <div className="bg-green-50 p-2 rounded text-xs">
                <strong>Formatted with UCO Context:</strong> ✅
                <div className="mt-1">
                  Has UCO: {testResult.formattedMessage?.uco ? '✅' : '❌'}
                </div>
                <div>
                  Has Delta: {testResult.formattedMessage?.ucoDelta ? '✅' : '❌'}
                </div>
                <div>
                  Token Estimate: {testResult.formattedMessage?.metadata?.tokenEstimate || 'N/A'}
                </div>
              </div>
            )}
          </div>

          {/* Token Stats */}
          {testResult.tokenStats && (
            <div className="text-xs text-gray-600">
              <strong>Token Stats:</strong> {testResult.tokenStats.totalTokens} total, 
              {testResult.tokenStats.messageCount} messages
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        This test verifies that the UCO-LLM integration waits for UCO data before 
        formatting messages. If UCO is ready, messages should be formatted with context.
      </div>
    </div>
  );
}