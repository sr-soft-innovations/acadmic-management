import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function StudentMarks() {
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.student.marks()
      .then((r) => setMarks(r.marks || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="student-portal">
      <h2 className="page-title">My Marks</h2>
      <p className="dashboard-welcome">View your internal and external examination marks.</p>
      {error && <p className="form-error">{error}</p>}
      {marks.length === 0 ? (
        <p>No marks recorded yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Subject</th><th>Exam Type</th><th>Marks</th><th>Date</th></tr>
            </thead>
            <tbody>
              {marks.map((m) => (
                <tr key={m.id}>
                  <td>{m.subject}</td>
                  <td>{m.exam_type}</td>
                  <td>{m.marks} / {m.max_marks}</td>
                  <td>{m.exam_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p><Link to="/results" className="btn btn-secondary">View Results & GPA</Link></p>
    </div>
  );
}
