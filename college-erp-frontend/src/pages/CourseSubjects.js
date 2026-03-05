import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import FormError from '../components/FormError';
import './CourseSubjects.css';

const COLORS = ['#E11B21', '#FAD332', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const TYPE_COLORS = { theory: '#2563eb', practical: '#10b981', elective: '#f59e0b' };
const PAGE_SIZE = 12;

const EMPTY_FORM = {
  name: '', code: '', department: '', semester: '', credits: 0,
  type: 'theory', hours_per_week: 0,
};

const COURSES_TEMPLATE_COLUMNS = ['name', 'code', 'department', 'semester', 'credits', 'type', 'hours_per_week'];

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export default function CourseSubjects() {
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission('courses:write');
  const isAdmin = hasRole('super_admin', 'admin', 'principal');
  const isManagement = hasRole('super_admin', 'admin', 'principal', 'hod');

  const [list, setList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortCol, setSortCol] = useState('code');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const importInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([api.courses.list(), api.departments.list().catch(() => [])])
      .then(([courses, depts]) => {
        setList(Array.isArray(courses) ? courses : []);
        setDeptList(Array.isArray(depts) ? depts : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Derived data ── */
  const departments = useMemo(() => [...new Set(list.map((c) => c.department).filter(Boolean))].sort(), [list]);
  const semesters = useMemo(() => [...new Set(list.map((c) => c.semester).filter(Boolean))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0)), [list]);

  const stats = useMemo(() => {
    const totalCredits = list.reduce((s, c) => s + (Number(c.credits) || 0), 0);
    const totalHours = list.reduce((s, c) => s + (Number(c.hours_per_week) || 0), 0);
    const byType = {};
    const byDept = {};
    const bySem = {};
    for (const c of list) {
      const t = c.type || 'theory';
      const d = c.department || 'Other';
      const s = c.semester || '—';
      byType[t] = (byType[t] || 0) + 1;
      byDept[d] = (byDept[d] || 0) + 1;
      bySem[s] = (bySem[s] || 0) + 1;
    }
    return { total: list.length, totalCredits, totalHours, byType, byDept, bySem };
  }, [list]);

  const deptChartData = useMemo(() => Object.entries(stats.byDept).map(([name, value]) => ({ name, value })), [stats]);
  const semChartData = useMemo(() =>
    Object.entries(stats.bySem)
      .sort(([a], [b]) => (Number(a) || 0) - (Number(b) || 0))
      .map(([name, value]) => ({ name: `Sem ${name}`, value })),
    [stats]
  );

  /* ── Filtering + Sorting + Pagination ── */
  const filtered = useMemo(() => {
    let result = list;
    if (deptFilter) result = result.filter((c) => c.department === deptFilter);
    if (semFilter) result = result.filter((c) => c.semester === semFilter);
    if (typeFilter) result = result.filter((c) => (c.type || 'theory') === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.department || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [list, deptFilter, semFilter, typeFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'credits' || sortCol === 'hours_per_week' || sortCol === 'semester') {
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

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };
  const sortIcon = (col) => sortCol !== col ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  const clearFilters = () => { setSearch(''); setDeptFilter(''); setSemFilter(''); setTypeFilter(''); setPage(1); };
  const hasFilters = search || deptFilter || semFilter || typeFilter;

  /* ── CRUD ── */
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditId(null); };
  const openEdit = (c) => {
    setForm({
      name: c.name || '', code: c.code || '', department: c.department || '',
      semester: c.semester || '', credits: c.credits ?? 0,
      type: c.type || 'theory', hours_per_week: c.hours_per_week ?? 0,
    });
    setEditId(c.id);
  };

  const save = async () => {
    if (!form || !form.name.trim()) { setError('Subject name is required'); return; }
    try {
      const payload = { ...form, credits: Number(form.credits) || 0, hours_per_week: Number(form.hours_per_week) || 0 };
      if (editId) {
        await api.courses.update(editId, payload);
        toast.success('Subject updated successfully');
      } else {
        await api.courses.create(payload);
        toast.success('Subject added successfully');
      }
      setForm(null);
      setEditId(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    if (!confirmDelete || confirmDelete.id !== id) return;
    setConfirmDelete(null);
    try {
      await api.courses.delete(id);
      toast.success('Subject removed');
      load();
    } catch (err) { setError(err.message); }
  };

  const downloadTemplate = () => {
    const csv = COURSES_TEMPLATE_COLUMNS.join(',') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'subjects_template.csv';
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
      const r = await api.bulkUpload.upload('courses', importFile);
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

  /* ── Loading ── */
  if (loading && !list.length) {
    return (
      <div className="crs-page">
        <div className="crs-loading">
          <div className="crs-skeleton" style={{ width: '100%', height: 80 }} />
          <div className="crs-skeleton" style={{ width: '100%', height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="crs-page">
      {/* ── Stats ── */}
      <div className="crs-stats-strip">
        <div className="crs-stat-card crs-stat-primary">
          <span className="crs-stat-icon">📚</span>
          <div><span className="crs-stat-value">{stats.total}</span><span className="crs-stat-label">Total Subjects</span></div>
        </div>
        <div className="crs-stat-card">
          <span className="crs-stat-icon">🎯</span>
          <div><span className="crs-stat-value">{stats.totalCredits}</span><span className="crs-stat-label">Total Credits</span></div>
        </div>
        <div className="crs-stat-card">
          <span className="crs-stat-icon">⏱️</span>
          <div><span className="crs-stat-value">{stats.totalHours}</span><span className="crs-stat-label">Hours / Week</span></div>
        </div>
        <div className="crs-stat-card">
          <span className="crs-stat-icon">🏛️</span>
          <div><span className="crs-stat-value">{departments.length}</span><span className="crs-stat-label">Departments</span></div>
        </div>
        {Object.entries(stats.byType).map(([t, count]) => (
          <div key={t} className="crs-stat-card" style={{ borderLeftColor: TYPE_COLORS[t] || '#94a3b8' }}>
            <span className="crs-stat-dot" style={{ background: TYPE_COLORS[t] || '#94a3b8' }} />
            <div><span className="crs-stat-value">{count}</span><span className="crs-stat-label">{t.charAt(0).toUpperCase() + t.slice(1)}</span></div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {isManagement && list.length > 0 && (
        <div className="crs-charts-row">
          <div className="crs-chart-card">
            <h4>By Department</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deptChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => `${e.name.slice(0, 12)}: ${e.value}`}>
                  {deptChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="crs-chart-card">
            <h4>By Semester</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={semChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Subjects" fill="#E11B21" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="crs-header">
        <h2 className="page-title">Subjects & Courses</h2>
        <div className="crs-header-actions">
          {isManagement && canWrite && (
            <button type="button" className="btn-secondary" onClick={() => setBulkOpen((o) => !o)}>
              {bulkOpen ? '− Bulk Import/Export' : '+ Bulk Import/Export'}
            </button>
          )}
          {isManagement && (
            <button type="button" className="btn-secondary" onClick={() => exportCSV(
              filtered.map((c) => ({ Name: c.name, Code: c.code, Department: c.department, Semester: c.semester, Credits: c.credits, Type: c.type || 'theory', Hours: c.hours_per_week || 0 })),
              'subjects.csv'
            )}>Export CSV</button>
          )}
          <div className="crs-view-toggle">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')} title="Table view">☰</button>
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Card view">▦</button>
          </div>
          {canWrite && <button type="button" className="btn-primary" onClick={openCreate}>+ Add Subject</button>}
        </div>
      </div>
      <FormError message={error} onDismiss={() => setError('')} />

      {/* ── Bulk Import & Export ── */}
      {isManagement && canWrite && bulkOpen && (
        <div className="crs-bulk-card card">
          <h4>Bulk Import & Export</h4>
          <p className="crs-bulk-desc">Import subjects from Excel (.xlsx) or CSV. First row must be headers: {COURSES_TEMPLATE_COLUMNS.join(', ')}.</p>
          <div className="crs-bulk-actions">
            <button type="button" className="btn-secondary" onClick={downloadTemplate}>Download Template</button>
            <div className="crs-import-row">
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
              filtered.map((c) => ({ Name: c.name, Code: c.code, Department: c.department, Semester: c.semester, Credits: c.credits, Type: c.type || 'theory', Hours: c.hours_per_week || 0 })),
              'subjects.csv'
            )}>Export CSV</button>
          </div>
          {importError && <p className="form-error">{importError}</p>}
          {importResult && (
            <div className="crs-import-result">
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

      {/* ── Toolbar ── */}
      <div className="crs-toolbar">
        <input className="crs-search" type="text" placeholder="Search subjects, codes, departments..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="crs-filter" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="crs-filter" value={semFilter} onChange={(e) => { setSemFilter(e.target.value); setPage(1); }}>
          <option value="">All Semesters</option>
          {semesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select className="crs-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="theory">Theory</option>
          <option value="practical">Practical</option>
          <option value="elective">Elective</option>
        </select>
        {hasFilters && <button className="btn-sm" onClick={clearFilters}>Clear</button>}
        <span className="crs-count">{filtered.length} subject{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ══════ TABLE VIEW ══════ */}
      {viewMode === 'table' && (
        <div className="table-wrap">
          <table className="crs-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>Code{sortIcon('code')}</th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Subject{sortIcon('name')}</th>
                <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>Department{sortIcon('department')}</th>
                <th onClick={() => handleSort('semester')} style={{ cursor: 'pointer' }}>Sem{sortIcon('semester')}</th>
                <th onClick={() => handleSort('credits')} style={{ cursor: 'pointer' }}>Credits{sortIcon('credits')}</th>
                <th>Type</th>
                {isManagement && <th onClick={() => handleSort('hours_per_week')} style={{ cursor: 'pointer' }}>Hrs/Wk{sortIcon('hours_per_week')}</th>}
                {canWrite && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={canWrite ? (isManagement ? 8 : 7) : (isManagement ? 7 : 6)} className="crs-empty-row">
                  <div className="crs-empty">
                    <span className="crs-empty-icon">📚</span>
                    <p>No subjects found</p>
                    {canWrite && <button className="btn-primary" onClick={openCreate}>Add First Subject</button>}
                  </div>
                </td></tr>
              ) : paginated.map((c) => (
                <tr key={c.id}>
                  <td><code className="crs-code-badge">{c.code || '—'}</code></td>
                  <td>
                    <div className="crs-name-cell">
                      <span className="crs-name-icon" style={{ background: TYPE_COLORS[c.type] || '#94a3b8' }}>
                        {(c.type || 'T')[0].toUpperCase()}
                      </span>
                      <strong className="crs-name">{c.name}</strong>
                    </div>
                  </td>
                  <td><span className="crs-dept-badge">{c.department || '—'}</span></td>
                  <td className="crs-sem">{c.semester || '—'}</td>
                  <td className="crs-credits">{c.credits ?? '—'}</td>
                  <td><span className={`crs-type-pill crs-type-${c.type || 'theory'}`}>{c.type || 'theory'}</span></td>
                  {isManagement && <td className="crs-hours">{c.hours_per_week || '—'}</td>}
                  {canWrite && (
                    <td className="crs-actions">
                      <button className="crs-action-btn" onClick={() => openEdit(c)} title="Edit">✏️</button>
                      {isAdmin && <button className="crs-action-btn crs-action-delete" onClick={() => setConfirmDelete({ id: c.id, name: c.name })} title="Delete">🗑️</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════ GRID VIEW ══════ */}
      {viewMode === 'grid' && (
        <div className="crs-grid">
          {paginated.length === 0 ? (
            <div className="crs-empty" style={{ gridColumn: '1 / -1', padding: '3rem' }}>
              <span className="crs-empty-icon">📚</span>
              <p>No subjects found</p>
            </div>
          ) : paginated.map((c) => (
            <div key={c.id} className="crs-card">
              <div className="crs-card-header">
                <code className="crs-code-badge">{c.code || '—'}</code>
                <span className={`crs-type-pill crs-type-${c.type || 'theory'}`}>{c.type || 'theory'}</span>
              </div>
              <h4 className="crs-card-title">{c.name}</h4>
              <div className="crs-card-meta">
                <span className="crs-dept-badge">{c.department || '—'}</span>
                <span>Sem {c.semester || '—'}</span>
              </div>
              <div className="crs-card-stats">
                <div><span className="crs-card-stat-val">{c.credits ?? 0}</span><span className="crs-card-stat-lbl">Credits</span></div>
                <div><span className="crs-card-stat-val">{c.hours_per_week ?? 0}</span><span className="crs-card-stat-lbl">Hrs/Wk</span></div>
              </div>
              {canWrite && (
                <div className="crs-card-actions">
                  <button className="btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  {isAdmin && <button className="btn-sm btn-danger" onClick={() => setConfirmDelete({ id: c.id, name: c.name })}>Delete</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="crs-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .reduce((acc, n, idx, arr) => { if (idx > 0 && n - arr[idx - 1] > 1) acc.push('...'); acc.push(n); return acc; }, [])
            .map((n, i) => n === '...' ? <span key={`e${i}`} className="crs-page-ellipsis">...</span> : <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* ── Form Modal ── */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content crs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Subject' : 'Add Subject'}</h3>
            <div className="crs-form-grid">
              <div className="crs-form-full">
                <label>Subject Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pharmaceutics I" required />
              </div>
              <div>
                <label>Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. BP101T" />
              </div>
              <div>
                <label>Department</label>
                <input list="dept-suggest" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Select or type" />
                <datalist id="dept-suggest">
                  {[...departments, ...deptList.map((d) => d.name)].filter((v, i, a) => a.indexOf(v) === i).map((d, i) => <option key={i} value={d} />)}
                </datalist>
              </div>
              <div>
                <label>Semester</label>
                <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                  <option value="">Select</option>
                  {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={String(s)}>Semester {s}</option>)}
                </select>
              </div>
              <div>
                <label>Credits</label>
                <input type="number" min={0} max={20} step={0.5} value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
              </div>
              <div>
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="theory">Theory</option>
                  <option value="practical">Practical</option>
                  <option value="elective">Elective</option>
                </select>
              </div>
              <div>
                <label>Hours / Week</label>
                <input type="number" min={0} max={20} value={form.hours_per_week} onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save}>{editId ? 'Update' : 'Create'} Subject</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete subject"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This may affect timetable and faculty mapping.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(confirmDelete?.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
