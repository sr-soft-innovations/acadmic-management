import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './Admission.css';

const COURSES = ['B.Pharm', 'D.Pharm', 'M.Pharm', 'Pharm.D'];
const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST'];
const STATUS_OPTIONS = ['draft', 'submitted', 'clerk_verified', 'hod_approved', 'verified', 'approved', 'rejected'];
const STATUS_COLOR = { draft: '#94a3b8', submitted: '#2563eb', clerk_verified: '#f59e0b', hod_approved: '#8b5cf6', verified: '#f59e0b', approved: '#059669', rejected: '#dc2626' };
const DOC_TYPES = ['photo', 'marksheet', 'transfer_certificate', 'aadhaar', 'other'];
const COLORS = ['#E11B21', '#FAD332', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const PAGE_SIZE = 10;

const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];
const MANAGEMENT_ROLES = [...ADMIN_ROLES, 'hod'];
const VIEWER_ROLES = [...MANAGEMENT_ROLES, 'faculty', 'staff'];
const CLERK_ROLES = ['staff', 'super_admin', 'admin', 'principal', 'hod'];
const HOD_ROLES = ['hod', 'super_admin', 'admin', 'principal'];

const emptyForm = {
  name: '', email: '', phone: '', course: '', department: '',
  marks_obtained: '', board: '', previous_school: '', category: 'GEN',
  date_of_birth: '', gender: '', address: '',
  guardian_name: '', guardian_phone: '', guardian_email: '',
  payment_status: 'pending', payment_reference: '',
};

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

export default function Admission() {
  const { hasPermission, hasRole, user } = useAuth();
  const canWrite = hasPermission('students:write');
  const role = user?.role || '';

  const isAdmin = hasRole(...ADMIN_ROLES);
  const isManagement = hasRole(...MANAGEMENT_ROLES);
  const isViewer = hasRole(...VIEWER_ROLES);
  const isStudent = hasRole('student');
  const isParent = hasRole('parent');

  const canViewStats = isManagement;
  const canViewCharts = isManagement;
  const canViewMerit = isViewer;
  const canExport = isManagement;
  const canClerkVerify = hasRole(...CLERK_ROLES);
  const canHodApprove = hasRole(...HOD_ROLES);
  const canApprove = isAdmin;  // Principal final approval
  const canEdit = canWrite;
  const canCreate = canWrite || isStudent;
  const canViewContact = isManagement;
  const canViewGuardian = isAdmin;
  const canViewVerification = isViewer && !isStudent && !isParent;
  const canViewCategory = isViewer;
  const canViewFilters = isViewer && !isStudent && !isParent;
  const canViewAdmissionNo = isViewer;

  const [applications, setApplications] = useState([]);
  const [meritList, setMeritList] = useState([]);
  const [tab, setTab] = useState('applications');
  const [form, setForm] = useState(null);
  const [formStep, setFormStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [approveModal, setApproveModal] = useState(null);
  const [approveForm, setApproveForm] = useState({ roll_no: '', batch: '', section: '', create_login: true, semester: '1', academic_year: new Date().getFullYear().toString() });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const loadApplications = useCallback(() => {
    setError('');
    api.admission
      .list()
      .then((r) => setApplications(r.applications || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadMeritList = useCallback(() => {
    api.admission
      .meritList(courseFilter || undefined)
      .then((r) => setMeritList(r.merit_list || []))
      .catch(() => setMeritList([]));
  }, [courseFilter]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const byStatus = {};
    const byCourse = {};
    const byCat = {};
    for (const a of applications) {
      const s = (a.status || 'draft').toLowerCase();
      const c = a.course || 'Unspecified';
      const cat = a.category || 'GEN';
      byStatus[s] = (byStatus[s] || 0) + 1;
      byCourse[c] = (byCourse[c] || 0) + 1;
      byCat[cat] = (byCat[cat] || 0) + 1;
    }
    return { total: applications.length, byStatus, byCourse, byCat };
  }, [applications]);

  const statusChartData = useMemo(() => Object.entries(stats.byStatus).map(([name, value]) => ({ name, value })), [stats]);
  const courseChartData = useMemo(() => Object.entries(stats.byCourse).map(([name, value]) => ({ name, value })), [stats]);

  /* ── Filtering + Sorting + Pagination ── */
  const filtered = useMemo(() => {
    let result = applications;
    if (statusFilter) result = result.filter((a) => (a.status || '').toLowerCase() === statusFilter);
    if (courseFilter) result = result.filter((a) => a.course === courseFilter);
    if (catFilter) result = result.filter((a) => (a.category || 'GEN') === catFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').includes(q) ||
        (a.roll_no || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [applications, statusFilter, courseFilter, catFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'marks_obtained') {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
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

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCourseFilter(''); setCatFilter(''); setPage(1); };
  const hasFilters = search || statusFilter || courseFilter || catFilter;

  /* ── Column config ── */
  const columns = useMemo(() => {
    const cols = [
      { key: 'admission_number', label: 'Admission No.', sortable: true, visible: canViewAdmissionNo },
      { key: 'name', label: 'Applicant', sortable: true, visible: true },
      { key: 'course', label: 'Course', sortable: true, visible: true },
      { key: 'category', label: 'Category', sortable: true, visible: canViewCategory },
      { key: 'marks_obtained', label: 'Marks', sortable: true, visible: true },
      { key: 'status', label: 'Status', sortable: true, visible: true },
      { key: 'payment_status', label: 'Payment', sortable: false, visible: isViewer },
      { key: 'verification_status', label: 'Verification', sortable: false, visible: canViewVerification },
      { key: 'contact', label: 'Contact', sortable: false, visible: canViewContact },
      { key: 'guardian', label: 'Guardian', sortable: false, visible: canViewGuardian },
      { key: 'created_at', label: 'Date', sortable: true, visible: isViewer },
      { key: 'actions', label: 'Actions', sortable: false, visible: canEdit || canClerkVerify || canHodApprove || canApprove },
    ];
    return cols.filter((c) => c.visible);
  }, [canViewCategory, canViewVerification, canViewContact, canViewGuardian, canViewAdmissionNo, canEdit, canClerkVerify, canHodApprove, canApprove, isViewer]);

  /* ── Form handlers ── */
  const openNew = () => { setForm({ ...emptyForm }); setFormStep(0); setTab('apply'); setError(''); };
  const openEdit = (app) => { setForm({ ...app }); setFormStep(0); setTab('apply'); };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    try {
      await api.admission.update(form.id, { ...form, status: 'submitted' });
      setForm(null);
      setTab('applications');
      loadApplications();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    try {
      await api.admission.create(form);
      setForm(null);
      setTab('applications');
      loadApplications();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!approveModal) return;
    setSubmitting(true);
    try {
      await api.admission.approve(approveModal.id, approveForm);
      setApproveModal(null);
      loadApplications();
      loadMeritList();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleClerkVerify = async (app) => {
    try {
      await api.admission.clerkVerify(app.id);
      loadApplications();
      loadMeritList();
    } catch (err) { setError(err.message); }
  };

  const handleHodApprove = async (app) => {
    try {
      await api.admission.hodApprove(app.id);
      loadApplications();
      loadMeritList();
    } catch (err) { setError(err.message); }
  };

  const handleReject = async (app) => {
    if (!window.confirm(`Reject application from ${app.name}?`)) return;
    try {
      await api.admission.update(app.id, { status: 'rejected' });
      loadApplications();
    } catch (err) { setError(err.message); }
  };

  /* ── Role label ── */
  const roleLabel = useMemo(() => {
    const map = {
      super_admin: 'Super Admin',
      admin: 'Administrator',
      principal: 'Principal',
      hod: 'Head of Department',
      faculty: 'Faculty',
      staff: 'Staff',
      student: 'Student',
      parent: 'Parent',
    };
    return map[role] || role;
  }, [role]);

  /* ── Loading skeleton ── */
  if (loading && applications.length === 0) {
    return (
      <div className="adm-page">
        <div className="adm-loading">
          <div className="adm-skeleton" style={{ width: '100%', height: 80 }} />
          <div className="adm-skeleton" style={{ width: '100%', height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page">
      {/* ── Role Badge ── */}
      <div className="adm-role-bar">
        <span className="adm-role-badge">
          <span className="adm-role-dot" />
          Viewing as: <strong>{roleLabel}</strong>
        </span>
        {(isStudent || isParent) && (
          <span className="adm-role-hint">
            {isStudent ? 'You can apply for admission and track your application status.' : 'You can view your child\'s application status.'}
          </span>
        )}
      </div>

      {/* ── Stats Strip (management+ only) ── */}
      {canViewStats && (
        <div className="adm-stats-strip">
          <div className="adm-stat-card adm-stat-primary">
            <span className="adm-stat-icon">📋</span>
            <div><span className="adm-stat-value">{stats.total}</span><span className="adm-stat-label">Total Applications</span></div>
          </div>
          {STATUS_OPTIONS.map((s) => (
            <div key={s} className="adm-stat-card" onClick={() => { setStatusFilter(s); setTab('applications'); setPage(1); }}>
              <span className="adm-stat-dot" style={{ background: STATUS_COLOR[s] }} />
              <div><span className="adm-stat-value">{stats.byStatus[s] || 0}</span><span className="adm-stat-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts (management+ only) ── */}
      {canViewCharts && applications.length > 0 && (
        <div className="adm-charts-row">
          <div className="adm-chart-card">
            <h4>By Status</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${e.value}`}>
                  {statusChartData.map((entry, i) => <Cell key={i} fill={STATUS_COLOR[entry.name] || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="adm-chart-card">
            <h4>By Course</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={courseChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Applications" fill="#E11B21" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="adm-header">
        <h2 className="page-title">Admission Management</h2>
        <div className="adm-header-actions">
          {canExport && (
            <button type="button" className="btn-secondary" onClick={() => exportCSV(
              filtered.map((a) => {
                const row = { Name: a.name, Course: a.course, Marks: a.marks_obtained, Status: a.status };
                if (canViewCategory) row.Category = a.category;
                if (canViewVerification) row.Verification = a.verification_status;
                if (canViewContact) { row.Email = a.email; row.Phone = a.phone; }
                if (canViewGuardian) { row.Guardian = a.guardian_name; row.GuardianPhone = a.guardian_phone; }
                row.Created = a.created_at;
                return row;
              }),
              'admissions.csv'
            )}>Export CSV</button>
          )}
          {canViewMerit && <Link to="/admission/merit-list" className="btn-secondary">Merit List</Link>}
          {canCreate && <button type="button" className="btn-primary" onClick={openNew}>+ New Application</button>}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}

      {/* ── Tabs ── */}
      <div className="adm-tabs">
        <button className={tab === 'applications' ? 'active' : ''} onClick={() => setTab('applications')}>
          Applications <span className="adm-tab-count">{filtered.length}</span>
        </button>
        {canViewMerit && (
          <button className={tab === 'merit' ? 'active' : ''} onClick={() => { setTab('merit'); loadMeritList(); }}>
            Merit List <span className="adm-tab-count">{meritList.length}</span>
          </button>
        )}
        {form && (
          <button className={tab === 'apply' ? 'active' : ''} onClick={() => setTab('apply')}>
            {form.id ? 'Edit' : 'New'} Application
          </button>
        )}
      </div>

      {/* ══════ APPLICATIONS TAB ══════ */}
      {tab === 'applications' && (
        <>
          {/* Toolbar with role-based filters */}
          <div className="adm-toolbar">
            <input className="adm-search" type="text" placeholder={isStudent ? 'Search your application...' : 'Search name, email, phone, roll no...'} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            {canViewFilters && (
              <>
                <select className="adm-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select className="adm-filter" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
                  <option value="">All Courses</option>
                  {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {canViewCategory && (
                  <select className="adm-filter" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
                    <option value="">All Categories</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </>
            )}
            {hasFilters && <button className="btn-sm" onClick={clearFilters}>Clear</button>}
            <span className="adm-count">{filtered.length} application{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} onClick={col.sortable ? () => handleSort(col.key) : undefined} style={col.sortable ? { cursor: 'pointer' } : undefined}>
                      {col.label}{col.sortable ? sortIcon(col.key) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={columns.length} className="adm-empty-row">
                    <div className="adm-empty">
                      <span className="adm-empty-icon">{isStudent ? '📝' : '📋'}</span>
                      <p>{isStudent ? 'You have no applications yet.' : 'No applications found'}</p>
                      {canCreate && <button className="btn-primary" onClick={openNew}>{isStudent ? 'Apply Now' : 'Create First Application'}</button>}
                    </div>
                  </td></tr>
                ) : paginated.map((a) => (
                  <tr key={a.id} className={a.status === 'approved' ? 'adm-row-approved' : ''}>
                    {/* Admission No. */}
                    {columns.some((c) => c.key === 'admission_number') && (
                      <td><code className="adm-admission-no">{a.admission_number || '—'}</code></td>
                    )}
                    {/* Applicant — always visible */}
                    {columns.some((c) => c.key === 'name') && (
                      <td>
                        <div className="adm-applicant-cell">
                          <span className="adm-applicant-avatar" style={{ background: STATUS_COLOR[a.status] || '#94a3b8' }}>
                            {(a.name || '?')[0].toUpperCase()}
                          </span>
                          <div>
                            <strong className="adm-applicant-name">{a.name}</strong>
                            {canViewContact && a.email && <span className="adm-applicant-email">{a.email}</span>}
                          </div>
                        </div>
                      </td>
                    )}
                    {/* Course */}
                    {columns.some((c) => c.key === 'course') && (
                      <td><span className="adm-course-badge">{a.course || '—'}</span></td>
                    )}
                    {/* Category */}
                    {columns.some((c) => c.key === 'category') && (
                      <td><span className={`adm-cat-badge adm-cat-${(a.category || 'GEN').toLowerCase()}`}>{a.category || 'GEN'}</span></td>
                    )}
                    {/* Marks */}
                    {columns.some((c) => c.key === 'marks_obtained') && (
                      <td className="adm-marks">{a.marks_obtained || '—'}</td>
                    )}
                    {/* Status */}
                    {columns.some((c) => c.key === 'status') && (
                      <td><span className={`adm-status-pill adm-status-${a.status}`}>{a.status}</span></td>
                    )}
                    {/* Payment */}
                    {columns.some((c) => c.key === 'payment_status') && (
                      <td><span className={`adm-payment-pill adm-payment-${(a.payment_status || 'pending').toLowerCase()}`}>{a.payment_status || 'pending'}</span></td>
                    )}
                    {/* Verification */}
                    {columns.some((c) => c.key === 'verification_status') && (
                      <td><span className={`adm-verify-pill adm-verify-${a.verification_status || 'pending'}`}>{a.verification_status || 'pending'}</span></td>
                    )}
                    {/* Contact */}
                    {columns.some((c) => c.key === 'contact') && (
                      <td className="adm-contact-cell">
                        {a.phone && <span title={a.phone}>📞 {a.phone}</span>}
                        {a.email && <span title={a.email}>📧 {a.email}</span>}
                        {!a.phone && !a.email && '—'}
                      </td>
                    )}
                    {/* Guardian */}
                    {columns.some((c) => c.key === 'guardian') && (
                      <td className="adm-guardian-cell">
                        {a.guardian_name && <span className="adm-guardian-name">{a.guardian_name}</span>}
                        {a.guardian_phone && <span className="adm-guardian-phone">📞 {a.guardian_phone}</span>}
                        {!a.guardian_name && !a.guardian_phone && '—'}
                      </td>
                    )}
                    {/* Date */}
                    {columns.some((c) => c.key === 'created_at') && (
                      <td className="adm-date">{a.created_at || '—'}</td>
                    )}
                    {/* Actions */}
                    {columns.some((c) => c.key === 'actions') && (
                      <td className="adm-actions">
                        {canEdit && (a.status === 'draft' || a.status === 'submitted') && <button className="adm-action-btn" onClick={() => openEdit(a)} title="Edit">✏️</button>}
                        {canClerkVerify && (a.status === 'submitted' || (a.approval_stage || '') === 'clerk_pending') && (
                          <button className="adm-action-btn adm-action-verify" onClick={() => handleClerkVerify(a)} title="Clerk Verify">📋</button>
                        )}
                        {canHodApprove && (a.status === 'clerk_verified' || (a.approval_stage || '') === 'clerk_verified') && (
                          <button className="adm-action-btn adm-action-hod" onClick={() => handleHodApprove(a)} title="HOD Approve">✓ HOD</button>
                        )}
                        {canApprove && (a.status === 'hod_approved' || a.status === 'verified' || (a.approval_stage || '') === 'hod_approved') && (
                          <button className="adm-action-btn adm-action-approve" onClick={() => { setApproveModal(a); setApproveForm({ roll_no: '', batch: '', section: '', create_login: true, semester: '1', academic_year: new Date().getFullYear().toString() }); }} title="Principal Approve">🎓</button>
                        )}
                        {(canApprove || canHodApprove) && !['approved', 'rejected'].includes(a.status) && (
                          <button className="adm-action-btn adm-action-reject" onClick={() => handleReject(a)} title="Reject">❌</button>
                        )}
                        {a.student_id && <Link to={`/students/${a.student_id}`} className="adm-action-btn" title="View Student">👤</Link>}
                        {canEdit && a.id && <button className="adm-action-btn" onClick={() => setSelectedApp(selectedApp?.id === a.id ? null : a)} title="Upload docs">📎</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="adm-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                .reduce((acc, n, idx, arr) => { if (idx > 0 && n - arr[idx - 1] > 1) acc.push('...'); acc.push(n); return acc; }, [])
                .map((n, i) => n === '...' ? <span key={`e${i}`} className="adm-page-ellipsis">...</span> : <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* ══════ MERIT TAB ══════ */}
      {tab === 'merit' && canViewMerit && (
        <>
          <div className="adm-toolbar">
            <select className="adm-filter" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); }}>
              <option value="">All Courses</option>
              {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn-sm" onClick={loadMeritList}>Refresh</button>
            {isAdmin && <span className="adm-count">Sorted by category reservation, then marks descending</span>}
          </div>
          <div className="table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Applicant</th>
                  <th>Course</th>
                  {canViewCategory && <th>Category</th>}
                  <th>Marks</th>
                  <th>Status</th>
                  {canApprove && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {meritList.length === 0 ? (
                  <tr><td colSpan={canApprove ? 7 : canViewCategory ? 6 : 5} className="adm-empty-row">
                    <div className="adm-empty"><span className="adm-empty-icon">🏆</span><p>No merit list data. Submit and verify applications first.</p></div>
                  </td></tr>
                ) : meritList.map((a, idx) => (
                  <tr key={a.id}>
                    <td><span className={`adm-rank ${idx < 3 ? 'adm-rank-top' : ''}`}>{a.merit_rank ?? idx + 1}</span></td>
                    <td>
                      <div className="adm-applicant-cell">
                        <span className="adm-applicant-avatar" style={{ background: COLORS[idx % COLORS.length] }}>{(a.name || '?')[0].toUpperCase()}</span>
                        <div>
                          <strong>{a.name}</strong>
                          {canViewContact && a.email && <span className="adm-applicant-email">{a.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="adm-course-badge">{a.course || '—'}</span></td>
                    {canViewCategory && <td><span className={`adm-cat-badge adm-cat-${(a.category || 'GEN').toLowerCase()}`}>{a.category || 'GEN'}</span></td>}
                    <td className="adm-marks">{a.marks_obtained || '—'}</td>
                    <td><span className={`adm-status-pill adm-status-${a.status}`}>{a.status}</span></td>
                    {canApprove && (
                      <td className="adm-actions">
                        {a.status === 'hod_approved' && (
                          <button className="adm-action-btn adm-action-approve" onClick={() => { setApproveModal(a); setApproveForm({ roll_no: '', batch: '', section: '', create_login: true, semester: '1', academic_year: new Date().getFullYear().toString() }); }} title="Principal Approve">🎓</button>
                        )}
                        {a.status === 'clerk_verified' && (
                          <button className="adm-action-btn adm-action-hod" onClick={() => handleHodApprove(a)} title="HOD Approve">✓ HOD</button>
                        )}
                        {a.status === 'submitted' && (
                          <button className="adm-action-btn adm-action-verify" onClick={() => handleClerkVerify(a)} title="Clerk Verify">📋</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════ APPLICATION FORM TAB ══════ */}
      {tab === 'apply' && form && (
        <div className="adm-form-card">
          <div className="adm-form-header">
            <h3>{form.id ? 'Edit Application' : 'New Admission Application'}</h3>
            <p className="adm-form-role-hint">
              {isStudent && 'Fill in your details below to apply for admission.'}
              {isAdmin && 'Admin view — all fields are editable.'}
              {hasRole('hod') && 'HOD view — review and update application details.'}
            </p>
            <div className="adm-form-steps">
              {['Personal', 'Academic', ...(isStudent || isParent ? [] : ['Guardian'])].map((label, i) => (
                <button key={label} type="button" className={`adm-step ${formStep === i ? 'active' : ''} ${formStep > i ? 'done' : ''}`} onClick={() => setFormStep(i)}>
                  <span className="adm-step-num">{formStep > i ? '✓' : i + 1}</span>
                  <span className="adm-step-label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={form.id ? handleSubmitApplication : handleCreateApplication}>
            {/* Step 0: Personal */}
            {formStep === 0 && (
              <div className="adm-form-section">
                <h4 className="adm-form-section-title">Personal Information</h4>
                <div className="adm-form-grid">
                  <div><label>Full Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Enter full name" /></div>
                  <div><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
                  <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
                  <div><label>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
                  <div><label>Gender</label><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                  {canViewCategory && (
                    <div><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  )}
                  <div className="adm-form-full"><label>Address</label><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" rows={2} /></div>
                </div>
                <div className="adm-form-nav">
                  <button type="button" className="btn-primary" onClick={() => setFormStep(1)}>Next: Academic Details →</button>
                </div>
              </div>
            )}

            {/* Step 1: Academic */}
            {formStep === 1 && (
              <div className="adm-form-section">
                <h4 className="adm-form-section-title">Academic Details</h4>
                <div className="adm-form-grid">
                  <div><label>Course Applied For</label><select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}><option value="">Select course</option>{COURSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  {!isStudent && (
                    <div><label>Department</label><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Pharmaceutics" /></div>
                  )}
                  <div><label>Marks Obtained</label><input value={form.marks_obtained} onChange={(e) => setForm({ ...form, marks_obtained: e.target.value })} placeholder="e.g. 85.5" /></div>
                  {form.id && (
                    <div className="adm-form-full">
                      <label>Upload Documents</label>
                      <p className="adm-form-hint">After saving, use the 📎 button in the applications list to upload marksheet, TC, photo, etc.</p>
                    </div>
                  )}
                  <div><label>Board</label><input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} placeholder="e.g. CBSE, State Board" /></div>
                  <div className="adm-form-full"><label>Previous School / College</label><input value={form.previous_school} onChange={(e) => setForm({ ...form, previous_school: e.target.value })} placeholder="Name of previous institution" /></div>
                </div>
                <div className="adm-form-nav">
                  <button type="button" className="btn" onClick={() => setFormStep(0)}>← Back</button>
                  {isStudent || isParent ? (
                    <>
                      <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? 'Saving...' : form.id ? 'Submit Application' : 'Save & Create Application'}
                      </button>
                      <button type="button" className="btn" onClick={() => { setForm(null); setTab('applications'); }}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary" onClick={() => setFormStep(2)}>Next: Guardian Details →</button>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Guardian (admin/management only) */}
            {formStep === 2 && !isStudent && !isParent && (
              <div className="adm-form-section">
                <h4 className="adm-form-section-title">Guardian Details</h4>
                <div className="adm-form-grid">
                  <div><label>Guardian Name</label><input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} placeholder="Parent / Guardian name" /></div>
                  <div><label>Guardian Phone</label><input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="Phone number" /></div>
                  <div><label>Guardian Email</label><input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} placeholder="email@example.com" /></div>
                </div>
                {/* Admin-only: status override */}
                {isAdmin && form.id && (
                  <div className="adm-admin-section">
                    <h4 className="adm-form-section-title">Admin Controls</h4>
                    <div className="adm-form-grid">
                      <div>
                        <label>Override Status</label>
                        <select value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Verification Status</label>
                        <select value={form.verification_status || 'pending'} onChange={(e) => setForm({ ...form, verification_status: e.target.value })}>
                          <option value="pending">Pending</option>
                          <option value="verified">Verified</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <div className="adm-form-nav">
                  <button type="button" className="btn" onClick={() => setFormStep(1)}>← Back</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : form.id ? 'Submit Application' : 'Save & Create Application'}
                  </button>
                  <button type="button" className="btn" onClick={() => { setForm(null); setTab('applications'); }}>Cancel</button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ══════ DOCUMENT UPLOAD PANEL ══════ */}
      {selectedApp && (
        <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="modal-content adm-doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-doc-header">
              <h3>📎 Upload Documents — {selectedApp.name}</h3>
              <button type="button" className="btn-sm" onClick={() => setSelectedApp(null)}>✕ Close</button>
            </div>
            <div className="adm-doc-list">
              {(selectedApp.documents || []).map((d) => (
                <div key={d.id} className="adm-doc-item">
                  <span className="adm-doc-type">{d.type}</span>
                  <span className="adm-doc-name">{d.filename}</span>
                  {d.verified && <span className="adm-doc-verified">✓</span>}
                </div>
              ))}
              {(!selectedApp.documents || selectedApp.documents.length === 0) && <p className="adm-doc-empty">No documents uploaded yet.</p>}
            </div>
            <div className="adm-doc-upload">
              <label>Upload:</label>
              <select id="adm-doc-type" defaultValue="marksheet">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !selectedApp) return;
                  setUploading(true);
                  try {
                    const docType = document.getElementById('adm-doc-type')?.value || 'other';
                    await api.admission.uploadDocument(selectedApp.id, docType, file);
                    loadApplications();
                    const updated = await api.admission.get(selectedApp.id);
                    setSelectedApp(updated || selectedApp);
                  } catch (err) { setError(err.message); }
                  finally { setUploading(false); e.target.value = ''; }
                }}
                disabled={uploading}
              />
              {uploading && <span>Uploading…</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════ APPROVE MODAL ══════ */}
      {approveModal && canApprove && (
        <div className="modal-overlay" onClick={() => setApproveModal(null)}>
          <div className="modal-content adm-approve-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-approve-header">
              <span className="adm-approve-icon">🎓</span>
              <div>
                <h3>Approve Admission</h3>
                <p className="adm-approve-name">{approveModal.name} — {approveModal.course} ({approveModal.category || 'GEN'})</p>
                <p className="adm-approve-meta">Marks: {approveModal.marks_obtained || '—'} | Board: {approveModal.board || '—'}</p>
              </div>
            </div>
            <form onSubmit={handleApprove}>
              <div className="adm-form-grid">
                <div><label>Roll Number</label><input value={approveForm.roll_no} onChange={(e) => setApproveForm({ ...approveForm, roll_no: e.target.value })} placeholder="Auto-generated if empty" /></div>
                <div><label>Batch</label><input value={approveForm.batch} onChange={(e) => setApproveForm({ ...approveForm, batch: e.target.value })} placeholder="e.g. 2026" /></div>
                <div><label>Section</label><input value={approveForm.section} onChange={(e) => setApproveForm({ ...approveForm, section: e.target.value })} placeholder="e.g. A" /></div>
                <div><label>Semester</label><input value={approveForm.semester} onChange={(e) => setApproveForm({ ...approveForm, semester: e.target.value })} /></div>
                <div><label>Academic Year</label><input value={approveForm.academic_year} onChange={(e) => setApproveForm({ ...approveForm, academic_year: e.target.value })} /></div>
                <div className="adm-checkbox-wrap">
                  <label><input type="checkbox" checked={approveForm.create_login} onChange={(e) => setApproveForm({ ...approveForm, create_login: e.target.checked })} /> Create student login automatically</label>
                </div>
              </div>
              <div className="adm-form-nav">
                <button type="button" className="btn" onClick={() => setApproveModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Approving...' : 'Approve & Create Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
