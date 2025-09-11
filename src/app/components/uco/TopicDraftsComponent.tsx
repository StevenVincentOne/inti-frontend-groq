import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface TopicDraftsComponentProps {
  uco: any;
}

export const TopicDraftsComponent: React.FC<TopicDraftsComponentProps> = ({ uco }) => {
  const drafts = uco?.topicDrafts || uco?.userDrafts || [];
  const currentDraftId = uco?.currentDraft?.id || uco?.activeTopic?.id || 
                        uco?.activeTopic?.data?.uuid || null;
  
  // Sort drafts with most recent first
  const sortedDrafts = [...drafts].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.lastModified || 0).getTime();
    const dateB = new Date(b.updated_at || b.lastModified || 0).getTime();
    return dateB - dateA;
  });
  
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Topic Drafts ({drafts.length})</h3>
        <p className="text-xs text-gray-500 mt-1">All drafts for current user</p>
      </div>
      
      <ScrollArea className="h-[350px]">
        {sortedDrafts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No drafts available</p>
            <p className="text-xs text-gray-400 mt-1">Create a new draft to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDrafts.map((draft: any, idx: number) => {
              const isCurrentDraft = draft.uuid === currentDraftId || 
                                    draft.draft_uuid === currentDraftId ||
                                    draft.id === currentDraftId;
              
              return (
                <div 
                  key={idx} 
                  className={`border rounded p-3 transition-colors ${
                    isCurrentDraft 
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm truncate flex-1 pr-2">
                      {draft.title || draft.title_final || 'Untitled Draft'}
                    </h4>
                    <div className="flex items-center gap-2">
                      {isCurrentDraft && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                      <Badge 
                        variant={
                          draft.status === 'published' ? 'default' : 
                          draft.status === 'active' ? 'secondary' : 
                          'outline'
                        }
                      >
                        {draft.status || draft.stage || 'draft'}
                      </Badge>
                    </div>
                  </div>
                  
                  {draft.excerpt && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {draft.excerpt}
                    </p>
                  )}
                  
                  <div className="space-y-1">
                    {draft.category_name && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Category:</span> {draft.category_name}
                      </div>
                    )}
                    
                    {draft.topic_type && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Type:</span> {draft.topic_type}
                      </div>
                    )}
                    
                    {(draft.updated_at || draft.lastModified) && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Modified:</span> {
                          new Date(draft.updated_at || draft.lastModified).toLocaleString()
                        }
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3 mt-2 pt-2 border-t">
                    {draft.word_count !== undefined && (
                      <span className="text-xs text-gray-500">
                        📝 {draft.word_count} words
                      </span>
                    )}
                    {draft.version && (
                      <span className="text-xs text-gray-500">
                        v{draft.version}
                      </span>
                    )}
                    {draft.uuid && (
                      <span className="text-xs text-gray-400">
                        ID: {draft.uuid.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                  
                  {draft.tags && draft.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {draft.tags.slice(0, 5).map((tag: string, tagIdx: number) => (
                        <Badge key={tagIdx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {draft.tags.length > 5 && (
                        <span className="text-xs text-gray-400">
                          +{draft.tags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};