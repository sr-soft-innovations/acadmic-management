import React from 'react';

/**
 * Dismissible error message. Use for form/page-level errors.
 */
export default function FormError({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="form-error-wrap" role="alert">
      <span className="form-error">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="form-error-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}
