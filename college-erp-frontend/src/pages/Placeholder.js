import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { exportToCSV } from '../utils/exportUtils';

const STORAGE_PREFIX = 'erp_page_data_';

function slug(title) {
  if (!title || typeof title !== 'string') return 'default';
  return title
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase() || 'default';
}

function loadList(pageKey) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pageKey);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveList(pageKey, list) {
  try {
    localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(list));
  } catch (_) {}
}

const emptyItem = () => ({
  id: '',
  name: '',
  description: '',
  status: 'Active',
  created: new Date().toISOString(),
});

export default function Placeholder({ title = 'Page', description }) {
  const pageKey = slug(title);
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    setList(loadList(pageKey));
  }, [pageKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setForm({ ...emptyItem(), id: `new_${Date.now()}` });
    setEditId(null);
    setError('');
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
      status: item.status || 'Active',
      created: item.created || new Date().toISOString(),
    });
    setEditId(item.id);
    setError('');
  };

  const save = () => {
    if (!form) return;
    const name = (form.name || '').trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    const next = loadList(pageKey);
    const existing = next.findIndex((r) => String(r.id) === String(form.id));
    const record = {
      id: form.id,
      name,
      description: (form.description || '').trim(),
      status: form.status || 'Active',
      created: form.created || new Date().toISOString(),
    };
    if (existing >= 0) {
      next[existing] = record;
    } else {
      next.push(record);
    }
    saveList(pageKey, next);
    setList(next);
    setForm(null);
    setEditId(null);
    setError('');
  };

  const remove = (id) => {
    if (!window.confirm('Delete this record?')) return;
    const next = loadList(pageKey).filter((r) => String(r.id) !== String(id));
    saveList(pageKey, next);
    setList(next);
    if (form && String(form.id) === String(id)) setForm(null);
    setEditId(null);
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="placeholder-page">
      <div className="page-header">
        <h2 className="page-title">{title}</h2>
        <div className="page-header-actions">
          <button
            type="button"
            onClick={() => exportToCSV(list, `${pageKey}_export.csv`, ['name', 'description', 'status', 'created'])}
            className="btn"
            disabled={list.length === 0}
          >
            Export CSV
          </button>
          <button type="button" onClick={openCreate} className="btn btn-primary">
            Add
          </button>
          <Link to="/" className="btn btn-secondary">Dashboard</Link>
        </div>
      </div>

      {description && <p className="placeholder-description">{description}</p>}

      {error && <p className="form-error">{error}</p>}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)} role="presentation">
          <div className="modal modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit' : 'New'} record</h3>
            <div className="form-grid">
              <div>
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Title or name"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div>
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={save} className="btn btn-primary">Save</button>
              <button type="button" onClick={() => setForm(null)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  No records yet. Click &quot;Add&quot; to create one.
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="cell-desc">{item.description || '—'}</td>
                  <td><span className={`status-badge status-${(item.status || 'Active').toLowerCase()}`}>{item.status || 'Active'}</span></td>
                  <td>{formatDate(item.created)}</td>
                  <td>
                    <button type="button" onClick={() => openEdit(item)} className="btn-sm">Edit</button>
                    <button type="button" onClick={() => remove(item.id)} className="btn-sm btn-danger">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
