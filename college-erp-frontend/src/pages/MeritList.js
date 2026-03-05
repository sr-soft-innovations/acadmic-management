import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './Admission.css';

const COURSES = ['B.Pharm', 'D.Pharm', 'M.Pharm', 'Pharm.D'];

export default function MeritList() {
  const [meritList, setMeritList] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admission
      .meritList(courseFilter || undefined)
      .then((r) => setMeritList(r.merit_list || []))
      .catch(() => setMeritList([]))
      .finally(() => setLoading(false));
  }, [courseFilter]);

  return (
    <div className="admission-page merit-list-page">
      <div className="page-header">
        <h2 className="page-title">Merit list</h2>
        <Link to="/admission" className="btn-secondary">← Admission</Link>
      </div>
      <div className="filters">
        <label>Course</label>
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All</option>
          {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? (
        <p className="loading">Loading merit list...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Course</th>
                <th>Category</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {meritList.length === 0 ? (
                <tr><td colSpan={7}>No applications in merit list</td></tr>
              ) : (
                meritList.map((a, idx) => (
                  <tr key={a.id}>
                    <td><strong>{a.merit_rank ?? idx + 1}</strong></td>
                    <td>{a.name}</td>
                    <td>{a.course || '—'}</td>
                    <td>{a.category || 'GEN'}</td>
                    <td>{a.marks_obtained || '—'}</td>
                    <td><span className={`status-badge status-${a.status}`}>{a.status}</span></td>
                    <td>{a.student_id ? <Link to={`/students/${a.student_id}`}>View student</Link> : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
