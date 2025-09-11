import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface TopicComponentProps {
  uco: any;
}

export const TopicComponent: React.FC<TopicComponentProps> = ({ uco }) => {
  const activeTopic = uco?.activeTopic || {};
  const topicData = activeTopic.data || {};
  const updates = activeTopic.updates || [];
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">Active Topic</h3>
      
      {!activeTopic.id && !topicData.title ? (
        <p className="text-sm text-gray-500">No active topic</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-medium">{topicData.title || 'Untitled Topic'}</h4>
                {topicData.description && (
                  <p className="text-sm text-gray-600 mt-1">{topicData.description}</p>
                )}
              </div>
              <Badge variant={topicData.status === 'published' ? 'default' : 'secondary'}>
                {topicData.status || 'draft'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {topicData.category && (
                <div>
                  <span className="text-gray-500">Category:</span>
                  <span className="ml-1">{topicData.category}</span>
                </div>
              )}
              {topicData.type && (
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-1">{topicData.type}</span>
                </div>
              )}
              {topicData.wordCount && (
                <div>
                  <span className="text-gray-500">Words:</span>
                  <span className="ml-1">{topicData.wordCount}</span>
                </div>
              )}
              {topicData.version && (
                <div>
                  <span className="text-gray-500">Version:</span>
                  <span className="ml-1">{topicData.version}</span>
                </div>
              )}
            </div>
          </div>
          
          {updates.length > 0 && (
            <div className="border-t pt-3">
              <h5 className="text-sm font-medium mb-2">Recent Updates</h5>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {updates.map((update: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{update.field}</span>
                        <span className="text-gray-500">
                          {new Date(update.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {update.oldValue && update.newValue && (
                        <div className="mt-1">
                          <span className="text-red-600">-{update.oldValue}</span>
                          <span className="mx-1">→</span>
                          <span className="text-green-600">+{update.newValue}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Debug section - remove in production */}
          {activeTopic && (
            <details className="mt-3 border-t pt-3">
              <summary className="cursor-pointer text-xs text-gray-500">Debug: Raw Topic Data</summary>
              <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(activeTopic, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </Card>
  );
};