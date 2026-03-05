import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AuditLogs() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.audit
      .list(200)
      .then((r) => setEntries(r.audit || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !error) return <p className="loading">Loading...</p>;
  if (error && (error.includes('permission') || error.includes('403'))) {
    return (
      <div>
        <h2 className="page-title">Audit logs</h2>
        <p className="placeholder-text">You do not have permission to view audit logs.</p>
      </div>
    );
  }
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div>
      <h2 className="page-title">Audit logs</h2>
      <p className="dashboard-welcome">Recent login, logout, and security events.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>User ID</th>
              <th>Resource</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5}>No audit entries</td></tr>
            ) : (
              entries.map((e, i) => (
                <tr key={i}>
                  <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</td>
                  <td>{e.action}</td>
                  <td>{e.user_id || '—'}</td>
                  <td>{e.resource}</td>
                  <td>{e.details && Object.keys(e.details).length ? JSON.stringify(e.details) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
