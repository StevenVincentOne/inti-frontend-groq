import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface SystemStatusComponentProps {
  uco: any;
}

export const SystemStatusComponent: React.FC<SystemStatusComponentProps> = ({ uco }) => {
  const systemStatus = uco?.systemStatus || {};
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">System Status</h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span>Server State</span>
          <Badge variant={systemStatus.state === 'connected' ? 'default' : 'secondary'}>
            {systemStatus.state || 'unknown'}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Server Type</span>
          <span className="text-sm text-gray-600">{systemStatus.serverType || 'not set'}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Auth Status</span>
          <Badge variant={systemStatus.authStatus === 'authenticated' ? 'default' : 'secondary'}>
            {systemStatus.authStatus || 'unauthenticated'}
          </Badge>
        </div>
        
        {systemStatus.capabilities && (
          <div className="mt-2">
            <span className="text-sm font-medium">Capabilities:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {systemStatus.capabilities.map((cap: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {systemStatus.error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
            {systemStatus.error}
          </div>
        )}
      </div>
    </Card>
  );
};