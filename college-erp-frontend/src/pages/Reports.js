import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { exportToCSV } from '../utils/exportUtils';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reports
      .summary()
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleExportExcel = () => {
    if (!summary) return;
    const rows = [
      { metric: 'Students', value: summary.students },
      { metric: 'Staff', value: summary.staff },
      { metric: 'Courses', value: summary.courses },
      { metric: 'Fee collections (count)', value: summary.fee_collections_count },
      { metric: 'Fee total collected (₹)', value: summary.fee_total_collected },
      { metric: 'Exams total', value: summary.exams_total },
      { metric: 'Exams upcoming', value: summary.exams_upcoming_count },
      { metric: 'Pending approvals', value: summary.pending_approvals_count },
      { metric: 'Attendance records', value: summary.attendance_records },
    ];
    exportToCSV(rows, 'report_summary.csv', ['metric', 'value']);
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) return <p className="loading">Loading reports...</p>;

  return (
    <div className="reports-page">
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
        <div className="page-header-actions">
          <button type="button" onClick={handleExportExcel} className="btn" disabled={!summary}>
            Export to Excel (CSV)
          </button>
          <button type="button" onClick={handleExportPDF} className="btn btn-secondary">
            Print / PDF
          </button>
          <Link to="/" className="btn btn-secondary">Dashboard</Link>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="reports-summary-card">
        <h3>Report summary</h3>
        <p className="reports-description">High-level metrics for the college. Use Export to download as CSV or print for PDF.</p>
        {summary ? (
          <div className="report-summary-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Students</td><td><strong>{summary.students}</strong></td></tr>
                <tr><td>Staff</td><td><strong>{summary.staff}</strong></td></tr>
                <tr><td>Courses</td><td><strong>{summary.courses}</strong></td></tr>
                <tr><td>Fee collections (count)</td><td><strong>{summary.fee_collections_count}</strong></td></tr>
                <tr><td>Fee total collected (₹)</td><td><strong>{summary.fee_total_collected?.toLocaleString() ?? '0'}</strong></td></tr>
                <tr><td>Exams total</td><td><strong>{summary.exams_total}</strong></td></tr>
                <tr><td>Exams upcoming</td><td><strong>{summary.exams_upcoming_count}</strong></td></tr>
                <tr><td>Pending approvals</td><td><strong>{summary.pending_approvals_count}</strong></td></tr>
                <tr><td>Attendance records</td><td><strong>{summary.attendance_records}</strong></td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="placeholder-text">No summary data available.</p>
        )}
      </div>

      <div className="reports-links">
        <h3>More reports</h3>
        <ul>
          <li><Link to="/reports/builder">Custom report builder</Link></li>
          <li><Link to="/reports/export-excel">Export to Excel</Link></li>
          <li><Link to="/reports/export-pdf">Export to PDF</Link></li>
          <li><Link to="/analytics">Graphical dashboard</Link></li>
          <li><Link to="/analytics/department-performance">Department performance analytics</Link></li>
        </ul>
      </div>
    </div>
  );
}
