import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './Staff.css';

export default function StaffResignations() {
  const { hasPermission } = useAuth();
  const [list, setList] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const canWrite = hasPermission('staff:write');

  useEffect(() => {
    Promise.all([
      api.staff.resignations(statusFilter || undefined).then((r) => setList(r.resignations || [])),
      api.staff.list().then((data) => setStaff(Array.isArray(data) ? data : [])),
    ]).finally(() => setLoading(false));
  }, [statusFilter]);

  const staffById = Object.fromEntries((staff || []).map((s) => [s.id, s]));

  const handleUpdate = async (id, status) => {
    try {
      await api.staff.updateResignation(id, { status, remarks: '' });
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="staff-page">
      <div className="page-header">
        <h2 className="page-title">Exit / Resignations</h2>
        <Link to="/staff" className="btn-secondary">← Staff</Link>
      </div>
      <div className="filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Notice date</th>
              <th>Last working date</th>
              <th>Reason</th>
              <th>Status</th>
              {canWrite && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={canWrite ? 6 : 5}>No resignations</td></tr>
            ) : (
              list.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/staff/${r.staff_id}`}>{staffById[r.staff_id]?.name || r.staff_id}</Link></td>
                  <td>{r.notice_date || '—'}</td>
                  <td>{r.last_working_date || '—'}</td>
                  <td>{r.reason || '—'}</td>
                  <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                  {canWrite && r.status === 'pending' && (
                    <td>
                      <button type="button" className="btn-sm btn-primary" onClick={() => handleUpdate(r.id, 'approved')}>Approve</button>
                      <button type="button" className="btn-sm btn-danger" onClick={() => handleUpdate(r.id, 'rejected')}>Reject</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
