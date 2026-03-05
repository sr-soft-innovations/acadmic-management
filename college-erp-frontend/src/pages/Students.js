import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import FormError from '../components/FormError';
import './Students.css';

const COLORS = ['#E11B21','#FAD332','#2563eb','#16a34a','#9333ea','#f97316','#06b6d4','#ec4899'];
const GENDER_CLR = { Male: '#2563eb', Female: '#ec4899', Other: '#f59e0b' };
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: '', roll_no: '', course: '', semester: '', email: '', phone: '',
  date_of_birth: '', gender: '', blood_group: '', address: '', city: '', state: '', pincode: '',
  admission_date: '', academic_year: '', previous_school: '', board: '',
  guardian_name: '', guardian_relation: '', guardian_phone: '', guardian_email: '',
  guardian_address: '', guardian_occupation: '', category: '', batch: '', section: '', unique_id: '',
};

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export default function Students() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const canWrite = hasPermission('students:write');
  const isHod = user?.role === 'hod';
  const isAdmin = ['super_admin', 'admin', 'principal', 'hod'].includes(user?.role || '');
  const [list, setList] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  /* filters */
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  /* sort */
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  /* pagination */
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    setError('');
    api.students.list(false)
      .then(data => setList(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /* derived data */
  const courses = useMemo(() => [...new Set(list.map(s => s.course).filter(Boolean))].sort(), [list]);
  const semesters = useMemo(() => [...new Set(list.map(s => s.semester).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [list]);

  const filtered = useMemo(() => {
    let rows = list;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_no || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q)
      );
    }
    if (courseFilter) rows = rows.filter(s => s.course === courseFilter);
    if (semFilter) rows = rows.filter(s => s.semester === semFilter);
    if (genderFilter) rows = rows.filter(s => (s.gender || 'Not specified') === genderFilter);
    return rows;
  }, [list, search, courseFilter, semFilter, genderFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a[sortCol] ?? '').toString().toLowerCase();
      const bv = (b[sortCol] ?? '').toString().toLowerCase();
      if (sortCol === 'semester') return sortDir === 'asc' ? Number(a.semester || 0) - Number(b.semester || 0) : Number(b.semester || 0) - Number(a.semester || 0);
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, courseFilter, semFilter, genderFilter]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  /* stats */
  const stats = useMemo(() => {
    const byCourse = {};
    const byGender = {};
    const bySem = {};
    list.forEach(s => {
      const c = s.course || 'N/A';
      const g = s.gender || 'Not specified';
      const sem = s.semester || 'N/A';
      byCourse[c] = (byCourse[c] || 0) + 1;
      byGender[g] = (byGender[g] || 0) + 1;
      bySem[sem] = (bySem[sem] || 0) + 1;
    });
    return { total: list.length, byCourse, byGender, bySem };
  }, [list]);

  /* form actions */
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setError(''); };
  const openEdit = (s) => {
    const f = {};
    Object.keys(EMPTY_FORM).forEach(k => { f[k] = s[k] || ''; });
    setForm(f);
    setEditId(s.id);
    setError('');
  };
  const save = async () => {
    if (!form) return;
    if (!form.name?.trim()) { setError('Student name is required'); return; }
    try {
      if (editId) {
        await api.students.update(editId, form);
        toast.success('Student updated successfully');
      } else {
        await api.students.create(form);
        toast.success('Student added successfully');
      }
      setForm(null);
      setEditId(null);
      load();
    } catch (e) { setError(e.message); }
  };
  const remove = async (id) => {
    if (!confirmDelete || confirmDelete.id !== id) return;
    setConfirmDelete(null);
    try {
      await api.students.delete(id);
      toast.success('Student removed');
      load();
    } catch (e) { setError(e.message); }
  };
  const handleExport = () => {
    exportCSV(filtered.map(s => ({
      Name: s.name, 'Roll No': s.roll_no, Course: s.course, Semester: s.semester,
      Email: s.email, Phone: s.phone, Gender: s.gender || '', DOB: s.date_of_birth || '',
      City: s.city || '', State: s.state || '',
    })), 'students_export.csv');
  };

  if (loading) return <div className="stu-loading"><div className="skel skel-hero" /><div className="skel skel-sub" /></div>;

  return (
    <div className="students-page">
      {/* ── Stats Header ── */}
      <div className="stu-stats-strip">
        <div className="stu-stat-card stu-stat-primary">
          <span className="stu-stat-icon">🎓</span>
          <div><span className="stu-stat-val">{stats.total}</span><span className="stu-stat-lbl">Total Students</span></div>
        </div>
        {Object.entries(stats.byCourse).map(([c, n], i) => (
          <div key={c} className="stu-stat-card">
            <span className="stu-stat-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <div><span className="stu-stat-val">{n}</span><span className="stu-stat-lbl">{c}</span></div>
          </div>
        ))}
        {Object.entries(stats.byGender).map(([g, n]) => (
          <div key={g} className="stu-stat-card">
            <span className="stu-stat-dot" style={{ background: GENDER_CLR[g] || '#94a3b8' }} />
            <div><span className="stu-stat-val">{n}</span><span className="stu-stat-lbl">{g}</span></div>
          </div>
        ))}
      </div>

      {/* mini charts */}
      {stats.total > 0 && (
        <div className="stu-charts-row">
          <div className="stu-chart-card">
            <h4>By Course</h4>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={Object.entries(stats.byCourse).map(([name, value]) => ({ name, value }))}
                  cx="50%" cy="50%" outerRadius={55} innerRadius={25} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {Object.keys(stats.byCourse).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="stu-chart-card">
            <h4>By Gender</h4>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={Object.entries(stats.byGender).map(([name, value]) => ({ name, value }))}
                  cx="50%" cy="50%" outerRadius={55} innerRadius={25} paddingAngle={3} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {Object.entries(stats.byGender).map(([g], i) => <Cell key={i} fill={GENDER_CLR[g] || COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="stu-header">
        <div>
          <h2 className="page-title">Students</h2>
          {isHod && user?.department && <span className="stu-role-badge">Department: {user.department}</span>}
          {isAdmin && !isHod && <span className="stu-role-badge">All students</span>}
        </div>
        <div className="stu-header-actions">
          {canWrite && <button type="button" onClick={() => navigate('/students/promote')} className="btn">Promote</button>}
          {canWrite && <button type="button" onClick={() => navigate('/students/alumni')} className="btn">Alumni</button>}
          <button type="button" onClick={handleExport} className="btn" title="Export to CSV">📥 Export</button>
          {canWrite && <button type="button" onClick={openCreate} className="btn btn-primary">+ Add Student</button>}
        </div>
      </div>

      <FormError message={error} onDismiss={() => setError('')} />

      {/* ── Search & Filters ── */}
      <div className="stu-toolbar">
        <input
          type="text"
          placeholder="Search by name, roll no, email, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="stu-search"
        />
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="stu-filter">
          <option value="">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={semFilter} onChange={e => setSemFilter(e.target.value)} className="stu-filter">
          <option value="">All Semesters</option>
          {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="stu-filter">
          <option value="">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        {(search || courseFilter || semFilter || genderFilter) && (
          <button type="button" className="stu-clear-btn" onClick={() => { setSearch(''); setCourseFilter(''); setSemFilter(''); setGenderFilter(''); }}>Clear</button>
        )}
        <span className="stu-count">{filtered.length} of {list.length} students</span>
      </div>

      {/* ── Form Modal ── */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal modal-content stu-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? 'Edit' : 'New'} Student</h3>
            <div className="form-grid">
              <div><label>Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label>Roll No *</label><input value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} /></div>
              <div><label>Course *</label><input value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} placeholder="e.g. B.Pharm" /></div>
              <div><label>Semester</label><input value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} /></div>
              <div><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label>DOB</label><input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div><label>Gender</label><select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">—</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div><label>Blood group</label><input value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })} placeholder="e.g. O+" /></div>
              <div><label>Category</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. General, OBC" /></div>
              <div style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><label>City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><label>State</label><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><label>Pincode</label><input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} /></div>
              <div><label>Admission date</label><input type="date" value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} /></div>
              <div><label>Academic year</label><input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} placeholder="2024-25" /></div>
              <div><label>Batch</label><input value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} /></div>
              <div><label>Section</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} /></div>
              <div><label>Previous school</label><input value={form.previous_school} onChange={e => setForm({ ...form, previous_school: e.target.value })} /></div>
              <div><label>Board</label><input value={form.board} onChange={e => setForm({ ...form, board: e.target.value })} /></div>
              <div><label>Unique ID</label><input value={form.unique_id} onChange={e => setForm({ ...form, unique_id: e.target.value })} placeholder="Aadhaar / UID" /></div>
              <div style={{ gridColumn: '1 / -1' }}><h4 className="stu-form-section">Guardian Details</h4></div>
              <div><label>Name</label><input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} /></div>
              <div><label>Relation</label><input value={form.guardian_relation} onChange={e => setForm({ ...form, guardian_relation: e.target.value })} /></div>
              <div><label>Phone</label><input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} /></div>
              <div><label>Email</label><input type="email" value={form.guardian_email} onChange={e => setForm({ ...form, guardian_email: e.target.value })} /></div>
              <div><label>Occupation</label><input value={form.guardian_occupation} onChange={e => setForm({ ...form, guardian_occupation: e.target.value })} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={form.guardian_address} onChange={e => setForm({ ...form, guardian_address: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={save} className="btn btn-primary">{editId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-wrap">
        <table className="stu-table">
          <thead>
            <tr>
              <th className="stu-th-sortable" onClick={() => handleSort('name')}>Name{sortIcon('name')}</th>
              <th className="stu-th-sortable" onClick={() => handleSort('roll_no')}>Roll No{sortIcon('roll_no')}</th>
              <th className="stu-th-sortable" onClick={() => handleSort('course')}>Course{sortIcon('course')}</th>
              <th className="stu-th-sortable" onClick={() => handleSort('semester')}>Sem{sortIcon('semester')}</th>
              <th>Gender</th>
              <th className="stu-th-sortable" onClick={() => handleSort('email')}>Email{sortIcon('email')}</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No students found{(search || courseFilter || semFilter || genderFilter) ? ' matching filters' : ''}.</td></tr>
            ) : paginated.map(s => (
              <tr key={s.id}>
                <td>
                  <button type="button" className="link-button stu-name-link" onClick={() => navigate(`/students/${s.id}`)}>
                    <span className="stu-avatar" style={{ background: GENDER_CLR[s.gender] || '#94a3b8' }}>{(s.name || '?')[0].toUpperCase()}</span>
                    {s.name}
                  </button>
                </td>
                <td><code className="stu-roll">{s.roll_no}</code></td>
                <td><span className="stu-course-badge">{s.course}</span></td>
                <td className="stu-sem">{s.semester}</td>
                <td>{s.gender ? <span className="stu-gender-dot" style={{ background: GENDER_CLR[s.gender] || '#94a3b8' }}>{s.gender[0]}</span> : '—'}</td>
                <td className="stu-email">{s.email}</td>
                <td>{s.phone}</td>
                <td className="stu-actions">
                  <button type="button" onClick={() => navigate(`/students/${s.id}`)} className="btn-sm" title="Profile">👤</button>
                  {canWrite && <button type="button" onClick={() => openEdit(s)} className="btn-sm" title="Edit">✏️</button>}
                  {canWrite && <button type="button" onClick={() => setConfirmDelete({ id: s.id, name: s.name })} className="btn-sm btn-danger" title="Delete">🗑️</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="stu-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="stu-page-btn">← Prev</button>
          <div className="stu-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="stu-page-ellipsis">…</span>}
                  <button type="button" className={`stu-page-btn ${p === page ? 'stu-page-active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                </React.Fragment>
              ))}
          </div>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="stu-page-btn">Next →</button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete student"
        message={confirmDelete ? `Are you sure you want to delete ${confirmDelete.name}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(confirmDelete?.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
