import React, { useState } from 'react';
import api, { getAuthHeaders } from '../api';
import { useToast } from '../context/ToastContext';
import FormError from '../components/FormError';
import './Backup.css';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Backup() {
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setError('');
    setExporting(true);
    try {
      const res = await fetch(`${BASE}/api/settings/backup/export`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(res.statusText || 'Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Backup downloaded');
    } catch (e) {
      setError(e.message || 'Export failed');
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Only .zip backup files allowed');
      return;
    }
    if (!window.confirm('Restore will overwrite existing data. Continue?')) return;
    setError('');
    setRestoring(true);
    try {
      const res = await api.backup.restore(file);
      toast.success(res.message || 'Restore complete');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e.message || 'Restore failed');
      toast.error(e.message);
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="backup-page">
      <h2 className="page-title">Backup & Restore</h2>
      <p className="dashboard-welcome">
        Export all data (JSON + uploads) as a ZIP file, or restore from a previous backup. Super Admin only.
      </p>
      <FormError message={error} onDismiss={() => setError('')} />

      <div className="backup-cards">
        <div className="backup-card card">
          <h3>Export backup</h3>
          <p>Download a complete backup of all data and user photos.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Download backup'}
          </button>
        </div>
        <div className="backup-card card">
          <h3>Restore backup</h3>
          <p>Upload a backup ZIP file. This will overwrite existing data.</p>
          <label className="btn-secondary btn-file">
            <input type="file" accept=".zip" onChange={handleRestore} disabled={restoring} />
            {restoring ? 'Restoring…' : 'Choose file & restore'}
          </label>
        </div>
      </div>
    </div>
  );
}
