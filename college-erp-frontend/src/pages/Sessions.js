import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.auth
      .sessions()
      .then((r) => setSessions(r.sessions || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (sessionId) => {
    if (!window.confirm('Revoke this session? The device will be logged out.')) return;
    try {
      await api.auth.revokeSession(sessionId);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading && !error) return <p className="loading">Loading...</p>;
  if (error && (error.includes('permission') || error.includes('403'))) {
    return (
      <div>
        <h2 className="page-title">Sessions</h2>
        <p className="placeholder-text">You do not have permission to view sessions.</p>
      </div>
    );
  }
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div>
      <h2 className="page-title">My sessions (multi-device)</h2>
      <p className="dashboard-welcome">Active sessions. Revoke to log out that device.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Device / Session</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={3}>No sessions</td></tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.device_info || s.device_id || s.id.slice(0, 12)}</td>
                  <td>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <button type="button" className="btn-sm btn-danger" onClick={() => revoke(s.id)}>Revoke</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
