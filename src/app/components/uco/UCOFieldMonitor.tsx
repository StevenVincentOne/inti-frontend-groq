'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Field {
  component: string;
  fieldName: string;
  value: any;
  lastUpdated: string;
  isNew?: boolean;
}

interface UCOFieldMonitorProps {
  components: any;
  selectedComponents: string[];
}

export function UCOFieldMonitor({ components, selectedComponents }: UCOFieldMonitorProps) {
  const [fields, setFields] = useState<Field[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const previousValuesRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const newFields: Field[] = [];
    const newUpdates = new Set<string>();

    // Helper to flatten object into fields
    const flattenObject = (obj: any, prefix = '', componentName: string): void => {
      if (!obj) return;
      
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const fieldKey = `${componentName}:${fieldPath}`;
        
        // Skip functions and undefined
        if (typeof value === 'function' || value === undefined) return;
        
        // Handle nested objects (but not too deep)
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 2) {
          flattenObject(value, fieldPath, componentName);
        } else {
          // Check if value changed
          const previousValue = previousValuesRef.current[fieldKey];
          const hasChanged = previousValue !== undefined && 
                           JSON.stringify(previousValue) !== JSON.stringify(value);
          
          if (hasChanged) {
            newUpdates.add(fieldKey);
            // Keep it highlighted for 3 seconds
            setTimeout(() => {
              setRecentlyUpdated(prev => {
                const next = new Set(prev);
                next.delete(fieldKey);
                return next;
              });
            }, 3000);
          }
          
          // Store current value for next comparison
          previousValuesRef.current[fieldKey] = value;
          
          newFields.push({
            component: componentName,
            fieldName: fieldPath,
            value: value,
            lastUpdated: new Date().toISOString(),
            isNew: hasChanged
          });
        }
      });
    };

    // Process selected components
    selectedComponents.forEach(componentName => {
      const componentData = components[componentName];
      if (componentData) {
        // Special handling for different component types
        if (componentName === 'user' && componentData.data) {
          flattenObject(componentData.data, '', 'user');
        } else if (componentName === 'topic' || componentName === 'currentDraft') {
          const data = componentData.data || componentData;
          flattenObject(data, '', componentName);
          
          // Add subscribed fields as a special entry
          if (componentData.subscribedFields) {
            newFields.push({
              component: componentName,
              fieldName: 'subscribedFields',
              value: componentData.subscribedFields,
              lastUpdated: new Date().toISOString(),
              isNew: false
            });
          }
        } else if (componentName === 'navigation') {
          flattenObject(componentData, '', 'navigation');
        } else if (componentName === 'drafts') {
          // Show count and most recent
          const draftsArray = Array.isArray(componentData) ? componentData : [];
          newFields.push({
            component: 'drafts',
            fieldName: 'count',
            value: draftsArray.length,
            lastUpdated: new Date().toISOString(),
            isNew: false
          });
          if (draftsArray.length > 0) {
            newFields.push({
              component: 'drafts',
              fieldName: 'mostRecent',
              value: draftsArray[0]?.title || 'N/A',
              lastUpdated: draftsArray[0]?.updated_at || new Date().toISOString(),
              isNew: false
            });
          }
        } else {
          // Generic handling
          flattenObject(componentData, '', componentName);
        }
      }
    });

    setFields(newFields);
    setRecentlyUpdated(prev => new Set([...prev, ...newUpdates]));
  }, [components, selectedComponents]);

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `[${value.length} items]`;
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getFieldStyles = (field: Field): React.CSSProperties => {
    const fieldKey = `${field.component}:${field.fieldName}`;
    const isRecent = recentlyUpdated.has(fieldKey);
    
    return {
      backgroundColor: isRecent ? '#10b981' : 'transparent',
      color: isRecent ? 'white' : 'inherit',
      transition: 'all 0.3s ease',
      padding: '4px 8px',
      borderRadius: '4px',
      marginBottom: '4px'
    };
  };

  return (
    <div className="uco-field-monitor">
      <div className="field-grid">
        {fields.map((field, index) => {
          const fieldKey = `${field.component}:${field.fieldName}`;
          const isRecent = recentlyUpdated.has(fieldKey);
          
          return (
            <div 
              key={`${fieldKey}-${index}`} 
              className="field-row"
              style={getFieldStyles(field)}
            >
              <div className="field-component">
                <span className="component-badge">{field.component}</span>
              </div>
              <div className="field-name">
                {field.fieldName}
              </div>
              <div className="field-value">
                <input
                  type="text"
                  value={formatValue(field.value)}
                  readOnly
                  className={`field-input ${isRecent ? 'recently-updated' : ''}`}
                  title={typeof field.value === 'object' ? JSON.stringify(field.value, null, 2) : String(field.value)}
                />
              </div>
              {isRecent && (
                <div className="update-indicator">
                  ✨ Updated
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {fields.length === 0 && (
        <div className="no-fields">
          Select components to monitor their fields
        </div>
      )}

      <style jsx>{`
        .uco-field-monitor {
          width: 100%;
          padding: 1rem;
        }

        .field-grid {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .field-row {
          display: grid;
          grid-template-columns: 120px 200px 1fr auto;
          gap: 1rem;
          align-items: center;
          min-height: 36px;
        }

        .component-badge {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .field-name {
          font-family: monospace;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .field-input {
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
          background: white;
        }

        .field-input.recently-updated {
          border-color: #10b981;
          animation: pulse 0.5s ease-in-out;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        .update-indicator {
          color: #10b981;
          font-size: 0.75rem;
          font-weight: 500;
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .no-fields {
          text-align: center;
          color: #9ca3af;
          padding: 2rem;
        }
      `}</style>
    </div>
  );
}