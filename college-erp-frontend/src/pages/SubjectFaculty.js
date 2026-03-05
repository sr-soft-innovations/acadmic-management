import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SubjectFaculty() {
  const [mappings, setMappings] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addSubjectId, setAddSubjectId] = useState('');
  const [addStaffId, setAddStaffId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.subjectFaculty.list().then((data) => setMappings(Array.isArray(data) ? data : [])),
      api.courses.list().then((data) => setSubjects(Array.isArray(data) ? data : [])),
      api.staff.list().then((data) => setStaff(Array.isArray(data) ? data : [])),
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addSubjectId || !addStaffId) return;
    try {
      await api.subjectFaculty.create({ subject_id: addSubjectId, staff_id: addStaffId });
      setAddSubjectId('');
      setAddStaffId('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this mapping?')) return;
    try {
      await api.subjectFaculty.delete(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div>
      <h2 className="page-title">Subject–faculty mapping</h2>
      <p className="dashboard-welcome">Assign faculty to subjects.</p>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleAdd} className="form-grid" style={{ marginBottom: '1rem', alignItems: 'end' }}>
        <div><label>Subject</label><select value={addSubjectId} onChange={(e) => setAddSubjectId(e.target.value)} required><option value="">Select</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></div>
        <div><label>Faculty</label><select value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)} required><option value="">Select</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} – {s.designation}</option>)}</select></div>
        <div><button type="submit" className="btn btn-primary">Add mapping</button></div>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Faculty</th><th></th></tr></thead>
          <tbody>
            {mappings.length === 0 ? <tr><td colSpan="3">No mappings. Add one above.</td></tr> : mappings.map((m) => (
              <tr key={m.id}><td>{m.subject_name || m.subject_id}</td><td>{m.staff_name || m.staff_id}</td><td><button type="button" className="btn btn-small btn-danger" onClick={() => remove(m.id)}>Remove</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
