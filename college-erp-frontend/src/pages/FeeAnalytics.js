import React, { useState, useEffect } from 'react';
import api from '../api';

function formatAmount(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

function formatDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', { dateStyle: 'short' });
  } catch {
    return s;
  }
}

export default function FeeAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.fees
      .analytics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="placeholder-text">No analytics data.</p>;

  const { total_collected, transaction_count, by_course, by_semester, by_fee_type, by_month, recent_collections } = data;

  return (
    <div>
      <h2 className="page-title">Fee collection analytics</h2>

      <div className="fee-analytics-summary">
        <div className="fee-summary-card fee-total">
          <span className="fee-summary-label">Total collected</span>
          <span className="fee-summary-value">{formatAmount(total_collected)}</span>
        </div>
        <div className="fee-summary-card">
          <span className="fee-summary-label">Transactions</span>
          <span className="fee-summary-value">{transaction_count}</span>
        </div>
      </div>

      <div className="strength-tables fee-tables">
        <div className="strength-block">
          <h4>By course</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Course</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {Object.entries(by_course || {}).map(([course, amt]) => (
                  <tr key={course}><td>{course}</td><td>{formatAmount(amt)}</td></tr>
                ))}
                {(!by_course || Object.keys(by_course).length === 0) && (
                  <tr><td colSpan={2}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="strength-block">
          <h4>By fee type</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {Object.entries(by_fee_type || {}).map(([type, amt]) => (
                  <tr key={type}><td>{type}</td><td>{formatAmount(amt)}</td></tr>
                ))}
                {(!by_fee_type || Object.keys(by_fee_type).length === 0) && (
                  <tr><td colSpan={2}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(by_semester && Object.keys(by_semester).length > 0) && (
        <div className="strength-block strength-full">
          <h4>By semester</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Semester</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {Object.entries(by_semester).map(([sem, amt]) => (
                  <tr key={sem}><td>{sem}</td><td>{formatAmount(amt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(by_month && Object.keys(by_month).length > 0) && (
        <div className="strength-block strength-full">
          <h4>By month</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Month</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {Object.entries(by_month).map(([month, amt]) => (
                  <tr key={month}><td>{month}</td><td>{formatAmount(amt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="strength-block strength-full">
        <h4>Recent collections</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Roll No</th>
                <th>Course</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {(recent_collections || []).length === 0 ? (
                <tr><td colSpan={7}>No collections yet</td></tr>
              ) : (
                (recent_collections || []).map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.paid_at || c.created_at)}</td>
                    <td>{c.student_name || '—'}</td>
                    <td>{c.roll_no || '—'}</td>
                    <td>{c.course || '—'}</td>
                    <td>{c.fee_type || '—'}</td>
                    <td>{formatAmount(c.amount)}</td>
                    <td>{c.receipt_no || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
