import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface CurrentDraftComponentProps {
  uco: any;
}

interface FieldStatus {
  name: string;
  value: any;
  subscribed: boolean;
  lastUpdate?: string;
  confidence?: number;
}

export const CurrentDraftComponent: React.FC<CurrentDraftComponentProps> = ({ uco }) => {
  const currentDraft = uco?.currentDraft || uco?.activeTopic || {};
  const draftData = currentDraft.data || currentDraft || {};
  const subscribedFields = currentDraft.subscribedFields || [];
  
  // Check if a draft is actually loaded
  const isDraftLoaded = !!(currentDraft.id || draftData.uuid || draftData.draft_uuid);
  
  // Build field status list from draft data
  const fieldStatuses: FieldStatus[] = [];
  
  if (isDraftLoaded) {
    // Core fields that are commonly subscribed
    const coreFields = [
      { key: 'title', label: 'Title' },
      { key: 'title_final', label: 'Final Title' },
      { key: 'excerpt', label: 'Excerpt' },
      { key: 'body', label: 'Body' },
      { key: 'category_name', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'stage', label: 'Stage' },
      { key: 'word_count', label: 'Word Count' },
      { key: 'version', label: 'Version' },
      { key: 'tags', label: 'Tags' },
      { key: 'topic_type', label: 'Topic Type' },
      { key: 'created_at', label: 'Created' },
      { key: 'updated_at', label: 'Updated' }
    ];
    
    coreFields.forEach(field => {
      const value = draftData[field.key];
      if (value !== undefined && value !== null) {
        fieldStatuses.push({
          name: field.label,
          value: value,
          subscribed: subscribedFields.includes(field.key) || 
                     currentDraft.subscriptions?.includes(field.key) ||
                     false,
          lastUpdate: draftData[`${field.key}_updated`] || draftData.updated_at,
          confidence: draftData[`${field.key}_confidence`]
        });
      }
    });
  }
  
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Current Draft</h3>
        <p className="text-xs text-gray-500 mt-1">
          {isDraftLoaded ? 'Monitoring subscribed fields' : 'No draft loaded'}
        </p>
      </div>
      
      {!isDraftLoaded ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-2">No draft currently loaded</p>
          <p className="text-xs text-gray-400">Load a draft to see field subscriptions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Draft Info Header */}
          <div className="pb-3 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-sm">
                  {draftData.title || draftData.title_final || 'Untitled Draft'}
                </h4>
                {draftData.uuid && (
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {draftData.uuid.substring(0, 8)}...
                  </p>
                )}
              </div>
              <Badge variant={draftData.status === 'published' ? 'default' : 'secondary'}>
                {draftData.status || draftData.stage || 'draft'}
              </Badge>
            </div>
          </div>
          
          {/* Subscribed Fields */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Subscribed Fields</h4>
              <span className="text-xs text-gray-500">
                {fieldStatuses.filter(f => f.subscribed).length} / {fieldStatuses.length} active
              </span>
            </div>
            
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {fieldStatuses.length === 0 ? (
                  <p className="text-xs text-gray-500">No fields detected</p>
                ) : (
                  fieldStatuses.map((field, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2 rounded text-xs ${
                        field.subscribed ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            field.subscribed ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <span className="font-medium">{field.name}</span>
                        </div>
                        {field.subscribed && (
                          <Badge variant="default" className="text-xs h-4 px-1">
                            Live
                          </Badge>
                        )}
                      </div>
                      
                      <div className="ml-4 mt-1">
                        <div className="text-gray-600 truncate">
                          {typeof field.value === 'object' 
                            ? JSON.stringify(field.value).substring(0, 50) + '...'
                            : String(field.value).substring(0, 50)
                          }
                          {String(field.value).length > 50 && '...'}
                        </div>
                        
                        {field.lastUpdate && (
                          <div className="text-gray-400 mt-1">
                            Updated: {new Date(field.lastUpdate).toLocaleTimeString()}
                          </div>
                        )}
                        
                        {field.confidence !== undefined && (
                          <div className="text-gray-400">
                            Confidence: {(field.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Subscription Stats */}
          {subscribedFields.length > 0 && (
            <div className="pt-3 border-t">
              <div className="text-xs text-gray-500">
                <div>Active Subscriptions: {subscribedFields.join(', ') || 'None'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};