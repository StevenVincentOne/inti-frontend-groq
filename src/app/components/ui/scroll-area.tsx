import React from 'react';

export const ScrollArea = ({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string 
}) => (
  <div className={`overflow-auto ${className}`}>
    {children}
  </div>
);