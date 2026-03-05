/** Reusable empty state with optional action */
import React from 'react';
import { Link } from 'react-router-dom';
import './EmptyState.css';

export default function EmptyState({ icon = '📭', title = 'No data', message, action, to }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">{icon}</span>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && to && (
        <Link to={to} className="empty-state-action btn-primary">
          {action}
        </Link>
      )}
    </div>
  );
}
