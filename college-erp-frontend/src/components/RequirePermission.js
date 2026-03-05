import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Renders children only if the current user has the given permission.
 * Use for module-level access control (e.g. students:read, role_management:read).
 * Supports OR: permission="courses:read|student_portal:read" allows if user has any.
 */
export default function RequirePermission({ permission, children }) {
  const { user, hasPermission } = useAuth();

  if (!user) return null; // ProtectedRoute already redirects to login

  const allowed = permission && (
    permission.includes('|')
      ? permission.split('|').some((p) => hasPermission(p.trim()))
      : hasPermission(permission)
  );

  if (!allowed) {
    return (
      <div className="unauthorized" role="alert" aria-live="polite">
        <h2>Access denied</h2>
        <p>You do not have permission to access this module. Contact your administrator if you need access.</p>
        <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  return children;
}
