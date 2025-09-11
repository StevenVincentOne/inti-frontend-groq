import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface UserDraftsComponentProps {
  uco: any;
}

export const UserDraftsComponent: React.FC<UserDraftsComponentProps> = ({ uco }) => {
  const drafts = uco?.userDrafts || [];
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">User Drafts ({drafts.length})</h3>
      <ScrollArea className="h-[300px]">
        {drafts.length === 0 ? (
          <p className="text-sm text-gray-500">No drafts available</p>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft: any, idx: number) => (
              <div key={idx} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm truncate flex-1">
                    {draft.title || 'Untitled Draft'}
                  </h4>
                  <Badge variant={draft.status === 'active' ? 'default' : 'secondary'}>
                    {draft.status || 'draft'}
                  </Badge>
                </div>
                
                {draft.category && (
                  <div className="text-xs text-gray-600 mb-1">
                    Category: {draft.category}
                  </div>
                )}
                
                {draft.lastModified && (
                  <div className="text-xs text-gray-500">
                    Modified: {new Date(draft.lastModified).toLocaleString()}
                  </div>
                )}
                
                <div className="flex gap-2 mt-2">
                  {draft.wordCount && (
                    <span className="text-xs text-gray-500">
                      {draft.wordCount} words
                    </span>
                  )}
                  {draft.version && (
                    <span className="text-xs text-gray-500">
                      v{draft.version}
                    </span>
                  )}
                </div>
                
                {draft.tags && draft.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {draft.tags.map((tag: string, tagIdx: number) => (
                      <Badge key={tagIdx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};