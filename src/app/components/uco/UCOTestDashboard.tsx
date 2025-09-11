import React from 'react';
import { SystemStatusComponent } from './SystemStatusComponent';
import { UserStateComponent } from './UserStateComponent';
import { TopicDraftsComponent } from './TopicDraftsComponent';
import { CurrentDraftComponent } from './CurrentDraftComponent';
import { TopicComponent } from './TopicComponent';
import { NavigationComponent } from './NavigationComponent';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface UCOTestDashboardProps {
  uco: any;
  onRefresh?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const UCOTestDashboard: React.FC<UCOTestDashboardProps> = ({
  uco,
  onRefresh,
  onConnect,
  onDisconnect
}) => {
  const isConnected = uco?.systemStatus?.state === 'connected';
  const lastUpdate = uco?.metadata?.lastUpdate;
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">UCO Test Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Unified Context Object real-time monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Last update: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" size="sm">
              Refresh
            </Button>
          )}
          {onConnect && !isConnected && (
            <Button onClick={onConnect} variant="default" size="sm">
              Connect
            </Button>
          )}
          {onDisconnect && isConnected && (
            <Button onClick={onDisconnect} variant="destructive" size="sm">
              Disconnect
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* First Row - System Info */}
        <SystemStatusComponent uco={uco} />
        <UserStateComponent uco={uco} />
        <NavigationComponent uco={uco} />
        
        {/* Second Row - Draft Management */}
        <div className="lg:col-span-2">
          <TopicDraftsComponent uco={uco} />
        </div>
        <div className="lg:col-span-1">
          <CurrentDraftComponent uco={uco} />
        </div>
        
        {/* Third Row - Active Topic Details */}
        <div className="lg:col-span-3">
          <TopicComponent uco={uco} />
        </div>
      </div>
      
      {uco?.debug && (
        <div className="mt-6">
          <details className="p-4 border rounded">
            <summary className="cursor-pointer font-medium">Debug Information</summary>
            <pre className="mt-2 text-xs overflow-x-auto">
              {JSON.stringify(uco, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};