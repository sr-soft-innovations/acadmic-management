import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import { useToast } from '../context/ToastContext';
import { SECTION_ICONS } from '../config/navConfig';

const EXPIRES_KEY = 'college_erp_expires';
const DARK_KEY = 'erp_dark';
const SIDEBAR_KEY = 'erp_sidebar';
const COLLAPSED_KEY = 'erp_collapsed_sections';
function SessionExpiry() {
  const [mins, setMins] = useState(null);
  const toast = useToast();
  const warnedRef = useRef(false);

  useEffect(() => {
    const check = () => {
      const exp = localStorage.getItem(EXPIRES_KEY);
      if (!exp) { setMins(null); return; }
      const m = Math.max(0, Math.floor((parseInt(exp, 10) - Date.now()) / 60000));
      setMins(m);
      if (m > 0 && m <= 5 && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning('Your session will expire in ' + m + ' minute(s). Save your work and refresh to stay logged in.');
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [toast]);
  if (mins === null || mins > 30) return null;
  return <span className="session-expiry">Session: {mins}m</span>;
}

function TopLoadingBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => {
    setVisible(true);
    setProgress(30);
    timerRef.current = setTimeout(() => setProgress(70), 100);
    const done = setTimeout(() => { setProgress(100); setTimeout(() => setVisible(false), 300); }, 250);
    return () => { clearTimeout(timerRef.current); clearTimeout(done); };
  }, [location.pathname]);
  if (!visible) return null;
  return <div className="top-loading-bar" style={{ width: `${progress}%` }} />;
}

const LABEL_MAP = {
  students: 'Students', staff: 'Staff', departments: 'Departments', courses: 'Courses',
  semesters: 'Semesters', 'subject-faculty': 'Subject Faculty', timetable: 'Timetable',
  attendance: 'Attendance', exams: 'Examinations', results: 'Results', reports: 'Reports',
  fees: 'Fees', analytics: 'Analytics', approvals: 'Approvals', audit: 'Audit Logs',
  sessions: 'Sessions', permissions: 'Permissions', users: 'Users', profile: 'Profile',
  parent: 'Parent Portal', 'parent-inbox': 'Messages', admission: 'Admission',
  'bulk-upload': 'Bulk Upload', academic: 'Academic', library: 'Library', lab: 'Lab',
  pharmd: 'Pharm.D', notice: 'Notice Board', messaging: 'Messaging', hostel: 'Hostel',
  transport: 'Transport', placement: 'Placement', events: 'Events',
  accreditation: 'Accreditation', communication: 'Communication', payroll: 'Payroll',
  expense: 'Expense', scholarship: 'Scholarship',
};

function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const crumbs = parts.map((part, i) => ({
    label: LABEL_MAP[part] || part.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    path: '/' + parts.slice(0, i + 1).join('/'),
  }));
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <NavLink to="/" className="breadcrumb-link">Dashboard</NavLink>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.path}>
          <span className="breadcrumb-sep">/</span>
          {i === crumbs.length - 1 ? (
            <span className="breadcrumb-current">{c.label}</span>
          ) : (
            <NavLink to={c.path} className="breadcrumb-link">{c.label}</NavLink>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const { items: navItems } = useNav();
  const navigate = useNavigate();
  const location = useLocation();

  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === '1');
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== '0');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}'); }
    catch { return {}; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem(DARK_KEY, dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '1' : '0');
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const visibleNav = useMemo(
    () => navItems.filter((item) => hasPermission(item.permission)),
    [navItems, hasPermission]
  );

  const filteredNav = useMemo(() => {
    if (!sidebarSearch.trim()) return visibleNav;
    const q = sidebarSearch.toLowerCase();
    return visibleNav.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.section || '').toLowerCase().includes(q)
    );
  }, [visibleNav, sidebarSearch]);

  const navBySection = useMemo(() => {
    const map = {};
    for (const item of filteredNav) {
      const section = item.section || 'Dashboard';
      if (!map[section]) map[section] = [];
      map[section].push(item);
    }
    return map;
  }, [filteredNav]);

  const sectionOrder = useMemo(
    () => [...new Set(filteredNav.map((item) => item.section || 'Dashboard'))],
    [filteredNav]
  );

  const toggleSection = useCallback((section) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const activeSectionFor = useMemo(() => {
    for (const item of visibleNav) {
      if (item.to === location.pathname) return item.section || 'Dashboard';
    }
    return null;
  }, [visibleNav, location.pathname]);

  useEffect(() => {
    if (activeSectionFor && collapsed[activeSectionFor]) {
      setCollapsed((prev) => ({ ...prev, [activeSectionFor]: false }));
    }
  }, [activeSectionFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-logo">GP</span>
          {sidebarOpen && <span className="sidebar-brand-text">G.P. Pharmacy</span>}
        </div>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Sidebar search */}
      {sidebarOpen && (
        <div className="sidebar-search-wrap">
          <input
            ref={searchRef}
            className="sidebar-search"
            type="text"
            placeholder="Search menu..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
          />
          {sidebarSearch && (
            <button className="sidebar-search-clear" onClick={() => setSidebarSearch('')} aria-label="Clear">×</button>
          )}
        </div>
      )}

      {/* Navigation sections */}
      <nav className="app-sidebar-nav" role="navigation" aria-label="Main navigation">
        {sectionOrder.map((section) => {
          const items = navBySection[section];
          if (!items || items.length === 0) return null;
          const icon = SECTION_ICONS[section] || '📁';
          const isCollapsed = collapsed[section] && !sidebarSearch;
          const isActive = activeSectionFor === section;
          const isSingleItem = section === 'Dashboard' && items.length === 1;

          if (isSingleItem) {
            const item = items[0];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive: a }) => `sidebar-link sidebar-link-solo${a ? ' active' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="sidebar-link-icon">{icon}</span>
                {sidebarOpen && <span className="sidebar-link-label">{item.label}</span>}
              </NavLink>
            );
          }

          return (
            <div key={section} className={`sidebar-section${isActive ? ' sidebar-section-active' : ''}`}>
              <button
                className="sidebar-section-header"
                onClick={() => toggleSection(section)}
                title={!sidebarOpen ? section : undefined}
                aria-expanded={!isCollapsed}
              >
                <span className="sidebar-section-icon">{icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="sidebar-section-title">{section}</span>
                    <span className={`sidebar-section-arrow${isCollapsed ? '' : ' open'}`}>›</span>
                    <span className="sidebar-section-count">{items.length}</span>
                  </>
                )}
              </button>
              {!isCollapsed && sidebarOpen && (
                <div className="sidebar-section-items">
                  {items.map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive: a }) => `sidebar-link${a ? ' active' : ''}`}
                    >
                      <span className="sidebar-link-label">{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      {sidebarOpen && (
        <div className="sidebar-footer">
          <span className="sidebar-footer-text">ERP v1.0</span>
        </div>
      )}
    </>
  );

  return (
    <div className={`app-wrapper${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <TopLoadingBar />

      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <h1 className="app-title">G.P. College of Pharmacy</h1>
          <span className="app-subtitle">Enterprise Resource Planning</span>
        </div>
        <div className="app-header-right">
          <SessionExpiry />
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setDark((d) => !d)}
            title={dark ? 'Light mode' : 'Dark mode'}
            aria-label="Toggle dark mode"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <NavLink to="/profile" className="app-user-chip">
            <span className="app-user-avatar">{(user?.name || user?.username || '?')[0].toUpperCase()}</span>
            <span className="app-user-info">
              <span className="app-user-name">{user?.name || user?.username}</span>
              <span className="app-user-role">{user?.role?.replace(/_/g, ' ')}</span>
            </span>
          </NavLink>
          <button type="button" onClick={handleLogout} className="btn-logout" title="Logout">
            Logout
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Mobile overlay */}
        {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

        {/* Sidebar */}
        <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
          {sidebarContent}
        </aside>

        {/* Main content */}
        <main className="app-main" role="main">
          <div className="app-main-inner">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
