import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormError from '../components/FormError';
import './UserManagement.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  principal: 'Principal',
  hod: 'HOD',
  staff: 'Staff',
  faculty: 'Faculty',
  student: 'Student',
  parent: 'Parent',
  librarian: 'Librarian',
  lab_assistant: 'Lab Assistant',
  non_teaching_staff: 'Non-teaching staff',
  hospital_mentor: 'Hospital Mentor (Pharm.D)',
  guest_faculty: 'Guest Faculty',
};

export default function UserManagement() {
  const { user, ROLES, hasPermission, startImpersonate, stopImpersonate, isImpersonating } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | { type: 'edit', user } | { type: 'copy', user }
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', phone: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const canWrite = hasPermission('users:write');
  const canImpersonate = hasPermission('users:impersonate');

  const load = () => {
    setLoading(true);
    setError('');
    api.auth
      .listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setModal('create');
    setForm({ username: '', password: '', name: '', email: '', phone: '', role: 'staff' });
  };

  const openEdit = (u) => {
    setModal({ type: 'edit', user: u });
    setForm({ username: u.username, name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '', role: u.role ?? 'staff' });
  };

  const openCopy = (u) => {
    setModal({ type: 'copy', user: u });
    setForm({ new_username: `${u.username}_copy`, name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '', password: '' });
  };

  const closeModal = () => {
    setModal(null);
    setSaving(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.username?.trim() && !form.name?.trim()) {
      setError('Username or name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.auth.createUser({
        username: form.username?.trim() || undefined,
        password: form.password || undefined,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
      });
      if (res?.generated_password) {
        toast.success(`User created. Temporary password: ${res.generated_password} (copy it now)`);
      } else {
        toast.success('User created successfully');
      }
      load();
      closeModal();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    if (!modal?.user || !form.new_username?.trim()) {
      setError('New username is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.auth.copyUser(modal.user.id, {
        new_username: form.new_username.trim(),
        password: form.password || undefined,
        name: form.name?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
      });
      if (res?.generated_password) {
        toast.success(`User copied. Password: ${res.generated_password} (copy it now)`);
      } else {
        toast.success('User copied successfully');
      }
      load();
      closeModal();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportUsers = () => {
    const filtered = filteredUsers;
    const headers = ['username', 'name', 'email', 'phone', 'role'];
    const csv = [headers.join(',')].concat(
      filtered.map((u) => headers.map((h) => `"${String(u[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Exported to CSV');
  };

  const filteredUsers = users.filter((u) => {
    const q = (search || '').toLowerCase();
    if (q && !`${u.username} ${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!modal?.user) return;
    setSaving(true);
    setError('');
    try {
      await api.auth.updateUser(modal.user.id, {
        username: form.username.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
      });
      toast.success('User updated successfully');
      load();
      closeModal();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (u) => {
    if (!canWrite) return;
    const next = !u.is_enabled;
    if (!window.confirm(next ? 'Enable this user?' : 'Disable this user? They will not be able to log in.')) return;
    try {
      await api.auth.setUserEnabled(u.id, next);
      toast.success(next ? 'User enabled' : 'User disabled');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUnlock = async (u) => {
    if (!canWrite) return;
    try {
      await api.auth.unlockUser(u.id);
      toast.success(`Account unlocked for ${u.name || u.username}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleImpersonate = (u) => {
    if (!canImpersonate) return;
    if (!window.confirm(`Act as "${u.name || u.username}"? You can stop from the banner or profile.`)) return;
    startImpersonate(u.id);
  };

  if (loading && !users.length) return <p className="loading">Loading users...</p>;

  return (
    <div className="user-management-page">
      <div className="page-header-row">
        <h2 className="page-title">User management</h2>
        <div className="user-mgmt-actions">
          <input
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="user-search-input"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="user-role-filter"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={exportUsers} title="Export to CSV">
            Export
          </button>
          {canWrite && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Create user
            </button>
          )}
        </div>
      </div>

      {isImpersonating && (
        <div className="impersonation-banner">
          <span>Support mode: acting as <strong>{user?.name || user?.username}</strong></span>
          <button type="button" className="btn-sm btn-secondary" onClick={stopImpersonate}>
            Stop impersonating
          </button>
        </div>
      )}

      <FormError message={error} onDismiss={() => setError('')} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              {canWrite && <th>Actions</th>}
              {canImpersonate && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={canWrite && canImpersonate ? 7 : canWrite || canImpersonate ? 6 : 5}>No users</td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.name || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>{ROLE_LABELS[u.role] || u.role}</td>
                  <td>
                    <span className={`status-badge ${u.is_enabled !== false ? 'status-enabled' : 'status-disabled'}`}>
                      {u.is_enabled !== false ? 'Enabled' : 'Disabled'}
                    </span>
                    {u.is_locked && (
                      <span className="status-badge status-locked" title="Account locked after failed attempts">
                        Locked
                      </span>
                    )}
                  </td>
                  {canWrite && (
                    <td>
                      <button type="button" className="btn-sm btn-secondary" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button type="button" className="btn-sm btn-secondary" onClick={() => openCopy(u)} title="Duplicate user">
                        Copy
                      </button>
                      <button
                        type="button"
                        className={`btn-sm ${u.is_enabled !== false ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => toggleEnabled(u)}
                      >
                        {u.is_enabled !== false ? 'Disable' : 'Enable'}
                      </button>
                      {u.is_locked && (
                        <button
                          type="button"
                          className="btn-sm btn-primary"
                          onClick={() => handleUnlock(u)}
                          title="Unlock account"
                        >
                          Unlock
                        </button>
                      )}
                    </td>
                  )}
                  {canImpersonate && (
                    <td>
                      <button
                        type="button"
                        className="btn-sm btn-secondary"
                        onClick={() => handleImpersonate(u)}
                        title="Act as this user (support mode)"
                      >
                        Impersonate
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal === 'create' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create user</h3>
            <p className="form-muted">Username or name required. Password optional (auto-generated).</p>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <label htmlFor="um-name">Full name</label>
                <input
                  id="um-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Used to generate username if left empty"
                  autoComplete="name"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-username">Username</label>
                <input
                  id="um-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="Auto from name if empty"
                  autoComplete="username"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-password">Password</label>
                <input
                  id="um-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Auto-generated if empty"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-name">Full name</label>
                <input
                  id="um-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-email">Email</label>
                <input
                  id="um-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-phone">Phone</label>
                <input
                  id="um-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-role">Role</label>
                <select
                  id="um-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'edit' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit user: {modal.user?.username}</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-row">
                <label htmlFor="um-edit-username">Username</label>
                <input
                  id="um-edit-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-edit-name">Full name</label>
                <input
                  id="um-edit-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-edit-email">Email</label>
                <input
                  id="um-edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-edit-phone">Phone</label>
                <input
                  id="um-edit-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-edit-role">Role</label>
                <select
                  id="um-edit-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
              <p className="form-muted">To change password, use the user’s profile or ask them to change it.</p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'copy' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Copy user: {modal.user?.username}</h3>
            <p className="form-muted">Create a duplicate with a new username. Password optional.</p>
            <form onSubmit={handleCopy}>
              <div className="form-row">
                <label htmlFor="um-copy-username">New username *</label>
                <input
                  id="um-copy-username"
                  type="text"
                  value={form.new_username}
                  onChange={(e) => setForm((f) => ({ ...f, new_username: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-copy-name">Name</label>
                <input
                  id="um-copy-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label htmlFor="um-copy-password">Password</label>
                <input
                  id="um-copy-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Copying…' : 'Copy user'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
