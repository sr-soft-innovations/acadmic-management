import React, { useState, useEffect } from 'react';
import api from '../api';

export default function StudentNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.student.notices()
      .then((r) => setNotices(r.notices || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="student-portal">
      <h2 className="page-title">Notices</h2>
      <p className="dashboard-welcome">View notices and announcements for students.</p>
      {error && <p className="form-error">{error}</p>}
      {notices.length === 0 ? (
        <p>No notices at the moment.</p>
      ) : (
        <ul className="notice-list">
          {notices.map((n) => (
            <li key={n.id} className="notice-item">
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              {n.expiry_date && <span className="notice-meta">Valid until: {n.expiry_date}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
