import React from 'react';
import './EmptyState.css';

const EmptyState = ({ 
  icon = '📭', 
  title = 'Ничего не найдено', 
  description, 
  action, 
  actionLabel 
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && actionLabel && (
        <button className="empty-state-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
