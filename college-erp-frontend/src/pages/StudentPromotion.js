import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function StudentPromotion() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [targetSemester, setTargetSemester] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [setAlumni, setSetAlumni] = useState(false);
  const [alumniYear, setAlumniYear] = useState(new Date().getFullYear().toString());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.students
      .list(false)
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    if (filterCourse && (s.course || '') !== filterCourse) return false;
    if (filterSemester && (s.semester || '') !== filterSemester) return false;
    return true;
  });

  const courses = [...new Set(students.map((s) => s.course).filter(Boolean))].sort();
  const semesters = [...new Set(students.map((s) => s.semester).filter(Boolean))].sort();

  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedIds.length >= filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((s) => s.id));
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!targetSemester.trim() || selectedIds.length === 0) {
      setError('Select target semester and at least one student.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.students.promote({
        student_ids: selectedIds,
        target_semester: targetSemester.trim(),
        set_alumni: setAlumni,
        alumni_year: alumniYear || new Date().getFullYear().toString(),
      });
      setSelectedIds([]);
      setTargetSemester('');
      setStudents((prev) =>
        prev.map((s) =>
          selectedIds.includes(s.id)
            ? { ...s, semester: targetSemester.trim(), ...(setAlumni ? { is_alumni: true, alumni_year: alumniYear } : {}) }
            : s
        )
      );
      api.students.list(false).then((data) => setStudents(Array.isArray(data) ? data : []));
    } catch (err) {
      setError(err.message || 'Promotion failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <button type="button" className="btn btn-small" onClick={() => navigate('/students')}>← Back</button>
        <h2 className="page-title">Student promotion (year upgrade)</h2>
      </div>
      {error && <p className="form-error">{error}</p>}

      <form onSubmit={handlePromote} className="form-grid" style={{ marginBottom: '1.5rem' }}>
        <div>
          <label>Filter by course</label>
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Filter by current semester</label>
          <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
            <option value="">All</option>
            {semesters.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Target semester</label>
          <input value={targetSemester} onChange={(e) => setTargetSemester(e.target.value)} placeholder="e.g. 2" required />
        </div>
        <div>
          <label>
            <input type="checkbox" checked={setAlumni} onChange={(e) => setSetAlumni(e.target.checked)} />
            Mark as alumni after promotion
          </label>
        </div>
        {setAlumni && (
          <div>
            <label>Alumni year</label>
            <input value={alumniYear} onChange={(e) => setAlumniYear(e.target.value)} />
          </div>
        )}
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={filtered.length > 0 && selectedIds.length >= filtered.length} onChange={toggleAll} /></th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Course</th>
              <th>Semester</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} /></td>
                <td>{s.name}</td>
                <td>{s.roll_no}</td>
                <td>{s.course}</td>
                <td>{s.semester}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1rem' }}>
        Selected: {selectedIds.length}. Target semester: {targetSemester || '—'}
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={selectedIds.length === 0 || !targetSemester.trim()} onClick={handlePromote}>
          {submitting ? 'Promoting…' : 'Promote selected'}
        </button>
        <button type="button" className="btn" onClick={() => navigate('/students')}>Cancel</button>
      </div>
    </div>
  );
}
