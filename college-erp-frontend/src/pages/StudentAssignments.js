import React, { useState, useEffect } from 'react';
import api from '../api';

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(null);
  const [formByAssignment, setFormByAssignment] = useState({});

  useEffect(() => {
    api.student.assignments()
      .then((r) => setAssignments(r.assignments || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e, assignmentId) => {
    e.preventDefault();
    const content = formByAssignment[assignmentId] || '';
    if (!content?.trim()) return;
    setSubmitting(assignmentId);
    try {
      await api.student.submitAssignment({ assignment_id: assignmentId, content });
      setFormByAssignment((f) => ({ ...f, [assignmentId]: '' }));
      const r = await api.student.assignments();
      setAssignments(r.assignments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="student-portal">
      <h2 className="page-title">Assignments</h2>
      <p className="dashboard-welcome">View and submit your assignments.</p>
      {error && <p className="form-error">{error}</p>}
      {assignments.length === 0 ? (
        <p>No assignments for your course.</p>
      ) : (
        <ul className="assignment-list">
          {assignments.map((a) => (
            <li key={a.id} className={`assignment-item ${a.submitted ? 'submitted' : ''}`}>
              <div>
                <strong>{a.title}</strong>
                <span className="assignment-meta">{a.subject} · Due: {a.due_date}</span>
              </div>
              <p>{a.description}</p>
              {a.submitted ? (
                <p className="status-badge status-active">Submitted</p>
              ) : (
                <form onSubmit={(e) => handleSubmit(e, a.id)} className="form-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Your submission</label>
                    <textarea value={formByAssignment[a.id] || ''} onChange={(e) => setFormByAssignment((f) => ({ ...f, [a.id]: e.target.value }))} rows={3} placeholder="Enter your response..." />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting === a.id}>
                    {submitting === a.id ? 'Submitting…' : 'Submit'}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
