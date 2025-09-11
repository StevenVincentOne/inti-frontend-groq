import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface NavigationComponentProps {
  uco: any;
}

export const NavigationComponent: React.FC<NavigationComponentProps> = ({ uco }) => {
  const navigation = uco?.navigation || {};
  const history = navigation.history || [];
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">Navigation</h3>
      
      <div className="space-y-3">
        {navigation.currentRoute && (
          <div>
            <h4 className="text-sm font-medium mb-1">Current Route</h4>
            <div className="p-2 bg-blue-50 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm font-mono">{navigation.currentRoute}</span>
                {navigation.params && Object.keys(navigation.params).length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {Object.keys(navigation.params).length} params
                  </Badge>
                )}
              </div>
              {navigation.params && Object.keys(navigation.params).length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {Object.entries(navigation.params).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {navigation.previousRoute && (
          <div>
            <h4 className="text-sm font-medium mb-1">Previous Route</h4>
            <div className="text-sm text-gray-600 font-mono">
              {navigation.previousRoute}
            </div>
          </div>
        )}
        
        {history.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Navigation History</h4>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {history.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded text-xs">
                    <span className="font-mono">{item.route}</span>
                    <span className="text-gray-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {navigation.breadcrumbs && navigation.breadcrumbs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Breadcrumbs</h4>
            <div className="flex items-center gap-2 text-sm">
              {navigation.breadcrumbs.map((crumb: string, idx: number) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-gray-400">/</span>}
                  <span className={idx === navigation.breadcrumbs.length - 1 ? 'font-medium' : ''}>
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};