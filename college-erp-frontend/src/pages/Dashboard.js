import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Dashboard.css';

/* ── helpers ── */
const COLORS = ['#E11B21','#FAD332','#2563eb','#16a34a','#9333ea','#f97316','#06b6d4','#ec4899','#84cc16','#6366f1'];
const GENDER_CLR = { Male: '#2563eb', Female: '#ec4899', Other: '#f59e0b', 'Not specified': '#94a3b8' };

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function fmtDate(d) { return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function timeAgo(ts) { if (!ts) return ''; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return 'now'; const m = Math.floor(s / 60); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; }
function isAdmin(r) { return ['super_admin','admin','principal','hod'].includes(r); }
function isHod(r) { return r === 'hod'; }
function isSuperAdmin(r) { return r === 'super_admin'; }
function isFaculty(r) { return ['faculty','staff','lab_assistant','guest_faculty','hospital_mentor'].includes(r); }

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ── small components ── */
function Skel() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-hero"><div className="skel skel-hero"/><div className="skel skel-sub"/></header>
      <div className="dash-kpi-strip">{[1,2,3,4,5,6,7,8].map(i=><div key={i} className="dash-kpi"><div className="skel skel-kpi-v"/><div className="skel skel-kpi-l"/></div>)}</div>
      <div className="dash-grid">{[1,2,3,4].map(i=><div key={i} className="dash-module skel-card"><div className="skel skel-t"/><div className="skel skel-l"/><div className="skel skel-l" style={{width:'70%'}}/></div>)}</div>
    </div>
  );
}

function Empty({ icon, text, action, to }) {
  return <div className="dash-empty"><span className="dash-empty-icon">{icon}</span><span className="dash-empty-text">{text}</span>{action && to && <Link to={to} className="dash-empty-link">{action} →</Link>}</div>;
}

function Progress({ value, max, label, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="dash-progress"><div className="dash-progress-hdr"><span>{label}</span><span className="dash-progress-pct">{pct}%</span></div><div className="dash-progress-track"><div className="dash-progress-fill" style={{ width: `${pct}%`, background: color || 'var(--color-primary)' }}/></div></div>;
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const role = user?.role || '';
  const admin = isAdmin(role), hod = isHod(role), faculty = isFaculty(role), student = role === 'student', parent = role === 'parent', superAdmin = isSuperAdmin(role);
  const otherRole = !admin && !hod && !faculty && !student && !parent;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRef = useRef(null);

  /* filters */
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  /* data */
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [strength, setStrength] = useState(null);
  const [feeData, setFeeData] = useState(null);
  const [dailyOverview, setDailyOverview] = useState(null);
  const [attendTrend, setAttendTrend] = useState(null);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [deptComparison, setDeptComparison] = useState(null);
  const [admissionStats, setAdmissionStats] = useState(null);
  const [, setAdmissions] = useState([]);
  const [staffSummary, setStaffSummary] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [notifications, setNotifications] = useState({ unread_count: 0, items: [] });
  const [calendar, setCalendar] = useState({ events: [] });
  const [health, setHealth] = useState(null);
  const [todaySlots, setTodaySlots] = useState([]);
  const [parentStudents, setParentStudents] = useState([]);
  const [parentPersonal, setParentPersonal] = useState(null);
  const [studentPersonal, setStudentPersonal] = useState(null);
  const [staffPersonal, setStaffPersonal] = useState(null);
  const [hodPersonal, setHodPersonal] = useState(null);
  const [passPercentage, setPassPercentage] = useState(null);
  const [upcomingInspections, setUpcomingInspections] = useState([]);
  const [superAdminSummary, setSuperAdminSummary] = useState(null);

  const load = useCallback(() => {
    const dow = new Date().getDay();
    const ttDay = dow === 0 ? 6 : dow;
    const p = [
      api.auth.getMe().then(setProfile).catch(() => null),
      api.dashboard.notifications().then(setNotifications).catch(() => setNotifications({ unread_count: 0, items: [] })),
      api.dashboard.calendar().then(setCalendar).catch(() => setCalendar({ events: [] })),
      api.exams.upcoming(10).then(r => setUpcomingExams(r.exams || [])).catch(() => setUpcomingExams([])),
    ];
    if (admin || faculty || student) p.push(api.dashboard.stats().then(setStats).catch(() => null));
    if (student) p.push(api.dashboard.studentPersonal().then(setStudentPersonal).catch(() => setStudentPersonal(null)));
    if (admin) {
      p.push(
        api.dashboard.studentStrength().then(setStrength).catch(() => null),
        api.fees.analytics().then(setFeeData).catch(() => null),
        api.dashboard.dailyOverview().then(setDailyOverview).catch(() => null),
        api.dashboard.attendanceTrend(30).then(setAttendTrend).catch(() => null),
        api.approvals.pending().then(r => setPendingApprovals(r.approvals || [])).catch(() => setPendingApprovals([])),
        api.dashboard.departmentComparison().then(setDeptComparison).catch(() => null),
        api.dashboard.admissionStats().then(setAdmissionStats).catch(() => null),
        api.admission.list().then(r => setAdmissions(Array.isArray(r) ? r : (r.applications || []))).catch(() => setAdmissions([])),
        api.dashboard.staffSummary().then(setStaffSummary).catch(() => null),
        api.dashboard.todaySummary().then(setTodaySummary).catch(() => null),
        api.dashboard.recentActivity(30).then(r => setRecentActivity(r.items || [])).catch(() => setRecentActivity([])),
        api.health().then(setHealth).catch(() => null),
        api.results.passPercentage().then(setPassPercentage).catch(() => setPassPercentage(null)),
        api.dashboard.upcomingInspections().then(r => setUpcomingInspections(r.inspections || [])).catch(() => setUpcomingInspections([])),
      );
    }
    if (superAdmin) p.push(api.dashboard.superAdminSummary().then(setSuperAdminSummary).catch(() => setSuperAdminSummary(null)));
    if (faculty || student) p.push(api.timetable.list(null, null, ttDay).then(setTodaySlots).catch(() => setTodaySlots([])));
    if (faculty) p.push(api.dashboard.staffPersonal().then(setStaffPersonal).catch(() => setStaffPersonal(null)));
    if (hod) p.push(api.dashboard.hodPersonal().then(setHodPersonal).catch(() => setHodPersonal(null)));
    if (parent) {
      p.push(api.parent.students().then(r => setParentStudents(r.students || [])).catch(() => setParentStudents([])));
      p.push(api.dashboard.parentPersonal().then(setParentPersonal).catch(() => setParentPersonal(null)));
    }
    Promise.all(p).finally(() => { setLoading(false); setRefreshing(false); setLastUpdated(new Date()); });
  }, [admin, faculty, student, parent, superAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (hod && profile?.department) setDeptFilter(profile.department); }, [hod, profile?.department]);

  /* auto refresh */
  useEffect(() => {
    if (autoRefresh) { autoRef.current = setInterval(() => load(), 60000); }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoRefresh, load]);

  const refresh = () => { setRefreshing(true); load(); };
  const quickActions = [
    { label: 'Add Student', to: '/students', permission: 'students:write', icon: '➕' },
    { label: 'Approve Leave', to: '/staff/leave', permission: 'staff:write', icon: '✅' },
    { label: 'Collect Fee', to: '/fees', permission: 'fees:write', icon: '💳' },
    { label: 'Mark Attendance', to: '/attendance', permission: 'attendance:write', icon: '📋' },
    { label: 'Students', to: '/students', permission: 'students:read', icon: '👥' },
    { label: 'Exams', to: '/exams', permission: 'courses:read', icon: '📝' },
    { label: 'Reports', to: '/reports', permission: 'reports:read', icon: '📊' },
    { label: 'Profile', to: '/profile', permission: 'dashboard:read', icon: '👤' },
  ].filter(a => hasPermission(a.permission));

  if (loading && !profile) return <Skel />;

  const displayName = profile?.name || user?.name || user?.username;
  const attendPct = dailyOverview?.total_students > 0 ? Math.round((dailyOverview.present / dailyOverview.total_students) * 100) : null;
  const monthlyTrend = feeData?.by_month ? Object.entries(feeData.by_month).slice(0, 12).reverse().map(([m, v]) => ({ month: m.slice(5), amount: v })) : [];
  const loginActivity = recentActivity.filter(a => (a.action || a.type || '').toLowerCase().includes('login')).slice(0, 10);
  const lowAttendAlerts = todaySummary?.low_attendance_alerts || [];

  /* departments list for filter */
  const departments = deptComparison ? Object.keys(deptComparison.by_department || {}) : [];
  const academicYears = admissionStats ? Object.keys(admissionStats.by_year || {}) : [];

  /* export helpers */
  const exportStudentData = () => {
    if (!strength) return;
    exportCSV(Object.entries(strength.by_course).map(([c, n]) => ({ Course: c, Students: n })), 'student_strength.csv');
  };
  const exportFeeData = () => {
    if (!feeData) return;
    exportCSV(Object.entries(feeData.by_course || {}).map(([c, a]) => ({ Course: c, Amount: a })), 'fee_analytics.csv');
  };
  const exportAttendance = () => {
    if (!attendTrend) return;
    exportCSV(attendTrend.trend.map(d => ({ Date: d.date, Present: d.present, Absent: d.absent, Percentage: d.pct })), 'attendance_trend.csv');
  };

  return (
    <div className="dashboard-page">
      {/* ════ HERO ════ */}
      <header className="dashboard-hero">
        <div className="dashboard-hero-top">
          <div><h1 className="dashboard-title">Dashboard</h1><p className="dashboard-date">{fmtDate(new Date())}</p></div>
          <div className="dashboard-hero-actions">
            <label className="dash-auto-toggle" title="Auto-refresh every 60s">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              <span>Auto</span>
            </label>
            <button type="button" onClick={refresh} disabled={refreshing} className="dashboard-refresh-btn">
              <span className={refreshing ? 'dash-spin' : ''}>↻</span>{refreshing ? ' Refreshing…' : ' Refresh'}
            </button>
          </div>
        </div>
        <p className="dashboard-welcome">{greeting()}, <strong>{displayName}</strong>{profile?.role && <span className="dashboard-role"> · {profile.role.replace(/_/g, ' ')}</span>}{hod && profile?.department && <span className="dashboard-role"> · Dept: {profile.department}</span>}</p>
        {lastUpdated && <p className="dashboard-last-updated">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{autoRefresh && ' · Auto-refresh ON'}</p>}
      </header>

      {/* ════ SUPER ADMIN KPI STRIP ════ */}
      {superAdmin && (
        <section className="dash-kpi-strip" aria-label="System overview">
          {[
            { val: superAdminSummary?.active_users ?? '—', lbl: 'Active Users', icon: '👥', to: '/sessions' },
            { val: superAdminSummary?.server_status ?? '—', lbl: 'Server Status', icon: '🖥️', to: '/' },
            { val: superAdminSummary?.revenue_today != null ? `₹${superAdminSummary.revenue_today.toLocaleString('en-IN')}` : '—', lbl: 'Revenue Today', icon: '💰', to: '/fees' },
            { val: superAdminSummary?.security_alert_count ?? '—', lbl: 'Security Alerts', icon: '🔒', to: '/audit', alert: (superAdminSummary?.security_alert_count || 0) > 0 },
          ].map(k => (
            <Link key={k.lbl} to={k.to} className={`dash-kpi ${k.alert ? 'dash-kpi-alert' : ''}`}>
              <span className="dash-kpi-icon">{k.icon}</span>
              <span className="dash-kpi-val">{k.val ?? '—'}</span>
              <span className="dash-kpi-lbl">{k.lbl}</span>
            </Link>
          ))}
        </section>
      )}
      {/* ════ KPI STRIP (8 cards) ════ */}
      {hod && (
        <section className="dash-kpi-strip" aria-label="Department metrics">
          {[
            { val: hodPersonal?.department ?? '—', lbl: 'Department', icon: '🏢', to: '/staff' },
            { val: hodPersonal?.student_strength ?? '—', lbl: 'Dept Student Strength', icon: '🎓', to: '/students' },
            { val: hodPersonal?.attendance_pct != null ? `${hodPersonal.attendance_pct}%` : '—', lbl: 'Dept Attendance %', icon: '📋', to: '/attendance' },
            { val: hodPersonal?.pass_pct != null ? `${hodPersonal.pass_pct}%` : '—', lbl: 'Dept Pass %', icon: '📊', to: '/results' },
            { val: hodPersonal?.pending_count ?? '—', lbl: 'Pending Approvals', icon: '⏳', to: '/approvals', alert: (hodPersonal?.pending_count || 0) > 0 },
            { val: hodPersonal?.faculty_workload?.length ?? '—', lbl: 'Faculty', icon: '👨‍🏫', to: '/staff' },
          ].map(k => (
            <Link key={k.lbl} to={k.to} className={`dash-kpi ${k.alert ? 'dash-kpi-alert' : ''}`}>
              <span className="dash-kpi-icon">{k.icon}</span>
              <span className="dash-kpi-val">{k.val ?? '—'}</span>
              <span className="dash-kpi-lbl">{k.lbl}</span>
            </Link>
          ))}
        </section>
      )}
      {((admin && !hod) || faculty) && (
        <section className="dash-kpi-strip" aria-label="Key metrics">
          {[
            { val: stats?.students, lbl: 'Total Students', icon: '🎓', to: '/students' },
            { val: stats?.staff, lbl: 'Total Staff', icon: '👨‍🏫', to: '/staff' },
            { val: todaySummary ? `${todaySummary.fee_collected_pct}%` : '—', lbl: 'Fee Collection %', icon: '💰', to: '/fees' },
            { val: todaySummary ? `${todaySummary.avg_attendance_pct}%` : (attendPct !== null ? `${attendPct}%` : '—'), lbl: 'Avg Attendance %', icon: '📋', to: '/attendance' },
            { val: passPercentage != null ? `${passPercentage.pass_percentage}%` : '—', lbl: 'Pass %', icon: '📊', to: '/results' },
            { val: stats?.courses, lbl: 'Active Courses', icon: '📚', to: '/courses' },
            { val: stats?.pending_approvals, lbl: 'Pending Requests', icon: '⏳', to: '/approvals', alert: true },
            { val: todaySummary?.today_classes ?? '—', lbl: "Today's Classes", icon: '🕐', to: '/timetable' },
            { val: todaySummary?.pending_leaves ?? '—', lbl: "Today's Leaves", icon: '📋', to: '/staff/leave' },
          ].map(k => (
            <Link key={k.lbl} to={k.to} className={`dash-kpi ${k.alert && Number(k.val) > 0 ? 'dash-kpi-alert' : ''}`}>
              <span className="dash-kpi-icon">{k.icon}</span>
              <span className="dash-kpi-val">{k.val ?? '—'}</span>
              <span className="dash-kpi-lbl">{k.lbl}</span>
            </Link>
          ))}
        </section>
      )}

      {/* ════ FILTERS + EXPORT + QUICK ACTIONS ════ */}
      {admin && !hod && (
        <div className="dash-toolbar">
          <div className="dash-filters">
            {departments.length > 0 && (
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="dash-filter-select">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {academicYears.length > 0 && (
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="dash-filter-select">
                <option value="">All Years</option>
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
          <div className="dash-export-btns">
            <button type="button" className="dash-export-btn" onClick={exportStudentData} title="Export student data">📥 Students</button>
            <button type="button" className="dash-export-btn" onClick={exportFeeData} title="Export fee data">📥 Fees</button>
            <button type="button" className="dash-export-btn" onClick={exportAttendance} title="Export attendance">📥 Attendance</button>
          </div>
        </div>
      )}

      <section className="dash-module dash-accent-red">
        <h3>⚡ Quick Actions</h3>
        <div className="dash-qa-row">{quickActions.map(a => <Link key={a.to + a.label} to={a.to} className="dash-qa-btn"><span className="dash-qa-icon">{a.icon}</span>{a.label}</Link>)}</div>
      </section>

      {/* ════ ALERTS ════ */}
      {admin && !hod && (lowAttendAlerts.length > 0 || (todaySummary?.fee_pending_count || 0) > 0) && (
        <div className="dash-alerts-row">
          {lowAttendAlerts.length > 0 && (
            <div className="dash-alert dash-alert-warn">
              <span className="dash-alert-icon">⚠️</span>
              <div><strong>Low Attendance Alert</strong><p>{lowAttendAlerts.length} student(s) below 75%: {lowAttendAlerts.slice(0, 3).map(s => `${s.name} (${s.pct}%)`).join(', ')}{lowAttendAlerts.length > 3 && '…'}</p></div>
              <Link to="/attendance" className="dash-alert-link">View →</Link>
            </div>
          )}
          {(todaySummary?.fee_pending_count || 0) > 0 && (
            <div className="dash-alert dash-alert-danger">
              <span className="dash-alert-icon">💸</span>
              <div><strong>Fee Due Alert</strong><p>{todaySummary.fee_pending_count} student(s) have not paid fees yet.</p></div>
              <Link to="/fees" className="dash-alert-link">View →</Link>
            </div>
          )}
        </div>
      )}

      {/* ════ HOD DASHBOARD ════ */}
      {hod && (
        <div className="dash-grid">
          <div className="dash-module dash-accent-blue">
            <div className="dash-module-hdr"><h3>🏢 Department Overview</h3><span className="dash-mod-link">{hodPersonal?.department || '—'}</span></div>
            <div className="dash-stat-row">
              <div className="dash-stat-big"><span className="dash-stat-num">{hodPersonal?.student_strength ?? '—'}</span><span className="dash-stat-label">Student Strength</span></div>
              <div className="dash-stat-big"><span className="dash-stat-num">{hodPersonal?.attendance_pct != null ? `${hodPersonal.attendance_pct}%` : '—'}</span><span className="dash-stat-label">Attendance %</span></div>
              <div className="dash-stat-big"><span className="dash-stat-num">{hodPersonal?.pass_pct != null ? `${hodPersonal.pass_pct}%` : '—'}</span><span className="dash-stat-label">Pass %</span></div>
            </div>
          </div>
          <div className="dash-module dash-accent-red">
            <div className="dash-module-hdr"><h3>✅ Pending Approvals</h3><Link to="/approvals" className="dash-mod-link">Manage →</Link></div>
            {(hodPersonal?.pending_approvals?.length || 0) > 0 ? (
              <ul className="dash-list">{(hodPersonal.pending_approvals || []).slice(0, 6).map(a => <li key={a.id}><div className="dash-list-main"><strong>{a.type}</strong><span className="dash-list-meta">{a.applicant_name}</span></div><span className="dash-list-badge dash-badge-warn">Pending</span></li>)}</ul>
            ) : <Empty icon="🎉" text="All caught up!" />}
          </div>
          <div className="dash-module dash-accent-purple dash-module-wide">
            <div className="dash-module-hdr"><h3>👨‍🏫 Faculty Workload</h3><Link to="/staff" className="dash-mod-link">View →</Link></div>
            {(hodPersonal?.faculty_workload?.length || 0) > 0 ? (
              <ul className="dash-list">{(hodPersonal.faculty_workload || []).map(w => <li key={w.staff_id}><div className="dash-list-main"><strong>{w.name}</strong><span className="dash-list-meta">{w.slots} slots · {w.subjects} subject(s)</span></div></li>)}</ul>
            ) : <Empty icon="👨‍🏫" text="No faculty data" />}
          </div>
          <div className="dash-module dash-accent-amber">
            <div className="dash-module-hdr"><h3>📝 Upcoming Exams</h3><Link to="/exams" className="dash-mod-link">All →</Link></div>
            {upcomingExams.length > 0 ? <ul className="dash-list">{upcomingExams.slice(0, 5).map(e => <li key={e.id}><div className="dash-list-main"><strong>{e.title}</strong></div><span className="dash-list-badge">{e.exam_date}</span></li>)}</ul> : <Empty icon="📝" text="No upcoming exams" />}
          </div>
          <div className="dash-module dash-accent-blue">
            <div className="dash-module-hdr"><h3>🔔 Notifications</h3></div>
            {notifications.items.length === 0 ? <Empty icon="🔕" text="No notifications" /> : <ul className="dash-list">{notifications.items.slice(0, 5).map(n => <li key={n.id}><div className="dash-list-main"><span className="dash-notif-pill">{n.type}</span><strong>{n.title}</strong><span className="dash-list-meta">{n.message}</span></div><span className="dash-list-time">{timeAgo(n.created_at)}</span></li>)}</ul>}
          </div>
        </div>
      )}

      {/* ════ ADMIN MODULES ════ */}
      {admin && !hod && (
        <div className="dash-grid">

          {/* 1. Student strength summary */}
          <div className="dash-module dash-accent-blue" data-dash-section="student-strength">
            <div className="dash-module-hdr"><h3>🎓 Student Distribution</h3><Link to="/students" className="dash-mod-link">View all →</Link></div>
            {strength ? (
              <>
                <div className="dash-stat-row">
                  <div className="dash-stat-big"><span className="dash-stat-num">{strength.total}</span><span className="dash-stat-label">Total</span></div>
                  {Object.entries(strength.by_gender || {}).map(([g, c]) => (
                    <div key={g} className="dash-stat-pill" style={{ borderColor: GENDER_CLR[g] || '#94a3b8' }}>
                      <span className="dash-stat-pill-val" style={{ color: GENDER_CLR[g] }}>{c}</span><span>{g}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={Object.entries(strength.by_course).map(([name, value]) => ({ name, value }))}
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {Object.keys(strength.by_course).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : <Empty icon="🎓" text="No student data" action="Add" to="/students" />}
          </div>

          {/* 2. Fee collection analytics */}
          <div className="dash-module dash-accent-green" data-dash-section="fee-analytics">
            <div className="dash-module-hdr"><h3>💰 Monthly Fee Collection</h3><Link to="/fees" className="dash-mod-link">Details →</Link></div>
            {feeData ? (
              <>
                <div className="dash-stat-row">
                  <div className="dash-stat-big"><span className="dash-stat-num">₹{feeData.total_collected?.toLocaleString('en-IN')}</span><span className="dash-stat-label">Total Collected ({feeData.transaction_count} txns)</span></div>
                </div>
                {monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                      <Bar dataKey="amount" fill="#16a34a" radius={[4,4,0,0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty icon="📊" text="No monthly data yet" />}
              </>
            ) : <Empty icon="💰" text="No fee data" action="Manage" to="/fees" />}
          </div>

          {/* 3. Attendance % trend */}
          <div className="dash-module dash-accent-amber dash-module-wide" data-dash-section="attendance">
            <div className="dash-module-hdr"><h3>📈 Attendance Trend (30 days)</h3><Link to="/attendance" className="dash-mod-link">Details →</Link></div>
            {attendTrend?.trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={attendTrend.trend.map(d => ({ ...d, date: d.date.slice(5) }))}>
                  <defs>
                    <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E11B21" stopOpacity={0.2}/><stop offset="95%" stopColor="#E11B21" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="present" stroke="#16a34a" fill="url(#gradPresent)" strokeWidth={2} name="Present" />
                  <Area type="monotone" dataKey="absent" stroke="#E11B21" fill="url(#gradAbsent)" strokeWidth={2} name="Absent" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty icon="📈" text="No attendance trend data" />}
          </div>

          {/* 4. Department comparison */}
          <div className="dash-module dash-accent-purple" data-dash-section="department-comparison">
            <div className="dash-module-hdr"><h3>🏢 Department Performance</h3><Link to="/analytics" className="dash-mod-link">Analytics →</Link></div>
            {deptComparison ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(deptComparison.by_department || {})
                  .filter(([k]) => !deptFilter || k === deptFilter)
                  .map(([k, v]) => ({ name: k, staff: v.staff, courses: v.courses }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="staff" fill="#E11B21" name="Staff" radius={[4,4,0,0]} />
                  <Bar dataKey="courses" fill="#FAD332" name="Courses" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty icon="🏢" text="No data" />}
          </div>

          {/* 5. Year-wise Admission Growth */}
          <div className="dash-module dash-accent-green">
            <div className="dash-module-hdr"><h3>🎒 Admission Growth</h3><Link to="/admission" className="dash-mod-link">View →</Link></div>
            {admissionStats && Object.keys(admissionStats.by_year).length > 0 ? (
              <>
                <div className="dash-stat-row"><div className="dash-stat-big"><span className="dash-stat-num">{admissionStats.total}</span><span className="dash-stat-label">Total Applications</span></div></div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={Object.entries(admissionStats.by_year)
                    .filter(([y]) => !yearFilter || y === yearFilter)
                    .map(([y, c]) => ({ year: y, count: c }))}>
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip /><Bar dataKey="count" fill="#2563eb" radius={[4,4,0,0]} name="Applications" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : <Empty icon="🎒" text="No admission data" action="New" to="/admission" />}
          </div>

          {/* 6. Course-wise Strength (graphs) */}
          <div className="dash-module dash-accent-blue" data-dash-section="course-strength-chart">
            <div className="dash-module-hdr"><h3>📚 Course-wise Strength</h3></div>
            {strength ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(strength.by_course).map(([k, v]) => ({ name: k, students: v }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip /><Bar dataKey="students" fill="#2563eb" radius={[4,4,0,0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty icon="📚" text="No data" />}
          </div>

          {/* 7. Fee Pending vs Paid (graphs) */}
          <div className="dash-module dash-accent-red" data-dash-section="fee-paid-pending">
            <div className="dash-module-hdr"><h3>💳 Fee: Paid vs Pending</h3><Link to="/fees" className="dash-mod-link">Fees →</Link></div>
            {todaySummary && stats ? (() => {
              const paid = stats.students - (todaySummary.fee_pending_count || 0);
              const pending = todaySummary.fee_pending_count || 0;
              return (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: 'Paid', value: Math.max(0, paid) }, { name: 'Pending', value: pending }]}
                        cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={4} dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}>
                        <Cell fill="#16a34a" /><Cell fill="#E11B21" />
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dash-stat-row" style={{ justifyContent: 'center' }}>
                    <div className="dash-stat-pill" style={{ borderColor: '#16a34a' }}><span className="dash-stat-pill-val" style={{ color: '#16a34a' }}>{Math.max(0, paid)}</span><span>Paid</span></div>
                    <div className="dash-stat-pill" style={{ borderColor: '#E11B21' }}><span className="dash-stat-pill-val" style={{ color: '#E11B21' }}>{pending}</span><span>Pending</span></div>
                  </div>
                </>
              );
            })() : <Empty icon="💳" text="No data" />}
          </div>

          {/* 8. Upcoming exams */}
          <div className="dash-module dash-accent-purple" data-dash-section="upcoming-exams">
            <div className="dash-module-hdr"><h3>📅 Exam Schedule</h3><Link to="/exams" className="dash-mod-link">All exams →</Link></div>
            {upcomingExams.length > 0 ? (
              <div className="dash-timeline">
                {upcomingExams.slice(0, 8).map((e, i) => (
                  <div key={e.id} className="dash-timeline-item">
                    <div className="dash-timeline-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <div className="dash-timeline-content">
                      <strong>{e.title}</strong>
                      <span className="dash-timeline-meta">{e.course || ''} · {e.exam_type || 'Exam'}</span>
                    </div>
                    <span className="dash-timeline-date">{e.exam_date}</span>
                  </div>
                ))}
              </div>
            ) : <Empty icon="📅" text="No upcoming exams" action="Schedule" to="/exams" />}
          </div>

          {/* 8b. Upcoming Inspections (Principal) */}
          <div className="dash-module dash-accent-amber">
            <div className="dash-module-hdr"><h3>🏆 Upcoming Inspections</h3><Link to="/accreditation/faculty-qualification" className="dash-mod-link">Accreditation →</Link></div>
            {upcomingInspections.length > 0 ? (
              <div className="dash-timeline">
                {upcomingInspections.slice(0, 6).map((i, idx) => (
                  <div key={i.id} className="dash-timeline-item">
                    <div className="dash-timeline-dot" style={{ background: COLORS[idx % COLORS.length] }} />
                    <div className="dash-timeline-content">
                      <strong>{i.title}</strong>
                      <span className="dash-timeline-meta">{i.type || ''} · {i.description || ''}</span>
                    </div>
                    <span className="dash-timeline-date">{i.date}</span>
                  </div>
                ))}
              </div>
            ) : <Empty icon="🏆" text="No upcoming inspections" />}
          </div>

          {/* Today's Attendance % */}
          <div className="dash-module dash-accent-amber" data-dash-section="attendance-today">
            <div className="dash-module-hdr"><h3>📋 Today's Attendance</h3><Link to="/attendance" className="dash-mod-link">Details →</Link></div>
            {dailyOverview ? (
              <>
                <div className="dash-attend-hero">
                  <div className={`dash-attend-circle ${(attendPct || 0) >= 75 ? 'dash-attend-good' : 'dash-attend-low'}`}>
                    <span className="dash-attend-pct">{attendPct ?? 0}%</span><span className="dash-attend-sub">Today</span>
                  </div>
                  <div className="dash-attend-counts">
                    <div><strong>{dailyOverview.present}</strong> Present</div>
                    <div><strong>{dailyOverview.total_students - dailyOverview.present}</strong> Absent</div>
                  </div>
                </div>
                {dailyOverview.by_course?.length > 0 && dailyOverview.by_course.map(c => (
                  <Progress key={c.course} value={c.present} max={c.total} label={`${c.course}: ${c.present}/${c.total}`}
                    color={c.total > 0 && (c.present / c.total) >= 0.75 ? '#16a34a' : '#E11B21'} />
                ))}
              </>
            ) : <Empty icon="📋" text="No data" action="Mark" to="/attendance" />}
          </div>

          {/* Pending approvals */}
          <div className="dash-module dash-accent-red" data-dash-section="pending-approvals">
            <div className="dash-module-hdr"><h3>✅ Pending Approvals</h3><Link to="/approvals" className="dash-mod-link">Manage →</Link></div>
            <div className="dash-stat-row">
              <div className="dash-stat-big"><span className="dash-stat-num" style={{ color: pendingApprovals.length > 0 ? '#E11B21' : '#16a34a' }}>{pendingApprovals.length}</span><span className="dash-stat-label">Pending</span></div>
            </div>
            {pendingApprovals.length > 0 ? (
              <ul className="dash-list">{pendingApprovals.slice(0, 4).map(a => <li key={a.id}><div className="dash-list-main"><strong>{a.type}</strong><span className="dash-list-meta">{a.applicant_name}</span></div><span className="dash-list-badge dash-badge-warn">Pending</span></li>)}</ul>
            ) : <Empty icon="🎉" text="All caught up!" />}
          </div>

          {/* Staff Summary */}
          <div className="dash-module dash-accent-purple">
            <div className="dash-module-hdr"><h3>👨‍🏫 Staff Summary</h3><Link to="/staff" className="dash-mod-link">View →</Link></div>
            {staffSummary ? (
              <>
                <div className="dash-stat-row"><div className="dash-stat-big"><span className="dash-stat-num">{staffSummary.total}</span><span className="dash-stat-label">Total Staff</span></div></div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={Object.entries(staffSummary.by_department).map(([n, v]) => ({ name: n, value: v }))}
                      cx="50%" cy="50%" outerRadius={65} innerRadius={30} paddingAngle={3} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {Object.keys(staffSummary.by_department).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : <Empty icon="👨‍🏫" text="No data" />}
          </div>

          {/* Notifications */}
          <div className="dash-module dash-accent-amber">
            <div className="dash-module-hdr"><h3>🔔 Notifications {notifications.unread_count > 0 && <span className="dash-badge">{notifications.unread_count}</span>}</h3></div>
            {notifications.items.length === 0 ? <Empty icon="🔕" text="No notifications" /> : (
              <ul className="dash-list">{notifications.items.slice(0, 6).map(n => (
                <li key={n.id}><div className="dash-list-main"><span className="dash-notif-pill">{n.type}</span><strong>{n.title}</strong><span className="dash-list-meta">{n.message}</span></div>{n.created_at && <span className="dash-list-time">{timeAgo(n.created_at)}</span>}</li>
              ))}</ul>
            )}
          </div>

          {/* Login Activity + Calendar + Health */}
          <div className="dash-module dash-accent-blue">
            <div className="dash-module-hdr"><h3>🔐 Login Activity</h3><Link to="/audit" className="dash-mod-link">Audit →</Link></div>
            {loginActivity.length > 0 ? (
              <ul className="dash-list">{loginActivity.map((a, i) => <li key={a.id || i}><div className="dash-list-main"><strong>{a.user || a.username || '—'}</strong><span className="dash-list-meta">{a.action || a.type} {a.role ? `· ${a.role}` : ''}</span></div><span className="dash-list-time">{timeAgo(a.timestamp)}</span></li>)}</ul>
            ) : <Empty icon="🔐" text="No recent logins" />}
          </div>

          <div className="dash-module dash-accent-green">
            <div className="dash-module-hdr"><h3>📅 Calendar</h3>{hasPermission('courses:write') && <Link to="/academic/calendar" className="dash-mod-link">+ Add</Link>}</div>
            {calendar.events.length === 0 ? <Empty icon="📅" text="No events" action="Add" to="/academic/calendar" /> : (
              <ul className="dash-list">{calendar.events.slice(0, 5).map((ev, i) => <li key={ev.id || i}><div className="dash-list-main"><strong>{ev.title || ev.name}</strong></div><span className="dash-list-badge">{ev.date || ev.start_date}</span></li>)}</ul>
            )}
          </div>

          <div className="dash-module dash-accent-blue">
            <h3>🖥️ System Health</h3>
            <div className={`dash-health ${health?.status === 'ok' ? 'dash-health-ok' : 'dash-health-warn'}`}>
              <span className="dash-health-dot" /><span>{health?.status === 'ok' ? 'All systems operational' : 'Checking…'}</span>
            </div>
          </div>
          {superAdmin && (superAdminSummary?.security_alerts?.length || 0) > 0 && (
            <div className="dash-module dash-accent-red">
              <div className="dash-module-hdr"><h3>🔒 Security Alerts</h3><Link to="/audit" className="dash-mod-link">View →</Link></div>
              <ul className="dash-list">{(superAdminSummary.security_alerts || []).slice(0, 5).map((a, i) => <li key={i}><div className="dash-list-main"><span className="dash-notif-pill">{a.action || a.type || 'Alert'}</span><span className="dash-list-meta">{a.user_id || a.target || ''}</span></div><span className="dash-list-time">{timeAgo(a.timestamp)}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* ════ FACULTY / STAFF ════ */}
      {faculty && (
        <div className="dash-grid">
          {(staffPersonal?.assigned_subjects?.length || 0) > 0 && (
            <div className="dash-module dash-accent-blue">
              <div className="dash-module-hdr"><h3>📘 Assigned Subjects</h3><Link to="/subject-faculty" className="dash-mod-link">View →</Link></div>
              <ul className="dash-list">{(staffPersonal.assigned_subjects || []).slice(0, 6).map(s => <li key={s.id}><div className="dash-list-main"><strong>{s.name}</strong><span className="dash-list-meta">{s.code || ''}</span></div></li>)}</ul>
            </div>
          )}
          <div className="dash-module dash-accent-blue">
            <div className="dash-module-hdr"><h3>🕐 Today's Timetable</h3><Link to="/timetable" className="dash-mod-link">Full →</Link></div>
            {((staffPersonal?.today_slots?.length || 0) > 0 ? staffPersonal.today_slots : todaySlots).length === 0 ? <Empty icon="📚" text="No classes today" /> : <ul className="dash-list">{(staffPersonal?.today_slots?.length ? staffPersonal.today_slots : todaySlots).slice(0, 6).map(s => <li key={s.id}><div className="dash-list-main"><strong>{s.slot_start}–{s.slot_end}</strong><span className="dash-list-meta">{(s.subject_name || s.subject_id)} ({s.room || '—'})</span></div></li>)}</ul>}
          </div>
          <div className="dash-module dash-accent-green">
            <div className="dash-module-hdr"><h3>📋 Attendance Pending</h3><Link to="/attendance" className="dash-mod-link">Mark →</Link></div>
            <p>{(staffPersonal?.attendance_pending || 0) > 0 ? <strong>{staffPersonal.attendance_pending} student(s)</strong> : 'No'} pending for today.</p>
          </div>
          <div className="dash-module dash-accent-amber">
            <div className="dash-module-hdr"><h3>📝 Assignment Pending</h3><Link to="/academic/submission-feedback" className="dash-mod-link">Evaluate →</Link></div>
            <p>{(staffPersonal?.assignment_pending || 0) > 0 ? <strong>{staffPersonal.assignment_pending} submission(s)</strong> : 'No'} pending evaluation.</p>
          </div>
          {(staffPersonal?.student_performance?.length || 0) > 0 && (
            <div className="dash-module dash-accent-purple">
              <div className="dash-module-hdr"><h3>📊 Student Performance</h3><Link to="/results" className="dash-mod-link">Analytics →</Link></div>
              <ul className="dash-list">{(staffPersonal.student_performance || []).slice(0, 5).map((p, i) => <li key={i}><div className="dash-list-main"><strong>{p.subject}</strong></div><span className="dash-list-badge">Avg {p.avg_marks} ({p.count})</span></li>)}</ul>
            </div>
          )}
          <div className="dash-module dash-accent-amber"><div className="dash-module-hdr"><h3>📝 Upcoming Exams</h3><Link to="/exams" className="dash-mod-link">Exams →</Link></div>{upcomingExams.length === 0 ? <Empty icon="📝" text="No exams" /> : <ul className="dash-list">{upcomingExams.slice(0,5).map(e => <li key={e.id}><div className="dash-list-main"><strong>{e.title}</strong></div><span className="dash-list-badge">{e.exam_date}</span></li>)}</ul>}</div>
          <div className="dash-module dash-accent-red"><h3>🔔 Notifications</h3><p>Unread: <strong>{notifications.unread_count}</strong></p><Link to="/approvals" className="dash-mod-link">View →</Link></div>
        </div>
      )}

      {/* ════ STUDENT ════ */}
      {student && (
        <div className="dash-grid">
          {studentPersonal?.student && (
            <>
              <div className="dash-module dash-accent-green">
                <div className="dash-module-hdr"><h3>📋 My Attendance</h3><Link to="/attendance" className="dash-mod-link">View →</Link></div>
                {studentPersonal.attendance_pct != null ? (
                  <div className="dash-attend-hero">
                    <div className={`dash-attend-circle ${studentPersonal.attendance_pct >= 75 ? 'dash-attend-good' : 'dash-attend-low'}`}>
                      <span className="dash-attend-pct">{studentPersonal.attendance_pct}%</span>
                      <span className="dash-attend-sub">Overall</span>
                    </div>
                  </div>
                ) : <Empty icon="📊" text="No attendance records yet" action="View" to="/attendance" />}
              </div>
              <div className="dash-module dash-accent-blue">
                <div className="dash-module-hdr"><h3>💰 Fee Status</h3><Link to="/student/fees" className="dash-mod-link">Details →</Link></div>
                <div className="dash-stat-row">
                  <div className="dash-stat-big"><span className="dash-stat-num">₹{studentPersonal.total_paid?.toLocaleString('en-IN') || 0}</span><span className="dash-stat-label">Total Paid ({studentPersonal.fee_paid} txns)</span></div>
                  {(studentPersonal.fee_due || 0) > 0 && <div className="dash-stat-big"><span className="dash-stat-num dash-stat-due">₹{studentPersonal.fee_due?.toLocaleString('en-IN') || 0}</span><span className="dash-stat-label">Due</span></div>}
                </div>
              </div>
              {(studentPersonal.internal_marks?.length || 0) > 0 && (
                <div className="dash-module dash-accent-amber">
                  <div className="dash-module-hdr"><h3>📊 Internal Marks</h3><Link to="/student/marks" className="dash-mod-link">View →</Link></div>
                  <ul className="dash-list">{(studentPersonal.internal_marks || []).slice(0, 5).map(m => <li key={m.id}><div className="dash-list-main"><strong>{m.subject}</strong></div><span className="dash-list-badge">{m.marks}/{m.max_marks}</span></li>)}</ul>
                </div>
              )}
              {(studentPersonal.assignment_due_alerts?.length || 0) > 0 && (
                <div className="dash-module dash-accent-red">
                  <div className="dash-module-hdr"><h3>📝 Assignment Due</h3><Link to="/academic/assignments" className="dash-mod-link">Submit →</Link></div>
                  <ul className="dash-list">{(studentPersonal.assignment_due_alerts || []).slice(0, 4).map(a => <li key={a.id}><div className="dash-list-main"><strong>{a.title}</strong></div><span className="dash-list-badge">{a.due_date}</span></li>)}</ul>
                </div>
              )}
              {(studentPersonal.notices?.length || 0) > 0 && (
                <div className="dash-module dash-accent-blue">
                  <div className="dash-module-hdr"><h3>📢 Notices</h3><Link to="/student/notices" className="dash-mod-link">All →</Link></div>
                  <ul className="dash-list">{(studentPersonal.notices || []).slice(0, 4).map(n => <li key={n.id}><div className="dash-list-main"><strong>{n.title}</strong></div><span className="dash-list-meta">{n.body?.slice(0, 50)}{n.body?.length > 50 ? '…' : ''}</span></li>)}</ul>
                </div>
              )}
            </>
          )}
          <div className="dash-module dash-accent-amber"><div className="dash-module-hdr"><h3>📝 Upcoming Exams</h3><Link to="/exams" className="dash-mod-link">All →</Link></div>{(studentPersonal?.upcoming_exams?.length || upcomingExams.length) > 0 ? <ul className="dash-list">{(studentPersonal?.upcoming_exams || upcomingExams).slice(0, 6).map(e => <li key={e.id}><div className="dash-list-main"><strong>{e.title}</strong><span className="dash-list-meta">{e.course || ''} · {e.exam_type || 'Exam'}</span></div><span className="dash-list-badge">{e.exam_date}</span></li>)}</ul> : <Empty icon="📝" text="No upcoming exams" />}</div>
          <div className="dash-module dash-accent-blue"><div className="dash-module-hdr"><h3>🕐 Today's Classes</h3><Link to="/timetable" className="dash-mod-link">Full →</Link></div>{todaySlots.length === 0 ? <Empty icon="📚" text="No classes" /> : <ul className="dash-list">{todaySlots.slice(0,5).map(s => <li key={s.id}><div className="dash-list-main"><strong>{s.slot_start}–{s.slot_end}</strong><span className="dash-list-meta">{s.subject_name}</span></div></li>)}</ul>}</div>
          <div className="dash-module dash-accent-red"><div className="dash-module-hdr"><h3>📊 Results</h3><Link to="/results" className="dash-mod-link">View →</Link></div><p>Results, rank list, analytics.</p></div>
        </div>
      )}

      {/* ════ PARENT ════ */}
      {parent && (
        <div className="dash-grid">
          <div className="dash-module dash-accent-blue"><div className="dash-module-hdr"><h3>👨‍🎓 My Students</h3><Link to="/parent" className="dash-mod-link">Portal →</Link></div>{parentStudents.length === 0 ? <Empty icon="👤" text="No students linked" /> : <ul className="dash-list">{parentStudents.map(s => <li key={s.id}><div className="dash-list-main"><strong>{s.name || s.roll_no}</strong><span className="dash-list-meta">{s.course} · Sem {s.semester}</span></div></li>)}</ul>}</div>
          {(parentPersonal?.children || []).map((c) => (
            <React.Fragment key={c.student?.id}>
              {c.attendance_pct != null && (
                <div className="dash-module dash-accent-green">
                  <div className="dash-module-hdr"><h3>📋 {c.student?.name} – Attendance</h3><Link to="/parent" className="dash-mod-link">View →</Link></div>
                  <div className={`dash-attend-circle ${c.attendance_pct >= 75 ? 'dash-attend-good' : 'dash-attend-low'}`} style={{ width: 80, height: 80, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}><span className="dash-attend-pct">{c.attendance_pct}%</span></div>
                </div>
              )}
              {(c.marks?.length || 0) > 0 && (
                <div className="dash-module dash-accent-amber">
                  <div className="dash-module-hdr"><h3>📊 {c.student?.name} – Marks</h3><Link to="/parent" className="dash-mod-link">View →</Link></div>
                  <ul className="dash-list">{(c.marks || []).slice(0, 4).map(m => <li key={m.id}><div className="dash-list-main"><strong>{m.subject}</strong></div><span className="dash-list-badge">{m.marks}/{m.max_marks}</span></li>)}</ul>
                </div>
              )}
              <div className="dash-module dash-accent-blue">
                <div className="dash-module-hdr"><h3>💰 {c.student?.name} – Fee Status</h3><Link to="/parent" className="dash-mod-link">Pay →</Link></div>
                <div className="dash-stat-row">
                  <div className="dash-stat-big"><span className="dash-stat-num">₹{c.total_paid?.toLocaleString('en-IN') || 0}</span><span className="dash-stat-label">Paid ({c.payment_count} txns)</span></div>
                  {(c.fee_due || 0) > 0 && <div className="dash-stat-big"><span className="dash-stat-num dash-stat-due">₹{c.fee_due?.toLocaleString('en-IN') || 0}</span><span className="dash-stat-label">Due</span></div>}
                </div>
              </div>
            </React.Fragment>
          ))}
          {(parentPersonal?.notices?.length || 0) > 0 && (
            <div className="dash-module dash-accent-blue">
              <div className="dash-module-hdr"><h3>📢 Notices</h3><Link to="/parent" className="dash-mod-link">Portal →</Link></div>
              <ul className="dash-list">{(parentPersonal.notices || []).slice(0, 4).map(n => <li key={n.id}><div className="dash-list-main"><strong>{n.title}</strong></div><span className="dash-list-meta">{n.body?.slice(0, 40)}{n.body?.length > 40 ? '…' : ''}</span></li>)}</ul>
            </div>
          )}
          <div className="dash-module dash-accent-amber"><div className="dash-module-hdr"><h3>📝 Upcoming Exams</h3><Link to="/parent" className="dash-mod-link">Portal →</Link></div>{(parentPersonal?.upcoming_exams?.length || upcomingExams.length) > 0 ? <ul className="dash-list">{(parentPersonal?.upcoming_exams || upcomingExams).slice(0, 5).map(e => <li key={e.id}><div className="dash-list-main"><strong>{e.title}</strong></div><span className="dash-list-badge">{e.exam_date}</span></li>)}</ul> : <Empty icon="📝" text="No upcoming exams" />}</div>
          <div className="dash-module dash-accent-amber"><h3>🔔 Notifications</h3><p>Pending: <strong>{notifications.unread_count}</strong></p></div>
        </div>
      )}

      {/* ════ OTHER ROLES (librarian, accountant, non_teaching_staff, etc.) ════ */}
      {otherRole && (
        <div className="dash-grid">
          <div className="dash-module dash-accent-blue dash-module-wide">
            <h3>👋 Welcome, {displayName}</h3>
            <p className="dashboard-welcome" style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)' }}>
              You are logged in as <strong>{role.replace(/_/g, ' ')}</strong>. Use the sidebar to access modules available to your role.
            </p>
          </div>
          <div className="dash-module dash-accent-amber">
            <h3>⚡ Quick Links</h3>
            <div className="dash-qa-row">
              {hasPermission('library:read') && <Link to="/library/book-entry" className="dash-qa-btn"><span className="dash-qa-icon">📕</span>Library</Link>}
              {hasPermission('fees:read') && <Link to="/fees" className="dash-qa-btn"><span className="dash-qa-icon">💰</span>Fees</Link>}
              {hasPermission('students:read') && <Link to="/students" className="dash-qa-btn"><span className="dash-qa-icon">🎓</span>Students</Link>}
              {hasPermission('staff:read') && <Link to="/staff" className="dash-qa-btn"><span className="dash-qa-icon">👨‍🏫</span>Staff</Link>}
              {hasPermission('reports:read') && <Link to="/reports" className="dash-qa-btn"><span className="dash-qa-icon">📊</span>Reports</Link>}
              <Link to="/profile" className="dash-qa-btn"><span className="dash-qa-icon">👤</span>Profile</Link>
            </div>
          </div>
          <div className="dash-module dash-accent-blue">
            <h3>🔔 Notifications</h3>
            {notifications.items.length === 0 ? <Empty icon="🔕" text="No notifications" /> : (
              <ul className="dash-list">{notifications.items.slice(0, 5).map(n => <li key={n.id}><div className="dash-list-main"><strong>{n.title}</strong><span className="dash-list-meta">{n.message}</span></div><span className="dash-list-time">{timeAgo(n.created_at)}</span></li>)}</ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
