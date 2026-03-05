import React, { useEffect, useRef } from 'react';

/**
 * Accessible confirm dialog. Replaces window.confirm with branded, keyboard-friendly UI.
 * @param {boolean} open - Whether dialog is visible
 * @param {string} title - Dialog title
 * @param {string} message - Body message
 * @param {string} confirmLabel - Confirm button text (default: "Confirm")
 * @param {string} cancelLabel - Cancel button text (default: "Cancel")
 * @param {string} variant - "danger" | "warning" | "default" - affects confirm button style
 * @param {function} onConfirm - Called when user confirms
 * @param {function} onCancel - Called when user cancels
 */
export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    const toFocus = variant === 'danger' ? cancelRef.current : confirmRef.current;
    setTimeout(() => toFocus?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, variant]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="modal-content confirm-dialog">
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h3>
        <p id="confirm-dialog-desc" className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-primary confirm-dialog-confirm confirm-dialog-${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
