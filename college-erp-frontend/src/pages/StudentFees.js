import React, { useState, useEffect } from 'react';
import api from '../api';

export default function StudentFees() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.student.fees()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading…</p>;

  const structure = data?.structure;
  const payments = data?.payments || [];
  const totalPaid = data?.total_paid ?? 0;
  const feeDue = data?.fee_due ?? 0;

  return (
    <div className="student-portal">
      <h2 className="page-title">Fee Structure & Payment History</h2>
      <p className="dashboard-welcome">View your fee structure, payment history, and due amount.</p>
      {error && <p className="form-error">{error}</p>}

      {structure && (
        <section className="table-wrap">
          <h3>Fee Structure</h3>
          <p><strong>Course:</strong> {structure.course} · Sem {structure.semester}</p>
          <p><strong>Total:</strong> ₹{Number(structure.total || 0).toLocaleString('en-IN')}</p>
        </section>
      )}

      <section className="table-wrap">
        <h3>Payment History</h3>
        <p><strong>Total Paid:</strong> ₹{Number(totalPaid).toLocaleString('en-IN')} ({payments.length} transaction(s))</p>
        {feeDue > 0 && <p className="form-error"><strong>Due:</strong> ₹{Number(feeDue).toLocaleString('en-IN')}</p>}
        {payments.length > 0 ? (
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Receipt</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{(p.paid_at || p.created_at || '').slice(0, 10)}</td>
                  <td>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td>{p.fee_type || '—'}</td>
                  <td>{p.receipt_no || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No payments recorded yet.</p>
        )}
      </section>
    </div>
  );
}
