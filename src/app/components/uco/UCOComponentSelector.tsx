'use client';

import React from 'react';

interface ComponentOption {
  id: string;
  label: string;
  description: string;
  available: boolean;
}

interface UCOComponentSelectorProps {
  availableComponents: string[];
  selectedComponents: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function UCOComponentSelector({ 
  availableComponents, 
  selectedComponents, 
  onSelectionChange 
}: UCOComponentSelectorProps) {
  
  const componentOptions: ComponentOption[] = [
    {
      id: 'user',
      label: 'User State',
      description: 'User profile, authentication, and permissions',
      available: availableComponents.includes('user')
    },
    {
      id: 'topic',
      label: 'Current Draft/Topic',
      description: 'Active draft with field subscriptions',
      available: availableComponents.includes('topic')
    },
    {
      id: 'drafts',
      label: 'Topic Drafts',
      description: 'All user drafts and their metadata',
      available: availableComponents.includes('drafts')
    },
    {
      id: 'navigation',
      label: 'Navigation',
      description: 'Current route and navigation history',
      available: availableComponents.includes('navigation')
    },
    {
      id: 'metadata',
      label: 'Metadata',
      description: 'System metadata and subscriptions',
      available: availableComponents.includes('metadata')
    },
    {
      id: 'system',
      label: 'System Status',
      description: 'Connection state and capabilities',
      available: availableComponents.includes('system')
    }
  ];

  const handleToggle = (componentId: string) => {
    const newSelection = selectedComponents.includes(componentId)
      ? selectedComponents.filter(id => id !== componentId)
      : [...selectedComponents, componentId];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allAvailable = componentOptions
      .filter(opt => opt.available)
      .map(opt => opt.id);
    onSelectionChange(allAvailable);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="uco-component-selector">
      <div className="selector-header">
        <h3>Select Components to Monitor</h3>
        <div className="selector-actions">
          <button onClick={handleSelectAll} className="btn-small">Select All</button>
          <button onClick={handleClearAll} className="btn-small">Clear All</button>
        </div>
      </div>
      
      <div className="component-list">
        {componentOptions.map(option => (
          <div 
            key={option.id} 
            className={`component-option ${!option.available ? 'disabled' : ''}`}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedComponents.includes(option.id)}
                onChange={() => handleToggle(option.id)}
                disabled={!option.available}
              />
              <span className="checkbox-custom"></span>
              <div className="option-content">
                <div className="option-label">
                  {option.label}
                  {!option.available && <span className="unavailable-badge">N/A</span>}
                </div>
                <div className="option-description">{option.description}</div>
              </div>
            </label>
          </div>
        ))}
      </div>

      <div className="selection-summary">
        {selectedComponents.length} component{selectedComponents.length !== 1 ? 's' : ''} selected
      </div>

      <style jsx>{`
        .uco-component-selector {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .selector-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .selector-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-small {
          padding: 4px 12px;
          font-size: 0.75rem;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-small:hover {
          background: #e5e7eb;
        }

        .component-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .component-option {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .component-option:hover:not(.disabled) {
          border-color: #3b82f6;
          background: #f9fafb;
        }

        .component-option.disabled {
          opacity: 0.5;
        }

        .checkbox-label {
          display: flex;
          align-items: flex-start;
          cursor: pointer;
        }

        .component-option.disabled .checkbox-label {
          cursor: not-allowed;
        }

        input[type="checkbox"] {
          position: absolute;
          opacity: 0;
        }

        .checkbox-custom {
          width: 20px;
          height: 20px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          margin-right: 0.75rem;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        input[type="checkbox"]:checked + .checkbox-custom {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        input[type="checkbox"]:checked + .checkbox-custom::after {
          content: '✓';
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .option-content {
          flex: 1;
        }

        .option-label {
          font-weight: 500;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .unavailable-badge {
          background: #ef4444;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.625rem;
          font-weight: 600;
        }

        .option-description {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .selection-summary {
          margin-top: 1rem;
          padding-top: 0.5rem;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}