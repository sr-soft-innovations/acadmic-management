import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import FormError from '../components/FormError';
import './Staff.css';

const COLORS = ['#E11B21', '#FAD332', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const ROLES = ['Faculty', 'HOD', 'Principal', 'Lab Assistant', 'Guest Faculty', 'Visiting', 'Substitute'];
const PAGE_SIZE = 12;
const STAFF_TEMPLATE_COLUMNS = ['name', 'designation', 'department', 'role', 'email', 'phone', 'date_of_joining', 'is_guest_faculty', 'is_substitute'];

const emptyForm = {
  name: '',
  designation: '',
  department: '',
  role: 'Faculty',
  email: '',
  phone: '',
  date_of_joining: '',
  is_guest_faculty: false,
  is_substitute: false,
  substitute_for_staff_id: '',
  qualifications: [],
  experience: [],
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

export default function Staff() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const canWrite = hasPermission('staff:write');

  const load = () => {
    setLoading(true);
    setError('');
    api.staff
      .list()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const departments = useMemo(() => [...new Set(list.map((s) => s.department).filter(Boolean))].sort(), [list]);
  const roles = useMemo(() => [...new Set(list.map((s) => s.role).filter(Boolean))].sort(), [list]);

  const stats = useMemo(() => {
    const byDept = {};
    const byRole = {};
    let guest = 0, substitute = 0, regular = 0;
    for (const s of list) {
      const dept = (s.department || '').trim() || 'Other';
      const role = (s.role || '').trim() || 'Faculty';
      byDept[dept] = (byDept[dept] || 0) + 1;
      byRole[role] = (byRole[role] || 0) + 1;
      if (s.is_substitute) substitute++;
      else if (s.is_guest_faculty) guest++;
      else regular++;
    }
    return { total: list.length, byDept, byRole, guest, substitute, regular };
  }, [list]);

  const deptChartData = useMemo(() => Object.entries(stats.byDept).map(([name, value]) => ({ name, value })), [stats]);
  const roleChartData = useMemo(() => Object.entries(stats.byRole).map(([name, value]) => ({ name, value })), [stats]);

  const filtered = useMemo(() => {
    let result = list;
    if (deptFilter) result = result.filter((s) => s.department === deptFilter);
    if (roleFilter) result = result.filter((s) => s.role === roleFilter);
    if (typeFilter === 'regular') result = result.filter((s) => !s.is_guest_faculty && !s.is_substitute);
    else if (typeFilter === 'guest') result = result.filter((s) => s.is_guest_faculty && !s.is_substitute);
    else if (typeFilter === 'substitute') result = result.filter((s) => s.is_substitute);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.designation || '').toLowerCase().includes(q) ||
          (s.department || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.phone || '').includes(q)
      );
    }
    return result;
  }, [list, deptFilter, roleFilter, typeFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va = String(a[sortCol] ?? '').toLowerCase();
      let vb = String(b[sortCol] ?? '').toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const openCreate = () => { setForm({ ...emptyForm }); setEditId(null); };
  const openEdit = (s) => {
    setForm({
      name: s.name || '',
      designation: s.designation || '',
      department: s.department || '',
      role: s.role || 'Faculty',
      email: s.email || '',
      phone: s.phone || '',
      date_of_joining: s.date_of_joining || '',
      is_guest_faculty: !!s.is_guest_faculty,
      is_substitute: !!s.is_substitute,
      substitute_for_staff_id: s.substitute_for_staff_id || '',
      qualifications: Array.isArray(s.qualifications) ? [...s.qualifications] : [],
      experience: Array.isArray(s.experience) ? [...s.experience] : [],
    });
    setEditId(s.id);
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setError('Staff name is required'); return; }
    try {
      if (editId) {
        await api.staff.update(editId, form);
        toast.success('Staff updated successfully');
      } else {
        await api.staff.create(form);
        toast.success('Staff added successfully');
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
      await api.staff.delete(id);
      toast.success('Staff member removed');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const downloadTemplate = () => {
    const csv = STAFF_TEMPLATE_COLUMNS.join(',') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'staff_template.csv';
    a.click();
  };

  const handleBulkImport = async () => {
    if (!importFile) { setImportError('Select a file'); return; }
    const fn = (importFile.name || '').toLowerCase();
    if (!fn.endsWith('.xlsx') && !fn.endsWith('.csv')) {
      setImportError('Only .xlsx or .csv files allowed');
      return;
    }
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const r = await api.bulkUpload.upload('staff', importFile);
      setImportResult(r);
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = '';
      load();
      toast.success(`Imported: ${r.created} created, ${r.updated} updated`);
    } catch (err) {
      setImportError(err.message);
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDeptFilter('');
    setRoleFilter('');
    setTypeFilter('');
    setPage(1);
  };

  const hasFilters = search || deptFilter || roleFilter || typeFilter;

  if (loading && !list.length) {
    return (
      <div className="staff-page">
        <div className="staff-loading">
          <div className="staff-skeleton" style={{ width: '100%', height: 80 }} />
          <div className="staff-skeleton" style={{ width: '100%', height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      {/* Stats Strip */}
      <div className="staff-stats-strip">
        <div className="staff-stat-card staff-stat-primary">
          <span className="staff-stat-icon">👨‍🏫</span>
          <div>
            <span className="staff-stat-value">{stats.total}</span>
            <span className="staff-stat-label">Total Staff</span>
          </div>
        </div>
        <div className="staff-stat-card">
          <span className="staff-stat-icon">🏛️</span>
          <div>
            <span className="staff-stat-value">{departments.length}</span>
            <span className="staff-stat-label">Departments</span>
          </div>
        </div>
        <div className="staff-stat-card">
          <span className="staff-stat-icon">✅</span>
          <div>
            <span className="staff-stat-value">{stats.regular}</span>
            <span className="staff-stat-label">Regular</span>
          </div>
        </div>
        <div className="staff-stat-card">
          <span className="staff-stat-icon">🔄</span>
          <div>
            <span className="staff-stat-value">{stats.guest}</span>
            <span className="staff-stat-label">Guest</span>
          </div>
        </div>
        <div className="staff-stat-card">
          <span className="staff-stat-icon">🔀</span>
          <div>
            <span className="staff-stat-value">{stats.substitute}</span>
            <span className="staff-stat-label">Substitute</span>
          </div>
        </div>
      </div>

      {/* Mini Charts */}
      {list.length > 0 && (
        <div className="staff-charts-row">
          <div className="staff-chart-card">
            <h4>By Department</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={deptChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={(e) => e.name}>
                  {deptChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="staff-chart-card">
            <h4>By Role</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={roleChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={(e) => e.name}>
                  {roleChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Staff Management</h2>
        <div className="header-actions">
          {canWrite && (
            <button type="button" className="btn-secondary" onClick={() => setBulkOpen((o) => !o)}>
              {bulkOpen ? '− Bulk Import/Export' : '+ Bulk Import/Export'}
            </button>
          )}
          <Link to="/staff/leave" className="btn-secondary">Leave Requests</Link>
          <Link to="/staff/resignations" className="btn-secondary">Resignations</Link>
          <button type="button" className="btn-secondary" onClick={() => exportCSV(
            filtered.map((s) => ({
              Name: s.name, Designation: s.designation, Department: s.department, Role: s.role,
              Email: s.email, Phone: s.phone, DOJ: s.date_of_joining,
              Type: s.is_substitute ? 'Substitute' : s.is_guest_faculty ? 'Guest' : 'Regular',
            })),
            'staff.csv'
          )}>
            Export CSV
          </button>
          {canWrite && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              + Add Staff
            </button>
          )}
        </div>
      </div>
      <FormError message={error} onDismiss={() => setError('')} />

      {/* Bulk Import & Export */}
      {canWrite && bulkOpen && (
        <div className="staff-bulk-card card">
          <h4>Bulk Import & Export</h4>
          <p className="staff-bulk-desc">Import staff from Excel (.xlsx) or CSV. First row must be headers: {STAFF_TEMPLATE_COLUMNS.join(', ')}.</p>
          <div className="staff-bulk-actions">
            <button type="button" className="btn-secondary" onClick={downloadTemplate}>Download Template</button>
            <div className="staff-import-row">
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportError(''); setImportResult(null); }}
              />
              <button type="button" className="btn-primary" onClick={handleBulkImport} disabled={!importFile || importing}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
            <button type="button" className="btn-secondary" onClick={() => exportCSV(
              filtered.map((s) => ({
                Name: s.name, Designation: s.designation, Department: s.department, Role: s.role,
                Email: s.email, Phone: s.phone, DOJ: s.date_of_joining,
                Type: s.is_substitute ? 'Substitute' : s.is_guest_faculty ? 'Guest' : 'Regular',
              })),
              'staff.csv'
            )}>Export CSV</button>
          </div>
          {importError && <p className="form-error">{importError}</p>}
          {importResult && (
            <div className="staff-import-result">
              <strong>Result:</strong> {importResult.created} created, {importResult.updated} updated, {importResult.total_rows} rows processed.
              {importResult.errors?.length > 0 && (
                <details>
                  <summary>Errors ({importResult.errors.length})</summary>
                  <ul>{importResult.errors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="staff-toolbar">
        <input
          className="staff-search"
          type="text"
          placeholder="Search by name, email, phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="staff-filter" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="staff-filter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="staff-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="regular">Regular</option>
          <option value="guest">Guest</option>
          <option value="substitute">Substitute</option>
        </select>
        {hasFilters && (
          <button type="button" className="btn-sm" onClick={clearFilters}>Clear</button>
        )}
        <span className="staff-count">{filtered.length} staff member{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="staff-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Name{sortIcon('name')}</th>
              <th onClick={() => handleSort('designation')} style={{ cursor: 'pointer' }}>Designation{sortIcon('designation')}</th>
              <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>Department{sortIcon('department')}</th>
              <th onClick={() => handleSort('role')} style={{ cursor: 'pointer' }}>Role{sortIcon('role')}</th>
              <th>Contact</th>
              <th>Type</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={canWrite ? 7 : 6} className="staff-empty-row">No staff found</td></tr>
            ) : (
              paginated.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="staff-name-cell">
                      <span className="staff-avatar" style={{ background: COLORS[(Number(s.id) - 1) % COLORS.length] }}>
                        {(s.name || '?')[0]}
                      </span>
                      <Link to={`/staff/${s.id}`} className="staff-name-link">{s.name}</Link>
                    </div>
                  </td>
                  <td>{s.designation || '—'}</td>
                  <td>
                    {s.department ? (
                      <span className="staff-dept-badge">{s.department}</span>
                    ) : '—'}
                  </td>
                  <td>{s.role || 'Faculty'}</td>
                  <td>
                    <div className="staff-contact">
                      {s.email && <span title={s.email}>📧 {s.email}</span>}
                      {s.phone && <span title={s.phone}>📞 {s.phone}</span>}
                      {!s.email && !s.phone && '—'}
                    </div>
                  </td>
                  <td>
                    {s.is_substitute && <span className="badge badge-substitute">Substitute</span>}
                    {s.is_guest_faculty && !s.is_substitute && <span className="badge badge-guest">Guest</span>}
                    {!s.is_guest_faculty && !s.is_substitute && <span className="badge badge-regular">Regular</span>}
                  </td>
                  {canWrite && (
                    <td className="staff-actions-cell">
                      <button type="button" className="staff-action-btn" onClick={() => navigate(`/staff/${s.id}`)} title="Profile">👤</button>
                      <button type="button" className="staff-action-btn" onClick={() => openEdit(s)} title="Edit">✏️</button>
                      <button type="button" className="staff-action-btn staff-action-delete" onClick={() => setConfirmDelete({ id: s.id, name: s.name })} title="Delete">🗑️</button>
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
        <div className="staff-pagination">
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
                <span key={`e${i}`} className="staff-page-ellipsis">...</span>
              ) : (
                <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            )}
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Form Modal */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content staff-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Staff' : 'Add Staff'}</h3>
            <div className="staff-form-grid">
              <div>
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required />
              </div>
              <div>
                <label>Designation</label>
                <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Assistant Professor" />
              </div>
              <div>
                <label>Department</label>
                <input
                  list="dept-suggestions"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="Select or type department"
                />
                <datalist id="dept-suggestions">
                  {departments.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@college.edu" />
              </div>
              <div>
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
              </div>
              <div>
                <label>Date of Joining</label>
                <input type="date" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
              </div>
              <div className="staff-checkbox-group">
                <label>
                  <input type="checkbox" checked={form.is_guest_faculty} onChange={(e) => setForm({ ...form, is_guest_faculty: e.target.checked })} />
                  Guest / Visiting Faculty
                </label>
                <label>
                  <input type="checkbox" checked={form.is_substitute} onChange={(e) => setForm({ ...form, is_substitute: e.target.checked })} />
                  Substitute Faculty
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save}>
                {editId ? 'Update' : 'Add'} Staff
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete staff member"
        message={confirmDelete ? `Are you sure you want to delete ${confirmDelete.name}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(confirmDelete?.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
