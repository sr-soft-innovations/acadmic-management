import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Alumni() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  useEffect(() => {
    api.students
      .alumni()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = list.filter((s) => {
    if (filterYear && (s.alumni_year || '') !== filterYear) return false;
    if (filterCourse && (s.course || '') !== filterCourse) return false;
    return true;
  });

  const years = [...new Set(list.map((s) => s.alumni_year).filter(Boolean))].sort().reverse();
  const courses = [...new Set(list.map((s) => s.course).filter(Boolean))].sort();

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <button type="button" className="btn btn-small" onClick={() => navigate('/students')}>← Back</button>
        <h2 className="page-title">Alumni tracking</h2>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Filter by year</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Filter by course</label>
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="dashboard-welcome">Total alumni: {filtered.length}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Roll No</th>
              <th>Course</th>
              <th>Last semester</th>
              <th>Alumni year</th>
              <th>Contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7">No alumni records. Use Promotion to mark students as alumni.</td></tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}>
                  <td><button type="button" className="link-button" onClick={() => navigate(`/students/${s.id}`)}>{s.name}</button></td>
                  <td>{s.roll_no}</td>
                  <td>{s.course}</td>
                  <td>{s.semester}</td>
                  <td>{s.alumni_year || '—'}</td>
                  <td>{s.email || s.phone || '—'}</td>
                  <td><button type="button" className="btn-sm" onClick={() => navigate(`/students/${s.id}`)}>Profile</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
