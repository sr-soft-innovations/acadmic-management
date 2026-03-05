import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Approvals() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    api.approvals
      .pending()
      .then((r) => setList(r.approvals || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDecision = async (id, status) => {
    const remarks = window.prompt(status === 'approved' ? 'Remarks (optional):' : 'Reason for rejection (optional):') || '';
    try {
      await api.approvals.update(id, status, remarks);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div>
      <h2 className="page-title">Pending approvals</h2>
      <p className="dashboard-welcome">Review and approve or reject requests.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Applicant</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6}>No pending approvals</td></tr>
            ) : (
              list.map((a) => (
                <tr key={a.id}>
                  <td>{a.type}</td>
                  <td>{a.applicant_name || '—'}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{a.details || '—'}</td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <button type="button" className="btn-sm btn-primary" onClick={() => handleDecision(a.id, 'approved')}>Approve</button>
                    <button type="button" className="btn-sm btn-danger" onClick={() => handleDecision(a.id, 'rejected')}>Reject</button>
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
