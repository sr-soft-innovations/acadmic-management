import React, { useState, useEffect } from 'react';
import api from '../api';

export default function StudentCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tcReason, setTcReason] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    api.student.certificates()
      .then((r) => setCertificates(r.certificates || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRequestTC = async (e) => {
    e.preventDefault();
    setRequesting(true);
    try {
      await api.student.requestTC({ reason: tcReason });
      setTcReason('');
      const r = await api.student.certificates();
      setCertificates(r.certificates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(false);
    }
  };

  const hasPendingTC = certificates.some((c) => (c.type || '').toLowerCase() === 'tc_request' && (c.status || '').toLowerCase() === 'pending');

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="student-portal">
      <h2 className="page-title">Certificates</h2>
      <p className="dashboard-welcome">Download Bonafide certificate or request Transfer Certificate.</p>
      {error && <p className="form-error">{error}</p>}

      <section>
        <h3>Bonafide Certificate</h3>
        <p>Download your Bonafide certificate from the office. Contact admin for issuance.</p>
      </section>

      <section>
        <h3>Transfer Certificate (TC)</h3>
        {hasPendingTC ? (
          <p className="status-badge status-active">TC request is pending approval.</p>
        ) : (
          <form onSubmit={handleRequestTC} className="form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Reason for TC request</label>
              <textarea value={tcReason} onChange={(e) => setTcReason(e.target.value)} rows={2} placeholder="Reason (optional)" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={requesting}>{requesting ? 'Requesting…' : 'Request TC'}</button>
          </form>
        )}
      </section>

      {certificates.length > 0 && (
        <section className="table-wrap">
          <h3>Certificate History</h3>
          <table>
            <thead><tr><th>Type</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {certificates.map((c) => (
                <tr key={c.id}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td>{(c.requested_at || c.created_at || '').slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
