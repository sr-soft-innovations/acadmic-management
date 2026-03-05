import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function RolePermissions() {
  const { user, permissionMatrix, hasPermission, refreshPermissions } = useAuth();
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | 'create' | { type: 'edit', role }
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPermissions, setFormPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission('role_management:write');

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.roles.list().then((r) => r.roles || []).catch(() => []),
      api.roles.modules().then((r) => r.modules || []).catch(() => []),
      api.auth.permissions().then((r) => r.matrix || {}).catch(() => ({})),
    ])
      .then(([r, m, mat]) => {
        setRoles(r);
        setModules(m);
        setMatrix(mat);
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setModal('create');
    setFormName('');
    setFormSlug('');
    setFormPermissions([]);
  };

  const openEdit = (role) => {
    setModal({ type: 'edit', role });
    setFormName(role.name || '');
    setFormSlug(role.slug || '');
    let perms = Array.isArray(role.permissions) ? [...role.permissions] : [];
    // Expand module:write to add, edit, delete for display (modules use granular perms)
    const expanded = [];
    for (const p of perms) {
      if (p && p.endsWith(':write')) {
        const prefix = p.slice(0, -6);
        ['add', 'edit', 'delete'].forEach((a) => { if (!expanded.includes(`${prefix}:${a}`)) expanded.push(`${prefix}:${a}`); });
      } else {
        expanded.push(p);
      }
    }
    setFormPermissions(expanded);
  };

  const closeModal = () => {
    setModal(null);
    setSaving(false);
  };

  const togglePermission = (perm) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleAllForModule = (modulePerms, checked) => {
    setFormPermissions((prev) => {
      const next = prev.filter((p) => !modulePerms.includes(p));
      if (checked) return [...next, ...modulePerms];
      return next;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = formName.trim();
    const slug = (formSlug || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!slug) {
      setError('Slug is required');
      return;
    }
    setSaving(true);
    try {
      await api.roles.create({ name: name || slug, slug, permissions: formPermissions });
      closeModal();
      refreshPermissions();
      load();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const roleId = modal?.role?.id;
    if (!roleId) return;
    setSaving(true);
    try {
      await api.roles.update(roleId, {
        name: formName.trim() || modal.role.name,
        permissions: formPermissions,
      });
      closeModal();
      refreshPermissions();
      load();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.roles.delete(role.id);
      refreshPermissions();
      load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const data = matrix || permissionMatrix || {};

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Role & permission management</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Role & permission management</h2>
      <p className="dashboard-welcome">
        Your role: <strong>{user?.role}</strong>. Create roles and assign module permissions; the sidebar and page access are controlled by these permissions.
      </p>
      {error && <div className="form-error" role="alert">{error}</div>}

      {canWrite && (
        <p style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Create role
          </button>
        </p>
      )}

      <section className="table-wrap" style={{ marginBottom: '2rem' }}>
        <h3>Roles</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Permissions</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td><code>{role.slug}</code></td>
                <td>
                  {Array.isArray(role.permissions) && role.permissions.length > 0 ? (
                    role.permissions.includes('*') ? 'All' : role.permissions.join(', ')
                  ) : (
                    '—'
                  )}
                </td>
                {canWrite && (
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => openEdit(role)}>Edit</button>
                    {' '}
                    <button type="button" className="btn btn-small btn-danger" onClick={() => handleDelete(role)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-wrap">
        <h3>Permission matrix (by role)</h3>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>
                  {Array.isArray(data[role.slug]) ? (
                    data[role.slug].includes('*') ? 'All' : data[role.slug].join(', ')
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'create' ? 'Create role' : 'Edit role & permissions'}</h3>
            <form
              onSubmit={modal === 'create' ? handleCreate : handleUpdate}
              className="form-grid"
            >
              <div>
                <label>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Display name"
                />
              </div>
              {modal === 'create' && (
                <div>
                  <label>Slug</label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. department_head"
                  />
                </div>
              )}
              {modal !== 'create' && <div />}

              <div style={{ gridColumn: '1 / -1' }}>
                <label>Module permissions</label>
                <div className="permission-checkboxes">
                  {modules.map((mod) => {
                    const perms = mod.permissions || [];
                    const allChecked = perms.length > 0 && perms.every((p) => formPermissions.includes(p));
                    const someChecked = perms.some((p) => formPermissions.includes(p));
                    return (
                      <div key={mod.id} className="permission-module">
                        <label className="permission-module-label">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = Boolean(someChecked && !allChecked);
                            }}
                            onChange={(e) => toggleAllForModule(perms, e.target.checked)}
                          />
                          {mod.label}
                        </label>
                        <div className="permission-actions">
                          {perms.map((perm) => {
                            const action = perm.split(':')[1] || perm;
                            const label = { read: 'View', add: 'Add', edit: 'Edit', delete: 'Delete', write: 'All' }[action] || action;
                            return (
                              <label key={perm} className="permission-action-label">
                                <input
                                  type="checkbox"
                                  checked={formPermissions.includes(perm)}
                                  onChange={() => togglePermission(perm)}
                                />
                                {label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : modal === 'create' ? 'Create' : 'Save'}
                </button>
                <button type="button" className="btn" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
