import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SemesterSetup() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [filterProgram, setFilterProgram] = useState('');

  const load = () => {
    setLoading(true);
    api.semesters
      .list(filterProgram || undefined)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterProgram]);

  const openCreate = () => {
    setForm({ program: 'B.Pharm', semester_number: 1, name: '' });
    setEditId(null);
  };

  const openEdit = (s) => {
    setForm({ program: s.program || '', semester_number: s.semester_number ?? 1, name: s.name || '' });
    setEditId(s.id);
  };

  const save = async () => {
    if (!form) return;
    try {
      if (editId) await api.semesters.update(editId, form);
      else await api.semesters.create(form);
      setForm(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this semester?')) return;
    try {
      await api.semesters.delete(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const programs = [...new Set(list.map((s) => s.program).filter(Boolean))];

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div>
      <h2 className="page-title">Semester setup</h2>
      <p className="dashboard-welcome">Define semesters for each program (e.g. B.Pharm, D.Pharm).</p>
      {error && <p className="form-error">{error}</p>}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add semester</button>
      </div>
      {form && (
        <div className="modal">
          <h3>{editId ? 'Edit' : 'New'} semester</h3>
          <div className="form-grid">
            <div><label>Program</label><input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="e.g. B.Pharm" /></div>
            <div><label>Semester number</label><input type="number" min={1} value={form.semester_number} onChange={(e) => setForm({ ...form, semester_number: parseInt(e.target.value, 10) || 1 })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label>Name (optional)</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Semester I" /></div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={save}>Save</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Program</th><th>Semester #</th><th>Name</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.program}</td>
                <td>{s.semester_number}</td>
                <td>{s.name || `Semester ${s.semester_number}`}</td>
                <td>
                  <button type="button" className="btn btn-small" onClick={() => openEdit(s)}>Edit</button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
