import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface UserStateComponentProps {
  uco: any;
}

export const UserStateComponent: React.FC<UserStateComponentProps> = ({ uco }) => {
  const userState = uco?.userState || {};
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">User State</h3>
      <div className="space-y-2">
        {userState.name && (
          <div className="flex justify-between items-center">
            <span>Name</span>
            <span className="text-sm font-medium">{userState.name}</span>
          </div>
        )}
        
        {userState.userId && (
          <div className="flex justify-between items-center">
            <span>User ID</span>
            <span className="text-sm font-mono">{userState.userId}</span>
          </div>
        )}
        
        {userState.email && (
          <div className="flex justify-between items-center">
            <span>Email</span>
            <span className="text-sm">{userState.email}</span>
          </div>
        )}
        
        {userState.bio && (
          <div className="flex justify-between items-center">
            <span>Bio</span>
            <span className="text-sm">{userState.bio}</span>
          </div>
        )}
        
        {userState.intisEarned && (
          <div className="flex justify-between items-center">
            <span>Intis Earned</span>
            <span className="text-sm font-medium">{userState.intisEarned}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <span>Authentication</span>
          <Badge variant={userState.isAuthenticated ? 'default' : 'secondary'}>
            {userState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
          </Badge>
        </div>
        
        {userState.sessionId && (
          <div className="flex justify-between items-center">
            <span>Session ID</span>
            <span className="text-xs font-mono truncate max-w-[150px]" title={userState.sessionId}>
              {userState.sessionId.substring(0, 8)}...
            </span>
          </div>
        )}
        
        {userState.permissions && userState.permissions.length > 0 && (
          <div className="mt-2">
            <span className="text-sm font-medium">Permissions:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {userState.permissions.map((perm: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {perm}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {userState.metadata && Object.keys(userState.metadata).length > 10 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
              All User Fields ({Object.keys(userState.metadata).length})
            </summary>
            <div className="mt-2 p-2 bg-gray-50 rounded max-h-40 overflow-y-auto">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(userState.metadata, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </div>
    </Card>
  );
};