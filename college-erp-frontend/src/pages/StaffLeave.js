import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './Staff.css';

export default function StaffLeave() {
  const { hasPermission } = useAuth();
  const [requests, setRequests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const canWrite = hasPermission('staff:write');

  useEffect(() => {
    Promise.all([
      api.staff.allLeaveRequests(statusFilter || undefined).then((r) => setRequests(r.leave_requests || [])),
      api.staff.list().then((data) => setStaff(Array.isArray(data) ? data : [])),
    ]).finally(() => setLoading(false));
  }, [statusFilter]);

  const staffById = Object.fromEntries((staff || []).map((s) => [s.id, s]));

  const handleApprove = async (id, approved) => {
    try {
      await api.staff.updateLeaveRequest(id, { status: approved ? 'approved' : 'rejected', remarks: '' });
      setRequests((r) => r.map((x) => (x.id === id ? { ...x, status: approved ? 'approved' : 'rejected' } : x)));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="staff-page">
      <div className="page-header">
        <h2 className="page-title">Leave requests</h2>
        <Link to="/staff" className="btn-secondary">← Staff</Link>
      </div>
      <div className="filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Status</th>
              {canWrite && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={canWrite ? 7 : 6}>No leave requests</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td>{staffById[r.staff_id]?.name || r.staff_id}</td>
                  <td>{r.from_date}</td>
                  <td>{r.to_date}</td>
                  <td>{r.leave_type || '—'}</td>
                  <td>{r.reason || '—'}</td>
                  <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                  {canWrite && r.status === 'pending' && (
                    <td>
                      <button type="button" className="btn-sm btn-primary" onClick={() => handleApprove(r.id, true)}>Approve</button>
                      <button type="button" className="btn-sm btn-danger" onClick={() => handleApprove(r.id, false)}>Reject</button>
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
