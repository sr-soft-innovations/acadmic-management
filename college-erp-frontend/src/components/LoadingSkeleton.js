/** Reusable loading skeleton for list/detail views */
import React from 'react';
import './LoadingSkeleton.css';

export default function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="loading-skeleton" aria-busy="true" aria-live="polite">
      <div className="skeleton-header" />
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-row">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
