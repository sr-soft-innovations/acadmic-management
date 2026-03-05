import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import FormError from '../components/FormError';
import './Departments.css';

const COLORS = ['#E11B21', '#FAD332', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: '',
  code: '',
  head_of_department: '',
  description: '',
  established_year: '',
  phone: '',
  email: '',
};

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export default function Departments() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission('departments:write');

  const [list, setList] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [depts, staff] = await Promise.all([api.departments.list(), api.staff.list()]);
      setList(Array.isArray(depts) ? depts : []);
      setStaffList(Array.isArray(staff) ? staff : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hodOptions = useMemo(() => {
    return staffList
      .filter((s) => (s.designation || '').toLowerCase().includes('hod') || (s.designation || '').toLowerCase().includes('head') || (s.role || '').toLowerCase() === 'hod')
      .map((s) => s.name);
  }, [staffList]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.code || '').toLowerCase().includes(q) ||
        (d.head_of_department || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'staff_count' || sortCol === 'student_count' || sortCol === 'course_count') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const totalStaff = list.reduce((a, d) => a + (d.staff_count || 0), 0);
    const totalStudents = list.reduce((a, d) => a + (d.student_count || 0), 0);
    const totalCourses = list.reduce((a, d) => a + (d.course_count || 0), 0);
    return { totalDepts: list.length, totalStaff, totalStudents, totalCourses };
  }, [list]);

  const chartData = useMemo(() => {
    return list.map((d) => ({
      name: d.name,
      staff: d.staff_count || 0,
      students: d.student_count || 0,
      courses: d.course_count || 0,
    }));
  }, [list]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditId(null); };
  const openEdit = (d) => {
    setForm({
      name: d.name || '',
      code: d.code || '',
      head_of_department: d.head_of_department || '',
      description: d.description || '',
      established_year: d.established_year || '',
      phone: d.phone || '',
      email: d.email || '',
    });
    setEditId(d.id);
  };

  const save = async () => {
    if (!form || !form.name.trim()) { setError('Department name is required'); return; }
    try {
      if (editId) {
        await api.departments.update(editId, form);
        toast.success('Department updated successfully');
      } else {
        await api.departments.create(form);
        toast.success('Department added successfully');
      }
      setForm(null);
      setEditId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirmDelete || confirmDelete.id !== id) return;
    setConfirmDelete(null);
    try {
      await api.departments.delete(id);
      toast.success('Department removed');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading && !list.length) {
    return (
      <div className="dept-page">
        <div className="dept-loading">
          <div className="dept-skeleton" style={{ width: '100%', height: 80 }} />
          <div className="dept-skeleton" style={{ width: '100%', height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dept-page">
      {/* Stats Strip */}
      <div className="dept-stats-strip">
        <div className="dept-stat-card dept-stat-primary">
          <span className="dept-stat-icon">🏛️</span>
          <div>
            <span className="dept-stat-value">{stats.totalDepts}</span>
            <span className="dept-stat-label">Departments</span>
          </div>
        </div>
        <div className="dept-stat-card">
          <span className="dept-stat-icon">👨‍🏫</span>
          <div>
            <span className="dept-stat-value">{stats.totalStaff}</span>
            <span className="dept-stat-label">Total Staff</span>
          </div>
        </div>
        <div className="dept-stat-card">
          <span className="dept-stat-icon">🎓</span>
          <div>
            <span className="dept-stat-value">{stats.totalStudents}</span>
            <span className="dept-stat-label">Total Students</span>
          </div>
        </div>
        <div className="dept-stat-card">
          <span className="dept-stat-icon">📚</span>
          <div>
            <span className="dept-stat-value">{stats.totalCourses}</span>
            <span className="dept-stat-label">Courses</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {list.length > 0 && (
        <div className="dept-charts-row">
          <div className="dept-chart-card">
            <h4>Staff by Department</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData.filter((d) => d.staff > 0)} dataKey="staff" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="dept-chart-card">
            <h4>Department Comparison</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="staff" fill="#E11B21" name="Staff" />
                <Bar dataKey="students" fill="#FAD332" name="Students" />
                <Bar dataKey="courses" fill="#2563eb" name="Courses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dept-header">
        <h2 className="page-title">Departments</h2>
        <div className="dept-header-actions">
          <button type="button" className="btn-secondary" onClick={() => exportCSV(list.map((d) => ({ Name: d.name, Code: d.code, HOD: d.head_of_department, Staff: d.staff_count, Students: d.student_count, Courses: d.course_count, Email: d.email, Phone: d.phone })), 'departments.csv')}>
            Export CSV
          </button>
          {canWrite && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              + Add Department
            </button>
          )}
        </div>
      </div>

      <FormError message={error} onDismiss={() => setError('')} />

      {/* Toolbar */}
      <div className="dept-toolbar">
        <input
          className="dept-search"
          type="text"
          placeholder="Search departments..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        {search && (
          <button type="button" className="btn-sm" onClick={() => { setSearch(''); setPage(1); }}>Clear</button>
        )}
        <span className="dept-count">{filtered.length} department{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="dept-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Department{sortIcon('name')}</th>
              <th onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>Code{sortIcon('code')}</th>
              <th onClick={() => handleSort('head_of_department')} style={{ cursor: 'pointer' }}>HOD{sortIcon('head_of_department')}</th>
              <th onClick={() => handleSort('staff_count')} style={{ cursor: 'pointer' }}>Staff{sortIcon('staff_count')}</th>
              <th onClick={() => handleSort('student_count')} style={{ cursor: 'pointer' }}>Students{sortIcon('student_count')}</th>
              <th onClick={() => handleSort('course_count')} style={{ cursor: 'pointer' }}>Courses{sortIcon('course_count')}</th>
              <th>Contact</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={canWrite ? 8 : 7} className="dept-empty-row">No departments found</td></tr>
            ) : (
              paginated.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="dept-name-cell">
                      <span className="dept-avatar" style={{ background: COLORS[(Number(d.id) - 1) % COLORS.length] }}>
                        {(d.name || '?')[0]}
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        {d.description && <span className="dept-desc-sm">{d.description}</span>}
                      </div>
                    </div>
                  </td>
                  <td><code className="dept-code-badge">{d.code || '—'}</code></td>
                  <td>{d.head_of_department || <span className="text-muted">Not assigned</span>}</td>
                  <td>
                    <span className="dept-count-badge dept-count-staff">{d.staff_count || 0}</span>
                  </td>
                  <td>
                    <span className="dept-count-badge dept-count-student">{d.student_count || 0}</span>
                  </td>
                  <td>
                    <span className="dept-count-badge dept-count-course">{d.course_count || 0}</span>
                  </td>
                  <td>
                    <div className="dept-contact">
                      {d.email && <span title={d.email}>📧 {d.email}</span>}
                      {d.phone && <span title={d.phone}>📞 {d.phone}</span>}
                      {!d.email && !d.phone && '—'}
                    </div>
                  </td>
                  {canWrite && (
                    <td className="dept-actions">
                      <button type="button" className="dept-action-btn" onClick={() => openEdit(d)} title="Edit">✏️</button>
                      <button type="button" className="dept-action-btn dept-action-delete" onClick={() => setConfirmDelete({ id: d.id, name: d.name })} title="Delete">🗑️</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="dept-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .reduce((acc, n, idx, arr) => {
              if (idx > 0 && n - arr[idx - 1] > 1) acc.push('...');
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === '...' ? (
                <span key={`e${i}`} className="dept-page-ellipsis">...</span>
              ) : (
                <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            )}
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Quick Links */}
      <div className="dept-quick-links">
        <h4>Quick Actions</h4>
        <div className="dept-quick-grid">
          <button className="dept-quick-btn" onClick={() => navigate('/staff')}>👨‍🏫 Manage Staff</button>
          <button className="dept-quick-btn" onClick={() => navigate('/students')}>🎓 Manage Students</button>
          <button className="dept-quick-btn" onClick={() => navigate('/courses')}>📚 Manage Subjects</button>
          {canWrite && <button className="dept-quick-btn" onClick={openCreate}>+ New Department</button>}
        </div>
      </div>

      {/* Form Modal */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content dept-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Department' : 'Add Department'}</h3>
            <div className="dept-form-grid">
              <div className="dept-form-full">
                <label>Department Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pharmaceutics" required />
              </div>
              <div>
                <label>Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. PHARMA" />
              </div>
              <div>
                <label>Head of Department</label>
                <input
                  list="hod-suggestions"
                  value={form.head_of_department}
                  onChange={(e) => setForm({ ...form, head_of_department: e.target.value })}
                  placeholder="Select or type HOD name"
                />
                <datalist id="hod-suggestions">
                  {hodOptions.map((n, i) => <option key={i} value={n} />)}
                  {staffList.filter((s) => !hodOptions.includes(s.name)).map((s, i) => <option key={`s${i}`} value={s.name} />)}
                </datalist>
              </div>
              <div>
                <label>Established Year</label>
                <input value={form.established_year} onChange={(e) => setForm({ ...form, established_year: e.target.value })} placeholder="e.g. 2005" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="dept@college.edu" />
              </div>
              <div>
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
              </div>
              <div className="dept-form-full">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the department"
                  rows={3}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save}>
                {editId ? 'Update' : 'Create'} Department
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete department"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This may affect staff and student assignments.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(confirmDelete?.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
